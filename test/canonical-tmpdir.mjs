import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";

/**
 * Test-harness bootstrap: canonicalize the temporary root before any test
 * imports `node:os`.
 *
 * The accepted configuration-authorization contract requires the trusted
 * user-config root to be an absolute, normalized, canonical directory (for
 * example macOS `/var` is a symlink to `/private/var`, so `os.tmpdir()`
 * results are not canonical there). Test fixtures must satisfy the documented
 * contract on every platform, so the harness rewrites TMPDIR once to the
 * realpath of the platform temp root. This changes only the test environment;
 * production roots are still supplied by the trusted caller.
 */
try {
  process.env["TMPDIR"] = realpathSync(tmpdir());
} catch {
  // Keep the platform default when the temp root cannot be canonicalized;
  // fixtures fail closed through the loader in that case.
}
