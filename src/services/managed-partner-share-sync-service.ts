import type { PartnerShareSecretStore } from "../security/partner-share-secret-store";
import type { SyncSecretStore } from "../security/sync-secret-store";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { loadManagedPremiumFeatures } from "./managed-premium-features-service";
import { loadManagedPartnerAccess } from "./managed-partner-access-service";
import {
  reconcileManagedPartnerShareKeys,
  reserveNextManagedPartnerProjectionGeneration,
  uploadManagedPartnerProjection,
} from "./managed-partner-share-service";
import { buildPartnerSharedProjectionPayload } from "./partner-shared-projection-service";
import { loadSyncSetupState } from "../sync/sync-setup-service";

export async function syncManagedPartnerSharedProjections(
  storage: LocalAppStorage,
  syncSecretStore: SyncSecretStore,
  partnerShareSecretStore: PartnerShareSecretStore,
  now: Date,
): Promise<{
  skipped: boolean;
  syncedCount: number;
}> {
  const syncState = await loadSyncSetupState(storage, syncSecretStore);
  if (!syncState.hasAuthSession || syncState.preferences.mode !== "managed") {
    return { skipped: true, syncedCount: 0 };
  }

  const premiumFeatures = await loadManagedPremiumFeatures(
    syncSecretStore,
    syncState.preferences.mode,
  );
  if (!premiumFeatures.partnerAccess) {
    return { skipped: true, syncedCount: 0 };
  }

  const partnerAccessResult = await loadManagedPartnerAccess(
    syncSecretStore,
    syncState.preferences.mode,
  );
  if (!partnerAccessResult.ok) {
    return { skipped: true, syncedCount: 0 };
  }

  await reconcileManagedPartnerShareKeys(
    partnerShareSecretStore,
    partnerAccessResult.value,
    now,
  );
  const grants = partnerAccessResult.value.owned.grants.filter(
    (grant) => grant.revokedAt === null,
  );
  if (grants.length === 0) {
    return { skipped: true, syncedCount: 0 };
  }

  const [profile, symptomRecords, summary] = await Promise.all([
    storage.readProfileRecord(),
    storage.listSymptomRecords(),
    storage.readDayLogSummary(),
  ]);
  const dayLogs =
    summary.hasData && summary.dateFrom && summary.dateTo
      ? await storage.listDayLogRecordsInRange(summary.dateFrom, summary.dateTo)
      : [];

  let syncedCount = 0;
  for (const grant of grants) {
    // Reserve the next monotonic generation BEFORE building the payload so
    // the value lives inside the AEAD-protected ciphertext (partner-side F5
    // anti-replay check rejects regressions below the last-seen marker). The
    // counter is incremented and persisted even if the upload below fails:
    // gaps in the sequence are intentional and safe — only regression is
    // treated as tampering.
    const generation = await reserveNextManagedPartnerProjectionGeneration(
      partnerShareSecretStore,
      grant.id,
    );
    const projection = buildPartnerSharedProjectionPayload({
      accessLevel: grant.accessLevel,
      dayLogs,
      generatedAt: now.toISOString(),
      generation,
      grantID: grant.id,
      ownerAccountID: grant.ownerAccountID,
      profile,
      symptomRecords,
    });

    const uploadResult = await uploadManagedPartnerProjection(
      syncSecretStore,
      syncState.preferences.mode,
      {
        projection,
        partnerShareSecretStore,
      },
    );
    if (uploadResult.ok) {
      syncedCount += 1;
    }
  }

  return {
    skipped: false,
    syncedCount,
  };
}
