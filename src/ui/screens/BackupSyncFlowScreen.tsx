import type { SettingsViewData } from "../../services/settings-view-service";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { SettingsSyncSetupSection } from "../components/SettingsSyncSetupSection";
import type {
  SyncCapabilityDocument,
  SyncPreferencesRecord,
} from "../../sync/sync-contract";

type BackupSyncFlowScreenProps = {
  authLoginValue: string;
  authPasswordValue: string;
  errorMessage: string;
  generatedRecoveryPhrase: string;
  hasSyncSession: boolean;
  hasStoredSyncSecrets: boolean;
  isAuthenticating: boolean;
  isPreparing: boolean;
  isRestoring: boolean;
  isSyncing: boolean;
  notSetLabel: string;
  onAuthLoginChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onDisconnect: () => void | Promise<void>;
  onDeviceLabelChange: (value: string) => void;
  onEndpointChange: (value: string) => void;
  onLogin: () => void | Promise<void>;
  onModeSelect: (value: SyncPreferencesRecord["mode"]) => void;
  onPrepare: () => void | Promise<void>;
  onRegister: () => void | Promise<void>;
  onRestore: () => void | Promise<void>;
  onSyncNow: () => void | Promise<void>;
  preferences: SyncPreferencesRecord;
  statusMessage: string;
  syncCapabilities: SyncCapabilityDocument | null;
  viewData: SettingsViewData["account"];
};

export function BackupSyncFlowScreen({
  authLoginValue,
  authPasswordValue,
  errorMessage,
  generatedRecoveryPhrase,
  hasSyncSession,
  hasStoredSyncSecrets,
  isAuthenticating,
  isPreparing,
  isRestoring,
  isSyncing,
  notSetLabel,
  onAuthLoginChange,
  onAuthPasswordChange,
  onDisconnect,
  onDeviceLabelChange,
  onEndpointChange,
  onLogin,
  onModeSelect,
  onPrepare,
  onRegister,
  onRestore,
  onSyncNow,
  preferences,
  statusMessage,
  syncCapabilities,
  viewData,
}: BackupSyncFlowScreenProps) {
  return (
    <ScreenScaffold
      description={viewData.subtitle}
      title={viewData.title}
    >
      <SettingsSyncSetupSection
        authLoginValue={authLoginValue}
        authPasswordValue={authPasswordValue}
        errorMessage={errorMessage}
        generatedRecoveryPhrase={generatedRecoveryPhrase}
        hasSyncSession={hasSyncSession}
        hasStoredSyncSecrets={hasStoredSyncSecrets}
        isAuthenticating={isAuthenticating}
        isPreparing={isPreparing}
        isRestoring={isRestoring}
        isSyncing={isSyncing}
        notSetLabel={notSetLabel}
        onAuthLoginChange={onAuthLoginChange}
        onAuthPasswordChange={onAuthPasswordChange}
        onDisconnect={onDisconnect}
        onDeviceLabelChange={onDeviceLabelChange}
        onEndpointChange={onEndpointChange}
        onLogin={onLogin}
        onModeSelect={onModeSelect}
        onPrepare={onPrepare}
        onRegister={onRegister}
        onRestore={onRestore}
        onSyncNow={onSyncNow}
        preferences={preferences}
        statusMessage={statusMessage}
        syncCapabilities={syncCapabilities}
        viewData={viewData}
      />
    </ScreenScaffold>
  );
}
