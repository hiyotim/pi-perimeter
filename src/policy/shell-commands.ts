/**
 * Fixed command-risk tables for the bounded shell grammar.
 *
 * These tables are compiled into the repository as constants. They are never
 * read from the workspace, configuration, model output, or any other
 * untrusted source, and they make no authorization decision by themselves:
 * `shell-policy.ts` joins their outcome with the loaded policy contributions.
 *
 * The tables exist because the profile alone cannot tell the user what a
 * command is *about*. Risk classes therefore drive approval requirements and
 * explicit refusals; containment remains the enforcement boundary. An `ALLOW`
 * effective outcome never waives a stronger class.
 */

export type ShellCommandRisk =
  | "ordinary"
  | "unknown"
  | "destructive"
  | "network"
  | "privilege"
  | "system"
  | "credential"
  | "publish"
  | "unsupported-builtin";

const ORDINARY = new Set([
  "cd",
  "pwd",
  "ls",
  "cat",
  "head",
  "tail",
  "wc",
  "grep",
  "rg",
  "egrep",
  "fgrep",
  "find",
  "sort",
  "uniq",
  "cut",
  "tr",
  "diff",
  "cmp",
  "echo",
  "printf",
  "true",
  "false",
  "test",
  "[",
  ":",
  "export",
  "set",
  "unset",
  "shift",
  "umask",
  "read",
  "mkdir",
  "touch",
  "cp",
  "ln",
  "chmod",
  "stat",
  "file",
  "basename",
  "dirname",
  "realpath",
  "readlink",
  "which",
  "type",
  "date",
  "sleep",
  "seq",
  "tee",
  "sed",
  "awk",
  "node",
  "npm",
  "tsc",
  "eslint",
  "prettier",
  "make",
  "cmake",
  "cc",
  "clang",
  "gcc",
  "python3",
  "jq",
  "git",
  "source",
  ".",
  "bash",
  "sh",
]);

const DESTRUCTIVE = new Set([
  "rm",
  "rmdir",
  "mv",
  "dd",
  "truncate",
  "shred",
  "chown",
  "chflags",
  "srm",
]);

const NETWORK = new Set([
  "curl",
  "wget",
  "nc",
  "ncat",
  "netcat",
  "ssh",
  "scp",
  "sftp",
  "telnet",
  "ftp",
  "rsync",
  "socat",
  "dig",
  "nslookup",
  "host",
  "ping",
  "ping6",
  "traceroute",
  "tcpdump",
  "nmap",
  "route",
  "netstat",
  "openssl",
  "pip",
  "pip3",
  "brew",
  "port",
  "gem",
  "cargo",
  "go",
  "rustup",
]);

const PRIVILEGE = new Set([
  "sudo",
  "sudoedit",
  "su",
  "doas",
  "chroot",
  "runas",
  "dseditgroup",
]);

const SYSTEM = new Set([
  "launchctl",
  "crontab",
  "at",
  "atq",
  "atrm",
  "defaults",
  "scutil",
  "nvram",
  "csrutil",
  "spctl",
  "softwareupdate",
  "installer",
  "networksetup",
  "diskutil",
  "mount",
  "umount",
  "kextload",
  "kextutil",
  "kextunload",
  "pmset",
  "shutdown",
  "reboot",
  "halt",
  "kill",
  "killall",
  "pkill",
  "sysctl",
  "dscl",
  "dscacheutil",
  "systemsetup",
  "bless",
  "asr",
  "hdiutil",
  "spindump",
  "log",
  "open",
  "osascript",
  "launchd",
  "sw_vers",
  "system_profiler",
]);

const CREDENTIAL = new Set([
  "security",
  "securityd",
  "keychain",
  "ssh-keygen",
  "ssh-add",
  "security-find-generic-password",
  "gpg",
  "gpg2",
]);

const PUBLISH = new Set([
  "gh",
  "docker",
  "podman",
  "kubectl",
  "helm",
  "terraform",
  "aws",
  "gcloud",
  "az",
  "vercel",
  "netlify",
  "flyctl",
  "heroku",
  "wrangler",
  "npm-publish",
  "hub",
]);

const UNSUPPORTED_BUILTINS = new Set([
  "eval",
  "exec",
  "trap",
  "alias",
  "unalias",
  "declare",
  "typeset",
  "local",
  "let",
  "builtin",
  "enable",
  "fc",
  "history",
  "jobs",
  "fg",
  "bg",
  "wait",
  "disown",
  "ulimit",
  "mapfile",
  "readarray",
  "complete",
  "compgen",
  "caller",
  "getopts",
  "hash",
]);

