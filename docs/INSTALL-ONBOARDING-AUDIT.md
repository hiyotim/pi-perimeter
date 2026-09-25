# Install onboarding audit

Task ID: `20260925-user-install-onboarding`. Baseline: `b308ed8b8ab1526e5b8287032e56867829279ce3` on `main` (local main 2 commits ahead of `origin/main`; nothing pushed, tagged, or published by this Goal).

## Pi 0.84.4 package-manager contract

Installed peer `@earendil-works/pi-coding-agent@0.84.4` bytes (verified in this tree):

- Commands: `pi install <source>`, `pi list`, `pi remove <source>` (alias `pi uninstall`): `dist/package-manager-cli.js` `handlePackageCommand` at `:747`, install branch at `:824-827`, remove branch at `:828-837`, list branch at `:838-868`; usage strings at `:204-211`, `:231-265`; alias normalization at `:308-311`. User docs: `docs/packages.md` Install and Manage at `:18-43`.
- `pi install npm:<name>@<version>` runs `npm install <spec> --prefix <agentDir>/npm --legacy-peer-deps`: `dist/core/package-manager.js` `getNpmInstallArgs` at `:1459-1479` (npm args at `:1479`), `installNpm` at `:1481-1484`, `getNpmInstallRoot` at `:1684-1693` (user root `<agentDir>/npm` at `:1692`), `ensureNpmProject` at `:1663-1674`.
- `pi remove npm:<name>` runs `npm uninstall <name> --prefix <agentDir>/npm --legacy-peer-deps` and removes the settings entry: `uninstallNpm` at `:1486-1500` (args at `:1496-1499`), `removeAndPersist` at `:810-812`, `removeSourceFromSettings` at `:649-665`.
- `pi list` prints `npm:<name>@<version>` and, indented on the next line, the installed root (`<agentDir>/npm/node_modules/<name>`): list formatting at `:846-852`; managed npm path at `:1723-1731` (`getManagedNpmInstallPath`); `getInstalledPath` at `:666-682`.
- `<agentDir>` is `PI_CODING_AGENT_DIR` when set: `dist/config.js` `getAgentDir` at `:420-426` (`ENV_AGENT_DIR` at `:404-406`).

## Isolated exercise outcomes

`test/user-install-onboarding.test.ts` runs one isolated cycle (synthetic loopback registry in-process, isolated `HOME`/`TMPDIR`/`PI_CODING_AGENT_DIR`/npm caches; fixture removed in `finally`; server closed in `finally`):

- `npm pack` the source tree (isolated pack cache), then serve its bytes from a `node:http` server on `127.0.0.1:0`: `GET /pi-perimeter` returns a minimal packument with the packed version, tarball URL, `shasum`, and `integrity`; `GET /pi-perimeter/-/pi-perimeter-<version>.tgz` returns the packed bytes.
- Pi CLI invoked directly (`process.execPath` + `dist/bundle/cli.js`) with `npm_config_registry` pointed at the loopback server and a separate install cache, via asynchronous `spawn` (the server cannot answer under `spawnSync`).
- Observed: `pi install npm:pi-perimeter@<packed>` exit 0; `agent/settings.json` contains `{"packages":["npm:pi-perimeter@<packed>"]}`; installed root `<agentDir>/npm/node_modules/pi-perimeter` exists with matching `package.json` version; both registry requests observed (`GET /pi-perimeter` and `GET /pi-perimeter/-/*.tgz`), so the result is not a cache replay.
- `pi list` exit 0 prints both the source and the installed root; the reported root equals `<agentDir>/npm/node_modules/pi-perimeter`.
- On the declared target only (`darwin`/`arm64`/Darwin major `27`, inner `if`), `npm --prefix <reported root> run build:native` exit 0 and `native/build-manifest.json` exists under that root, proving the reported root is the explicit build root.
- `pi remove npm:pi-perimeter` exit 0; settings no longer list the package; the installed directory is gone.
- Peer guard: the test asserts the installed peer version is exactly `0.84.4` before exercising the route.

## Three routes

- Synthetic-registry Pi package-manager route (this Goal): proves Pi `0.84.4` installs, lists (with root), and removes the packed candidate through its own CLI in isolation. It does not prove a published registry artifact and does not prove runtime gate behavior.
- Manual packed-source runtime smoke (`test/startup-readiness.test.ts`): packs the source, installs the tarball manually into `<agentDir>/npm` with a settings entry, and checks loader errors, tool ownership, `.env` denial, ordinary read, missing-helper refusal, and (on the declared target) helper build plus contained shell. It does not use `pi install` and does not prove a published artifact.
- Published `1.0.0` / corrected version: `pi-perimeter@1.0.0` is the only published version and fails at factory load in Pi `0.84.4`; no corrected version is published or downloadable. Post-publication verification of the exact published artifact waits for the release Goal and must not be claimed here.

## Declared limits

- Loopback synthetic registry only; no `npmjs` candidate download.
- Isolated profile only (`mkdtemp(os.tmpdir())`, synthetic files, cleanup in `finally`); no real `HOME`, credentials, or real Pi profile install.
- No installer, lifecycle script, implicit native build, runtime dependency, or platform/version widening.
- Biting check: the test asserts both registry `GET`s were observed; removing the `npm_config_registry` override or pointing the packument tarball at a wrong URL prevents install/list success, so the assertions fail. The test overwrites `HOME` (and related vars) with fixture paths only; it never reads the real profile.
