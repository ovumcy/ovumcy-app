import { createPlatformLocalDataKeyStore } from "../../security/platform-local-data-key-store";
import type { LocalAppStorage } from "./storage-contract";
import { createSQLiteAppStorage } from "./sqlite-app-storage";

const OVUMCY_NATIVE_LOCAL_APP_STORAGE_KEY =
  "__ovumcyNativeLocalAppStorageSingleton";

type NativeLocalAppStorageGlobal = typeof globalThis & {
  [OVUMCY_NATIVE_LOCAL_APP_STORAGE_KEY]?: LocalAppStorage;
};

export function createPlatformLocalAppStorage(): LocalAppStorage {
  const globalStorage = globalThis as NativeLocalAppStorageGlobal;
  if (globalStorage[OVUMCY_NATIVE_LOCAL_APP_STORAGE_KEY]) {
    return globalStorage[OVUMCY_NATIVE_LOCAL_APP_STORAGE_KEY];
  }

  const storage = createSQLiteAppStorage({
    localDataKeyStore: createPlatformLocalDataKeyStore(),
  });
  globalStorage[OVUMCY_NATIVE_LOCAL_APP_STORAGE_KEY] = storage;
  return storage;
}
