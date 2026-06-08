import { createInMemoryLocalDataKeyStore } from "./local-data-key-store";

// Web is preview-only and has no SecureStore, so the device-local data key is
// held in memory for the session — mirroring the web fallback of the other
// platform secret stores (sync, partner-share).
export function createPlatformLocalDataKeyStore() {
  return createInMemoryLocalDataKeyStore();
}
