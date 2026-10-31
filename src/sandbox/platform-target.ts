import { ShellRefusal } from "./errors.ts";

/** Internal platform gate. Package code, never project configuration, owns these targets. */
export function verifyPlatformTarget(target: {
  readonly platform: string;
  readonly arch: string;
  readonly kernelRelease: string;
}): number {
  if (target.platform !== "darwin") {
    throw new ShellRefusal("PLATFORM_UNSUPPORTED", `platform ${target.platform} is not supported`);
  }
  if (target.arch !== "arm64") {
    throw new ShellRefusal("PLATFORM_UNSUPPORTED", `architecture ${target.arch} is not supported`);
  }
  const darwinMajor = Number(target.kernelRelease.split(".")[0] ?? "0");
  if (!Number.isInteger(darwinMajor) || darwinMajor !== 27) {
    throw new ShellRefusal(
      "PLATFORM_UNSUPPORTED",
      `Darwin ${target.kernelRelease} is outside the declared target (major 27)`,
    );
  }
  return darwinMajor;
}

/** Exact observed binaries: macOS 27.0/27.0.1 and macOS 27.2 (26B123). */
export function isTrustedSandboxExecHash(sha256: string): boolean {
  return sha256 === "58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8"
    || sha256 === "10cf4a46a575e4747d2419cf343800db0d11ae6e6e9b8415998d3d8f336b2a92";
}
