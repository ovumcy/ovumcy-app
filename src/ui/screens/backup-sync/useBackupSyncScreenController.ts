import { usePreventRemove } from "expo-router/react-navigation";

import { getSubscriptionCopy } from "../../../i18n/subscription-copy";
import {
  buildBackupSyncSetupPresentation,
  resolveBackupSyncErrorPresentation,
  shouldBlockManagedRecoveryAction,
  shouldRotateManagedRecoveryPhrase,
} from "../../../services/backup-sync-view-service";
import { buildDataSharingConsentViewData } from "../../../services/data-sharing-consent-service";
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
import { useBackupSyncGuestUpgrade } from "./useBackupSyncGuestUpgrade";
import { useBackupSyncConsentWithdrawal } from "./useBackupSyncConsentWithdrawal";

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
  const guestUpgrade = useBackupSyncGuestUpgrade(core);
  const consentWithdrawal = useBackupSyncConsentWithdrawal(core, {
    setPartnerInviteLink: partner.setPartnerInviteLink,
  });

  const {
    accountStatusMessage,
    colors,
    dismissedOfferIDs,
    effectiveNow,
    errorState,
    generatedAccountLogin,
    generatedRecoveryCode,
    generatedRecoveryPhrase,
    isLoading,
    isPartnerInviteReplaced,
    isSavingSyncDraft,
    isSyncDirty,
    language,
    navigation,
    partnerCopy,
    partnerErrorMessage,
    partnerOverview,
    partnerReshareRequiredGrantIDs,
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
    errorState?.retryAfterSeconds,
    state?.managedPremiumAccess.planStatus,
  );

  usePreventRemove(
    isSyncDirty &&
      !isSavingSyncDraft &&
      !recovery.isPreparingSync &&
      !recovery.isRotatingRecoveryPhrase &&
      !connection.isAuthenticatingSync &&
      !connection.isRecoveringSync &&
      !connection.isDisconnectingSync &&
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
    hasStoredSyncSecrets: state.hasStoredSyncSecrets,
    hasSyncSession: state.hasSyncSession,
    isAuthenticating: connection.isAuthenticatingSync,
    isPreparing: recovery.isPreparingSync || recovery.isRotatingRecoveryPhrase,
    isRecovering: connection.isRecoveringSync,
    isRestoring: actions.isRestoringSync,
    // An in-flight account deletion or disconnect revoke disables the same
    // action set as a running upload, so the owner cannot start another
    // destructive action, or an upload that re-marks the device connected.
    isSyncing:
      actions.isSyncingNow ||
      deletion.isDeletingAccount ||
      connection.isDisconnectingSync,
    locale: language,
    managedPlanStatus: state.managedPremiumAccess.planStatus,
    managedRecoveryRotationLabel: shouldRotateManagedRecoveryPhrase({
      hasStoredSyncSecrets: state.hasStoredSyncSecrets,
      hasSyncSession: state.hasSyncSession,
      preferences: state.savedSyncPreferences,
    })
      ? recovery.managedRecoveryRotationCopy.actionLabel
      : null,
    managedRecoveryBlockedHint: shouldBlockManagedRecoveryAction({
      hasStoredSyncSecrets: state.hasStoredSyncSecrets,
      hasSyncSession: state.hasSyncSession,
      preferences: state.savedSyncPreferences,
    })
      ? recovery.managedRecoveryRotationCopy.noFloorHint
      : null,
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
      // Same filter as the shared-with-me list: a revoked grant renders nothing.
      (partnerOverview?.sharedWithMe ?? []).some((grant) => !grant.revokedAt));

  return {
    accentColor: colors.accent,
    flowProps: {
      authLoginValue: connection.accountLoginValue,
      authPasswordValue: connection.accountPasswordValue,
      backLabel: viewData.account.backToSettingsLabel,
      billingOffers,
      confirmActionLabel: viewData.common.confirmAction,
      dataSharingConsent: core.pendingDataSharingConsent
        ? buildDataSharingConsentViewData(core.pendingDataSharingConsent, language)
        : null,
      onAnswerDataSharingConsent: core.answerDataSharingConsent,
      dataSharingConsentWithdrawal: consentWithdrawal.dataSharingConsentWithdrawal,
      onWithdrawDataSharingConsent: consentWithdrawal.handleWithdrawDataSharingConsent,
      deviceErrorMessage: deviceManagement.deviceErrorMessage,
      deviceListItems: deviceManagement.deviceListItems,
      deviceStatusMessage: deviceManagement.deviceStatusMessage,
      errorPresentation,
      generatedAccountLogin,
      generatedRecoveryCode,
      generatedRecoveryPhrase,
      hasStoredSyncSecrets: state.hasStoredSyncSecrets,
      hasSyncSession: state.hasSyncSession,
      isDeviceBusy: deviceManagement.isDeviceBusy,
      isExportingRecoveryPhrase: recovery.isExportingRecoveryPhrase,
      isPartnerBusy: partner.isPartnerBusy,
      isPreparing: recovery.isPreparingSync,
      isRotatingRecoveryPhrase: recovery.isRotatingRecoveryPhrase,
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
      onAcknowledgeRecoveryPhrase: recovery.handleAcknowledgeRecoveryPhrase,
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
      onPartnerAcceptInviteAsGuest: () => {
        void partner.handleAcceptPartnerInviteAsGuest();
      },
      onPartnerChooseSignIn: () => {
        partner.handleChoosePartnerSignIn();
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
      onGuestUpgradeAcknowledgeRecoveryCode:
        guestUpgrade.handleAcknowledgeUpgradeRecoveryCode,
      onGuestUpgradeCancelForm: guestUpgrade.handleCancelForm,
      onGuestUpgradePasswordChange: guestUpgrade.setPasswordValue,
      onGuestUpgradeSubmitForm: () => {
        void guestUpgrade.handleSubmitUpgrade();
      },
      onGuestUpgradeTapKeepAccess: () => {
        void guestUpgrade.handleTapKeepAccess();
      },
      partnerCopy,
      partnerErrorMessage,
      partnerInviteAccessLevel: partner.partnerInviteAccessLevel,
      partnerInviteLink: partner.partnerInviteLink,
      partnerLocale: language,
      partnerOverview,
      partnerReshareRequiredGrantIDs,
      partnerStatusMessage,
      pendingPartnerInviteToken,
      isPartnerInviteReplaced,
      presentation,
      preferences: state.syncPreferences,
      guestUpgradeFormErrorMessage: guestUpgrade.formErrorMessage,
      guestUpgradeGeneratedAccountLogin: guestUpgrade.generatedAccountLogin,
      guestUpgradeGeneratedRecoveryCode: guestUpgrade.generatedRecoveryCode,
      guestUpgradeIsFormOpen: guestUpgrade.isFormOpen,
      guestUpgradeIsSubmitting: guestUpgrade.isSubmitting,
      guestUpgradeNudgeMessage: guestUpgrade.nudgeMessage,
      guestUpgradePasswordValue: guestUpgrade.passwordValue,
      isGuestPartner: guestUpgrade.isGuestPartner,
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
      recoveryKeyStepUpPrompt: actions.recoveryKeyStepUpPrompt,
      isSyncingNow: actions.isSyncingNow,
      onSubmitRecoveryKeyStepUp: actions.handleSubmitRecoveryKeyStepUp,
      onCancelRecoveryKeyStepUp: actions.handleCancelRecoveryKeyStepUp,
      accountDeletionStepUpPrompt: deletion.accountDeletionStepUpPrompt,
      accountDeletionStepUpMode: deletion.accountDeletionStepUpMode,
      isDeletingAccount: deletion.isDeletingAccount,
      onSubmitAccountDeletionStepUp: deletion.handleSubmitAccountDeletionStepUp,
      onCancelAccountDeletionStepUp: deletion.handleCancelAccountDeletionStepUp,
      managedRecoveryRotationStepUpCopy: recovery.managedRecoveryRotationCopy.stepUp,
      managedRecoveryRotationStepUpPrompt: recovery.managedRecoveryRotationStepUpPrompt,
      accountChangeRecovery: {
        copy: recovery.accountChangeRecoveryCopy,
        offer: recovery.accountChangeRecoveryPhrase,
        onReveal: () => {
          void recovery.handleRevealAccountChangeRecoveryPhrase();
        },
        onReplace: () => {
          void recovery.handlePrepareSyncSetup();
        },
      },
      onSubmitManagedRecoveryRotationStepUp:
        recovery.handleSubmitManagedRecoveryRotationStepUp,
      onCancelManagedRecoveryRotationStepUp:
        recovery.handleCancelManagedRecoveryRotationStepUp,
      deviceRemovalStepUpCopy: deviceManagement.deviceRemovalStepUpCopy,
      deviceRemovalStepUpPrompt: deviceManagement.deviceRemovalStepUpPrompt,
      onSubmitDeviceRemovalStepUp: deviceManagement.handleSubmitDeviceRemovalStepUp,
      onCancelDeviceRemovalStepUp: deviceManagement.handleCancelDeviceRemovalStepUp,
      viewData: viewData.account,
    },
    loadingDescription: shellCopy.loading.backupSyncDescription,
    loadingTitle: shellCopy.loading.backupSyncTitle,
  };
}
