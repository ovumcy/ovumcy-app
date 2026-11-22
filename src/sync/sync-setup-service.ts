import type { SyncSecretStore } from "../security/sync-secret-store";
import { createSyncSecretsRecord } from "../security/sync-crypto";
// isGuestPartnerAccount is a pure predicate over SyncPreferencesRecord (see
// its doc comment in backup-sync-view-service.ts for why presence of
// guestSessionExpiresAt is the single source of truth for guest mode).
// Reusing it here — rather than re-deriving the same check locally — keeps
// this refusal from silently drifting out of sync with the guest-status
// check every other guest-aware surface uses. account-deletion-service.ts
// already imports a pure services-layer helper the same way.
import { isGuestPartnerAccount } from "../services/backup-sync-view-service";
import { clearAccountChangeRecoveryPhrase } from "./account-change-recovery-phrase";
import { isSyncDeviceLabelLengthValid } from "./sync-input-limits";
import {
  createDefaultManagedBillingCacheRecord,
  type LocalAppStorage,
} from "../storage/local/storage-contract";
import {
  MANAGED_SYNC_BASE_URL,
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
  type SyncSecretsRecord,
} from "./sync-contract";
import {
  normalizeSyncEndpoint,
  type NormalizeSyncEndpointErrorCode,
} from "./sync-endpoint-policy";

export type LoadSyncSetupStateResult = {
  hasAuthSession: boolean;
  hasStoredSecrets: boolean;
  preferences: SyncPreferencesRecord;
};

export type PrepareSyncSetupErrorCode =
  | "endpoint_required"
  | "invalid_endpoint"
  | "unsupported_scheme"
  | "insecure_public_http"
  | "device_label_required"
  | "device_label_invalid_length"
  // Defense-in-depth: a guest partner session must never receive a real
  // recovery phrase (docs/sync-trust-model.md "Guest Partner Access" —
  // "Guests never see a recovery phrase"). The UI already hides the
  // prepare/regenerate affordance for a guest session
  // (SettingsSyncSetupSection via buildBackupSyncSetupPresentation's
  // shouldShowPrepareAction), but this is the function that actually mints
  // and returns the phrase, so it refuses independently of the caller.
  | "guest_recovery_phrase_blocked"
  | "generic";

export type SaveSyncPreferencesDraftErrorCode =
  | NormalizeSyncEndpointErrorCode
  | "device_label_invalid_length"
  | "generic";

export async function loadSyncSetupState(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
): Promise<LoadSyncSetupStateResult> {
  const [preferences, secrets] = await Promise.all([
    storage.readSyncPreferencesRecord(),
    secretStore.readSyncSecrets(),
  ]);

  return {
    hasAuthSession:
      typeof secrets?.authSessionToken === "string" ||
      typeof secrets?.managedAuthSessionToken === "string",
    preferences,
    hasStoredSecrets: secrets !== null,
  };
}

export async function prepareSyncSetup(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentPreferences: SyncPreferencesRecord,
  now: Date,
): Promise<
  | {
      ok: true;
      preferences: SyncPreferencesRecord;
      recoveryPhrase: string;
      secrets: SyncSecretsRecord;
    }
  | {
      ok: false;
      errorCode: PrepareSyncSetupErrorCode;
    }
> {
  if (isGuestPartnerAccount(currentPreferences)) {
    return {
      ok: false,
      errorCode: "guest_recovery_phrase_blocked",
    };
  }

  const nextLabel = currentPreferences.deviceLabel.trim();
  if (nextLabel.length === 0) {
    return {
      ok: false,
      errorCode: "device_label_required",
    };
  }
  if (!isSyncDeviceLabelLengthValid(nextLabel)) {
    return {
      ok: false,
      errorCode: "device_label_invalid_length",
    };
  }

  const normalizedEndpoint = normalizeSyncEndpoint(
    currentPreferences.mode,
    currentPreferences.endpointInput,
  );
  if (!normalizedEndpoint.ok) {
    return normalizedEndpoint;
  }

  const nextPreferences: SyncPreferencesRecord = {
    ...createDefaultSyncPreferencesRecord(),
    ...currentPreferences,
    deviceLabel: nextLabel,
    endpointInput:
      currentPreferences.mode === "self_hosted"
        ? currentPreferences.endpointInput.trim()
        : "",
    normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
    preparedAt: now.toISOString(),
    setupStatus: "local_ready",
    lastRemoteGeneration: null,
    lastSyncedAt: null,
  };

  try {
    const [existingSecrets, savedPreferences] = await Promise.all([
      secretStore.readSyncSecrets(),
      storage.readSyncPreferencesRecord(),
    ]);
    const result = createSyncSecretsRecord(nextLabel, now);
    // New keys do not end the signed-in session: dropping its tokens without
    // a logout would leave the server session alive while every caller that
    // needs it (account deletion included) treats the device as signed out.
    // A self-hosted token is kept only for the server that issued it.
    const sameSelfHostedServer =
      savedPreferences.mode === "self_hosted" &&
      nextPreferences.mode === "self_hosted" &&
      savedPreferences.normalizedEndpoint === nextPreferences.normalizedEndpoint;
    const secrets: SyncSecretsRecord = {
      ...result.record,
      authSessionToken: sameSelfHostedServer
        ? (existingSecrets?.authSessionToken ?? null)
        : null,
      managedAuthSessionToken: existingSecrets?.managedAuthSessionToken ?? null,
      managedAuthSessionExpiresAt:
        existingSecrets?.managedAuthSessionExpiresAt ?? null,
      managedRefreshToken: existingSecrets?.managedRefreshToken ?? null,
      managedRefreshTokenExpiresAt:
        existingSecrets?.managedRefreshTokenExpiresAt ?? null,
    };
    await secretStore.writeSyncSecrets(secrets);
    // A new key serves the account of the session it keeps; with no session
    // left it is bound to none yet, so the next sign-in, to any account,
    // keeps it and the phrase revealed below stays the one that opens it. Only
    // the current mode's session counts: a token of the other mode can outlive
    // a disconnect.
    const retainsSession =
      nextPreferences.mode === "managed"
        ? secrets.managedAuthSessionToken !== null
        : secrets.authSessionToken !== null;
    const preparedPreferences: SyncPreferencesRecord = retainsSession
      ? nextPreferences
      : { ...nextPreferences, accountId: null };
    // A new sync key can never finish a restore of the old backup, so an
    // unfinished-restore mark would block uploads for good. With the floor
    // reset, the fresh-install probe asks before overwriting a backup instead.
    await storage.writeSyncPreferencesRecord(preparedPreferences, {
      restoreInProgress: false,
    });

    return {
      ok: true,
      preferences: preparedPreferences,
      recoveryPhrase: result.recoveryPhrase,
      secrets,
    };
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }
}

