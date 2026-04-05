import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useNavigation, usePreventRemove } from "@react-navigation/native";

import { getShellCopy } from "../../../i18n/shell-copy";
import { getPartnerCopy } from "../../../i18n/partner-copy";
import { appStorage, readHasCompletedOnboarding } from "../../../services/app-bootstrap-service";
import {
  buildBackupSyncDirtyState,
  buildBackupSyncSetupPresentation,
  resolveBackupSyncConnectedStatusMessage,
  resolveBackupSyncErrorPresentation,
  revertBackupSyncDraftState,
  type BackupSyncErrorScope,
} from "../../../services/backup-sync-view-service";
import {
  acceptManagedPartnerInvite,
  issueManagedPartnerInvite,
  loadManagedPartnerAccess,
  revokeManagedPartnerGrant,
  revokeManagedPartnerInvite,
} from "../../../services/managed-partner-access-service";
import { loadManagedPremiumFeatures } from "../../../services/managed-premium-features-service";
import {
  clearUnauthorizedBackupSyncSession,
  connectBackupSyncAccount,
  disconnectBackupSyncAccount,
  prepareBackupSyncSetup,
  recoverBackupSyncAccess,
  restoreBackupSyncSnapshot,
  saveBackupSyncDraft,
  uploadBackupSyncSnapshot,
} from "../../../services/backup-sync-screen-service";
import {
  createPlatformExportDeliveryClient,
  type ExportDeliveryClient,
} from "../../../services/export-delivery";
import { deliverRecoveryPhraseArtifact } from "../../../services/recovery-phrase-delivery-service";
import { loadSettingsScreenState } from "../../../services/settings-state-service";
import {
  buildSettingsViewData,
  type LoadedSettingsState,
} from "../../../services/settings-view-service";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import type { SyncSecretStore } from "../../../security/sync-secret-store";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import { syncSecretStore as defaultSyncSecretStore } from "../../../sync/app-sync-service";
import { openConfirmation } from "../../confirm/open-confirmation";
import { useAppPreferences } from "../../providers/AppPreferencesProvider";
import type { BackupSyncFlowScreenProps } from "../BackupSyncFlowScreen";
import type {
  ManagedCloudPartnerAccessLevel,
  ManagedCloudPartnerAccessOverview,
} from "../../../sync/managed-cloud-api-client";

type BackupSyncScreenControllerOptions = {
  exportDeliveryClient?: ExportDeliveryClient | undefined;
  now?: Date | undefined;
  storage?: LocalAppStorage | undefined;
  syncSecretStore?: SyncSecretStore | undefined;
};

type BackupSyncScreenControllerResult = {
  accentColor: string;
  flowProps: BackupSyncFlowScreenProps | null;
  loadingDescription: string;
  loadingTitle: string;
};

