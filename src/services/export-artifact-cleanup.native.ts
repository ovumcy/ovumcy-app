import { Directory, Paths } from "expo-file-system";

const ARTIFACT_PREFIXES = ["ovumcy-export-", "ovumcy-private-export-"];

type DeletableEntry = {
  name: string;
  delete: () => void;
};

function isDeletableFile(entry: unknown): entry is DeletableEntry {
  return (
    typeof entry === "object" &&
    entry !== null &&
    typeof (entry as { name?: unknown }).name === "string" &&
    typeof (entry as { delete?: unknown }).delete === "function"
  );
}

/**
 * Sweep stale Ovumcy export artifacts from `Paths.cache`. The export
 * delivery layer cleans up its own file via `try/finally`, but a killed
 * JS process bypasses that. Run this on app boot to drop any leftovers
 * with our known prefixes. Best-effort — failures are swallowed. The
 * narrow prefix list keeps us from touching cache entries owned by
 * other libraries.
 */
export async function cleanupStaleExportArtifacts(): Promise<void> {
  try {
    const cacheDir = new Directory(Paths.cache);
    if (!cacheDir.exists) {
      return;
    }
    const entries = cacheDir.list();
    for (const entry of entries) {
      if (!isDeletableFile(entry)) {
        continue;
      }
      const matchesPrefix = ARTIFACT_PREFIXES.some((prefix) =>
        entry.name.startsWith(prefix),
      );
      if (!matchesPrefix) {
        continue;
      }
      try {
        entry.delete();
      } catch {
        // best-effort: a concurrent share may still hold the file open.
      }
    }
  } catch {
    // Cache dir unavailable, listing failure — nothing actionable here.
  }
}
