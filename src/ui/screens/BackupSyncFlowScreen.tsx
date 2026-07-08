import { useState } from "react";
import { useRouter } from "expo-router";

import { selectAccountSecurityCopy } from "../../i18n/account-security-copy";
import { getDeviceCopy } from "../../i18n/device-copy";
import { selectTOTPCopy } from "../../i18n/totp-copy";
import type { SettingsViewData } from "../../services/settings-view-service";
import type {
  BackupSyncDeviceListItemView,
  BackupSyncErrorPresentation,
  BackupSyncSetupPresentation,
} from "../../services/backup-sync-view-service";
import type { ResolvedBillingOffer } from "../../services/offers-service";
import { AppButton } from "../components/AppButton";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { InlineBackButton } from "../components/InlineBackButton";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import { SettingsSyncSetupSection } from "./backup-sync/SettingsSyncSetupSection";
import { SettingsPartnerAccessSection } from "./backup-sync/SettingsPartnerAccessSection";
import { SettingsSyncDevicesSection } from "./backup-sync/SettingsSyncDevicesSection";
import { BackupSyncTOTPChallengeSection } from "./backup-sync/BackupSyncTOTPChallengeSection";
import type { SyncPreferencesRecord } from "../../sync/sync-contract";
import type { PartnerCopy } from "../../i18n/partner-copy";
import type {
  ManagedCloudPartnerAccessLevel,
  ManagedCloudPartnerAccessOverview,
} from "../../sync/managed-cloud-api-client";

export type BackupSyncFlowScreenProps = {
  authLoginValue: string;
  authPasswordValue: string;
  billingOffers: ResolvedBillingOffer[];
  confirmActionLabel: string;
  deviceErrorMessage: string;
  deviceListItems: BackupSyncDeviceListItemView[] | null;
  deviceStatusMessage: string;
  errorPresentation: BackupSyncErrorPresentation;
  generatedRecoveryCode: string;
  generatedRecoveryPhrase: string;
  hasSyncSession: boolean;
  hasStoredSyncSecrets: boolean;
  isDeviceBusy: boolean;
  isExportingRecoveryPhrase: boolean;
  isPartnerBusy: boolean;
  isPreparing: boolean;
  onAcknowledgeRecoveryCode: () => void;
  onAuthLoginChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onCancelRenewal: () => void | Promise<void>;
  onDisconnect: () => void | Promise<void>;
  onDeleteAccount: () => void | Promise<void>;
  onDeviceLabelChange: (value: string) => void;
  onDismissOffer: (offerID: string) => void | Promise<void>;
  onEndpointChange: (value: string) => void;
  onExportRecoveryPhrase: () => void | Promise<void>;
  onIssuePartnerInvite: () => void | Promise<void>;
  onLoadDevices: () => void | Promise<void>;
  onLogin: () => void | Promise<void>;
  onModeSelect: (value: SyncPreferencesRecord["mode"]) => void;
  onOfferCTAPress: (offer: ResolvedBillingOffer) => void;
  onResumeRenewal: () => void | Promise<void>;
  onPartnerAccessLevelChange: (value: ManagedCloudPartnerAccessLevel) => void;
  onPartnerAcceptInvite: () => void | Promise<void>;
  onPartnerRevokeGrant: (grantID: string) => void | Promise<void>;
  onPartnerRevokeInvite: (inviteID: string) => void | Promise<void>;
  onPartnerOpenGrant: (grantID: string) => void | Promise<void>;
  onPrepare: () => void | Promise<void>;
  onRecoverAccess: () => void | Promise<void>;
  onRetryPlanCheck: () => void | Promise<void>;
  onRecoveryPhraseChange: (value: string) => void;
  onRegister: () => void | Promise<void>;
  onRemoveDevice: (deviceID: string) => void | Promise<void>;
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
  showDeviceSection: boolean;
  showPartnerOwnerControls: boolean;
  showPartnerSection: boolean;
  partnerStatusMessage: string;
  statusMessage: string;
  // Pending TOTP challenge from login; non-null only between password
  // verification and code completion. The flow swaps the setup section for a
  // dedicated challenge form while it is present.
  pendingTOTPChallenge: {
    challengeID: string;
    challengeExpiresAt: string;
  } | null;
  totpChallengeCode: string;
  onTOTPChallengeCodeChange: (value: string) => void;
  onSubmitTOTPChallenge: () => void | Promise<void>;
  onCancelTOTPChallenge: () => void;
  viewData: SettingsViewData["account"];
  backLabel?: string;
  onBack?: (() => void | Promise<void>) | undefined;
  showStandaloneHeader?: boolean;
};

