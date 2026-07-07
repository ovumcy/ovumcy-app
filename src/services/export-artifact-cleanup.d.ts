/**
 * Sweep stale Ovumcy export and import artifacts from the platform cache
 * directory.
 *
 * Export delivery (cycle CSV/JSON, doctor PDF, recovery phrase) writes a
 * temporary file under `Paths.cache`, and the JSON-import picker copies the
 * picked backup into the cache's `DocumentPicker` subdirectory; both remove
 * their file in a `try/finally`. If the JS process is killed mid-attempt
 * (OS reclaim, force-stop, OOM), the `finally` never runs and the artifact
 * survives. This function is called on app boot to wipe any leftover blobs
 * that match our naming convention plus the picker subdirectory, so a later
 * attacker with brief device access cannot pick them up.
 *
 * Native implementations clean the platform cache; web reads imports in
 * memory and downloads exports via ephemeral blob URLs, so it returns
 * immediately.
 */
export declare function cleanupStaleExportArtifacts(): Promise<void>;
