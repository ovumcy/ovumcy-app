import { createPlatformLocalDataKeyStore } from "../../security/platform-local-data-key-store";
import { createSQLiteAppStorage } from "./sqlite-app-storage";
import { createPlatformLocalAppStorage } from "./platform-local-app-storage.native";

jest.mock("../../security/platform-local-data-key-store", () => ({
  createPlatformLocalDataKeyStore: jest.fn(),
}));

jest.mock("./sqlite-app-storage", () => ({
  createSQLiteAppStorage: jest.fn(),
}));

const OVUMCY_NATIVE_LOCAL_APP_STORAGE_KEY =
  "__ovumcyNativeLocalAppStorageSingleton";

type NativeLocalAppStorageGlobal = typeof globalThis & {
  [OVUMCY_NATIVE_LOCAL_APP_STORAGE_KEY]?: unknown;
};

describe("platform-local-app-storage.native", () => {
  beforeEach(() => {
    delete (globalThis as NativeLocalAppStorageGlobal)[
      OVUMCY_NATIVE_LOCAL_APP_STORAGE_KEY
    ];
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete (globalThis as NativeLocalAppStorageGlobal)[
      OVUMCY_NATIVE_LOCAL_APP_STORAGE_KEY
    ];
  });

  it("reuses one native local-app storage instance across repeated calls", () => {
    const fakeKeyStore = { kind: "local-data-key-store" };
    const fakeStorage = { kind: "local-app-storage" };
    (createPlatformLocalDataKeyStore as jest.Mock).mockReturnValue(fakeKeyStore);
    (createSQLiteAppStorage as jest.Mock).mockReturnValue(fakeStorage);

    const first = createPlatformLocalAppStorage();
    const second = createPlatformLocalAppStorage();

    expect(first).toBe(fakeStorage);
    expect(second).toBe(first);
    expect(createPlatformLocalDataKeyStore).toHaveBeenCalledTimes(1);
    expect(createSQLiteAppStorage).toHaveBeenCalledTimes(1);
    expect(createSQLiteAppStorage).toHaveBeenCalledWith({
      localDataKeyStore: fakeKeyStore,
    });
  });
});
