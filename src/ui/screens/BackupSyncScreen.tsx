import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useNavigation, usePreventRemove } from "@react-navigation/native";

import { getShellCopy } from "../../i18n/shell-copy";
import { appStorage, readHasCompletedOnboarding } from "../../services/app-bootstrap-service";
import {
  createPlatformExportDeliveryClient,
  type ExportDeliveryClient,
} from "../../services/export-delivery";
import {
  type BackupSyncErrorScope,
  buildBackupSyncDirtyState,
  resolveBackupSyncConnectedStatusMessage,
  resolveBackupSyncErrorPresentation,
  revertBackupSyncDraftState,
} from "../../services/backup-sync-view-service";
import {
  clearUnauthorizedBackupSyncSession,
  connectBackupSyncAccount,
  disconnectBackupSyncAccount,
  prepareBackupSyncSetup,
  recoverBackupSyncAccess,
  restoreBackupSyncSnapshot,
  saveBackupSyncDraft,
  uploadBackupSyncSnapshot,
} from "../../services/backup-sync-screen-service";
import { deliverRecoveryPhraseArtifact } from "../../services/recovery-phrase-delivery-service";
import { loadSettingsScreenState } from "../../services/settings-state-service";
import { buildSettingsViewData, type LoadedSettingsState } from "../../services/settings-view-service";
import { syncSecretStore as defaultSyncSecretStore } from "../../sync/app-sync-service";
import type { SyncSecretStore } from "../../security/sync-secret-store";
import { requestSensitiveActionChallenge } from "../../security/sensitive-action-auth";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { openConfirmation } from "../confirm/open-confirmation";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import { BackupSyncFlowScreen } from "./BackupSyncFlowScreen";

type BackupSyncScreenProps = {
  exportDeliveryClient?: ExportDeliveryClient;
  storage?: LocalAppStorage;
  syncSecretStore?: SyncSecretStore;
  now?: Date;
};

export function BackupSyncScreen({
  exportDeliveryClient = createPlatformExportDeliveryClient(),
  storage = appStorage,
  syncSecretStore = defaultSyncSecretStore,
  now,
}: BackupSyncScreenProps) {
  const { colors, language } = useAppPreferences();
  const navigation = useNavigation();
  const router = useRouter();
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
  const shellCopy = getShellCopy(language);
  const viewData = buildSettingsViewData(effectiveNow, language);
  const isSyncDirty = buildBackupSyncDirtyState(state);
  const errorPresentation = resolveBackupSyncErrorPresentation(
    errorState?.code,
    errorState?.scope,
    viewData.account,
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
        setIsLoading(false);
      }

      setIsLoading(true);
      void load();

      return () => {
        isMounted = false;
      };
    }, [effectiveNow, router, storage, syncSecretStore]),
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
        setState(
          await clearUnauthorizedBackupSyncSession(
            storage,
            syncSecretStore,
            syncReadyState,
          ),
        );
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
        setState(
          await clearUnauthorizedBackupSyncSession(
            storage,
            syncSecretStore,
            state,
          ),
        );
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
    return (
      <ScreenScaffold
        description={shellCopy.loading.backupSyncDescription}
        title={shellCopy.loading.backupSyncTitle}
      >
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <BackupSyncFlowScreen
      authLoginValue={accountLoginValue}
      authPasswordValue={accountPasswordValue}
      backLabel={viewData.account.backToSettingsLabel}
      confirmActionLabel={viewData.common.confirmAction}
      errorPresentation={errorPresentation}
      generatedRecoveryPhrase={generatedRecoveryPhrase}
      hasStoredSyncSecrets={state.hasStoredSyncSecrets}
      hasSyncSession={state.hasSyncSession}
      isAuthenticating={isAuthenticatingSync}
      isExportingRecoveryPhrase={isExportingRecoveryPhrase}
      isPreparing={isPreparingSync}
      isRecovering={isRecoveringSync}
      isRestoring={isRestoringSync}
      isSyncing={isSyncingNow}
      notSetLabel={viewData.common.notSet}
      onBack={() => {
        router.replace("/(tabs)/settings");
      }}
      onAuthLoginChange={(value) => {
        resetFeedbackMessages();
        setAccountLoginValue(value);
      }}
      onAuthPasswordChange={(value) => {
        resetFeedbackMessages();
        setAccountPasswordValue(value);
      }}
      onDeviceLabelChange={(value) => {
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
      }}
      onDisconnect={() => {
        void handleDisconnectSync();
      }}
      onEndpointChange={(value) => {
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
      }}
      onExportRecoveryPhrase={() => {
        void handleExportRecoveryPhrase();
      }}
      onLogin={() => {
        void handleConnectSync("login");
      }}
      onModeSelect={(value) => {
        resetFeedbackMessages();
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
      }}
      onPrepare={() => {
        void handlePrepareSyncSetup();
      }}
      onRecoverAccess={() => {
        void handleRecoverSync();
      }}
      onRecoveryPhraseChange={(value) => {
        resetFeedbackMessages();
        setRecoveryPhraseInputValue(value);
      }}
      onRegister={() => {
        void handleConnectSync("register");
      }}
      onRestore={() => {
        void handleRestoreSync();
      }}
      onSyncNow={() => {
        void handleSyncNow();
      }}
      preferences={state.syncPreferences}
      recoveryPhraseValue={recoveryPhraseInputValue}
      statusMessage={accountStatusMessage}
      syncCapabilities={state.syncCapabilities}
      viewData={viewData.account}
    />
  );
}
