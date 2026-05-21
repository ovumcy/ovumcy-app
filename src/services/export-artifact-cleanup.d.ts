/**
 * Sweep stale Ovumcy export artifacts from the platform cache directory.
 *
 * Export delivery (cycle CSV/JSON, doctor PDF, recovery phrase) writes a
 * temporary file under `Paths.cache` and removes it in a `try/finally`.
 * If the JS process is killed mid-share (OS reclaim, force-stop, OOM),
 * the `finally` never runs and the artifact survives. This function is
 * called on app boot to wipe any leftover blobs that match our naming
 * convention, so a later attacker with brief device access cannot pick
 * them up.
 *
 * Native implementations clean the platform cache; web returns immediately.
 */
export declare function cleanupStaleExportArtifacts(): Promise<void>;
