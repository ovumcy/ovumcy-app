import type { PartnerShareSecretStore } from "../security/partner-share-secret-store";
import type { SyncSecretStore } from "../security/sync-secret-store";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { syncManagedPartnerSharedProjections } from "./managed-partner-share-sync-service";

type ManagedPartnerShareProjectionSync = typeof syncManagedPartnerSharedProjections;

export async function refreshManagedPartnerSharedProjectionsOnAppActive(
  storage: LocalAppStorage,
  syncSecretStore: SyncSecretStore,
  partnerShareSecretStore: PartnerShareSecretStore,
  now: Date,
  syncPartnerProjections: ManagedPartnerShareProjectionSync = syncManagedPartnerSharedProjections,
): Promise<{
  skipped: boolean;
  syncedCount: number;
}> {
  const secrets = await partnerShareSecretStore.readPartnerShareSecrets();
  const hasPendingInvites =
    Object.keys(secrets.pendingInviteKeysByInviteID).length > 0;
  const hasGrants = Object.keys(secrets.grantKeysByGrantID).length > 0;
  if (!hasPendingInvites && !hasGrants) {
    return { skipped: true, syncedCount: 0 };
  }

  return syncPartnerProjections(
    storage,
    syncSecretStore,
    partnerShareSecretStore,
    now,
  );
}
