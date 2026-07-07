import { cleanupStaleExportArtifacts } from "./export-artifact-cleanup.native";

type MockFile = {
  name: string;
  delete: jest.Mock;
};

type MockDirectoryEntry = {
  name: string;
};

let mockExists = true;
let mockEntries: (MockFile | MockDirectoryEntry)[] = [];
let mockPickerDirExists = false;
const mockPickerDirDelete = jest.fn();

jest.mock("expo-file-system", () => {
  return {
    Paths: { cache: "/cache" },
    Directory: jest.fn().mockImplementation((...segments: string[]) => {
      // Two-segment construction targets the DocumentPicker subdirectory the
      // import flow sweeps; single-segment is the cache root listing.
      if (segments.length > 1) {
        return {
          get exists() {
            return mockPickerDirExists;
          },
          delete: mockPickerDirDelete,
        };
      }
      return {
        get exists() {
          return mockExists;
        },
        list() {
          return mockEntries;
        },
      };
    }),
  };
});

function createMockFile(name: string): MockFile {
  return { name, delete: jest.fn() };
}

describe("cleanupStaleExportArtifacts", () => {
  beforeEach(() => {
    mockExists = true;
    mockEntries = [];
    mockPickerDirExists = false;
    mockPickerDirDelete.mockReset();
  });

  it("removes files whose name matches an Ovumcy export prefix", async () => {
    const cycle = createMockFile("ovumcy-export-2026-04-01.pdf");
    const recovery = createMockFile("ovumcy-private-export-2026-04-01.txt");
    const irrelevant = createMockFile("image-cache-thumb.png");
    mockEntries = [cycle, recovery, irrelevant];

    await cleanupStaleExportArtifacts();

    expect(cycle.delete).toHaveBeenCalledTimes(1);
    expect(recovery.delete).toHaveBeenCalledTimes(1);
    expect(irrelevant.delete).not.toHaveBeenCalled();
  });

  it("skips entries that lack a delete method (directory-like)", async () => {
    const dirLike: MockDirectoryEntry = { name: "ovumcy-export-some-dir" };
    mockEntries = [dirLike];

    await expect(cleanupStaleExportArtifacts()).resolves.toBeUndefined();
  });

  it("returns silently when the cache directory does not exist yet", async () => {
    mockExists = false;
    mockEntries = [];

    await expect(cleanupStaleExportArtifacts()).resolves.toBeUndefined();
  });

  it("swallows per-file delete failures so a single locked file does not abort the sweep", async () => {
    const stuck = createMockFile("ovumcy-export-stuck.pdf");
    stuck.delete.mockImplementation(() => {
      throw new Error("EBUSY");
    });
    const fresh = createMockFile("ovumcy-private-export-fresh.txt");
    mockEntries = [stuck, fresh];

    await cleanupStaleExportArtifacts();

    expect(stuck.delete).toHaveBeenCalledTimes(1);
    expect(fresh.delete).toHaveBeenCalledTimes(1);
  });

  it("removes the document-picker cache directory left behind by a killed import", async () => {
    mockPickerDirExists = true;

    await cleanupStaleExportArtifacts();

    expect(mockPickerDirDelete).toHaveBeenCalledTimes(1);
  });

  it("leaves the picker directory alone when it does not exist", async () => {
    mockPickerDirExists = false;

    await cleanupStaleExportArtifacts();

    expect(mockPickerDirDelete).not.toHaveBeenCalled();
  });

  it("still sweeps export files when the picker-directory delete fails", async () => {
    const exportFile = createMockFile("ovumcy-export-2026-04-01.csv");
    mockEntries = [exportFile];
    mockPickerDirExists = true;
    mockPickerDirDelete.mockImplementation(() => {
      throw new Error("EBUSY");
    });

    await expect(cleanupStaleExportArtifacts()).resolves.toBeUndefined();

    expect(exportFile.delete).toHaveBeenCalledTimes(1);
    expect(mockPickerDirDelete).toHaveBeenCalledTimes(1);
  });
});
