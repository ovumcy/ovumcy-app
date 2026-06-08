// Guards the native font-loading contract for PDF export: the bundled TTFs
// must be resolved to a local `file://` path via `downloadAsync()` and read
// with `File.bytes()`. Reading them through `fetch().arrayBuffer()` corrupts
// the binary on React Native, which made on-device PDF export fail while
// CSV/JSON kept working.

const mockFromModule = jest.fn();
const mockFileBytes = jest.fn();
const mockFetch = jest.fn(() => {
  throw new Error("fetch must not be used to load fonts on native");
});

jest.mock("expo-asset", () => ({
  Asset: {
    fromModule: (moduleID: number) => mockFromModule(moduleID),
  },
}));

jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((uri: string) => ({
    bytes: () => mockFileBytes(uri),
  })),
}));

type FakeFontAsset = {
  localUri: string | null;
  uri: string;
  downloadAsync: jest.Mock;
};

function createPendingFontAsset(name: string): FakeFontAsset {
  const asset: FakeFontAsset = {
    localUri: null,
    uri: `http://10.0.2.2:8081/assets/fonts/${name}.ttf`,
    downloadAsync: jest.fn(async () => {
      asset.localUri = `file:///cache/${name}.ttf`;
      return asset;
    }),
  };
  return asset;
}

describe("export-pdf-fonts", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.resetModules();
    mockFromModule.mockReset();
    mockFileBytes.mockReset();
    mockFetch.mockClear();
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it("downloads each bundled font to a file and reads its bytes without fetch", async () => {
    const regular = createPendingFontAsset("regular");
    const bold = createPendingFontAsset("bold");
    mockFromModule.mockReturnValueOnce(regular).mockReturnValueOnce(bold);
    mockFileBytes.mockImplementation((uri: string) =>
      Promise.resolve(
        uri.includes("regular")
          ? new Uint8Array([0x01, 0x02])
          : new Uint8Array([0x03, 0x04]),
      ),
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadExportPDFFontBytes } = require("./export-pdf-fonts");
    const result = await loadExportPDFFontBytes();

    expect(Array.from(result.regular)).toEqual([0x01, 0x02]);
    expect(Array.from(result.bold)).toEqual([0x03, 0x04]);
    expect(regular.downloadAsync).toHaveBeenCalledTimes(1);
    expect(bold.downloadAsync).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("memoizes the fonts so repeated exports resolve the assets once", async () => {
    mockFromModule
      .mockReturnValueOnce(createPendingFontAsset("regular"))
      .mockReturnValueOnce(createPendingFontAsset("bold"));
    mockFileBytes.mockResolvedValue(new Uint8Array([0x00]));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadExportPDFFontBytes } = require("./export-pdf-fonts");
    await loadExportPDFFontBytes();
    await loadExportPDFFontBytes();

    expect(mockFromModule).toHaveBeenCalledTimes(2);
  });

  it("drops the cached rejection so a later export can retry", async () => {
    const failing = createPendingFontAsset("regular");
    failing.downloadAsync = jest.fn(async () => {
      throw new Error("download failed");
    });
    mockFromModule
      .mockReturnValueOnce(failing)
      .mockImplementation(() => createPendingFontAsset("retry"));
    mockFileBytes.mockResolvedValue(new Uint8Array([0x09]));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadExportPDFFontBytes } = require("./export-pdf-fonts");
    await expect(loadExportPDFFontBytes()).rejects.toThrow("download failed");
    const result = await loadExportPDFFontBytes();

    expect(Array.from(result.regular)).toEqual([0x09]);
    expect(Array.from(result.bold)).toEqual([0x09]);
  });
});
