import type { SyncPreferencesRecord } from "../sync/sync-contract";
import type {
  LoadedSettingsState,
  SettingsViewData,
} from "./settings-view-service";

export type BackupSyncErrorScope = "local" | "account" | "sync";

export type BackupSyncErrorPresentation = {
  accountMessage: string;
  deviceLabelMessage: string;
  endpointMessage: string;
  localMessage: string;
  loginMessage: string;
  passwordMessage: string;
  recoveryPhraseMessage: string;
  syncMessage: string;
};

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
    case "recovery_phrase_required":
      return viewData.errors.recoveryPhraseRequired;
    case "invalid_recovery_phrase":
      return viewData.errors.invalidRecoveryPhrase;
    case "recovery_not_available":
      return viewData.errors.recoveryNotAvailable;
    case "recovery_package_not_found":
      return viewData.errors.recoveryPackageNotFound;
    case "too_many_devices":
      return viewData.errors.tooManyDevices;
    case "sync_not_prepared":
      return viewData.errors.syncNotPrepared;
    case "sync_not_allowed":
      return viewData.syncBlockedNoPlan;
    case "not_connected":
    case "unauthorized":
      return viewData.errors.notConnected;
    case "blob_not_found":
      return viewData.errors.blobNotFound;
    case "invalid_payload":
      return viewData.errors.invalidPayload;
    case "network_failed":
      return viewData.errors.networkFailed;
    case "deviceAuthUnavailable":
    case "device_auth_unavailable":
      return viewData.errors.deviceAuthUnavailable;
    case "deviceAuthFailed":
    case "device_auth_failed":
      return viewData.errors.deviceAuthFailed;
    case "recovery_export_unavailable":
      return viewData.errors.recoveryExportUnavailable;
    case "recovery_export_failed":
      return viewData.errors.recoveryExportFailed;
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

export function resolveBackupSyncErrorPresentation(
  errorCode: string | null | undefined,
  scope: BackupSyncErrorScope | null | undefined,
  viewData: SettingsViewData["account"],
): BackupSyncErrorPresentation {
  const emptyPresentation: BackupSyncErrorPresentation = {
    accountMessage: "",
    deviceLabelMessage: "",
    endpointMessage: "",
    localMessage: "",
    loginMessage: "",
    passwordMessage: "",
    recoveryPhraseMessage: "",
    syncMessage: "",
  };

  if (!errorCode) {
    return emptyPresentation;
  }

  const message = resolveBackupSyncErrorMessage(errorCode, viewData);

  switch (errorCode) {
    case "device_label_required":
      return {
        ...emptyPresentation,
        deviceLabelMessage: message,
      };
    case "endpoint_required":
    case "invalid_endpoint":
    case "unsupported_scheme":
    case "insecure_public_http":
      return {
        ...emptyPresentation,
        endpointMessage: message,
      };
    case "login_required":
      return {
        ...emptyPresentation,
        loginMessage: message,
      };
    case "password_required":
      return {
        ...emptyPresentation,
        passwordMessage: message,
      };
    case "recovery_phrase_required":
    case "invalid_recovery_phrase":
      return {
        ...emptyPresentation,
        recoveryPhraseMessage: message,
      };
    default:
      if (scope === "local") {
        return {
          ...emptyPresentation,
          localMessage: message,
        };
      }
      if (scope === "account") {
        return {
          ...emptyPresentation,
          accountMessage: message,
        };
      }

      return {
        ...emptyPresentation,
        syncMessage: message,
      };
  }
}
