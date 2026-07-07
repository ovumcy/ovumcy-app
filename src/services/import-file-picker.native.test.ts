import * as DocumentPicker from "expo-document-picker";

import { createPlatformImportFilePickerClient } from "./import-file-picker.native";
import { MAX_IMPORT_FILE_BYTES } from "./import-service";

const mockFileState = {
  exists: false,
  size: 0,
  uri: "file:///cache/DocumentPicker/copy.json",
  text: jest.fn<Promise<string>, []>(),
  delete: jest.fn(() => {
    mockFileState.exists = false;
  }),
};

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation(() => ({
    get exists() {
      return mockFileState.exists;
    },
    get size() {
      return mockFileState.size;
    },
    get uri() {
      return mockFileState.uri;
    },
    text: mockFileState.text,
    delete: mockFileState.delete,
  })),
}));

const mockGetDocumentAsync = jest.mocked(DocumentPicker.getDocumentAsync);

function pickedAsset(size?: number) {
  return {
    canceled: false as const,
    assets: [
      {
        name: "backup.json",
        uri: mockFileState.uri,
        lastModified: 0,
        ...(size === undefined ? {} : { size }),
      },
    ],
  };
}

describe("import-file-picker.native", () => {
  beforeEach(() => {
    mockGetDocumentAsync.mockReset();
    mockFileState.exists = true;
    mockFileState.size = 64;
    mockFileState.text.mockReset();
    mockFileState.delete.mockReset();
    mockFileState.delete.mockImplementation(() => {
      mockFileState.exists = false;
    });
  });

  it("restricts the picker to JSON documents and a single cache copy", async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: null });

    await createPlatformImportFilePickerClient().pick();

    expect(mockGetDocumentAsync).toHaveBeenCalledWith({
      type: ["application/json", "text/json"],
      copyToCacheDirectory: true,
      multiple: false,
    });
  });

  it("returns the file content and deletes the cache copy after a successful read", async () => {
    mockGetDocumentAsync.mockResolvedValue(pickedAsset(64));
    mockFileState.text.mockResolvedValue('{"app":"ovumcy"}');

    const result = await createPlatformImportFilePickerClient().pick();

    expect(result).toEqual({ status: "picked", content: '{"app":"ovumcy"}' });
    expect(mockFileState.delete).toHaveBeenCalledTimes(1);
    expect(mockFileState.exists).toBe(false);
  });

  it("deletes the cache copy even when reading the file fails", async () => {
    mockGetDocumentAsync.mockResolvedValue(pickedAsset(64));
    mockFileState.text.mockRejectedValue(new Error("io failure"));

    const result = await createPlatformImportFilePickerClient().pick();

    expect(result).toEqual({ status: "failed", errorCode: "read_failed" });
    expect(mockFileState.delete).toHaveBeenCalledTimes(1);
    expect(mockFileState.exists).toBe(false);
  });

  it("rejects an oversized file before reading it and still deletes the cache copy", async () => {
    mockGetDocumentAsync.mockResolvedValue(
      pickedAsset(MAX_IMPORT_FILE_BYTES + 1),
    );

    const result = await createPlatformImportFilePickerClient().pick();

    expect(result).toEqual({ status: "failed", errorCode: "too_large" });
    expect(mockFileState.text).not.toHaveBeenCalled();
    expect(mockFileState.delete).toHaveBeenCalledTimes(1);
    expect(mockFileState.exists).toBe(false);
  });

  it("falls back to the cache copy's own size when the picker reports none", async () => {
    mockGetDocumentAsync.mockResolvedValue(pickedAsset());
    mockFileState.size = MAX_IMPORT_FILE_BYTES + 1;

    const result = await createPlatformImportFilePickerClient().pick();

    expect(result).toEqual({ status: "failed", errorCode: "too_large" });
    expect(mockFileState.text).not.toHaveBeenCalled();
    expect(mockFileState.delete).toHaveBeenCalledTimes(1);
  });

  it("maps a cancelled picker to a quiet cancelled result", async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: null });

    const result = await createPlatformImportFilePickerClient().pick();

    expect(result).toEqual({ status: "cancelled" });
    expect(mockFileState.delete).not.toHaveBeenCalled();
  });

  it("maps a picker launch failure to pick_unavailable", async () => {
    mockGetDocumentAsync.mockRejectedValue(new Error("no activity"));

    const result = await createPlatformImportFilePickerClient().pick();

    expect(result).toEqual({ status: "failed", errorCode: "pick_unavailable" });
    expect(mockFileState.delete).not.toHaveBeenCalled();
  });
});
