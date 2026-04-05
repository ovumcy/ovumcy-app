import { formatSettingsLastSync } from "./settings-view-service";
import {
  supportsInlineSyncAccountAuth,
  type SyncCapabilityDocument,
  type SyncPreferencesRecord,
} from "../sync/sync-contract";
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

export type BackupSyncSetupPresentation = {
  accountActionButtonsDisabled: boolean;
  accountActionsDisabled: boolean;
  accountStepTitle: string;
  actionLabel: string;
  canShowSyncActions: boolean;
  endpointSummary: string;
  hasManagedPlan: boolean;
  isManaged: boolean;
  lastSyncValue: string;
  localStepTitle: string;
  planMessage: string;
  planStepTitle: string;
  selectedModeLabel: string;
  shouldShowDisconnectOnly: boolean;
  shouldShowEndpointSummary: boolean;
  supportsInlineAccountAuth: boolean;
  syncStepTitle: string;
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

export function buildBackupSyncSetupPresentation({
  hasStoredSyncSecrets,
  hasSyncSession,
  isAuthenticating,
  isPreparing,
  isRecovering,
  isRestoring,
  isSyncing,
  locale,
  notSetLabel,
  preferences,
  syncCapabilities,
  viewData,
}: {
  hasStoredSyncSecrets: boolean;
  hasSyncSession: boolean;
  isAuthenticating: boolean;
  isPreparing: boolean;
  isRecovering: boolean;
  isRestoring: boolean;
  isSyncing: boolean;
  locale?: string;
  notSetLabel: string;
  preferences: SyncPreferencesRecord;
  syncCapabilities: SyncCapabilityDocument | null;
  viewData: SettingsViewData["account"];
}): BackupSyncSetupPresentation {
  const isManaged = preferences.mode === "managed";
  const supportsInlineAccountAuth = supportsInlineSyncAccountAuth(preferences.mode);
  const hasManagedPlan = isManaged && syncCapabilities?.premiumActive === true;
  const syncEnabled = syncCapabilities?.syncEnabled !== false;
  const accountActionsDisabled =
    isPreparing || isAuthenticating || isRecovering || isRestoring || isSyncing;
  const canShowSyncActions =
    hasStoredSyncSecrets &&
    hasSyncSession &&
    syncEnabled &&
    (!isManaged || hasManagedPlan);
  const selectedModeLabel =
    viewData.modeOptions.find((option) => option.value === preferences.mode)?.label ??
    preferences.mode;
  const endpointSummary =
    preferences.mode === "managed"
      ? selectedModeLabel
      : preferences.endpointInput.trim() || notSetLabel;

  let planMessage = viewData.planSignInFirst;
  if (isManaged && hasSyncSession) {
    if (!syncCapabilities) {
      planMessage = viewData.planCheckFailed;
    } else if (syncCapabilities.premiumActive) {
      planMessage = viewData.planActive;
    } else {
      planMessage = viewData.planInactive;
    }
  }

  return {
    accountActionButtonsDisabled: accountActionsDisabled || !hasStoredSyncSecrets,
    accountActionsDisabled,
    accountStepTitle: renumberStepTitle(viewData.accountStepTitle, 2),
    actionLabel: hasStoredSyncSecrets
      ? viewData.regenerateLabel
      : viewData.prepareLabel,
    canShowSyncActions,
    endpointSummary,
    hasManagedPlan,
    isManaged,
    lastSyncValue: preferences.lastSyncedAt
      ? formatSettingsLastSync(preferences.lastSyncedAt, locale)
      : viewData.lastSyncNever,
    localStepTitle: renumberStepTitle(viewData.localStepTitle, 1),
    planMessage,
    planStepTitle: renumberStepTitle(viewData.planStepTitle, 3),
    selectedModeLabel,
    shouldShowDisconnectOnly:
      !canShowSyncActions && hasStoredSyncSecrets && hasSyncSession,
    shouldShowEndpointSummary: preferences.mode === "self_hosted",
    supportsInlineAccountAuth,
    syncStepTitle: renumberStepTitle(viewData.syncStepTitle, isManaged ? 4 : 3),
  };
}

export function formatBackupSyncLastSeen(
  value: string | null,
  locale: string | undefined,
  neverLabel: string,
): string {
  if (!value) {
    return neverLabel;
  }

  return formatSettingsLastSync(value, locale);
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

function renumberStepTitle(title: string, stepNumber: number): string {
  return `${stepNumber}. ${title.replace(/^\d+\.\s*/u, "")}`;
}
