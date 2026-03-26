import type { SettingsViewData } from "../../services/settings-view-service";
import type {
  BackupSyncErrorPresentation,
  BackupSyncSetupPresentation,
} from "../../services/backup-sync-view-service";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { InlineBackButton } from "../components/InlineBackButton";
import { SettingsSyncSetupSection } from "./backup-sync/SettingsSyncSetupSection";
import type { SyncPreferencesRecord } from "../../sync/sync-contract";

export type BackupSyncFlowScreenProps = {
  authLoginValue: string;
  authPasswordValue: string;
  confirmActionLabel: string;
  errorPresentation: BackupSyncErrorPresentation;
  generatedRecoveryPhrase: string;
  hasSyncSession: boolean;
  hasStoredSyncSecrets: boolean;
  isExportingRecoveryPhrase: boolean;
  isPreparing: boolean;
  onAuthLoginChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onDisconnect: () => void | Promise<void>;
  onDeviceLabelChange: (value: string) => void;
  onEndpointChange: (value: string) => void;
  onExportRecoveryPhrase: () => void | Promise<void>;
  onLogin: () => void | Promise<void>;
  onModeSelect: (value: SyncPreferencesRecord["mode"]) => void;
  onPrepare: () => void | Promise<void>;
  onRecoverAccess: () => void | Promise<void>;
  onRecoveryPhraseChange: (value: string) => void;
  onRegister: () => void | Promise<void>;
  onRestore: () => void | Promise<void>;
  onSyncNow: () => void | Promise<void>;
  presentation: BackupSyncSetupPresentation;
  preferences: SyncPreferencesRecord;
  recoveryPhraseValue: string;
  statusMessage: string;
  viewData: SettingsViewData["account"];
  backLabel?: string;
  onBack?: (() => void | Promise<void>) | undefined;
  showStandaloneHeader?: boolean;
};

export function BackupSyncFlowScreen({
  authLoginValue,
  authPasswordValue,
  confirmActionLabel,
  errorPresentation,
  generatedRecoveryPhrase,
  hasSyncSession,
  hasStoredSyncSecrets,
  isExportingRecoveryPhrase,
  isPreparing,
  onAuthLoginChange,
  onAuthPasswordChange,
  onDisconnect,
  onDeviceLabelChange,
  onEndpointChange,
  onExportRecoveryPhrase,
  onLogin,
  onModeSelect,
  onPrepare,
  onRecoverAccess,
  onRecoveryPhraseChange,
  onRegister,
  onRestore,
  onSyncNow,
  presentation,
  preferences,
  recoveryPhraseValue,
  statusMessage,
  viewData,
  backLabel,
  onBack,
  showStandaloneHeader = true,
}: BackupSyncFlowScreenProps) {
  return (
    <ScreenScaffold
      description={viewData.subtitle}
      topAccessory={
        showStandaloneHeader && onBack && backLabel ? (
          <InlineBackButton
            label={backLabel}
            onPress={onBack}
            testID="backup-sync-back-button"
          />
        ) : undefined
      }
      title={viewData.title}
    >
      <SettingsSyncSetupSection
        authLoginValue={authLoginValue}
        authPasswordValue={authPasswordValue}
        confirmActionLabel={confirmActionLabel}
        errorPresentation={errorPresentation}
        generatedRecoveryPhrase={generatedRecoveryPhrase}
        hasSyncSession={hasSyncSession}
        hasStoredSyncSecrets={hasStoredSyncSecrets}
        isExportingRecoveryPhrase={isExportingRecoveryPhrase}
        isPreparing={isPreparing}
        onAuthLoginChange={onAuthLoginChange}
        onAuthPasswordChange={onAuthPasswordChange}
        onDisconnect={onDisconnect}
        onDeviceLabelChange={onDeviceLabelChange}
        onEndpointChange={onEndpointChange}
        onExportRecoveryPhrase={onExportRecoveryPhrase}
        onLogin={onLogin}
        onModeSelect={onModeSelect}
        onPrepare={onPrepare}
        onRecoverAccess={onRecoverAccess}
        onRecoveryPhraseChange={onRecoveryPhraseChange}
        onRegister={onRegister}
        onRestore={onRestore}
        onSyncNow={onSyncNow}
        presentation={presentation}
        preferences={preferences}
        recoveryPhraseValue={recoveryPhraseValue}
        showCardHeader={!showStandaloneHeader}
        statusMessage={statusMessage}
        viewData={viewData}
      />
    </ScreenScaffold>
  );
}