export async function saveSyncPreferencesDraft(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  savedPreferences: SyncPreferencesRecord,
  currentPreferences: SyncPreferencesRecord,
  hasStoredSecrets: boolean,
): Promise<
  | {
      ok: true;
      preferences: SyncPreferencesRecord;
      hasStoredSecrets: boolean;
    }
  | {
      ok: false;
      errorCode: SaveSyncPreferencesDraftErrorCode;
    }
> {
  const nextMode = currentPreferences.mode;
  const nextDeviceLabel = currentPreferences.deviceLabel.trim();
  const nextEndpointInput =
    nextMode === "self_hosted" ? currentPreferences.endpointInput.trim() : "";
  // An empty label may still be saved as a draft; prepare requires one.
  if (nextDeviceLabel.length > 0 && !isSyncDeviceLabelLengthValid(nextDeviceLabel)) {
    return { ok: false, errorCode: "device_label_invalid_length" };
  }

  let nextNormalizedEndpoint = MANAGED_SYNC_BASE_URL;
  if (nextMode === "self_hosted") {
    if (nextEndpointInput.length > 0) {
      const normalizedEndpoint = normalizeSyncEndpoint(nextMode, nextEndpointInput);
      if (!normalizedEndpoint.ok) {
        return normalizedEndpoint;
      }
      nextNormalizedEndpoint = normalizedEndpoint.endpoint.baseURL;
    } else {
      nextNormalizedEndpoint = "";
    }
  }

  // The device label is not material: the stored keys, session and rollback
  // floor stay valid under a new label, so a relabel is applied in place.
  const materialChange =
    savedPreferences.mode !== nextMode ||
    savedPreferences.normalizedEndpoint !== nextNormalizedEndpoint;

  const shouldResetPreparedState = hasStoredSecrets && materialChange;
  const shouldRelabelStoredSecrets =
    hasStoredSecrets &&
    !shouldResetPreparedState &&
    nextDeviceLabel.length > 0 &&
    savedPreferences.deviceLabel.trim() !== nextDeviceLabel;
  const nextPreferences: SyncPreferencesRecord = {
    ...createDefaultSyncPreferencesRecord(),
    mode: nextMode,
    endpointInput: nextEndpointInput,
    normalizedEndpoint: nextNormalizedEndpoint,
    deviceLabel: nextDeviceLabel,
    setupStatus: shouldResetPreparedState
      ? "not_configured"
      : savedPreferences.setupStatus,
    preparedAt: shouldResetPreparedState ? null : savedPreferences.preparedAt,
    lastRemoteGeneration: shouldResetPreparedState
      ? null
      : savedPreferences.lastRemoteGeneration,
    lastSyncedAt: shouldResetPreparedState ? null : savedPreferences.lastSyncedAt,
    accountId: shouldResetPreparedState ? null : savedPreferences.accountId,
    // A materially-changed draft (mode/endpoint) with existing secrets clears
    // local secrets below, ending any guest session context along with them;
    // otherwise this is a local-only save (device label, etc.) that must not
    // disturb an unrelated guest marker.
    guestSessionExpiresAt: shouldResetPreparedState
      ? null
      : savedPreferences.guestSessionExpiresAt,
  };

  try {
    if (shouldResetPreparedState) {
      clearAccountChangeRecoveryPhrase();
      await secretStore.clearSyncSecrets();
      // Clearing sync secrets ends the managed session context (mode switch or
      // endpoint change): purge the billing-snapshot cache alongside, per the
      // same session-boundary invariant as the partner-invite buffer.
      await storage.writeManagedBillingCacheRecord(
        createDefaultManagedBillingCacheRecord(),
      );
    } else if (shouldRelabelStoredSecrets) {
      // Only the local device identity is relabelled; no server device
      // record is renamed here.
      const storedSecrets = await secretStore.readSyncSecrets();
      if (storedSecrets) {
        await secretStore.writeSyncSecrets({
          ...storedSecrets,
          device: { ...storedSecrets.device, deviceLabel: nextDeviceLabel },
        });
      }
    }
    // Cleared secrets end the old backup relationship along with the floor;
    // see prepareSyncSetup for why the unfinished-restore mark goes too.
    await storage.writeSyncPreferencesRecord(
      nextPreferences,
      shouldResetPreparedState ? { restoreInProgress: false } : undefined,
    );

    return {
      ok: true,
      preferences: nextPreferences,
      hasStoredSecrets: shouldResetPreparedState ? false : hasStoredSecrets,
    };
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }
}
