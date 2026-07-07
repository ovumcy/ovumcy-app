import { usePreventRemove } from "@react-navigation/native";

import { getSubscriptionCopy } from "../../../i18n/subscription-copy";
import {
  buildBackupSyncSetupPresentation,
  resolveBackupSyncErrorPresentation,
} from "../../../services/backup-sync-view-service";
import {
  resolveVisibleBillingOffers,
} from "../../../services/offers-service";
import {
  describeSubscriptionCountdown,
  formatSubscriptionCountdownMessage,
} from "../../../services/subscription-countdown-service";
import { clearManagedPartnerInviteToken } from "../../../security/managed-partner-invite-token-buffer";
import {
  openLeaveConfirmation,
} from "../../confirm/open-confirmation";
import type { BackupSyncFlowScreenProps } from "../BackupSyncFlowScreen";
import {
  useBackupSyncSessionCore,
  type BackupSyncSessionCoreOptions,
} from "./useBackupSyncSessionCore";
import { useBackupSyncRecoveryMaterials } from "./useBackupSyncRecoveryMaterials";
import { useBackupSyncAccountConnection } from "./useBackupSyncAccountConnection";
import { useBackupSyncActions } from "./useBackupSyncActions";
import { useBackupSyncManagedPlan } from "./useBackupSyncManagedPlan";
import { useBackupSyncPartnerAccess } from "./useBackupSyncPartnerAccess";
import { useBackupSyncAccountDeletion } from "./useBackupSyncAccountDeletion";
import { useBackupSyncDeviceManagement } from "./useBackupSyncDeviceManagement";

type BackupSyncScreenControllerOptions = BackupSyncSessionCoreOptions;

type BackupSyncScreenControllerResult = {
  accentColor: string;
  flowProps: BackupSyncFlowScreenProps | null;
  loadingDescription: string;
  loadingTitle: string;
};

/**
 * Composition root for the backup & sync screen. It wires the shared session
 * core to the concern hooks (recovery materials, account connection, sync
 * actions, managed plan, partner access, account deletion, device management),
 * owns the cross-hook leave guard, and assembles the presentation view-data
 * into the flat `flowProps` object the screen consumes. All product logic
 * lives in the services those hooks call; this file is orchestration + glue
 * only.
 */