export function BackupSyncFlowScreen({
  authLoginValue,
  authPasswordValue,
  billingOffers,
  confirmActionLabel,
  deviceErrorMessage,
  deviceListItems,
  deviceStatusMessage,
  errorPresentation,
  generatedRecoveryCode,
  generatedRecoveryPhrase,
  hasSyncSession,
  hasStoredSyncSecrets,
  isDeviceBusy,
  isExportingRecoveryPhrase,
  isPartnerBusy,
  isPreparing,
  onAcknowledgeRecoveryCode,
  onAuthLoginChange,
  onAuthPasswordChange,
  onCancelRenewal,
  onDisconnect,
  onDeleteAccount,
  onDeviceLabelChange,
  onDismissOffer,
  onEndpointChange,
  onExportRecoveryPhrase,
  onIssuePartnerInvite,
  onLoadDevices,
  onLogin,
  onModeSelect,
  onOfferCTAPress,
  onResumeRenewal,
  onPartnerAccessLevelChange,
  onPartnerAcceptInvite,
  onPartnerOpenGrant,
  onPartnerRevokeGrant,
  onPartnerRevokeInvite,
  onPrepare,
  onRecoverAccess,
  onRetryPlanCheck,
  onRecoveryPhraseChange,
  onRegister,
  onRemoveDevice,
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
  showDeviceSection,
  showPartnerOwnerControls,
  showPartnerSection,
  partnerStatusMessage,
  statusMessage,
  pendingTOTPChallenge,
  totpChallengeCode,
  onTOTPChallengeCodeChange,
  onSubmitTOTPChallenge,
  onCancelTOTPChallenge,
  viewData,
  backLabel,
  onBack,
  showStandaloneHeader = true,
}: BackupSyncFlowScreenProps) {
  const router = useRouter();
  const { language } = useAppPreferences();
  const accountSecurityCopy = selectAccountSecurityCopy(language);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const totpCopy = selectTOTPCopy(language);
  const deviceCopy = getDeviceCopy(language);
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
      {pendingTOTPChallenge ? (
        <BackupSyncTOTPChallengeSection
          challengeExpiresAt={pendingTOTPChallenge.challengeExpiresAt}
          code={totpChallengeCode}
          copy={totpCopy}
          errorMessage={errorPresentation.accountMessage}
          onCancel={onCancelTOTPChallenge}
          onCodeChange={onTOTPChallengeCodeChange}
          onSubmit={onSubmitTOTPChallenge}
        />
      ) : null}
      <SettingsSyncSetupSection
        authLoginValue={authLoginValue}
        authPasswordValue={authPasswordValue}
        billingOffers={billingOffers}
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
        onCancelRenewal={onCancelRenewal}
        onDisconnect={onDisconnect}
        onDeleteAccount={onDeleteAccount}
        onDeviceLabelChange={onDeviceLabelChange}
        onDismissOffer={onDismissOffer}
        onEndpointChange={onEndpointChange}
        onExportRecoveryPhrase={onExportRecoveryPhrase}
        onLogin={onLogin}
        onModeSelect={onModeSelect}
        onOfferCTAPress={onOfferCTAPress}
        onPrepare={onPrepare}
        onRecoverAccess={onRecoverAccess}
        onResumeRenewal={onResumeRenewal}
        onRetryPlanCheck={onRetryPlanCheck}
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
        label={`${viewData.advancedSectionLabel}  ${advancedOpen ? "▾" : "▸"}`}
        onPress={() => setAdvancedOpen((open) => !open)}
        testID="backup-sync-advanced-toggle"
        variant="secondary"
      />
      {advancedOpen ? (
        <>
          <AppButton
            label={accountSecurityCopy.title}
            onPress={() => router.push("/sync-account-security")}
            testID="backup-sync-account-security-link"
            variant="secondary"
          />
          {showDeviceSection ? (
            <SettingsSyncDevicesSection
              copy={deviceCopy}
              devices={deviceListItems}
              errorMessage={deviceErrorMessage}
              isBusy={isDeviceBusy}
              onLoadDevices={onLoadDevices}
              onRemoveDevice={onRemoveDevice}
              statusMessage={deviceStatusMessage}
            />
          ) : null}
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
        </>
      ) : null}
    </ScreenScaffold>
  );
}