/** Script suffixes that mark a direct script execution when used as a path. */
const SCRIPT_SUFFIXES = [".sh", ".bash", ".zsh", ".py", ".pl", ".rb", ".js", ".mjs", ".cjs", ".ts"];

const RISK_ORDER: Readonly<Record<ShellCommandRisk, number>> = Object.freeze({
  ordinary: 0,
  unknown: 1,
  destructive: 2,
  network: 3,
  privilege: 3,
  system: 3,
  credential: 3,
  publish: 3,
  "unsupported-builtin": 3,
});

export function strictestShellRisk(
  left: ShellCommandRisk,
  right: ShellCommandRisk,
): ShellCommandRisk {
  return RISK_ORDER[right] > RISK_ORDER[left] ? right : left;
}

/** True when the class cannot run under any effective outcome. */
export function isDeniedRisk(risk: ShellCommandRisk): boolean {
  return RISK_ORDER[risk] == 3;
}

export interface CommandNameClassification {
  readonly risk: ShellCommandRisk;
  /** Basename actually looked up, when the word was a path or wrapper. */
  readonly lookedUp: string;
  readonly reason: string;
}

/**
 * Classifies one command word. A path-shaped command is classified by its
 * basename, except that direct execution of a script file by its own path is
 * refused outright: there is no bound-bytes execution for that form.
 */
export function classifyCommandName(rawName: string): CommandNameClassification {
  const name = rawName;
  if (name.length === 0) {
    return { risk: "unknown", lookedUp: name, reason: "empty command name" };
  }
  const hasSeparator = name.includes("/");
  const lower = name.toLowerCase();
  if (hasSeparator) {
    const base = name.slice(name.lastIndexOf("/") + 1);
    const lowerBase = base.toLowerCase();
    if (
      !name.startsWith("/") ||
      name.startsWith("./") ||
      name.startsWith("../") ||
      SCRIPT_SUFFIXES.some((suffix) => lowerBase.endsWith(suffix))
    ) {
      return {
        risk: "unsupported-builtin",
        lookedUp: base,
        reason: "execution of a workspace object by its own path is unsupported",
      };
    }
    return classifyBasename(base);
  }
  if (SCRIPT_SUFFIXES.some((suffix) => lower.endsWith(suffix))) {
    return {
      risk: "unsupported-builtin",
      lookedUp: name,
      reason: "direct execution of a script by path is unsupported",
    };
  }
  return classifyBasename(name);
}

function classifyBasename(base: string): CommandNameClassification {
  const lowered = base.toLowerCase();
  if (UNSUPPORTED_BUILTINS.has(lowered)) {
    return { risk: "unsupported-builtin", lookedUp: basenameOf(base), reason: `shell builtin ${base} is unsupported` };
  }
  if (PRIVILEGE.has(lowered)) {
    return { risk: "privilege", lookedUp: basenameOf(base), reason: "privilege escalation is denied" };
  }
  if (SYSTEM.has(lowered)) {
    return { risk: "system", lookedUp: basenameOf(base), reason: "system-level command is denied" };
  }
  if (CREDENTIAL.has(lowered)) {
    return { risk: "credential", lookedUp: basenameOf(base), reason: "credential tool is denied" };
  }
  if (PUBLISH.has(lowered)) {
    return { risk: "publish", lookedUp: basenameOf(base), reason: "publish/deploy command is denied" };
  }
  if (NETWORK.has(lowered)) {
    return { risk: "network", lookedUp: basenameOf(base), reason: "network command is denied (networking is closed)" };
  }
  if (WRAPPER_NAMES.has(lowered)) {
    // A wrapper reached by a path spelling that was not unwrapped (for example
    // a toolchain-local `env`) must not pass as an ordinary tool: the wrapped
    // command line would then run unclassified.
    return {
      risk: "unknown",
      lookedUp: basenameOf(base),
      reason: `${base} is a command runner reached by path; approval required`,
    };
  }
  if (DESTRUCTIVE.has(lowered)) {
    return { risk: "destructive", lookedUp: basenameOf(base), reason: "destructive command requires approval" };
  }
  if (ORDINARY.has(lowered)) {
    return { risk: "ordinary", lookedUp: basenameOf(base), reason: "listed local development command" };
  }
  return { risk: "unknown", lookedUp: basenameOf(base), reason: "unknown command requires approval" };
}

function basenameOf(value: string): string {
  const index = value.lastIndexOf("/");
  return index === -1 ? value : value.slice(index + 1);
}

