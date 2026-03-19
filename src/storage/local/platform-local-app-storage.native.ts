import { createPlatformLocalDataKeyStore } from "../../security/platform-local-data-key-store";
import type { LocalAppStorage } from "./storage-contract";
import { createSQLiteAppStorage } from "./sqlite-app-storage";

export function createPlatformLocalAppStorage(): LocalAppStorage {
  return createSQLiteAppStorage({
    localDataKeyStore: createPlatformLocalDataKeyStore(),
  });
}
