import type { LocalAppStorage } from "./storage-contract";
import { createSQLiteAppStorage } from "./sqlite-app-storage";

export function createPlatformLocalAppStorage(): LocalAppStorage {
  return createSQLiteAppStorage();
}