/** Command runners that execute their remaining arguments. */
export const WRAPPER_NAMES: ReadonlySet<string> = Object.freeze(new Set(["env", "command", "timeout", "gtimeout"]));

/** Command names whose remaining words form a new command line to classify. */
export const COMMAND_WRAPPERS: readonly string[] = Object.freeze(["command", "env"]);

/**
 * Subcommand rules for dispatcher commands. A bounded list of first-argument
 * values is inspected so that `npm run check` stays ordinary while
 * `npm publish` and `git push` are classified by what they actually do.
 * A subcommand that is not in the table is a refusal, never the dispatcher's
 * base class: the base class of `git`/`npm` is ordinary, which would silently
 * downgrade an unlisted subcommand.
 */
const SUBCOMMAND_RULES: Readonly<Record<string, Readonly<Record<string, ShellCommandRisk>>>> = Object.freeze({
  npm: Object.freeze({
    publish: "publish",
    unpublish: "publish",
    deprecate: "publish",
    owner: "publish",
    access: "publish",
    token: "credential",
    login: "credential",
    adduser: "credential",
    install: "network",
    i: "network",
    ci: "network",
    add: "network",
    update: "network",
    upgrade: "network",
    create: "network",
    init: "network",
    x: "unknown",
    exec: "unknown",
    up: "network",
    ins: "network",
    insta: "network",
    s: "network",
    se: "network",
    search: "network",
    pub: "publish",
    unp: "publish",
    tok: "credential",
    docs: "network",
    home: "network",
    repo: "network",
    bugs: "network",
    view: "network",
    info: "network",
    show: "network",
    whoami: "network",
    ping: "network",
    star: "network",
    outdated: "network",
    audit: "network",
    cache: "unknown",
    fund: "network",
    link: "network",
    pack: "network",
    prune: "ordinary",
    run: "ordinary",
    test: "ordinary",
    t: "ordinary",
    start: "ordinary",
    stop: "ordinary",
    ls: "ordinary",
    list: "ordinary",
    ll: "ordinary",
    la: "ordinary",
    explain: "ordinary",
  }),
  yarn: Object.freeze({ publish: "publish", add: "network", install: "network", run: "ordinary", test: "ordinary" }),
  pnpm: Object.freeze({ publish: "publish", add: "network", install: "network", run: "ordinary", test: "ordinary" }),
  git: Object.freeze({
    push: "publish",
    clone: "network",
    fetch: "network",
    pull: "network",
    "ls-remote": "network",
    submodule: "network",
    daemon: "network",
    "send-email": "network",
    "imap-send": "network",
    svn: "network",
    "fetch-pack": "network",
    "send-pack": "network",
    p4: "network",
    credential: "credential",
    "credential-helper": "credential",
    clean: "destructive",
    reset: "destructive",
    rm: "destructive",
    mv: "destructive",
    gc: "destructive",
    prune: "destructive",
    status: "ordinary",
    diff: "ordinary",
    log: "ordinary",
    show: "ordinary",
    branch: "ordinary",
    add: "ordinary",
    commit: "ordinary",
    checkout: "ordinary",
    switch: "ordinary",
    restore: "ordinary",
    stash: "ordinary",
    tag: "ordinary",
    "rev-parse": "ordinary",
    config: "ordinary",
    describe: "ordinary",
    blame: "ordinary",
    grep: "ordinary",
    "ls-files": "ordinary",
    "ls-tree": "ordinary",
    worktree: "ordinary",
    "merge-base": "ordinary",
    shortlog: "ordinary",
    reflog: "ordinary",
    remote: "ordinary",
    "remote-update": "network",
    init: "ordinary",
    apply: "ordinary",
    am: "ordinary",
    "cherry-pick": "ordinary",
    rebase: "ordinary",
    merge: "ordinary",
    revert: "ordinary",
    version: "ordinary",
    help: "ordinary",
    archive: "ordinary",
  }),
  docker: Object.freeze({ push: "publish", pull: "network", login: "credential" }),
  gh: Object.freeze({ auth: "credential", api: "network" }),
  kubectl: Object.freeze({ apply: "publish", delete: "publish", create: "publish", edit: "publish" }),
  terraform: Object.freeze({ apply: "publish", destroy: "publish", init: "network", plan: "ordinary" }),
});

/**
 * Flags that take a separate value. A flag before the subcommand whose value
 * is not consumed would move the subcommand to the wrong word, so these are
 * skipped explicitly.
 */
