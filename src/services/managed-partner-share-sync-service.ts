import type { PartnerShareSecretStore } from "../security/partner-share-secret-store";
import type { SyncSecretStore } from "../security/sync-secret-store";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { loadManagedPremiumFeatures } from "./managed-premium-features-service";
import { loadManagedPartnerAccess } from "./managed-partner-access-service";
import {
  isManagedPartnerGrantReshareRequired,
  reconcileManagedPartnerShareKeys,
  reserveNextManagedPartnerProjectionGeneration,
  resolveManagedPartnerProjectionAccessLevel,
  uploadManagedPartnerProjection,
} from "./managed-partner-share-service";
import {
  backOffManagedPartnerProjectionPush,
  isManagedPartnerProjectionPushBackedOff,
  resetManagedPartnerProjectionPushBackoff,
} from "./managed-partner-projection-backoff";
import { buildPartnerSharedProjectionPayload } from "./partner-shared-projection-service";
import { loadSyncSetupState } from "../sync/sync-setup-service";

type ManagedPartnerProjectionSyncResult = {
  skipped: boolean;
  syncedCount: number;
  // Grants whose key context the server will not accept: legacy grants and
  // grants re-keyed since this device derived its key.
  reshareRequiredGrantIDs: string[];
};

let projectionPassTail: Promise<unknown> = Promise.resolve();

// Passes run one at a time, in call order. The lock spans the whole pass
// (storage read, generation reserve, build, PUT): with overlapping passes, one
// that read storage earlier could still reserve a higher generation or finish
// its PUT last, leaving the server holding older data.
export function syncManagedPartnerSharedProjections(
  storage: LocalAppStorage,
  syncSecretStore: SyncSecretStore,
  partnerShareSecretStore: PartnerShareSecretStore,
  now: Date,
): Promise<ManagedPartnerProjectionSyncResult> {
  const pass = projectionPassTail.then(() =>
    runManagedPartnerProjectionPass(
      storage,
      syncSecretStore,
      partnerShareSecretStore,
      now,
    ),
  );
  projectionPassTail = pass.catch(() => undefined);
  return pass;
}

async function runManagedPartnerProjectionPass(
  storage: LocalAppStorage,
  syncSecretStore: SyncSecretStore,
  partnerShareSecretStore: PartnerShareSecretStore,
  now: Date,
): Promise<ManagedPartnerProjectionSyncResult> {
  const syncState = await loadSyncSetupState(storage, syncSecretStore);
  if (!syncState.hasAuthSession || syncState.preferences.mode !== "managed") {
    // The rate limit is per account: a back-off armed by a previous session
    // must not hold the next account's pushes.
    resetManagedPartnerProjectionPushBackoff();
    return { skipped: true, syncedCount: 0, reshareRequiredGrantIDs: [] };
  }
  if (isManagedPartnerProjectionPushBackedOff()) {
    return { skipped: true, syncedCount: 0, reshareRequiredGrantIDs: [] };
  }

  const premiumFeatures = await loadManagedPremiumFeatures(
    storage,
    syncSecretStore,
    syncState.preferences.mode,
    undefined,
    undefined,
    { liveOnly: true },
  );
  if (!premiumFeatures.partnerAccess) {
    return { skipped: true, syncedCount: 0, reshareRequiredGrantIDs: [] };
  }

  const partnerAccessResult = await loadManagedPartnerAccess(
    syncSecretStore,
    syncState.preferences.mode,
  );
  if (!partnerAccessResult.ok) {
    return { skipped: true, syncedCount: 0, reshareRequiredGrantIDs: [] };
  }

  const partnerShareSecrets = await reconcileManagedPartnerShareKeys(
    partnerShareSecretStore,
    partnerAccessResult.value,
    now,
  );
  const grants = partnerAccessResult.value.owned.grants.filter(
    (grant) => grant.revokedAt === null,
  );
  if (grants.length === 0) {
    return { skipped: true, syncedCount: 0, reshareRequiredGrantIDs: [] };
  }

  const [profile, symptomRecords, summary, activePregnancy] = await Promise.all([
    storage.readProfileRecord(),
    storage.listSymptomRecords(),
    storage.readDayLogSummary(),
    storage.readActivePregnancy(),
  ]);
  const dayLogs =
    summary.hasData && summary.dateFrom && summary.dateTo
      ? await storage.listDayLogRecordsInRange(summary.dateFrom, summary.dateTo)
      : [];

  let syncedCount = 0;
  const reshareRequiredGrantIDs: string[] = [];
  for (const grant of grants) {
    if (
      isManagedPartnerGrantReshareRequired(
        grant,
        partnerShareSecrets.grantKeysByGrantID[grant.id],
      )
    ) {
      reshareRequiredGrantIDs.push(grant.id);
      continue;
    }
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
    const projection = buildPartnerSharedProjectionPayload(
      {
        accessLevel: resolveManagedPartnerProjectionAccessLevel(
          partnerShareSecrets.grantKeysByGrantID[grant.id]?.accessLevel,
          grant.accessLevel,
        ),
        dayLogs,
        generatedAt: now.toISOString(),
        generation,
        grantID: grant.id,
        ownerAccountID: grant.ownerAccountID,
        profile,
        symptomRecords,
      },
      {
        // Mirrors the stats/calendar suppressPredictions pattern: an ACTIVE pregnancy
        // record must suppress partner-facing predictions even when the
        // day-log pause itself has already been lifted by a later period
        // log. The builder additionally recomputes the owner's own
        // (not-yet-lifted) pause internally, since that signal cannot
        // survive the day-log pregnancyTest redaction.
        suppressPredictions: activePregnancy !== null,
      },
    );

    const uploadResult = await uploadManagedPartnerProjection(
      syncSecretStore,
      syncState.preferences.mode,
      {
        projection,
        partnerShareSecretStore,
        listedSourceInviteID: grant.sourceInviteID,
      },
    );
    if (uploadResult.ok) {
      syncedCount += 1;
    } else if (uploadResult.errorCode === "partner_grant_rekeyed") {
      reshareRequiredGrantIDs.push(grant.id);
    } else if (uploadResult.errorCode === "rate_limited") {
      // The limit is per account, so the remaining grants would 429 too.
      backOffManagedPartnerProjectionPush(uploadResult.retryAfterSeconds);
      break;
    } else if (
      uploadResult.errorCode === "payload_too_large" ||
      uploadResult.errorCode === "invalid_partner_projection" ||
      uploadResult.errorCode === "generic"
    ) {
      // A refusal of the body itself (too large, malformed — the managed
      // client reads 400 `invalid_json` as `generic`) repeats on every sync;
      // hold later pushes for the default window. The remaining grants in
      // this pass still run: a summary-level grant's payload is far smaller
      // than a full-level one's.
      backOffManagedPartnerProjectionPush(undefined);
    }
  }

  return {
    skipped: false,
    syncedCount,
    reshareRequiredGrantIDs,
  };
}
