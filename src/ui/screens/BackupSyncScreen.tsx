import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useNavigation, usePreventRemove } from "@react-navigation/native";

import { getShellCopy } from "../../i18n/shell-copy";
import { appStorage, readHasCompletedOnboarding } from "../../services/app-bootstrap-service";
import {
  connectBackupSyncAccount,
  disconnectBackupSyncAccount,
  prepareBackupSyncSetup,
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
  const [isAuthenticatingSync, setIsAuthenticatingSync] = useState(false);
  const [isPreparingSync, setIsPreparingSync] = useState(false);
  const [isRestoringSync, setIsRestoringSync] = useState(false);
  const [isSavingSyncDraft, setIsSavingSyncDraft] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const shellCopy = getShellCopy(language);
  const viewData = buildSettingsViewData(effectiveNow, language);
  const isSyncDirty = state
    ? !areSyncPreferencesEqual(state.syncPreferences, state.savedSyncPreferences)
    : false;

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
      current
        ? {
            ...current,
            syncPreferences: current.savedSyncPreferences,
          }
        : current,
    );
  }, [resetAccountMessages]);

  usePreventRemove(
    isSyncDirty &&
      !isSavingSyncDraft &&
      !isPreparingSync &&
      !isAuthenticatingSync &&
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

  function syncErrorLabel(errorCode: string) {
    switch (errorCode) {
      case "login_required":
        return viewData.account.errors.loginRequired;
      case "password_required":
        return viewData.account.errors.passwordRequired;
      case "device_label_required":
        return viewData.account.errors.deviceLabelRequired;
      case "endpoint_required":
        return viewData.account.errors.endpointRequired;
      case "invalid_endpoint":
        return viewData.account.errors.invalidEndpoint;
      case "unsupported_scheme":
        return viewData.account.errors.unsupportedScheme;
      case "insecure_public_http":
        return viewData.account.errors.insecurePublicHttp;
      case "invalid_registration_input":
        return viewData.account.errors.invalidRegistrationInput;
      case "registration_failed":
        return viewData.account.errors.registrationFailed;
      case "invalid_credentials":
        return viewData.account.errors.invalidCredentials;
      case "too_many_devices":
        return viewData.account.errors.tooManyDevices;
      case "sync_not_prepared":
        return viewData.account.errors.syncNotPrepared;
      case "not_connected":
      case "unauthorized":
        return viewData.account.errors.notConnected;
      case "blob_not_found":
        return viewData.account.errors.blobNotFound;
      case "invalid_payload":
        return viewData.account.errors.invalidPayload;
      case "network_failed":
        return viewData.account.errors.networkFailed;
      case "stale_generation":
        return viewData.account.errors.syncFailed;
      default:
        return viewData.account.errors.saveFailed;
    }
  }

  async function saveSyncDraftIfNeeded() {
    if (!state) {
      return null;
    }
    if (areSyncPreferencesEqual(state.syncPreferences, state.savedSyncPreferences)) {
      return state;
    }

    setIsSavingSyncDraft(true);
    const syncResult = await saveBackupSyncDraft(storage, syncSecretStore, state);
    setIsSavingSyncDraft(false);
    if (!syncResult.ok) {
      setAccountErrorMessage(syncErrorLabel(syncResult.errorCode));
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
      setAccountErrorMessage(syncErrorLabel(result.errorCode));
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
      setAccountErrorMessage(syncErrorLabel(result.errorCode));
      setIsAuthenticatingSync(false);
      return;
    }

    setState(result.state);
    setAccountPasswordValue("");
    setAccountStatusMessage(
      result.state.syncPreferences.mode === "managed" &&
        result.state.syncCapabilities &&
        !result.state.syncCapabilities.premiumActive
        ? viewData.account.status.connectedNoPlan
        : viewData.account.status.connected,
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
      setAccountErrorMessage(syncErrorLabel(result.errorCode));
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
      setAccountErrorMessage(syncErrorLabel(result.errorCode));
      setIsRestoringSync(false);
      return;
    }

    setState(result.state);
    setAccountStatusMessage(viewData.account.status.restored);
    setIsRestoringSync(false);
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
      errorMessage={accountErrorMessage}
      generatedRecoveryPhrase={generatedRecoveryPhrase}
      hasStoredSyncSecrets={state.hasStoredSyncSecrets}
      hasSyncSession={state.hasSyncSession}
      isAuthenticating={isAuthenticatingSync}
      isPreparing={isPreparingSync}
      isRestoring={isRestoringSync}
      isSyncing={isSyncingNow}
      notSetLabel={viewData.common.notSet}
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
      statusMessage={accountStatusMessage}
      syncCapabilities={state.syncCapabilities}
      viewData={viewData.account}
    />
  );
}

function areSyncPreferencesEqual(
  left: LoadedSettingsState["syncPreferences"],
  right: LoadedSettingsState["syncPreferences"],
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
