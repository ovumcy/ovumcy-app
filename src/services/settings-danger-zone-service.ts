import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  clearWipeScopeSecrets,
  type WipeScopeSecretStores,
} from "../security/wipe-scope-secrets";
import type { LocalAppStorage } from "../storage/local/storage-contract";

export const CLEAR_LOCAL_DATA_CONFIRMATION = "CLEAR";

export function isClearLocalDataConfirmationValid(value: string): boolean {
  return value.trim().toUpperCase() === CLEAR_LOCAL_DATA_CONFIRMATION;
}

// Resets local storage (which also rotates the local-data key), then deletes
// every wipe-scope SecureStore entry. `ok: true` only when the storage reset
// and every secret clear succeeded; a failing clear still lets the others run
// (see `clearWipeScopeSecrets`) and the result is `generic`.
export async function clearAllLocalSettingsData(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  wipeScopeSecretStores: WipeScopeSecretStores,
): Promise<
  | {
      ok: true;
    }
  | {
      ok: false;
      errorCode: "generic";
    }
> {
  try {
    await storage.clearAllLocalData();
    await clearWipeScopeSecrets(secretStore, wipeScopeSecretStores);
    return { ok: true };
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }
}
