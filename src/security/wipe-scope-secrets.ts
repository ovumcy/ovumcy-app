import type { CertPinStore } from "./cert-pin-store";
import type { EntitlementTokenStore } from "./entitlement-token-store";
import type { PartnerShareSecretStore } from "./partner-share-secret-store";
import type { SyncSecretStore } from "./sync-secret-store";

// WipeScopeSecretStores names every SecureStore-backed store, besides the
// sync secrets, whose entry belongs to the scope of a destructive local reset
// ("clear local data") and of account deletion. The local-data key is not
// listed: `LocalAppStorage.clearAllLocalData` deletes it and reseeds a fresh
// one as part of the storage reset.
export type WipeScopeSecretStores = {
  certPinStore: Pick<CertPinStore, "clearAll">;
  entitlementTokenStore: Pick<EntitlementTokenStore, "clearEntitlementToken">;
  partnerShareSecretStore: Pick<
    PartnerShareSecretStore,
    "clearPartnerShareSecrets"
  >;
};

/**
 * Deletes every wipe-scope SecureStore entry: sync secrets, partner-share
 * secrets, the entitlement token and the sync certificate pins.
 *
 * Every clear is attempted even when an earlier one throws, so one failing
 * entry never leaves the others behind; the first error is rethrown once all
 * of them have run, so the caller reports the wipe as failed rather than
 * complete. Each clear is an idempotent delete, which makes a retry safe.
 */
export async function clearWipeScopeSecrets(
  syncSecretStore: Pick<SyncSecretStore, "clearSyncSecrets">,
  stores: WipeScopeSecretStores,
): Promise<void> {
  const clears: (() => Promise<void>)[] = [
    () => syncSecretStore.clearSyncSecrets(),
    () => stores.partnerShareSecretStore.clearPartnerShareSecrets(),
    () => stores.entitlementTokenStore.clearEntitlementToken(),
    () => stores.certPinStore.clearAll(),
  ];

  const failures: unknown[] = [];
  for (const clear of clears) {
    try {
      await clear();
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length > 0) {
    throw failures[0];
  }
}
