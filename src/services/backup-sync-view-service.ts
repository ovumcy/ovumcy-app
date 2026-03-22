import type { SyncPreferencesRecord } from "../sync/sync-contract";
import type {
  LoadedSettingsState,
  SettingsViewData,
} from "./settings-view-service";

export function areSyncPreferencesEqual(
  left: SyncPreferencesRecord,
  right: SyncPreferencesRecord,
): boolean {
  return (
    left.mode === right.mode &&
    left.endpointInput === right.endpointInput &&
    left.normalizedEndpoint === right.normalizedEndpoint &&
    left.deviceLabel === right.deviceLabel &&
    left.setupStatus === right.setupStatus &&
    left.preparedAt === right.preparedAt &&
    left.lastRemoteGeneration === right.lastRemoteGeneration &&
    left.lastSyncedAt === right.lastSyncedAt
  );
}

export function buildBackupSyncDirtyState(
  state: LoadedSettingsState | null,
): boolean {
  return state
    ? !areSyncPreferencesEqual(state.syncPreferences, state.savedSyncPreferences)
    : false;
}

export function revertBackupSyncDraftState(
  state: LoadedSettingsState,
): LoadedSettingsState {
  return {
    ...state,
    syncPreferences: state.savedSyncPreferences,
  };
}

export function resolveBackupSyncErrorMessage(
  errorCode: string,
  viewData: SettingsViewData["account"],
): string {
  switch (errorCode) {
    case "login_required":
      return viewData.errors.loginRequired;
    case "password_required":
      return viewData.errors.passwordRequired;
    case "device_label_required":
      return viewData.errors.deviceLabelRequired;
    case "endpoint_required":
      return viewData.errors.endpointRequired;
    case "invalid_endpoint":
      return viewData.errors.invalidEndpoint;
    case "unsupported_scheme":
      return viewData.errors.unsupportedScheme;
    case "insecure_public_http":
      return viewData.errors.insecurePublicHttp;
    case "invalid_registration_input":
      return viewData.errors.invalidRegistrationInput;
    case "registration_failed":
      return viewData.errors.registrationFailed;
    case "invalid_credentials":
      return viewData.errors.invalidCredentials;
    case "too_many_devices":
      return viewData.errors.tooManyDevices;
    case "sync_not_prepared":
      return viewData.errors.syncNotPrepared;
    case "not_connected":
    case "unauthorized":
      return viewData.errors.notConnected;
    case "blob_not_found":
      return viewData.errors.blobNotFound;
    case "invalid_payload":
      return viewData.errors.invalidPayload;
    case "network_failed":
      return viewData.errors.networkFailed;
    case "stale_generation":
      return viewData.errors.syncFailed;
    default:
      return viewData.errors.saveFailed;
  }
}

export function resolveBackupSyncConnectedStatusMessage(
  state: LoadedSettingsState,
  viewData: SettingsViewData["account"],
): string {
  return state.syncPreferences.mode === "managed" &&
    state.syncCapabilities &&
    !state.syncCapabilities.premiumActive
    ? viewData.status.connectedNoPlan
    : viewData.status.connected;
}
