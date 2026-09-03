import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Non-enforcing package entry point.
 *
 * The Phase 1A path primitive is not connected to Pi tools yet.
 */
export default function piWarden(_pi: ExtensionAPI): void {
  // Intentionally empty: no tool is protected until its policy and tests exist.
}
