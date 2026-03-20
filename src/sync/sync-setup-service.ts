import type { SyncSecretStore } from "../security/sync-secret-store";
import { createSyncSecretsRecord } from "../security/sync-crypto";
import type { LocalAppStorage } from "../storage/local/storage-contract";
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
  hasStoredSecrets: boolean;
  preferences: SyncPreferencesRecord;
};

export type PrepareSyncSetupErrorCode =
  | "endpoint_required"
  | "invalid_endpoint"
  | "unsupported_scheme"
  | "insecure_public_http"
  | "device_label_required"
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
  };

  try {
    const result = createSyncSecretsRecord(nextLabel, now);
    await secretStore.writeSyncSecrets(result.record);
    await storage.writeSyncPreferencesRecord(nextPreferences);

    return {
      ok: true,
      preferences: nextPreferences,
      recoveryPhrase: result.recoveryPhrase,
      secrets: result.record,
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
  };

  try {
    if (shouldResetPreparedState) {
      await secretStore.clearSyncSecrets();
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