export function useBackupSyncScreenController(
  options: BackupSyncScreenControllerOptions,
): BackupSyncScreenControllerResult {
  const core = useBackupSyncSessionCore(options);
  const recovery = useBackupSyncRecoveryMaterials(core);
  const connection = useBackupSyncAccountConnection(core);
  const actions = useBackupSyncActions(core);
  const managedPlan = useBackupSyncManagedPlan(core);
  const partner = useBackupSyncPartnerAccess(core);
  const deletion = useBackupSyncAccountDeletion(core);
  const deviceManagement = useBackupSyncDeviceManagement(core);

  const {
    accountStatusMessage,
    colors,
    dismissedOfferIDs,
    effectiveNow,
    errorState,
    generatedRecoveryCode,
    generatedRecoveryPhrase,
    isLoading,
    isSavingSyncDraft,
    isSyncDirty,
    language,
    navigation,
    partnerCopy,
    partnerErrorMessage,
    partnerOverview,
    partnerStatusMessage,
    pendingPartnerInviteToken,
    recoveryPhraseInputValue,
    resetFeedbackMessages,
    resetPartnerFeedback,
    revertUnsavedSync,
    router,
    saveSyncDraftIfNeeded,
    setPendingPartnerInviteToken,
    setPartnerOverview,
    setShowPartnerOwnerControls,
    setState,
    shellCopy,
    showPartnerOwnerControls,
    state,
    viewData,
  } = core;

  const errorPresentation = resolveBackupSyncErrorPresentation(
    errorState?.code,
    errorState?.scope,
    viewData.account,
  );

  usePreventRemove(
    isSyncDirty &&
      !isSavingSyncDraft &&
      !recovery.isPreparingSync &&
      !connection.isAuthenticatingSync &&
      !connection.isRecoveringSync &&
      !actions.isRestoringSync &&
      !actions.isSyncingNow,
    ({ data }) => {
      void (async () => {
        const outcome = await openLeaveConfirmation(
          viewData.account.unsavedPrompt,
          viewData.account.saveBeforeLeaveLabel,
          viewData.account.discardChangesLabel,
          viewData.account.keepEditingLabel,
        );

        if (outcome === "dismiss") {
          return;
        }

        if (outcome === "reject") {
          revertUnsavedSync();
          requestAnimationFrame(() => {
            navigation.dispatch(data.action);
          });
          return;
        }

        const savedState = await saveSyncDraftIfNeeded("local");
        if (savedState) {
          requestAnimationFrame(() => {
            navigation.dispatch(data.action);
          });
        }
      })();
    },
  );

  if (isLoading || !state) {
    return {
      accentColor: colors.accent,
      flowProps: null,
      loadingDescription: shellCopy.loading.backupSyncDescription,
      loadingTitle: shellCopy.loading.backupSyncTitle,
    };
  }

  const subscriptionCountdownMessage = formatSubscriptionCountdownMessage(
    describeSubscriptionCountdown(
      state.managedPremiumAccess.activeSubscription,
      new Date().toISOString(),
    ),
    getSubscriptionCopy(language),
  );
  const presentation = buildBackupSyncSetupPresentation({
    billingManagement: state.managedPremiumAccess.billingManagement,
    hasStoredSyncSecrets: state.hasStoredSyncSecrets,
    hasSyncSession: state.hasSyncSession,
    isAuthenticating: connection.isAuthenticatingSync,
    isPreparing: recovery.isPreparingSync,
    isRecovering: connection.isRecoveringSync,
    isRestoring: actions.isRestoringSync,
    // A renewal update or an in-flight account deletion disables the same
    // action set as a running upload, so the owner cannot double-submit
    // billing changes or another destructive action mid-deletion.
    isSyncing:
      actions.isSyncingNow ||
      managedPlan.isUpdatingRenewal ||
      deletion.isDeletingAccount,
    locale: language,
    managedPlanStatus: state.managedPremiumAccess.planStatus,
    notSetLabel: viewData.common.notSet,
    preferences: state.syncPreferences,
    subscriptionCountdownMessage,
    syncCapabilities: state.syncCapabilities,
    viewData: viewData.account,
  });
  const billingOffers = resolveVisibleBillingOffers({
    offers: state.managedPremiumAccess.offers,
    now: effectiveNow,
    language,
    dismissedOfferIDs,
  });
  const showPartnerSection =
    presentation.isManaged &&
    (pendingPartnerInviteToken.length > 0 ||
      showPartnerOwnerControls ||
      partner.partnerInviteLink.length > 0 ||
      (partnerOverview?.owned.invites.length ?? 0) > 0 ||
      (partnerOverview?.owned.grants.length ?? 0) > 0 ||
      (partnerOverview?.sharedWithMe.length ?? 0) > 0);

  return {
    accentColor: colors.accent,
    flowProps: {
      authLoginValue: connection.accountLoginValue,
      authPasswordValue: connection.accountPasswordValue,
      backLabel: viewData.account.backToSettingsLabel,
      billingOffers,
      confirmActionLabel: viewData.common.confirmAction,
      deviceErrorMessage: deviceManagement.deviceErrorMessage,
      deviceListItems: deviceManagement.deviceListItems,
      deviceStatusMessage: deviceManagement.deviceStatusMessage,
      errorPresentation,
      generatedRecoveryCode,
      generatedRecoveryPhrase,
      hasStoredSyncSecrets: state.hasStoredSyncSecrets,
      hasSyncSession: state.hasSyncSession,
      isDeviceBusy: deviceManagement.isDeviceBusy,
      isExportingRecoveryPhrase: recovery.isExportingRecoveryPhrase,
      isPartnerBusy: partner.isPartnerBusy,
      isPreparing: recovery.isPreparingSync,
      onBack: () => {
        router.replace("/(tabs)/settings");
      },
      onAuthLoginChange: (value) => {
        resetFeedbackMessages();
        connection.setAccountLoginValue(value);
      },
      onAuthPasswordChange: (value) => {
        resetFeedbackMessages();
        connection.setAccountPasswordValue(value);
      },
      onDeviceLabelChange: (value) => {
        resetFeedbackMessages();
        setState((current) =>
          current
            ? {
                ...current,
                syncPreferences: {
                  ...current.syncPreferences,
                  deviceLabel: value,
                },
              }
            : current,
        );
      },
      onCancelRenewal: () => {
        void managedPlan.handleUpdateRenewal("cancel_at_period_end");
      },
      onDisconnect: () => {
        void connection.handleDisconnectSync();
      },
      onDeleteAccount: () => {
        void deletion.handleDeleteAccount();
      },
      onDismissOffer: (offerID) => {
        void managedPlan.handleDismissOffer(offerID);
      },
      onEndpointChange: (value) => {
        resetFeedbackMessages();
        setState((current) =>
          current
            ? {
                ...current,
                syncPreferences: {
                  ...current.syncPreferences,
                  endpointInput: value,
                },
              }
            : current,
        );
      },
      onAcknowledgeRecoveryCode: recovery.handleAcknowledgeRecoveryCode,
      onExportRecoveryPhrase: () => {
        void recovery.handleExportRecoveryPhrase();
      },
      onIssuePartnerInvite: () => {
        void partner.handleIssuePartnerInvite();
      },
      onLoadDevices: () => {
        void deviceManagement.handleLoadDevices();
      },
      onLogin: () => {
        void connection.handleConnectSync("login");
      },
      onModeSelect: (value) => {
        resetFeedbackMessages();
        resetPartnerFeedback();
        partner.setPartnerInviteLink("");
        setPartnerOverview(null);
        setShowPartnerOwnerControls(false);
        // A pending invite token is bound to the previously selected mode.
        // Switching modes (managed ↔ local ↔ community) makes it unredeemable
        // and risks cross-session leakage if retained.
        clearManagedPartnerInviteToken();
        setPendingPartnerInviteToken("");
        setState((current) =>
          current
            ? {
                ...current,
                syncPreferences: {
                  ...current.syncPreferences,
                  mode: value,
                  endpointInput:
                    value === "managed" ? "" : current.syncPreferences.endpointInput,
                },
              }
            : current,
        );
      },
      onOfferCTAPress: managedPlan.handleOfferCTAPress,
      onPartnerAcceptInvite: () => {
        void partner.handleAcceptPartnerInvite();
      },
      onPartnerAccessLevelChange: (value) => {
        resetPartnerFeedback();
        partner.setPartnerInviteAccessLevel(value);
      },
      onPartnerOpenGrant: (grantID) => {
        partner.handleOpenPartnerGrant(grantID);
      },
      onPartnerRevokeGrant: (grantID) => {
        void partner.handleRevokePartnerGrant(grantID);
      },
      onPartnerRevokeInvite: (inviteID) => {
        void partner.handleRevokePartnerInvite(inviteID);
      },
      onPrepare: () => {
        void recovery.handlePrepareSyncSetup();
      },
      onRecoverAccess: () => {
        void connection.handleRecoverSync();
      },
      onResumeRenewal: () => {
        void managedPlan.handleUpdateRenewal("resume");
      },
      onRetryPlanCheck: () => {
        void managedPlan.handleRetryPlanCheck();
      },
      onRecoveryPhraseChange: (value) => {
        resetFeedbackMessages();
        core.setRecoveryPhraseInputValue(value);
      },
      onRegister: () => {
        void connection.handleConnectSync("register");
      },
      onRemoveDevice: (deviceID) => {
        void deviceManagement.handleRemoveDevice(deviceID);
      },
      onRestore: () => {
        void actions.handleRestoreSync();
      },
      onSyncNow: () => {
        void actions.handleSyncNow();
      },
      partnerCopy,
      partnerErrorMessage,
      partnerInviteAccessLevel: partner.partnerInviteAccessLevel,
      partnerInviteLink: partner.partnerInviteLink,
      partnerLocale: language,
      partnerOverview,
      partnerStatusMessage,
      pendingPartnerInviteToken,
      presentation,
      preferences: state.syncPreferences,
      recoveryPhraseValue: recoveryPhraseInputValue,
      // Device management needs a live sync session on the sync server (in
      // managed mode that additionally means an active plan), which is exactly
      // the canShowSyncActions gate.
      showDeviceSection: presentation.canShowSyncActions,
      showPartnerOwnerControls,
      showPartnerSection,
      statusMessage: accountStatusMessage,
      pendingTOTPChallenge: connection.pendingTOTPChallenge,
      totpChallengeCode: connection.totpChallengeCode,
      onTOTPChallengeCodeChange: connection.setTotpChallengeCode,
      onSubmitTOTPChallenge: () => {
        void connection.handleSubmitTOTPChallenge();
      },
      onCancelTOTPChallenge: connection.handleCancelTOTPChallenge,
      viewData: viewData.account,
    },
    loadingDescription: shellCopy.loading.backupSyncDescription,
    loadingTitle: shellCopy.loading.backupSyncTitle,
  };
}
