import type { LocalAppStorage } from "./storage-contract";
import { createAsyncStorageAppStorage } from "./async-storage-app-storage";

export function createPlatformLocalAppStorage(): LocalAppStorage {
  return createAsyncStorageAppStorage();
}
