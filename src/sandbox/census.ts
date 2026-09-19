/**
 * Invocation process census.
 *
 * Detects processes that belong to one contained invocation so that a
 * survivor can be killed and can refuse the export. On macOS an unprivileged
 * observer cannot prove that no descendant remains (there is no session id and
 * no surviving lineage once a descendant is reparented), so this module is a
 * *gate*, not a proof: it attributes what it can observe, kills what it
 * attributes, and refuses the export while any attributed process is alive.
 *
 * Attribution rules, evaluated per sample:
 *   - the process group of the entry process, or
 *   - its parent is the entry process, or
 *   - its parent is already attributed (transitive within the sample).
 * Recorded processes are compared by pid *and* start time so that pid reuse
 * cannot make a dead process look alive.
 *
 * What it cannot see is declared in `docs/SHELL-GATE.md`: a descendant that
 * calls `setsid()` and is reparented between two samples leaves no lineage to
 * follow. The export's integrity does not depend on closing that window — the
 * scanned and applied source is a frozen copy outside every path the profile
 * grants (see `freezeProjection`).
 */

import { spawn } from "node:child_process";

import { ShellRefusal } from "./errors.ts";

export const CENSUS_LIMITS = Object.freeze({
  /** Sampling period while the entry process is alive. */
  sampleIntervalMs: 250,
  /** Samples are text; this bounds one helper invocation. */
  maxOutputBytes: 4 * 1024 * 1024,
  timeoutMs: 10_000,
});

export interface ProcessRecord {
  readonly pid: number;
  readonly ppid: number;
  readonly pgid: number;
  readonly uid: number;
  readonly startSec: number;
  readonly startUsec: number;
}

export type ProcessTable = ReadonlyMap<number, ProcessRecord>;

function sameProcess(left: ProcessRecord, right: ProcessRecord): boolean {
  return left.startSec === right.startSec && left.startUsec === right.startUsec;
}

function parseCensusOutput(text: string): ProcessTable {
  const table = new Map<number, ProcessRecord>();
  for (const line of text.split("\n")) {
    if (!line.startsWith("PROC ")) continue;
    const fields = line.slice(5).split(" ");
    if (fields.length !== 6) continue;
    // Fields are decimal integers from the kernel; anything else (hex, float,
    // sign, empty) is not a process record and is skipped.
    if (!fields.every((value) => /^[0-9]+$/.test(value))) continue;
    const [pid, ppid, pgid, uid, startSec, startUsec] = fields.map((value) => Number(value));
    table.set(pid, Object.freeze({ pid, ppid, pgid, uid, startSec, startUsec }));
  }
  return table;
}

/** One process-table sample, obtained through the audited helper. */
export async function sampleProcessTable(helperPath: string): Promise<ProcessTable> {
  return await new Promise<ProcessTable>((resolve, reject) => {
    const child = spawn(helperPath, ["census"], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (outcome: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      outcome();
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new ShellRefusal("QUIESCENCE_NOT_ESTABLISHED", "process census timed out")));
    }, CENSUS_LIMITS.timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
      if (stdout.length > CENSUS_LIMITS.maxOutputBytes) {
        child.kill("SIGKILL");
        finish(() => reject(new ShellRefusal("QUIESCENCE_NOT_ESTABLISHED", "process census output exceeded its bound")));
        return;
      }
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      if (stderr.length < 4096) stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      finish(() =>
        reject(new ShellRefusal("QUIESCENCE_NOT_ESTABLISHED", `process census could not run: ${error.message}`)),
      );
    });
    child.on("close", (code) => {
      if (code !== 0) {
        finish(() =>
          reject(
            new ShellRefusal(
              "QUIESCENCE_NOT_ESTABLISHED",
              `process census refused (exit ${code}): ${stderr.trim().split("\n").pop() ?? "unknown reason"}`,
            ),
          ),
        );
        return;
      }
      finish(() => resolve(parseCensusOutput(stdout)));
    });
  });
}

/**
 * Processes in one sample that belong to the invocation. `attributed` carries
 * the pids recorded so far so that a process whose parent was attributed in an
 * earlier sample stays attributed even after its parent exited.
 */
export function attributeInvocationProcesses(
  table: ProcessTable,
  options: { readonly entryPid: number; readonly processGroupId: number },
): readonly ProcessRecord[] {
  const attributed = new Set<number>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const [pid, record] of table) {
      if (attributed.has(pid)) continue;
      const isGroupMember = record.pgid === options.processGroupId && options.processGroupId > 0;
      const isChildOfEntry = record.ppid === options.entryPid && options.entryPid > 0;
      const isChildOfAttributed = attributed.has(record.ppid);
      if (isGroupMember || isChildOfEntry || isChildOfAttributed) {
        attributed.add(pid);
        grew = true;
      }
    }
  }
  // Never attribute the host's own processes (the shell that runs pi-warden).
  attributed.delete(process.pid);
  const records: ProcessRecord[] = [];
  for (const pid of attributed) {
    const record = table.get(pid);
    if (record !== undefined) records.push(record);
  }
  return Object.freeze(records);
}

/**
 * Invocation processes that are still alive in a later sample. Identity is
 * (pid, start time), so a reused pid is not reported as a survivor.
 */
export function survivingInvocationProcesses(
  recorded: Iterable<ProcessRecord>,
  table: ProcessTable,
): readonly ProcessRecord[] {
  const survivors: ProcessRecord[] = [];
  for (const record of recorded) {
    const current = table.get(record.pid);
    if (current !== undefined && sameProcess(current, record)) survivors.push(current);
  }
  return Object.freeze(survivors);
}

export interface CensusWatch {
  /** Every process ever attributed to the invocation, keyed by pid. */
  readonly recorded: Map<number, ProcessRecord>;
  /** Samples the current table and folds any new attribution in. */
  sample(): Promise<ProcessTable>;
  stop(): void;
}

/**
 * Periodically samples the process table while the entry process runs, so a
 * descendant that leaves the process group is still attributed while its
 * lineage is observable.
 */
export function startCensusWatch(options: {
  readonly helperPath: string;
  readonly entryPid: number;
  readonly processGroupId: number;
  readonly intervalMs?: number;
}): CensusWatch {
  const recorded = new Map<number, ProcessRecord>();
  const intervalMs = options.intervalMs ?? CENSUS_LIMITS.sampleIntervalMs;
  let stopped = false;
  let inFlight = false;

  const sample = async (): Promise<ProcessTable> => {
    const table = await sampleProcessTable(options.helperPath);
    for (const record of attributeInvocationProcesses(table, {
      entryPid: options.entryPid,
      processGroupId: options.processGroupId,
    })) {
      recorded.set(record.pid, record);
    }
    return table;
  };

  const timer = setInterval(() => {
    if (stopped || inFlight) return;
    inFlight = true;
    void sample()
      .catch(() => undefined)
      .finally(() => {
        inFlight = false;
      });
  }, intervalMs);
  timer.unref?.();

  return {
    recorded,
    sample,
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}
