import * as Sharing from "expo-sharing";

import { createPlatformExportDeliveryClient } from "./export-delivery.native";

const mockFileState = {
  exists: false,
  uri: "file:///cache/ovumcy-export-2026-03-19.pdf",
  create: jest.fn(),
  write: jest.fn(),
  delete: jest.fn(() => {
    mockFileState.exists = false;
  }),
};

jest.mock("expo-file-system", () => {
  return {
    Paths: {
      cache: "/cache",
    },
    File: jest.fn().mockImplementation(() => {
      mockFileState.exists = false;
      mockFileState.create.mockReset();
      mockFileState.write.mockReset();
      mockFileState.delete.mockReset();
      mockFileState.delete.mockImplementation(() => {
        mockFileState.exists = false;
      });

      return {
        get exists() {
          return mockFileState.exists;
        },
        get uri() {
          return mockFileState.uri;
        },
        create: jest.fn(() => {
          mockFileState.exists = true;
          mockFileState.create();
        }),
        write: mockFileState.write,
        delete: mockFileState.delete,
      };
    }),
  };
});

jest.mock("expo-sharing", () => {
  return {
    isAvailableAsync: jest.fn(),
    shareAsync: jest.fn(),
  };
});

describe("export-delivery.native", () => {
  beforeEach(() => {
    mockFileState.exists = false;
    mockFileState.create.mockReset();
    mockFileState.write.mockReset();
    mockFileState.delete.mockReset();
    mockFileState.delete.mockImplementation(() => {
      mockFileState.exists = false;
    });
  });

  it("deletes the temporary export file after a successful share", async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);
    const deliveryClient = createPlatformExportDeliveryClient();

    const result = await deliveryClient.deliver({
      filename: "ovumcy-export-2026-03-19.pdf",
      mimeType: "application/pdf",
      content: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    });

    expect(result).toEqual({ ok: true });
    expect(Sharing.shareAsync).toHaveBeenCalledWith(mockFileState.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Export Ovumcy data",
    });
    expect(mockFileState.create).toHaveBeenCalledTimes(1);
    expect(mockFileState.write).toHaveBeenCalledWith(
      new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    );
    expect(mockFileState.delete).toHaveBeenCalledTimes(1);
    expect(mockFileState.exists).toBe(false);
  });

  it("deletes the temporary export file after a failed share", async () => {
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    jest.mocked(Sharing.shareAsync).mockRejectedValue(new Error("share failed"));
    const deliveryClient = createPlatformExportDeliveryClient();

    const result = await deliveryClient.deliver({
      filename: "ovumcy-export-2026-03-19.pdf",
      mimeType: "application/pdf",
      content: "test",
    });

    expect(result).toEqual({
      ok: false,
      errorCode: "delivery_failed",
    });
    expect(mockFileState.create).toHaveBeenCalledTimes(1);
    expect(mockFileState.write).toHaveBeenCalledWith("test");
    expect(mockFileState.delete).toHaveBeenCalledTimes(1);
    expect(mockFileState.exists).toBe(false);
  });
});
