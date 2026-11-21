import { syncManagedPartnerSharedProjections } from "../../../services/managed-partner-share-sync-service";
import type { PartnerShareSecretStore } from "../../../security/partner-share-secret-store";
import type { SyncSecretStore } from "../../../security/sync-secret-store";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";

// A pregnancy record's status changes what the partner projection may show
// (an ACTIVE record suppresses its predictions), so the partner gets the new
// projection now rather than at the next day-log save or foreground. Not
// awaited: the local write has already succeeded and navigation must not wait
// on a network round trip; a failed push is retried by the next one.
export function pushPartnerProjectionInBackground(
  storage: LocalAppStorage,
  syncSecretStore: SyncSecretStore,
  partnerShareSecretStore: PartnerShareSecretStore,
  now: Date | undefined,
): void {
  void syncManagedPartnerSharedProjections(
    storage,
    syncSecretStore,
    partnerShareSecretStore,
    now ?? new Date(),
  ).catch(() => undefined);
}
