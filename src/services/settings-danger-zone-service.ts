import { clearManagedPartnerInviteToken } from "../security/managed-partner-invite-token-buffer";
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
// every wipe-scope SecureStore entry — also when the reset threw, so a failed
// reset never leaves sync or partner secrets behind. `ok: true` only when the
// reset and every secret clear succeeded; a failing clear still lets the
// others run (see `clearWipeScopeSecrets`).
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
  let storageCleared = true;
  try {
    await storage.clearAllLocalData();
  } catch {
    storageCleared = false;
  }

  let secretsCleared = true;
  try {
    await clearWipeScopeSecrets(secretStore, wipeScopeSecretStores);
  } catch {
    secretsCleared = false;
  }
  clearManagedPartnerInviteToken();

  return storageCleared && secretsCleared
    ? { ok: true }
    : { ok: false, errorCode: "generic" };
}
