import { useRouter } from "expo-router";

import { selectAccountSecurityCopy } from "../../i18n/account-security-copy";
import type { SettingsViewData } from "../../services/settings-view-service";
import type {
  BackupSyncErrorPresentation,
  BackupSyncSetupPresentation,
} from "../../services/backup-sync-view-service";
import { AppButton } from "../components/AppButton";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { InlineBackButton } from "../components/InlineBackButton";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import { SettingsSyncSetupSection } from "./backup-sync/SettingsSyncSetupSection";
import { SettingsPartnerAccessSection } from "./backup-sync/SettingsPartnerAccessSection";
import type { SyncPreferencesRecord } from "../../sync/sync-contract";
import type { PartnerCopy } from "../../i18n/partner-copy";
import type {
  ManagedCloudPartnerAccessLevel,
  ManagedCloudPartnerAccessOverview,
} from "../../sync/managed-cloud-api-client";

export type BackupSyncFlowScreenProps = {
  authLoginValue: string;
  authPasswordValue: string;
  confirmActionLabel: string;
  errorPresentation: BackupSyncErrorPresentation;
  generatedRecoveryCode: string;
  generatedRecoveryPhrase: string;
  hasSyncSession: boolean;
  hasStoredSyncSecrets: boolean;
  isExportingRecoveryPhrase: boolean;
  isPartnerBusy: boolean;
  isPreparing: boolean;
  onAcknowledgeRecoveryCode: () => void;
  onAuthLoginChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onDisconnect: () => void | Promise<void>;
  onDeviceLabelChange: (value: string) => void;
  onEndpointChange: (value: string) => void;
  onExportRecoveryPhrase: () => void | Promise<void>;
  onIssuePartnerInvite: () => void | Promise<void>;
  onLogin: () => void | Promise<void>;
  onModeSelect: (value: SyncPreferencesRecord["mode"]) => void;
  onPartnerAccessLevelChange: (value: ManagedCloudPartnerAccessLevel) => void;
  onPartnerAcceptInvite: () => void | Promise<void>;
  onPartnerRevokeGrant: (grantID: string) => void | Promise<void>;
  onPartnerRevokeInvite: (inviteID: string) => void | Promise<void>;
  onPartnerOpenGrant: (grantID: string) => void | Promise<void>;
  onPrepare: () => void | Promise<void>;
  onRecoverAccess: () => void | Promise<void>;
  onRecoveryPhraseChange: (value: string) => void;
  onRegister: () => void | Promise<void>;
  onRestore: () => void | Promise<void>;
  onSyncNow: () => void | Promise<void>;
  presentation: BackupSyncSetupPresentation;
  partnerCopy: PartnerCopy;
  partnerErrorMessage: string;
  partnerInviteAccessLevel: ManagedCloudPartnerAccessLevel;
  partnerInviteLink: string;
  partnerLocale?: string | undefined;
  partnerOverview: ManagedCloudPartnerAccessOverview | null;
  pendingPartnerInviteToken: string;
  preferences: SyncPreferencesRecord;
  recoveryPhraseValue: string;
  showPartnerOwnerControls: boolean;
  showPartnerSection: boolean;
  partnerStatusMessage: string;
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
  generatedRecoveryCode,
  generatedRecoveryPhrase,
  hasSyncSession,
  hasStoredSyncSecrets,
  isExportingRecoveryPhrase,
  isPartnerBusy,
  isPreparing,
  onAcknowledgeRecoveryCode,
  onAuthLoginChange,
  onAuthPasswordChange,
  onDisconnect,
  onDeviceLabelChange,
  onEndpointChange,
  onExportRecoveryPhrase,
  onIssuePartnerInvite,
  onLogin,
  onModeSelect,
  onPartnerAccessLevelChange,
  onPartnerAcceptInvite,
  onPartnerOpenGrant,
  onPartnerRevokeGrant,
  onPartnerRevokeInvite,
  onPrepare,
  onRecoverAccess,
  onRecoveryPhraseChange,
  onRegister,
  onRestore,
  onSyncNow,
  presentation,
  partnerCopy,
  partnerErrorMessage,
  partnerInviteAccessLevel,
  partnerInviteLink,
  partnerLocale,
  partnerOverview,
  pendingPartnerInviteToken,
  preferences,
  recoveryPhraseValue,
  showPartnerOwnerControls,
  showPartnerSection,
  partnerStatusMessage,
  statusMessage,
  viewData,
  backLabel,
  onBack,
  showStandaloneHeader = true,
}: BackupSyncFlowScreenProps) {
  const router = useRouter();
  const { language } = useAppPreferences();
  const accountSecurityCopy = selectAccountSecurityCopy(language);
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
        generatedRecoveryCode={generatedRecoveryCode}
        generatedRecoveryPhrase={generatedRecoveryPhrase}
        hasSyncSession={hasSyncSession}
        hasStoredSyncSecrets={hasStoredSyncSecrets}
        isExportingRecoveryPhrase={isExportingRecoveryPhrase}
        isPreparing={isPreparing}
        onAcknowledgeRecoveryCode={onAcknowledgeRecoveryCode}
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
      <AppButton
        label={accountSecurityCopy.title}
        onPress={() => router.push("/sync-account-security")}
        testID="backup-sync-account-security-link"
        variant="secondary"
      />
      {showPartnerSection ? (
        <SettingsPartnerAccessSection
          copy={partnerCopy}
          errorMessage={partnerErrorMessage}
          hasManagedSession={hasSyncSession && presentation.isManaged}
          inviteAccessLevel={partnerInviteAccessLevel}
          inviteLink={partnerInviteLink}
          isBusy={isPartnerBusy}
          locale={partnerLocale}
          onAcceptInvite={onPartnerAcceptInvite}
          onAccessLevelChange={onPartnerAccessLevelChange}
          onIssueInvite={onIssuePartnerInvite}
          onOpenGrant={onPartnerOpenGrant}
          onRevokeGrant={onPartnerRevokeGrant}
          onRevokeInvite={onPartnerRevokeInvite}
          overview={partnerOverview}
          pendingInviteToken={pendingPartnerInviteToken}
          showOwnerControls={showPartnerOwnerControls}
          statusMessage={partnerStatusMessage}
        />
      ) : null}
    </ScreenScaffold>
  );
}
