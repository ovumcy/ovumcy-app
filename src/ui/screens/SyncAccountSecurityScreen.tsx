import { useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { selectAccountSecurityCopy } from "../../i18n/account-security-copy";
import { appStorage } from "../../services/app-bootstrap-service";
import type { SyncSecretStore } from "../../security/sync-secret-store";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { syncSecretStore as defaultSyncSecretStore } from "../../sync/app-sync-service";
import { InlineBackButton } from "../components/InlineBackButton";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import { SyncAccountSecuritySection } from "./sync-account-security/SyncAccountSecuritySection";
import { useSyncAccountSecurityController } from "./sync-account-security/useSyncAccountSecurityController";

export type SyncAccountSecurityScreenProps = {
  storage?: LocalAppStorage;
  syncSecretStore?: SyncSecretStore;
};

export function SyncAccountSecurityScreen({
  storage = appStorage,
  syncSecretStore = defaultSyncSecretStore,
}: SyncAccountSecurityScreenProps = {}) {
  const router = useRouter();
  const { language, colors } = useAppPreferences();
  const copy = selectAccountSecurityCopy(language);

  const controller = useSyncAccountSecurityController({
    storage,
    syncSecretStore,
  });

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/backup-sync");
    }
  };

  if (controller.isLoading) {
    return (
      <ScreenScaffold description={copy.subtitle} title={copy.title}>
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      description={copy.subtitle}
      title={copy.title}
      topAccessory={
        <InlineBackButton
          label={copy.backLabel}
          onPress={goBack}
          testID="sync-account-security-back-button"
        />
      }
    >
      <SyncAccountSecuritySection
        copy={copy}
        changeCurrentPassword={controller.changeCurrentPassword}
        onChangeCurrentPasswordChange={controller.setChangeCurrentPassword}
        changeNewPassword={controller.changeNewPassword}
        onChangeNewPasswordChange={controller.setChangeNewPassword}
        changeStatus={controller.changeStatus}
        changeErrorCode={controller.changeErrorCode}
        onChangePassword={controller.handleChangePassword}
        forgotLogin={controller.forgotLogin}
        onForgotLoginChange={controller.setForgotLogin}
        forgotRecoveryCode={controller.forgotRecoveryCode}
        onForgotRecoveryCodeChange={controller.setForgotRecoveryCode}
        forgotNewPassword={controller.forgotNewPassword}
        onForgotNewPasswordChange={controller.setForgotNewPassword}
        forgotStage={controller.forgotStage}
        forgotStatus={controller.forgotStatus}
        forgotErrorCode={controller.forgotErrorCode}
        forgotResetTokenExpiresAt={controller.forgotResetTokenExpiresAt}
        onRequestReset={controller.handleRequestReset}
        onSubmitResetPassword={controller.handleSubmitResetPassword}
        onCancelForgot={controller.handleCancelForgot}
        regeneratePassword={controller.regeneratePassword}
        onRegeneratePasswordChange={controller.setRegeneratePassword}
        regenerateStatus={controller.regenerateStatus}
        regenerateErrorCode={controller.regenerateErrorCode}
        onRegenerate={controller.handleRegenerate}
        revealedRecoveryCode={controller.revealedRecoveryCode}
        onAcknowledgeRecoveryCode={controller.handleAcknowledgeRecoveryCode}
      />
    </ScreenScaffold>
  );
}