const DISPATCHER_VALUE_FLAGS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  npm: Object.freeze(["-C", "--prefix", "--userconfig", "--cache", "--registry", "--omit", "-w", "--workspace", "--loglevel"]),
  yarn: Object.freeze(["--cwd", "--cache-folder", "--registry"]),
  pnpm: Object.freeze(["-C", "--dir", "--registry", "--filter"]),
  git: Object.freeze(["-c", "-C", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env"]),
  docker: Object.freeze(["-H", "--host", "--context", "--config", "--log-level"]),
  gh: Object.freeze(["-R", "--repo", "--hostname"]),
  kubectl: Object.freeze(["--kubeconfig", "--context", "-n", "--namespace", "--cluster"]),
  terraform: Object.freeze(["-chdir"]),
});

/** Flags that are known not to take a value for the listed dispatchers. */
const DISPATCHER_BOOLEAN_FLAGS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  npm: Object.freeze(["--silent", "-s", "--verbose", "--quiet", "-q", "--json", "--global", "-g", "--help", "-h", "--version", "-v", "--dry-run"]),
  yarn: Object.freeze(["--silent", "--verbose", "--json", "--help", "-h", "--version", "-v"]),
  pnpm: Object.freeze(["--silent", "--reporter", "--help", "-h", "--version", "-v"]),
  git: Object.freeze(["--no-pager", "--paginate", "-p", "--bare", "--version", "--help", "-h", "--no-replace-objects"]),
  docker: Object.freeze(["--debug", "-D", "--help", "-h", "--version", "-v", "--tls"]),
  gh: Object.freeze(["--help", "-h", "--version"]),
  kubectl: Object.freeze(["--help", "-h", "--version", "--warnings"]),
  terraform: Object.freeze(["-help", "-h", "-version", "-v"]),
});

/** True for a word a duration-style command runner accepts as its duration. */
export function isTimeoutDuration(value: string): boolean {
  return /^[0-9]+(\.[0-9]+)?[smhd]?$/.test(value);
}

/**
 * Positional words of a dispatcher invocation: flags, their values and
 * `--flag=value` forms are skipped so that a later rule sees the same words a
 * shell would treat as operands. Returns a refusal when a flag whose value is
 * unknown appears before a positional word.
 */
function positionalDispatcherWords(
  lookedUp: string,
  args: readonly string[],
): { readonly words: readonly string[] } | { readonly refusal: string } {
  const valueFlags = DISPATCHER_VALUE_FLAGS[lookedUp.toLowerCase()] ?? [];
  const booleanFlags = DISPATCHER_BOOLEAN_FLAGS[lookedUp.toLowerCase()] ?? [];
  const words: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument.length === 0) continue;
    if (argument === "--") continue;
    if (argument.startsWith("-")) {
      const inlineFlag = argument.startsWith("--") && argument.includes("=")
        ? argument.slice(0, argument.indexOf("="))
        : undefined;
      if (inlineFlag !== undefined && (valueFlags.includes(inlineFlag) || booleanFlags.includes(inlineFlag))) {
        continue;
      }
      if (valueFlags.includes(argument)) {
        index += 1;
        continue;
      }
      if (booleanFlags.includes(argument)) continue;
      if (words.length === 0) {
        return {
          refusal: `${lookedUp} flag ${JSON.stringify(argument)} before the subcommand is not recognized, so the subcommand cannot be classified`,
        };
      }
      continue;
    }
    words.push(argument.toLowerCase());
  }
  return { words };
}

/**
 * Classifies a dispatcher invocation by its subcommand. Returns undefined when
 * the command has no subcommand rule or no subcommand, and a refusal string
 * when a flag whose value is not recognized could hide the subcommand.
 */
export function classifyCommandSubcommand(
  lookedUp: string,
  args: readonly string[],
): ShellCommandRisk | { readonly refusal: string } | undefined {
  const rules = SUBCOMMAND_RULES[lookedUp.toLowerCase()];
  if (rules === undefined) return undefined;
  const positional = positionalDispatcherWords(lookedUp, args);
  if ("refusal" in positional) return positional;
  const subcommand = positional.words[0];
  if (subcommand === undefined) return undefined;
  const risk = rules[subcommand];
  if (risk === undefined) {
    return {
      refusal: `${lookedUp} subcommand ${JSON.stringify(subcommand)} is not in the supported table, so it cannot be classified`,
    };
  }
  return risk;
}

/**
 * True for dispatcher names whose arguments must be inspected before the
 * invocation may be treated as a plain command.
 */
export function isDispatcherCommand(lookedUp: string): boolean {
  return Object.prototype.hasOwnProperty.call(SUBCOMMAND_RULES, lookedUp.toLowerCase());
}

