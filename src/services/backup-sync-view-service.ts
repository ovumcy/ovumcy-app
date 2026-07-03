import { formatSettingsLastSync } from "./settings-view-service";
import {
  supportsInlineSyncAccountAuth,
  type SyncCapabilityDocument,
  type SyncPreferencesRecord,
} from "../sync/sync-contract";
import type { ManagedCloudBillingManagement } from "../sync/managed-cloud-api-client";
import type {
  LoadedSettingsState,
  SettingsViewData,
} from "./settings-view-service";

export type BackupSyncErrorScope = "local" | "account" | "sync" | "delete_account";

export type BackupSyncErrorPresentation = {
  accountMessage: string;
  deleteAccountMessage: string;
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
  // guidanceMessage names the single next action (or current blocker) the owner
  // must resolve, so the screen never leaves them guessing why sync is locked.
  // It is one of the already-localized account strings, picked from the same
  // state inputs the steps use. guidanceComplete is true once backup is usable.
  guidanceComplete: boolean;
  guidanceMessage: string;
  guidanceStepNumber: number;
  hasManagedPlan: boolean;
  isManaged: boolean;
  lastSyncValue: string;
  localStepTitle: string;
  planMessage: string;
  // planCountdownMessage is the trial/subscription day countdown shown under the
  // plan banner, or "" when there is no managed subscription to count down.
  planCountdownMessage: string;
  planStepTitle: string;
  selectedModeLabel: string;
  shouldShowDisconnectOnly: boolean;
  shouldShowEndpointSummary: boolean;
  // Renewal management is driven STRICTLY by the server's billing_management
  // flags: both false (signed out, trial, cached billing truth, self-hosted)
  // renders no renewal row at all.
  showCancelRenewal: boolean;
  showResumeRenewal: boolean;
  showRenewalManagement: boolean;
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
  billingManagement,
  hasStoredSyncSecrets,
  hasSyncSession,
  isAuthenticating,
  isPreparing,
  isRecovering,
  isRestoring,
  isSyncing,
  locale,
  managedPlanStatus,
  notSetLabel,
  preferences,
  subscriptionCountdownMessage = "",
  syncCapabilities,
  viewData,
}: {
  billingManagement?: ManagedCloudBillingManagement | undefined;
  hasStoredSyncSecrets: boolean;
  hasSyncSession: boolean;
  isAuthenticating: boolean;
  isPreparing: boolean;
  isRecovering: boolean;
  isRestoring: boolean;
  isSyncing: boolean;
  locale?: string;
  managedPlanStatus: "unknown" | "inactive" | "active";
  notSetLabel: string;
  preferences: SyncPreferencesRecord;
  subscriptionCountdownMessage?: string;
  syncCapabilities: SyncCapabilityDocument | null;
  viewData: SettingsViewData["account"];
}): BackupSyncSetupPresentation {
  const isManaged = preferences.mode === "managed";
  const supportsInlineAccountAuth = supportsInlineSyncAccountAuth(preferences.mode);
  const hasManagedPlan = isManaged && managedPlanStatus === "active";
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
    if (managedPlanStatus === "unknown") {
      planMessage = viewData.planCheckFailed;
    } else if (managedPlanStatus === "active") {
      planMessage = viewData.planActive;
    } else {
      planMessage = viewData.planInactive;
    }
  }

  const showCancelRenewal = billingManagement?.canCancelAtPeriodEnd === true;
  const showResumeRenewal = billingManagement?.canResumeRenewal === true;

  const syncStepNumber = isManaged ? 4 : 3;
  let guidanceComplete = false;
  let guidanceMessage: string;
  let guidanceStepNumber: number;
  if (!hasStoredSyncSecrets) {
    guidanceStepNumber = 1;
    guidanceMessage = viewData.errors.syncNotPrepared;
  } else if (!hasSyncSession) {
    guidanceStepNumber = 2;
    guidanceMessage = isManaged
      ? viewData.accountStepHintManaged
      : viewData.accountStepHintSelfHosted;
  } else if (isManaged && !hasManagedPlan) {
    guidanceStepNumber = 3;
    guidanceMessage =
      managedPlanStatus === "unknown"
        ? viewData.planCheckFailed
        : viewData.syncBlockedNoPlan;
  } else if (canShowSyncActions) {
    guidanceStepNumber = syncStepNumber;
    guidanceMessage = viewData.status.connected;
    guidanceComplete = true;
  } else {
    guidanceStepNumber = syncStepNumber;
    guidanceMessage = viewData.status.connected;
  }

  return {
    guidanceComplete,
    guidanceMessage,
    guidanceStepNumber,
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
    planCountdownMessage: subscriptionCountdownMessage,
    planStepTitle: renumberStepTitle(viewData.planStepTitle, 3),
    selectedModeLabel,
    shouldShowDisconnectOnly:
      !canShowSyncActions && hasStoredSyncSecrets && hasSyncSession,
    shouldShowEndpointSummary: preferences.mode === "self_hosted",
    showCancelRenewal,
    showResumeRenewal,
    showRenewalManagement: showCancelRenewal || showResumeRenewal,
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
    case "billing_management_unavailable":
      return viewData.errors.renewalUnavailable;
    case "billing_subscription_conflict":
    case "billing_provider_unavailable":
      return viewData.errors.renewalUpdateFailed;
    default:
      return viewData.errors.saveFailed;
  }
}

export function resolveBackupSyncConnectedStatusMessage(
  state: LoadedSettingsState,
  viewData: SettingsViewData["account"],
): string {
  return state.syncPreferences.mode === "managed" &&
    state.managedPremiumAccess.planStatus === "inactive"
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
    deleteAccountMessage: "",
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

  // delete_account errors (unauthorized, network_failed, or a rare/unmapped
  // server code) always render in the dedicated delete-account banner, never
  // in the shared account/sync banners used by login, connect, or restore.
  if (scope === "delete_account") {
    return {
      ...emptyPresentation,
      deleteAccountMessage:
        errorCode === "not_connected" ||
        errorCode === "unauthorized" ||
        errorCode === "network_failed"
          ? message
          : viewData.errors.deleteAccountFailed,
    };
  }

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
