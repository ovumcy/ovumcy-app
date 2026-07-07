import { Directory, Paths } from "expo-file-system";

const ARTIFACT_PREFIXES = ["ovumcy-export-", "ovumcy-private-export-"];

// expo-document-picker copies every picked file into this cache subdirectory
// on both Android and iOS. The JSON-import flow (import-file-picker.native)
// deletes its own copy in try/finally, but a process kill mid-import leaves
// the copy — a health-data backup — behind. The import picker is this app's
// only document-picker consumer, so the whole directory is safe to drop.
const IMPORT_PICKER_CACHE_DIRECTORY = "DocumentPicker";

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
 * Sweep stale Ovumcy export and import artifacts from `Paths.cache`. The
 * export delivery and import picker layers clean up their own files via
 * `try/finally`, but a killed JS process bypasses that. Run this on app
 * boot to drop any leftovers with our known prefixes, plus the document
 * picker's cache subdirectory used by the JSON-import flow. Best-effort —
 * failures are swallowed. The narrow prefix list keeps us from touching
 * cache entries owned by other libraries.
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

    const pickerCacheDir = new Directory(
      Paths.cache,
      IMPORT_PICKER_CACHE_DIRECTORY,
    );
    if (pickerCacheDir.exists) {
      try {
        // Recursive: Directory.delete() also removes contained files.
        pickerCacheDir.delete();
      } catch {
        // best-effort: an in-flight pick may still hold a copy open.
      }
    }
  } catch {
    // Cache dir unavailable, listing failure — nothing actionable here.
  }
}
