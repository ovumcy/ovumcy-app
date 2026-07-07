import type {
  ImportFilePickerClient,
  ImportFilePickResult,
} from "./import-file-picker";
import { MAX_IMPORT_FILE_BYTES } from "./import-service";

// Web picks through a transient <input type="file"> and reads the file in
// memory with FileReader (mirroring ovumcy-web's settings-import handler), so
// no on-disk artifact exists and no cache cleanup is needed on this platform.
export function createPlatformImportFilePickerClient(): ImportFilePickerClient {
  return {
    pick(): Promise<ImportFilePickResult> {
      if (
        typeof window === "undefined" ||
        typeof document === "undefined" ||
        typeof FileReader === "undefined"
      ) {
        return Promise.resolve({
          status: "failed",
          errorCode: "pick_unavailable",
        });
      }

      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.style.display = "none";
        document.body.appendChild(input);

        const finish = (outcome: ImportFilePickResult) => {
          input.remove();
          resolve(outcome);
        };

        input.addEventListener(
          "change",
          () => {
            const file = input.files && input.files[0];
            if (!file) {
              finish({ status: "cancelled" });
              return;
            }
            if (file.size > MAX_IMPORT_FILE_BYTES) {
              finish({ status: "failed", errorCode: "too_large" });
              return;
            }

            const reader = new FileReader();
            reader.onload = () =>
              finish({ status: "picked", content: String(reader.result ?? "") });
            reader.onerror = () =>
              finish({ status: "failed", errorCode: "read_failed" });
            reader.readAsText(file);
          },
          { once: true },
        );
        // Dispatched by modern browsers when the dialog is dismissed without a
        // selection; on older engines the promise simply stays pending, which
        // leaves the screen idle rather than mis-reporting an error.
        input.addEventListener(
          "cancel",
          () => finish({ status: "cancelled" }),
          { once: true },
        );

        input.click();
      });
    },
  };
}