/** True when a word is a known boolean or value flag for a dispatcher. */
export function isKnownDispatcherFlag(lookedUp: string, flag: string): boolean {
  const valueFlags = DISPATCHER_VALUE_FLAGS[lookedUp.toLowerCase()] ?? [];
  const booleanFlags = DISPATCHER_BOOLEAN_FLAGS[lookedUp.toLowerCase()] ?? [];
  return valueFlags.includes(flag) || booleanFlags.includes(flag);
}

/**
 * Risk contributed by arguments that turn an otherwise ordinary tool into a
 * command runner. The bounded parser does not parse descendant programs, so a
 * construct that spawns one is classified conservatively (approval required)
 * instead of being treated as the tool's own class.
 */
interface ArgumentTriggeredRule {
  readonly flag: string;
  readonly risk: ShellCommandRisk;
  readonly reason: string;
}

const ARGUMENT_TRIGGERED_RISK: Readonly<Record<string, readonly ArgumentTriggeredRule[]>> = Object.freeze({
  find: Object.freeze<ArgumentTriggeredRule[]>([
    { flag: "-exec", risk: "unknown", reason: "find -exec runs another command" },
    { flag: "-execdir", risk: "unknown", reason: "find -execdir runs another command" },
    { flag: "-ok", risk: "unknown", reason: "find -ok runs another command" },
    { flag: "-okdir", risk: "unknown", reason: "find -okdir runs another command" },
    { flag: "-delete", risk: "destructive", reason: "find -delete removes entries" },
    { flag: "-fprint", risk: "unknown", reason: "find -fprint writes files" },
    { flag: "-fprint0", risk: "unknown", reason: "find -fprint0 writes files" },
    { flag: "-fls", risk: "unknown", reason: "find -fls writes files" },
  ]),
  tar: Object.freeze<ArgumentTriggeredRule[]>([
    { flag: "-x", risk: "unknown", reason: "tar extraction writes files" },
    { flag: "--extract", risk: "unknown", reason: "tar extraction writes files" },
  ]),
  git: Object.freeze<ArgumentTriggeredRule[]>([
    { flag: "--remote", risk: "network", reason: "git --remote fetches from a remote repository" },
  ]),
});

/** Argument-triggered risk for one dispatcher-like command, if any. */
export function argumentTriggeredRisk(
  lookedUp: string,
  args: readonly string[],
): { readonly risk: ShellCommandRisk; readonly reason: string } | undefined {
  const rules = ARGUMENT_TRIGGERED_RISK[lookedUp.toLowerCase()];
  if (rules === undefined) return undefined;
  for (const argument of args) {
    for (const rule of rules) {
      if (argument === rule.flag || argument.startsWith(`${rule.flag}=`)) {
        return { risk: rule.risk, reason: rule.reason };
      }
    }
  }
  return undefined;
}

/**
 * Subcommand second-word rules for the few dispatchers whose subcommands take
 * a further verb that reaches the network (`git remote update`, `git remote
 * prune`). Anything not listed keeps the subcommand's own class.
 */
const SECOND_WORD_RULES: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, ShellCommandRisk>>>>>> =
  Object.freeze({
    git: Object.freeze({
      remote: Object.freeze({
        update: "network",
        prune: "network",
        "set-head": "network",
        show: "network",
      }),
    }),
  });

/** Second-word risk for one dispatcher subcommand, if a rule exists. */
export function secondWordRisk(
  lookedUp: string,
  args: readonly string[],
): ShellCommandRisk | undefined {
  const rules = SECOND_WORD_RULES[lookedUp.toLowerCase()];
  if (rules === undefined) return undefined;
  // The same positional-word walk as the subcommand rule, so a preceding
  // value flag (`git -c x=y remote update`) cannot hide the subcommand verb.
  const positional = positionalDispatcherWords(lookedUp, args);
  if ("refusal" in positional) return undefined;
  const words = positional.words;
  if (words.length < 2) return undefined;
  const subcommandRules = rules[words[0]];
  if (subcommandRules === undefined) return undefined;
  const direct = subcommandRules[words[1]];
  if (direct !== undefined) return direct;
  // `git remote add -f <name> <url>` fetches immediately; the same flag on
  // other subcommands (for example `git add -f`) stays local.
  if (
    lookedUp.toLowerCase() === "git" &&
    words[0] === "remote" &&
    words[1] === "add" &&
    (args.includes("-f") || args.includes("--fetch"))
  ) {
    return "network";
  }
  return undefined;
}
