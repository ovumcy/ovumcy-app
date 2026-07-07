export type ImportFilePickErrorCode =
  | "pick_unavailable"
  | "read_failed"
  | "too_large";

export type ImportFilePickResult =
  | { status: "picked"; content: string }
  | { status: "cancelled" }
  | {
      status: "failed";
      errorCode: ImportFilePickErrorCode;
    };

export interface ImportFilePickerClient {
  pick(): Promise<ImportFilePickResult>;
}

/**
 * Open the platform file picker restricted to JSON documents and return the
 * selected file's text content.
 *
 * The picked file is privacy-sensitive (a health-data backup): the native
 * implementation deletes the picker's cache copy after the read attempt —
 * success or failure — and never surfaces the user-chosen filename; the web
 * implementation reads in memory and leaves no on-disk artifact.
 */
export declare function createPlatformImportFilePickerClient(): ImportFilePickerClient;