export function useBackupSyncScreenController({
  exportDeliveryClient = createPlatformExportDeliveryClient(),
  now,
  storage = appStorage,
  syncSecretStore = defaultSyncSecretStore,
}: BackupSyncScreenControllerOptions): BackupSyncScreenControllerResult {
  const { colors, language } = useAppPreferences();
  const navigation = useNavigation();
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ invite_token?: string | string[] }>();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [state, setState] = useState<LoadedSettingsState | null>(null);
  const [accountLoginValue, setAccountLoginValue] = useState("");
  const [accountPasswordValue, setAccountPasswordValue] = useState("");
  const [errorState, setErrorState] = useState<{
    code: string;
    scope: BackupSyncErrorScope;
  } | null>(null);
  const [accountStatusMessage, setAccountStatusMessage] = useState("");
  const [generatedRecoveryPhrase, setGeneratedRecoveryPhrase] = useState("");
  const [recoveryPhraseInputValue, setRecoveryPhraseInputValue] = useState("");
  const [isAuthenticatingSync, setIsAuthenticatingSync] = useState(false);
  const [isExportingRecoveryPhrase, setIsExportingRecoveryPhrase] = useState(false);
  const [isPreparingSync, setIsPreparingSync] = useState(false);
  const [isRecoveringSync, setIsRecoveringSync] = useState(false);
  const [isRestoringSync, setIsRestoringSync] = useState(false);
  const [isSavingSyncDraft, setIsSavingSyncDraft] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [partnerOverview, setPartnerOverview] =
    useState<ManagedCloudPartnerAccessOverview | null>(null);
  const [partnerInviteEmailValue, setPartnerInviteEmailValue] = useState("");
  const [partnerInviteAccessLevel, setPartnerInviteAccessLevel] =
    useState<ManagedCloudPartnerAccessLevel>("summary");
  const [partnerInviteEmailNotificationsAllowed, setPartnerInviteEmailNotificationsAllowed] =
    useState(false);
  const [partnerStatusMessage, setPartnerStatusMessage] = useState("");
  const [partnerErrorMessage, setPartnerErrorMessage] = useState("");
  const [partnerInviteLink, setPartnerInviteLink] = useState("");
  const [pendingPartnerInviteToken, setPendingPartnerInviteToken] = useState("");
  const [showPartnerOwnerControls, setShowPartnerOwnerControls] = useState(false);
  const [isPartnerBusy, setIsPartnerBusy] = useState(false);
  const shellCopy = getShellCopy(language);
  const partnerCopy = getPartnerCopy(language);
  const viewData = buildSettingsViewData(effectiveNow, language);
  const isSyncDirty = buildBackupSyncDirtyState(state);
  const errorPresentation = resolveBackupSyncErrorPresentation(
    errorState?.code,
    errorState?.scope,
    viewData.account,
  );

  useEffect(() => {
    const rawInviteToken = searchParams.invite_token;
    const nextInviteToken = Array.isArray(rawInviteToken)
      ? rawInviteToken[0] ?? ""
      : rawInviteToken ?? "";
    setPendingPartnerInviteToken(String(nextInviteToken).trim());
  }, [searchParams.invite_token]);

  const resetPartnerFeedback = useCallback(() => {
    setPartnerErrorMessage("");
    setPartnerStatusMessage("");
  }, []);

  const loadPartnerState = useCallback(
    async (loadedState: LoadedSettingsState) => {
      if (
        loadedState.syncPreferences.mode !== "managed" ||
        !loadedState.hasSyncSession
      ) {
        return {
          errorMessage: "",
          overview: null as ManagedCloudPartnerAccessOverview | null,
          showOwnerControls: false,
        };
      }

      const premiumFeatures = await loadManagedPremiumFeatures(
        syncSecretStore,
        loadedState.syncPreferences.mode,
      );

      const partnerResult = await loadManagedPartnerAccess(
        syncSecretStore,
        loadedState.syncPreferences.mode,
      );
      if (!partnerResult.ok) {
        return {
          errorMessage: resolvePartnerErrorMessage(
            partnerResult.errorCode,
            partnerCopy,
          ),
          overview: null as ManagedCloudPartnerAccessOverview | null,
          showOwnerControls: premiumFeatures.partnerAccess,
        };
      }

      return {
        errorMessage: "",
        overview: partnerResult.value,
        showOwnerControls: premiumFeatures.partnerAccess,
      };
    },
    [partnerCopy, syncSecretStore],
  );

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function load() {
        const hasCompletedOnboarding = await readHasCompletedOnboarding(storage);
        if (!isMounted) {
          return;
        }

        if (!hasCompletedOnboarding) {
          router.replace("/onboarding");
          return;
        }

        const loadedState = await loadSettingsScreenState(
          storage,
          syncSecretStore,
          effectiveNow,
        );
        if (!isMounted) {
          return;
        }

        setState(loadedState);
        setGeneratedRecoveryPhrase("");
        setRecoveryPhraseInputValue("");
        resetPartnerFeedback();
        const partnerState = await loadPartnerState(loadedState);
        if (!isMounted) {
          return;
        }
        setShowPartnerOwnerControls(partnerState.showOwnerControls);
        setPartnerOverview(partnerState.overview);
        setPartnerErrorMessage(partnerState.errorMessage);
        setIsLoading(false);
      }

      setIsLoading(true);
      void load();

      return () => {
        isMounted = false;
      };
    }, [
      effectiveNow,
      loadPartnerState,
      resetPartnerFeedback,
      router,
      storage,
      syncSecretStore,
    ]),
  );

  const resetFeedbackMessages = useCallback(() => {
    setErrorState(null);
    setAccountStatusMessage("");
  }, []);

  const revertUnsavedSync = useCallback(() => {
    resetFeedbackMessages();
    setState((current) =>
      current ? revertBackupSyncDraftState(current) : current,
    );
  }, [resetFeedbackMessages]);

  async function reloadPartnerAccess(nextState: LoadedSettingsState) {
    const partnerState = await loadPartnerState(nextState);
    setShowPartnerOwnerControls(partnerState.showOwnerControls);
    setPartnerOverview(partnerState.overview);
    setPartnerErrorMessage(partnerState.errorMessage);
  }

  async function handleIssuePartnerInvite() {
    if (!state) {
      return;
    }

    resetPartnerFeedback();
    setIsPartnerBusy(true);

    const result = await issueManagedPartnerInvite(
      syncSecretStore,
      state.syncPreferences.mode,
      {
        invitedEmail: partnerInviteEmailValue,
        accessLevel: partnerInviteAccessLevel,
        emailNotificationsAllowed: partnerInviteEmailNotificationsAllowed,
      },
    );

    if (!result.ok) {
      setPartnerErrorMessage(resolvePartnerErrorMessage(result.errorCode, partnerCopy));
      setIsPartnerBusy(false);
      return;
    }

    setPartnerInviteEmailValue("");
    setPartnerInviteLink(result.value.inviteURL);
    setPartnerStatusMessage(resolvePartnerInviteIssuedStatusMessage(result.value, partnerCopy));
    await reloadPartnerAccess(state);
    setIsPartnerBusy(false);
  }

  async function handleAcceptPartnerInvite() {
    if (!state || pendingPartnerInviteToken.length === 0) {
      return;
    }

    resetPartnerFeedback();
    setIsPartnerBusy(true);

    const result = await acceptManagedPartnerInvite(
      syncSecretStore,
      state.syncPreferences.mode,
      pendingPartnerInviteToken,
    );
    if (!result.ok) {
      setPartnerErrorMessage(resolvePartnerErrorMessage(result.errorCode, partnerCopy));
      setIsPartnerBusy(false);
      return;
    }

    setPartnerStatusMessage(partnerCopy.statusInviteAccepted);
    setPendingPartnerInviteToken("");
    router.replace("/backup-sync");
    await reloadPartnerAccess(state);
    setIsPartnerBusy(false);
  }

  async function handleRevokePartnerInvite(inviteID: string) {
    if (!state) {
      return;
    }

    resetPartnerFeedback();
    const confirmed = await openConfirmation(
      partnerCopy.revokeInviteLabel,
      viewData.common.confirmAction,
      viewData.common.cancelAction,
    );
    if (!confirmed) {
      return;
    }

    setIsPartnerBusy(true);
    const result = await revokeManagedPartnerInvite(
      syncSecretStore,
      state.syncPreferences.mode,
      inviteID,
    );
    if (!result.ok) {
      setPartnerErrorMessage(resolvePartnerErrorMessage(result.errorCode, partnerCopy));
      setIsPartnerBusy(false);
      return;
    }

    setPartnerStatusMessage(partnerCopy.statusInviteRevoked);
    await reloadPartnerAccess(state);
    setIsPartnerBusy(false);
  }

  async function handleRevokePartnerGrant(grantID: string) {
    if (!state) {
      return;
    }

    resetPartnerFeedback();
    const confirmed = await openConfirmation(
      partnerCopy.revokeGrantLabel,
      viewData.common.confirmAction,
      viewData.common.cancelAction,
    );
    if (!confirmed) {
      return;
    }

    setIsPartnerBusy(true);
    const result = await revokeManagedPartnerGrant(
      syncSecretStore,
      state.syncPreferences.mode,
      grantID,
    );
    if (!result.ok) {
      setPartnerErrorMessage(resolvePartnerErrorMessage(result.errorCode, partnerCopy));
      setIsPartnerBusy(false);
      return;
    }

    setPartnerStatusMessage(partnerCopy.statusGrantRevoked);
    await reloadPartnerAccess(state);
    setIsPartnerBusy(false);
  }

  usePreventRemove(
    isSyncDirty &&
      !isSavingSyncDraft &&
      !isPreparingSync &&
      !isAuthenticatingSync &&
      !isRecoveringSync &&
      !isRestoringSync &&
      !isSyncingNow,
    ({ data }) => {
      void (async () => {
        const shouldSave = await openConfirmation(
          viewData.account.unsavedPrompt,
          viewData.account.saveBeforeLeaveLabel,
          viewData.account.discardChangesLabel,
        );

        if (!shouldSave) {
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

  async function saveSyncDraftIfNeeded(scope: BackupSyncErrorScope) {
    if (!state) {
      return null;
    }
    if (!buildBackupSyncDirtyState(state)) {
      return state;
    }

    setIsSavingSyncDraft(true);
    const syncResult = await saveBackupSyncDraft(storage, syncSecretStore, state);
    setIsSavingSyncDraft(false);
    if (!syncResult.ok) {
      setErrorState({
        code: syncResult.errorCode,
        scope,
      });
      return null;
    }

    if (!syncResult.state.hasStoredSyncSecrets) {
      setGeneratedRecoveryPhrase("");
    }
    setState(syncResult.state);
    return syncResult.state;
  }

  async function handlePrepareSyncSetup() {
    if (!state) {
      return;
    }

    resetFeedbackMessages();

    if (state.hasStoredSyncSecrets) {
      const confirmed = await openConfirmation(
        viewData.account.regeneratePrompt,
        viewData.account.regenerateAccept,
      );
      if (!confirmed) {
        return;
      }

      const challengeResult = await requestSensitiveActionChallenge(
        viewData.account.regenerateDeviceAuthPrompt,
      );
      if (!challengeResult.ok) {
        if (challengeResult.reason === "unavailable") {
          setErrorState({
            code: "deviceAuthUnavailable",
            scope: "local",
          });
        } else if (challengeResult.reason === "failed") {
          setErrorState({
            code: "deviceAuthFailed",
            scope: "local",
          });
        }
        return;
      }
    }

    setIsPreparingSync(true);

    const result = await prepareBackupSyncSetup(
      storage,
      syncSecretStore,
      state,
      effectiveNow,
    );
    if (!result.ok) {
      setErrorState({
        code: result.errorCode,
        scope: "local",
      });
      setIsPreparingSync(false);
      return;
    }

    setErrorState(null);
    setState(result.state);
    await reloadPartnerAccess(result.state);
    setGeneratedRecoveryPhrase(result.recoveryPhrase);
    setAccountStatusMessage(
      result.regenerated
        ? viewData.account.status.regenerated
        : viewData.account.status.prepared,
    );
    setIsPreparingSync(false);
  }

  async function handleConnectSync(mode: "register" | "login") {
    if (!state) {
      return;
    }

    resetFeedbackMessages();
    setIsAuthenticatingSync(true);

    const syncReadyState = await saveSyncDraftIfNeeded("account");
    if (!syncReadyState) {
      setIsAuthenticatingSync(false);
      return;
    }

    const result = await connectBackupSyncAccount(
      storage,
      syncSecretStore,
      syncReadyState,
      {
        login: accountLoginValue,
        password: accountPasswordValue,
      },
      mode,
      effectiveNow,
    );
    if (!result.ok) {
      setErrorState({
        code: result.errorCode,
        scope: "account",
      });
      setIsAuthenticatingSync(false);
      return;
    }

    setErrorState(null);
    setState(result.state);
    await reloadPartnerAccess(result.state);
    setAccountPasswordValue("");
    setAccountStatusMessage(
      resolveBackupSyncConnectedStatusMessage(result.state, viewData.account),
    );
    setIsAuthenticatingSync(false);
  }

  async function handleSyncNow() {
    if (!state) {
      return;
    }

    resetFeedbackMessages();
    setIsSyncingNow(true);

    const syncReadyState = await saveSyncDraftIfNeeded("sync");
    if (!syncReadyState) {
      setIsSyncingNow(false);
      return;
    }

    const result = await uploadBackupSyncSnapshot(
      storage,
      syncSecretStore,
      syncReadyState,
      effectiveNow,
    );
    if (!result.ok) {
      if (result.errorCode === "unauthorized") {
        const clearedState = await clearUnauthorizedBackupSyncSession(
          storage,
          syncSecretStore,
          syncReadyState,
        );
        setState(clearedState);
        await reloadPartnerAccess(clearedState);
      }
      setErrorState({
        code: result.errorCode,
        scope: "sync",
      });
      setIsSyncingNow(false);
      return;
    }

    setErrorState(null);
    setState(result.state);
    await reloadPartnerAccess(result.state);
    setAccountStatusMessage(viewData.account.status.uploaded);
    setIsSyncingNow(false);
  }

  async function handleRestoreSync() {
    if (!state) {
      return;
    }

    resetFeedbackMessages();

    const challengeResult = await requestSensitiveActionChallenge(
      viewData.account.restoreDeviceAuthPrompt,
    );
    if (!challengeResult.ok) {
      if (challengeResult.reason === "unavailable") {
        setErrorState({
          code: "deviceAuthUnavailable",
          scope: "sync",
        });
      } else if (challengeResult.reason === "failed") {
        setErrorState({
          code: "deviceAuthFailed",
          scope: "sync",
        });
      }
      return;
    }

    const confirmed = await openConfirmation(
      viewData.account.restorePrompt,
      viewData.account.restoreAccept,
    );
    if (!confirmed) {
      return;
    }

    setIsRestoringSync(true);
    const result = await restoreBackupSyncSnapshot(
      storage,
      syncSecretStore,
      state,
      effectiveNow,
    );
    if (!result.ok) {
      if (result.errorCode === "unauthorized") {
        const clearedState = await clearUnauthorizedBackupSyncSession(
          storage,
          syncSecretStore,
          state,
        );
        setState(clearedState);
        await reloadPartnerAccess(clearedState);
      }
      setErrorState({
        code: result.errorCode,
        scope: "sync",
      });
      setIsRestoringSync(false);
      return;
    }

    setErrorState(null);
    setState(result.state);
    await reloadPartnerAccess(result.state);
    setAccountStatusMessage(viewData.account.status.restored);
    setIsRestoringSync(false);
  }

  async function handleRecoverSync() {
    if (!state) {
      return;
    }

    resetFeedbackMessages();
    setIsRecoveringSync(true);

    const syncReadyState = await saveSyncDraftIfNeeded("account");
    if (!syncReadyState) {
      setIsRecoveringSync(false);
      return;
    }

    const result = await recoverBackupSyncAccess(
      storage,
      syncSecretStore,
      syncReadyState,
      {
        login: accountLoginValue,
        password: accountPasswordValue,
      },
      recoveryPhraseInputValue,
      effectiveNow,
    );
    if (!result.ok) {
      setErrorState({
        code: result.errorCode,
        scope: "account",
      });
      setIsRecoveringSync(false);
      return;
    }

    setErrorState(null);
    setState(result.state);
    await reloadPartnerAccess(result.state);
    setAccountPasswordValue("");
    setRecoveryPhraseInputValue("");
    setAccountStatusMessage(viewData.account.status.recovered);
    setIsRecoveringSync(false);
  }

  async function handleDisconnectSync() {
    if (!state) {
      return;
    }

    resetFeedbackMessages();
    const confirmed = await openConfirmation(
      viewData.account.disconnectPrompt,
      viewData.account.disconnectLabel,
    );
    if (!confirmed) {
      return;
    }

    const result = await disconnectBackupSyncAccount(
      storage,
      syncSecretStore,
      state,
    );
    setErrorState(null);
    setState(result.state);
    await reloadPartnerAccess(result.state);
    setAccountStatusMessage(viewData.account.status.disconnected);
  }

  async function handleExportRecoveryPhrase() {
    if (!generatedRecoveryPhrase) {
      return;
    }

    resetFeedbackMessages();
    setIsExportingRecoveryPhrase(true);

    const result = await deliverRecoveryPhraseArtifact(
      exportDeliveryClient,
      generatedRecoveryPhrase,
      effectiveNow,
    );

    if (!result.ok) {
      setErrorState({
        code:
          result.errorCode === "delivery_unavailable"
            ? "recovery_export_unavailable"
            : "recovery_export_failed",
        scope: "local",
      });
    }

    setIsExportingRecoveryPhrase(false);
  }

  if (isLoading || !state) {
    return {
      accentColor: colors.accent,
      flowProps: null,
      loadingDescription: shellCopy.loading.backupSyncDescription,
      loadingTitle: shellCopy.loading.backupSyncTitle,
    };
  }

  const presentation = buildBackupSyncSetupPresentation({
    hasStoredSyncSecrets: state.hasStoredSyncSecrets,
    hasSyncSession: state.hasSyncSession,
    isAuthenticating: isAuthenticatingSync,
    isPreparing: isPreparingSync,
    isRecovering: isRecoveringSync,
    isRestoring: isRestoringSync,
    isSyncing: isSyncingNow,
    locale: language,
    notSetLabel: viewData.common.notSet,
    preferences: state.syncPreferences,
    syncCapabilities: state.syncCapabilities,
    viewData: viewData.account,
  });
  const showPartnerSection =
    presentation.isManaged &&
    (pendingPartnerInviteToken.length > 0 ||
      showPartnerOwnerControls ||
      partnerInviteLink.length > 0 ||
      (partnerOverview?.owned.invites.length ?? 0) > 0 ||
      (partnerOverview?.owned.grants.length ?? 0) > 0 ||
      (partnerOverview?.sharedWithMe.length ?? 0) > 0);

  return {
    accentColor: colors.accent,
    flowProps: {
      authLoginValue: accountLoginValue,
      authPasswordValue: accountPasswordValue,
      backLabel: viewData.account.backToSettingsLabel,
      confirmActionLabel: viewData.common.confirmAction,
      errorPresentation,
      generatedRecoveryPhrase,
      hasStoredSyncSecrets: state.hasStoredSyncSecrets,
      hasSyncSession: state.hasSyncSession,
      isExportingRecoveryPhrase,
      isPartnerBusy,
      isPreparing: isPreparingSync,
      onBack: () => {
        router.replace("/(tabs)/settings");
      },
      onAuthLoginChange: (value) => {
        resetFeedbackMessages();
        setAccountLoginValue(value);
      },
      onAuthPasswordChange: (value) => {
        resetFeedbackMessages();
        setAccountPasswordValue(value);
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
        void handleDisconnectSync();
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
      onExportRecoveryPhrase: () => {
        void handleExportRecoveryPhrase();
      },
      onIssuePartnerInvite: () => {
        void handleIssuePartnerInvite();
      },
      onLogin: () => {
        void handleConnectSync("login");
      },
      onModeSelect: (value) => {
        resetFeedbackMessages();
        resetPartnerFeedback();
        setPartnerInviteLink("");
        setPartnerOverview(null);
        setShowPartnerOwnerControls(false);
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
      onPartnerAcceptInvite: () => {
        void handleAcceptPartnerInvite();
      },
      onPartnerAccessLevelChange: (value) => {
        resetPartnerFeedback();
        setPartnerInviteAccessLevel(value);
      },
      onPartnerInviteEmailChange: (value) => {
        resetPartnerFeedback();
        setPartnerInviteEmailValue(value);
      },
      onPartnerInviteEmailNotificationsAllowedChange: (value) => {
        resetPartnerFeedback();
        setPartnerInviteEmailNotificationsAllowed(value);
      },
      onPartnerRevokeGrant: (grantID) => {
        void handleRevokePartnerGrant(grantID);
      },
      onPartnerRevokeInvite: (inviteID) => {
        void handleRevokePartnerInvite(inviteID);
      },
      onPrepare: () => {
        void handlePrepareSyncSetup();
      },
      onRecoverAccess: () => {
        void handleRecoverSync();
      },
      onRecoveryPhraseChange: (value) => {
        resetFeedbackMessages();
        setRecoveryPhraseInputValue(value);
      },
      onRegister: () => {
        void handleConnectSync("register");
      },
      onRestore: () => {
        void handleRestoreSync();
      },
      onSyncNow: () => {
        void handleSyncNow();
      },
      partnerCopy,
      partnerErrorMessage,
      partnerInviteAccessLevel,
      partnerInviteEmailValue,
      partnerInviteEmailNotificationsAllowed,
      partnerInviteLink,
      partnerLocale: language,
      partnerOverview,
      partnerStatusMessage,
      pendingPartnerInviteToken,
      presentation,
      preferences: state.syncPreferences,
      recoveryPhraseValue: recoveryPhraseInputValue,
      showPartnerOwnerControls,
      showPartnerSection,
      statusMessage: accountStatusMessage,
      viewData: viewData.account,
    },
    loadingDescription: shellCopy.loading.backupSyncDescription,
    loadingTitle: shellCopy.loading.backupSyncTitle,
  };
}

function resolvePartnerErrorMessage(
  errorCode: string,
  copy: ReturnType<typeof getPartnerCopy>,
): string {
  switch (errorCode) {
    case "not_connected":
      return copy.errors.notConnected;
    case "invalid_partner_invite":
      return copy.errors.invalidPartnerInvite;
    case "partner_invite_not_found":
      return copy.errors.partnerInviteNotFound;
    case "partner_invite_expired":
      return copy.errors.partnerInviteExpired;
    case "partner_invite_email_mismatch":
      return copy.errors.partnerInviteEmailMismatch;
    case "partner_access_unavailable":
      return copy.errors.partnerAccessUnavailable;
    case "partner_access_not_found":
      return copy.errors.partnerAccessNotFound;
    case "network_failed":
      return copy.errors.networkFailed;
    default:
      return copy.errors.generic;
  }
}

function resolvePartnerInviteIssuedStatusMessage(
  result: {
    emailDelivery: {
      requested: boolean;
      status: "disabled" | "sent" | "failed" | "unavailable";
    };
  },
  copy: ReturnType<typeof getPartnerCopy>,
): string {
  if (!result.emailDelivery.requested || result.emailDelivery.status === "disabled") {
    return copy.statusInviteIssued;
  }

  switch (result.emailDelivery.status) {
    case "sent":
      return copy.statusInviteIssuedEmailSent;
    case "failed":
      return copy.statusInviteIssuedEmailFailed;
    case "unavailable":
      return copy.statusInviteIssuedEmailUnavailable;
    default:
      return copy.statusInviteIssued;
  }
}
