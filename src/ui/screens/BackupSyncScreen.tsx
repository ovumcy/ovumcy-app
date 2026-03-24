import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useNavigation, usePreventRemove } from "@react-navigation/native";

import { getShellCopy } from "../../i18n/shell-copy";
import { appStorage, readHasCompletedOnboarding } from "../../services/app-bootstrap-service";
import {
  buildBackupSyncDirtyState,
  resolveBackupSyncConnectedStatusMessage,
  resolveBackupSyncErrorMessage,
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
  storage?: LocalAppStorage;
  syncSecretStore?: SyncSecretStore;
  now?: Date;
};

export function BackupSyncScreen({
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
  const [accountErrorMessage, setAccountErrorMessage] = useState("");
  const [accountStatusMessage, setAccountStatusMessage] = useState("");
  const [generatedRecoveryPhrase, setGeneratedRecoveryPhrase] = useState("");
  const [recoveryPhraseInputValue, setRecoveryPhraseInputValue] = useState("");
  const [isAuthenticatingSync, setIsAuthenticatingSync] = useState(false);
  const [isPreparingSync, setIsPreparingSync] = useState(false);
  const [isRecoveringSync, setIsRecoveringSync] = useState(false);
  const [isRestoringSync, setIsRestoringSync] = useState(false);
  const [isSavingSyncDraft, setIsSavingSyncDraft] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const shellCopy = getShellCopy(language);
  const viewData = buildSettingsViewData(effectiveNow, language);
  const isSyncDirty = buildBackupSyncDirtyState(state);

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

  const resetAccountMessages = useCallback(() => {
    setAccountErrorMessage("");
    setAccountStatusMessage("");
    setGeneratedRecoveryPhrase("");
  }, []);

  const revertUnsavedSync = useCallback(() => {
    resetAccountMessages();
    setState((current) =>
      current ? revertBackupSyncDraftState(current) : current,
    );
  }, [resetAccountMessages]);

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

        const savedState = await saveSyncDraftIfNeeded();
        if (savedState) {
          requestAnimationFrame(() => {
            navigation.dispatch(data.action);
          });
        }
      })();
    },
  );

  async function saveSyncDraftIfNeeded() {
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
      setAccountErrorMessage(
        resolveBackupSyncErrorMessage(syncResult.errorCode, viewData.account),
      );
      return null;
    }

    setState(syncResult.state);
    return syncResult.state;
  }

  async function handlePrepareSyncSetup() {
    if (!state) {
      return;
    }

    resetAccountMessages();

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
          setAccountErrorMessage(viewData.account.errors.deviceAuthUnavailable);
        } else if (challengeResult.reason === "failed") {
          setAccountErrorMessage(viewData.account.errors.deviceAuthFailed);
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
      setAccountErrorMessage(
        resolveBackupSyncErrorMessage(result.errorCode, viewData.account),
      );
      setIsPreparingSync(false);
      return;
    }

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

    resetAccountMessages();
    setIsAuthenticatingSync(true);

    const syncReadyState = await saveSyncDraftIfNeeded();
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
      setAccountErrorMessage(
        resolveBackupSyncErrorMessage(result.errorCode, viewData.account),
      );
      setIsAuthenticatingSync(false);
      return;
    }

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

    resetAccountMessages();
    setIsSyncingNow(true);

    const syncReadyState = await saveSyncDraftIfNeeded();
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
      setAccountErrorMessage(
        resolveBackupSyncErrorMessage(result.errorCode, viewData.account),
      );
      setIsSyncingNow(false);
      return;
    }

    setState(result.state);
    setAccountStatusMessage(viewData.account.status.uploaded);
    setIsSyncingNow(false);
  }

  async function handleRestoreSync() {
    if (!state) {
      return;
    }

    resetAccountMessages();

    const challengeResult = await requestSensitiveActionChallenge(
      viewData.account.restoreDeviceAuthPrompt,
    );
    if (!challengeResult.ok) {
      if (challengeResult.reason === "unavailable") {
        setAccountErrorMessage(viewData.account.errors.deviceAuthUnavailable);
      } else if (challengeResult.reason === "failed") {
        setAccountErrorMessage(viewData.account.errors.deviceAuthFailed);
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
      setAccountErrorMessage(
        resolveBackupSyncErrorMessage(result.errorCode, viewData.account),
      );
      setIsRestoringSync(false);
      return;
    }

    setState(result.state);
    setAccountStatusMessage(viewData.account.status.restored);
    setIsRestoringSync(false);
  }

  async function handleRecoverSync() {
    if (!state) {
      return;
    }

    resetAccountMessages();
    setIsRecoveringSync(true);

    const syncReadyState = await saveSyncDraftIfNeeded();
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
      setAccountErrorMessage(
        resolveBackupSyncErrorMessage(result.errorCode, viewData.account),
      );
      setIsRecoveringSync(false);
      return;
    }

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

    resetAccountMessages();
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
    setState(result.state);
    setAccountStatusMessage(viewData.account.status.disconnected);
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
      errorMessage={accountErrorMessage}
      generatedRecoveryPhrase={generatedRecoveryPhrase}
      hasStoredSyncSecrets={state.hasStoredSyncSecrets}
      hasSyncSession={state.hasSyncSession}
      isAuthenticating={isAuthenticatingSync}
      isPreparing={isPreparingSync}
      isRecovering={isRecoveringSync}
      isRestoring={isRestoringSync}
      isSyncing={isSyncingNow}
      notSetLabel={viewData.common.notSet}
      onBack={() => {
        router.back();
      }}
      onAuthLoginChange={(value) => {
        resetAccountMessages();
        setAccountLoginValue(value);
      }}
      onAuthPasswordChange={(value) => {
        resetAccountMessages();
        setAccountPasswordValue(value);
      }}
      onDeviceLabelChange={(value) => {
        resetAccountMessages();
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
        resetAccountMessages();
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
      onLogin={() => {
        void handleConnectSync("login");
      }}
      onModeSelect={(value) => {
        resetAccountMessages();
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
        resetAccountMessages();
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
