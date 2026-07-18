/**
 * @jest-environment jsdom
 */
import { createPlatformImportFilePickerClient } from "./import-file-picker.web";
import { MAX_IMPORT_FILE_BYTES } from "./import-service";

afterEach(() => {
  // Safety net: every branch under test is expected to remove its own
  // transient <input> via the production `finish()` cleanup, but this keeps
  // a failed assertion mid-test from leaking DOM state into the next test.
  document.body.innerHTML = "";
});

function queryPickerInput(): HTMLInputElement {
  const input = document.body.querySelector('input[type="file"]');
  if (!input) {
    throw new Error("expected the picker to have appended a file input");
  }
  return input as HTMLInputElement;
}

describe("import-file-picker.web", () => {
  it("restricts the picker to JSON documents, reads the selected file's text, and removes the transient input", async () => {
    const client = createPlatformImportFilePickerClient();
    const resultPromise = client.pick();

    const input = queryPickerInput();
    expect(input.accept).toBe("application/json,.json");
    expect(input.style.display).toBe("none");
    expect(document.body.contains(input)).toBe(true);

    const file = new File(['{"app":"ovumcy"}'], "backup.json", {
      type: "application/json",
    });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));

    const result = await resultPromise;

    expect(result).toEqual({ status: "picked", content: '{"app":"ovumcy"}' });
    // The web picker never writes to disk; the only cleanup surface is this
    // transient DOM node, which must not outlive the pick attempt.
    expect(document.body.contains(input)).toBe(false);
  });

  it("reports cancelled when the change event fires with no file selected", async () => {
    const client = createPlatformImportFilePickerClient();
    const resultPromise = client.pick();
    const input = queryPickerInput();

    // A freshly created file input's `.files` is an empty FileList (not
    // null) in real browsers, so a stray change dispatch with nothing
    // selected must still resolve quietly rather than error.
    input.dispatchEvent(new Event("change"));

    const result = await resultPromise;

    expect(result).toEqual({ status: "cancelled" });
    expect(document.body.contains(input)).toBe(false);
  });

  it("reports cancelled when the browser dispatches a cancel event for a dismissed dialog", async () => {
    const client = createPlatformImportFilePickerClient();
    const resultPromise = client.pick();
    const input = queryPickerInput();

    input.dispatchEvent(new Event("cancel"));

    const result = await resultPromise;

    expect(result).toEqual({ status: "cancelled" });
    expect(document.body.contains(input)).toBe(false);
  });

  it("rejects an oversized file before ever reading its content", async () => {
    const readAsTextSpy = jest.spyOn(FileReader.prototype, "readAsText");

    try {
      const client = createPlatformImportFilePickerClient();
      const resultPromise = client.pick();
      const input = queryPickerInput();

      const file = new File(["irrelevant"], "backup.json", {
        type: "application/json",
      });
      Object.defineProperty(file, "size", {
        value: MAX_IMPORT_FILE_BYTES + 1,
        configurable: true,
      });
      Object.defineProperty(input, "files", { value: [file], configurable: true });
      input.dispatchEvent(new Event("change"));

      const result = await resultPromise;

      expect(result).toEqual({ status: "failed", errorCode: "too_large" });
      // The oversized backup must never be loaded into memory at all.
      expect(readAsTextSpy).not.toHaveBeenCalled();
      expect(document.body.contains(input)).toBe(false);
    } finally {
      readAsTextSpy.mockRestore();
    }
  });

  it("reports read_failed when FileReader errors while reading the picked file", async () => {
    const readAsTextSpy = jest
      .spyOn(FileReader.prototype, "readAsText")
      .mockImplementation(function (this: FileReader) {
        // FileReader has no constructor hook to force a read error, so the
        // prototype method is stubbed for this test only to simulate a
        // browser-surfaced I/O failure (e.g. revoked file-system access
        // mid-read); restored in finally.
        this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>);
      });

    try {
      const client = createPlatformImportFilePickerClient();
      const resultPromise = client.pick();
      const input = queryPickerInput();

      const file = new File(["irrelevant"], "backup.json", {
        type: "application/json",
      });
      Object.defineProperty(input, "files", { value: [file], configurable: true });
      input.dispatchEvent(new Event("change"));

      const result = await resultPromise;

      expect(result).toEqual({ status: "failed", errorCode: "read_failed" });
      expect(document.body.contains(input)).toBe(false);
    } finally {
      readAsTextSpy.mockRestore();
    }
  });

  it("falls back to an empty string when the reader completes with no result", async () => {
    const readAsTextSpy = jest
      .spyOn(FileReader.prototype, "readAsText")
      .mockImplementation(function (this: FileReader) {
        // Defends a spec-edge case: `onload` firing while `.result` is still
        // null. Real browsers always populate `.result` on a successful
        // readAsText, so this is stubbed deliberately to reach the `?? ""`
        // fallback; restored in finally.
        this.onload?.(new ProgressEvent("load") as ProgressEvent<FileReader>);
      });

    try {
      const client = createPlatformImportFilePickerClient();
      const resultPromise = client.pick();
      const input = queryPickerInput();

      const file = new File(["irrelevant"], "backup.json", {
        type: "application/json",
      });
      Object.defineProperty(input, "files", { value: [file], configurable: true });
      input.dispatchEvent(new Event("change"));

      const result = await resultPromise;

      expect(result).toEqual({ status: "picked", content: "" });
    } finally {
      readAsTextSpy.mockRestore();
    }
  });

  it("reports pick_unavailable and never touches the DOM when FileReader is not available", async () => {
    const original = globalThis.FileReader;

    try {
      (globalThis as { FileReader?: typeof FileReader | undefined }).FileReader =
        undefined;

      const result = await createPlatformImportFilePickerClient().pick();

      expect(result).toEqual({ status: "failed", errorCode: "pick_unavailable" });
      // The feature-detection guard must short-circuit before creating any
      // picker element.
      expect(document.body.querySelector('input[type="file"]')).toBeNull();
    } finally {
      globalThis.FileReader = original;
    }
  });
});
