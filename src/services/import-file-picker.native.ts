import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

import type {
  ImportFilePickerClient,
  ImportFilePickResult,
} from "./import-file-picker";
import { MAX_IMPORT_FILE_BYTES } from "./import-service";

export function createPlatformImportFilePickerClient(): ImportFilePickerClient {
  return {
    async pick(): Promise<ImportFilePickResult> {
      let result: DocumentPicker.DocumentPickerResult;
      try {
        result = await DocumentPicker.getDocumentAsync({
          // Restrict to JSON documents; content is still shape-validated by
          // parseImportEnvelope, so the mime filter is UX, not a trust boundary.
          type: ["application/json", "text/json"],
          copyToCacheDirectory: true,
          multiple: false,
        });
      } catch {
        return { status: "failed", errorCode: "pick_unavailable" };
      }

      if (result.canceled) {
        return { status: "cancelled" };
      }

      const asset = result.assets[0];
      if (!asset) {
        return { status: "failed", errorCode: "read_failed" };
      }

      // copyToCacheDirectory places a copy of the picked backup in the app
      // cache. That copy is a transient sensitive artifact (health data) and
      // must not outlive this attempt — delete it whether the read succeeds
      // or fails. A process kill in between is covered by the boot sweep in
      // export-artifact-cleanup.
      let cacheCopy: File | null = null;
      try {
        cacheCopy = new File(asset.uri);
        const sizeInBytes =
          typeof asset.size === "number" ? asset.size : cacheCopy.size;
        if (sizeInBytes > MAX_IMPORT_FILE_BYTES) {
          return { status: "failed", errorCode: "too_large" };
        }

        const content = await cacheCopy.text();
        return { status: "picked", content };
      } catch {
        return { status: "failed", errorCode: "read_failed" };
      } finally {
        if (cacheCopy?.exists) {
          try {
            cacheCopy.delete();
          } catch {
            // Best-effort: the boot sweep removes leftover picker copies.
          }
        }
      }
    },
  };
}
