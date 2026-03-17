import type { LocalAppStorage } from "./storage-contract";
import { createVolatileWebAppStorage } from "./volatile-web-app-storage";

export function createPlatformLocalAppStorage(): LocalAppStorage {
  return createVolatileWebAppStorage();
}
