import { getAgentDir } from "@earendil-works/pi-coding-agent";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createPiWardenRuntime, type GateRuntimeOptions, type PiRuntimeAPI } from "./gate/runtime.ts";

/**
 * Thin pi-warden entry point. Trusted host inputs (the Pi agent directory via
 * Pi's own supported `getAgentDir()` API) are resolved here — never from
 * repository, model, session, or tool-output data — and the central runtime is
 * created. No policy decision is made in this file.
 */
export default async function piWarden(pi: ExtensionAPI): Promise<void> {
  const options = await buildRuntimeOptions();
  // The runtime's structural Pi subset is a subset of ExtensionAPI; the cast is
  // confined to this thin boundary and verified by integration tests.
  createPiWardenRuntime(pi as unknown as PiRuntimeAPI, options);
}

/**
 * Computes trusted runtime inputs. If the Pi agent directory cannot be
 * resolved through the current process (for example, a missing directory), a
 * lexical absolute fallback is registered so a control-plane zone still exists;
 * canonical roots are preferred and the extension host that loaded this module
 * supplies the argv/cwd context.
 */
async function buildRuntimeOptions(): Promise<GateRuntimeOptions> {
  const agentDir = getAgentDir();
  let canonicalRoot = path.resolve(agentDir);
  try {
    const { realpath } = await import("node:fs/promises");
    const { lstat } = await import("node:fs/promises");
    const direct = await lstat(agentDir);
    if (!direct.isSymbolicLink()) {
      canonicalRoot = await realpath(agentDir);
    }
  } catch {
    // Keep the lexical absolute root when the directory cannot be canonicalized.
  }
  return {
    trustedUserConfigRoot: agentDir,
    protectedRoots: [{ name: "pi-warden-agent-dir", canonicalRoot }],
  };
}
