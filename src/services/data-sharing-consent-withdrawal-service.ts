import { getPartnerCopy } from "../i18n/partner-copy";
import type { InterfaceLanguage } from "../models/profile";
import type { PartnerShareSecretStore } from "../security/partner-share-secret-store";
import type { SyncSecretStore } from "../security/sync-secret-store";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import type {
  ManagedCloudPartnerAccessGrant,
  ManagedCloudPartnerAccessOverview,
} from "../sync/managed-cloud-api-client";
import type { SyncMode } from "../sync/sync-contract";
import { formatBackupSyncLastSeen } from "./backup-sync-view-service";
import { withdrawAllDataSharingConsent } from "./data-sharing-consent-service";
import {
  loadManagedPartnerAccess,
  revokeManagedPartnerGrant,
} from "./managed-partner-access-service";
import { clearManagedPartnerGrantKey } from "./managed-partner-share-service";

export type DataSharingConsentWithdrawalDeps = {
  partnerShareSecretStore: PartnerShareSecretStore;
  storage: LocalAppStorage;
  syncMode: SyncMode;
  syncSecretStore: SyncSecretStore;
};

/**
 * The live grants this owner issued, which the withdrawal revokes. None unless
 * a partner-share consent is stored (any revision). The listing is fetched
 * fresh so the confirm names every live partner; when that fails, the screen's
 * last listing stands in.
 */
export async function loadPartnerGrantsToRevokeOnWithdrawal(
  deps: DataSharingConsentWithdrawalDeps,
  lastOverview: ManagedCloudPartnerAccessOverview | null,
): Promise<ManagedCloudPartnerAccessGrant[]> {
  const record = await deps.storage.readSyncPreferencesRecord();
  if (record.dataSharingConsent?.partner_share === undefined) {
    return [];
  }
  const fresh = await loadManagedPartnerAccess(
    deps.syncSecretStore,
    deps.syncMode,
  ).catch(() => null);
  const overview = fresh?.ok ? fresh.value : lastOverview;
  return (overview?.owned.grants ?? []).filter((grant) => !grant.revokedAt);
}

export type DataSharingConsentWithdrawalResult = {
  revokedGrantIDs: string[];
  failedGrantIDs: string[];
  keyCleanupFailed: boolean;
};

/**
 * Withdraws every stored consent, then revokes each grant. The local
 * withdrawal comes first: if it fails nothing is revoked, and a revoke that
 * fails afterwards leaves a live grant that no longer receives updates.
 * A revoked grant loses its local key and generation counter, as a single
 * revoke does; the anti-replay marker for its invite stays.
 */
export async function withdrawDataSharingConsentAndRevokePartnerGrants(
  deps: DataSharingConsentWithdrawalDeps,
  grantIDs: readonly string[],
): Promise<DataSharingConsentWithdrawalResult> {
  await withdrawAllDataSharingConsent(deps.storage);

  const result: DataSharingConsentWithdrawalResult = {
    revokedGrantIDs: [],
    failedGrantIDs: [],
    keyCleanupFailed: false,
  };
  for (const grantID of grantIDs) {
    const revoked = await revokeManagedPartnerGrant(
      deps.syncSecretStore,
      deps.syncMode,
      grantID,
    ).catch(() => null);
    if (!revoked?.ok) {
      result.failedGrantIDs.push(grantID);
      continue;
    }
    result.revokedGrantIDs.push(grantID);
    try {
      await clearManagedPartnerGrantKey(deps.partnerShareSecretStore, grantID);
    } catch {
      result.keyCleanupFailed = true;
    }
  }
  return result;
}

/** One line per partner, in the words the partner-access list uses. */
export function buildPartnerRevokeConfirmLines(
  grants: readonly ManagedCloudPartnerAccessGrant[],
  language: InterfaceLanguage,
): string[] {
  const copy = getPartnerCopy(language);
  return grants.map((grant) =>
    [
      copy.activePartnerLabel,
      grant.accessLevel === "full"
        ? copy.accessLevelFull
        : copy.accessLevelSummary,
      `${copy.lastSeenLabel}: ${formatBackupSyncLastSeen(grant.lastSeenAt, language, copy.lastSeenNever)}`,
    ].join(" · "),
  );
}
