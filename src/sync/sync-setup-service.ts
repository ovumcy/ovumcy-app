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
    const existingSecrets = await secretStore.readSyncSecrets();
    const result = createSyncSecretsRecord(nextLabel, now);
    await secretStore.writeSyncSecrets({
      ...result.record,
      managedAuthSessionToken: existingSecrets?.managedAuthSessionToken ?? null,
    });
    await storage.writeSyncPreferencesRecord(nextPreferences);

    return {
      ok: true,
      preferences: nextPreferences,
      recoveryPhrase: result.recoveryPhrase,
      secrets: {
        ...result.record,
        managedAuthSessionToken: existingSecrets?.managedAuthSessionToken ?? null,
      },
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

  const materialChange =
    savedPreferences.mode !== nextMode ||
    savedPreferences.deviceLabel.trim() !== nextDeviceLabel ||
    savedPreferences.normalizedEndpoint !== nextNormalizedEndpoint;

  const shouldResetPreparedState = hasStoredSecrets && materialChange;
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
    // A materially-changed draft (mode/label/endpoint) with existing secrets
    // clears local secrets below, ending any guest session context along
    // with them; otherwise this is a local-only save (device label, etc.)
    // that must not disturb an unrelated guest marker.
    guestSessionExpiresAt: shouldResetPreparedState
      ? null
      : savedPreferences.guestSessionExpiresAt,
  };

  try {
    if (shouldResetPreparedState) {
      await secretStore.clearSyncSecrets();
      // Clearing sync secrets ends the managed session context (mode switch,
      // endpoint change, relabel): purge the billing-snapshot cache alongside,
      // per the same session-boundary invariant as the partner-invite buffer.
      await storage.writeManagedBillingCacheRecord(
        createDefaultManagedBillingCacheRecord(),
      );
    }
    await storage.writeSyncPreferencesRecord(nextPreferences);

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
