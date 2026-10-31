import assert from "node:assert/strict";
import { test } from "node:test";
import { isTrustedSandboxExecHash, verifyPlatformTarget } from "../src/sandbox/platform-target.ts";
import { ShellRefusal } from "../src/sandbox/errors.ts";

test("the historical and macOS 27.2 sandbox-exec binaries remain explicitly trusted", () => {
  assert.equal(isTrustedSandboxExecHash("58839ef01b4eef8aac0d2aa8f9d1c074ae45aafe3533965b030672450064acc8"), true);
  assert.equal(isTrustedSandboxExecHash("10cf4a46a575e4747d2419cf343800db0d11ae6e6e9b8415998d3d8f336b2a92"), true);
});

test("unknown, modified and non-exact sandbox-exec identities remain refused", () => {
  for (const hash of ["", "0".repeat(64),
    "10cf4a46a575e4747d2419cf343800db0d11ae6e6e9b8415998d3d8f336b2a93",
    "10CF4A46A575E4747D2419CF343800DB0D11AE6E6E9B8415998D3D8F336B2A92",
    "10cf4a46a575e4747d2419cf343800db0d11ae6e6e9b8415998d3d8f336b2a92\n"]) {
    assert.equal(isTrustedSandboxExecHash(hash), false);
  }
});

test("the platform gate admits Darwin 27 arm64 without broadening other targets", () => {
  for (const kernelRelease of ["27.0.0", "27.2.0"]) {
    assert.equal(verifyPlatformTarget({ platform: "darwin", arch: "arm64", kernelRelease }), 27);
  }
});

test("unsupported platforms, architectures and kernel majors fail closed", () => {
  for (const target of [
    { platform: "linux", arch: "arm64", kernelRelease: "27.2.0" },
    { platform: "win32", arch: "arm64", kernelRelease: "27.2.0" },
    { platform: "darwin", arch: "x64", kernelRelease: "27.2.0" },
    ...["26.2.0", "28.0.0", "", "invalid"].map(kernelRelease => ({ platform: "darwin", arch: "arm64", kernelRelease })),
  ]) {
    assert.throws(() => verifyPlatformTarget(target),
      (error: unknown) => error instanceof ShellRefusal && error.code === "PLATFORM_UNSUPPORTED");
  }
});
