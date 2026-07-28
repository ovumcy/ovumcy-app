import { useEffect, useState } from "react";
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
import { GuestUpgradeSection } from "./backup-sync/GuestUpgradeSection";
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
  isGuestPartner: boolean;
  isPartnerBusy: boolean;
  isPreparing: boolean;
  guestUpgradeEmailValue: string;
  guestUpgradeFormErrorMessage: string;
  guestUpgradeGeneratedRecoveryCode: string;
  guestUpgradeIsFormOpen: boolean;
  guestUpgradeIsSubmitting: boolean;
  guestUpgradeNudgeMessage: string;
  guestUpgradePasswordValue: string;
  onAcknowledgeRecoveryCode: () => void;
  onAuthLoginChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onDisconnect: () => void | Promise<void>;
  onDeleteAccount: () => void | Promise<void>;
  onDeviceLabelChange: (value: string) => void;
  onDismissOffer: (offerID: string) => void | Promise<void>;
  onEndpointChange: (value: string) => void;
  onExportRecoveryPhrase: () => void | Promise<void>;
  onGuestUpgradeAcknowledgeRecoveryCode: () => void;
  onGuestUpgradeCancelForm: () => void;
  onGuestUpgradeEmailChange: (value: string) => void;
  onGuestUpgradePasswordChange: (value: string) => void;
  onGuestUpgradeSubmitForm: () => void | Promise<void>;
  onGuestUpgradeTapKeepAccess: () => void | Promise<void>;
  onIssuePartnerInvite: () => void | Promise<void>;
  onLoadDevices: () => void | Promise<void>;
  onLogin: () => void | Promise<void>;
  onModeSelect: (value: SyncPreferencesRecord["mode"]) => void;
  onOfferCTAPress: (offer: ResolvedBillingOffer) => void;
  onPartnerAccessLevelChange: (value: ManagedCloudPartnerAccessLevel) => void;
  onPartnerAcceptInvite: () => void | Promise<void>;
  onPartnerAcceptInviteAsGuest: () => void | Promise<void>;
  onPartnerChooseSignIn: () => void;
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
  isGuestPartner,
  isPartnerBusy,
  isPreparing,
  guestUpgradeEmailValue,
  guestUpgradeFormErrorMessage,
  guestUpgradeGeneratedRecoveryCode,
  guestUpgradeIsFormOpen,
  guestUpgradeIsSubmitting,
  guestUpgradeNudgeMessage,
  guestUpgradePasswordValue,
  onAcknowledgeRecoveryCode,
  onAuthLoginChange,
  onAuthPasswordChange,
  onDisconnect,
  onDeleteAccount,
  onDeviceLabelChange,
  onDismissOffer,
  onEndpointChange,
  onExportRecoveryPhrase,
  onGuestUpgradeAcknowledgeRecoveryCode,
  onGuestUpgradeCancelForm,
  onGuestUpgradeEmailChange,
  onGuestUpgradePasswordChange,
  onGuestUpgradeSubmitForm,
  onGuestUpgradeTapKeepAccess,
  onIssuePartnerInvite,
  onLoadDevices,
  onLogin,
  onModeSelect,
  onOfferCTAPress,
  onPartnerAccessLevelChange,
  onPartnerAcceptInvite,
  onPartnerAcceptInviteAsGuest,
  onPartnerChooseSignIn,
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
  // A buffered partner invite token means the partner arrived via the invite
  // link and needs the accept UI immediately — it must not sit behind the
  // same manual "Advanced" toggle as the unrelated account-security link and
  // device list. This is sticky rather than a live read of
  // pendingPartnerInviteToken: accepting clears the token as its very first
  // step (see useBackupSyncPartnerAccess), and the section must stay open
  // afterward to show the success banner and the newly visible grant instead
  // of collapsing the moment accept succeeds. With no buffered token this
  // never latches, so every other reason the section might want to render
  // (owner controls, an issued invite link, invite/grant history) still
  // stays behind the toggle exactly as before.
  const [hasShownPartnerSectionForToken, setHasShownPartnerSectionForToken] =
    useState(() => pendingPartnerInviteToken.length > 0);
  useEffect(() => {
    if (pendingPartnerInviteToken.length > 0) {
      setHasShownPartnerSectionForToken(true);
    }
  }, [pendingPartnerInviteToken]);
  const shouldShowPartnerSection =
    showPartnerSection && (advancedOpen || hasShownPartnerSectionForToken);
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
      <GuestUpgradeSection
        copy={partnerCopy}
        emailValue={guestUpgradeEmailValue}
        formErrorMessage={guestUpgradeFormErrorMessage}
        generatedRecoveryCode={guestUpgradeGeneratedRecoveryCode}
        isFormOpen={guestUpgradeIsFormOpen}
        isGuestPartner={isGuestPartner}
        isSubmitting={guestUpgradeIsSubmitting}
        nudgeMessage={guestUpgradeNudgeMessage}
        onAcknowledgeRecoveryCode={onGuestUpgradeAcknowledgeRecoveryCode}
        onCancelForm={onGuestUpgradeCancelForm}
        onEmailChange={onGuestUpgradeEmailChange}
        onPasswordChange={onGuestUpgradePasswordChange}
        onSubmitForm={onGuestUpgradeSubmitForm}
        onTapKeepAccess={onGuestUpgradeTapKeepAccess}
        passwordValue={guestUpgradePasswordValue}
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
        </>
      ) : null}
      {shouldShowPartnerSection ? (
        <SettingsPartnerAccessSection
          copy={partnerCopy}
          errorMessage={partnerErrorMessage}
          hasManagedSession={hasSyncSession && presentation.isManaged}
          inviteAccessLevel={partnerInviteAccessLevel}
          inviteLink={partnerInviteLink}
          isBusy={isPartnerBusy}
          locale={partnerLocale}
          onAcceptInvite={onPartnerAcceptInvite}
          onAcceptInviteAsGuest={onPartnerAcceptInviteAsGuest}
          onAccessLevelChange={onPartnerAccessLevelChange}
          onChooseSignIn={onPartnerChooseSignIn}
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
