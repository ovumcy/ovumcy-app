import { useEffect, useState } from "react";

import { syncSecretStore as defaultSyncSecretStore } from "../../../sync/app-sync-service";
import {
  changeSyncAccountPassword,
  regenerateSyncAccountRecoveryCode,
  requestSyncPasswordReset,
  resetSyncAccountPassword,
  type ChangeSyncPasswordErrorCode,
  type RegenerateSyncRecoveryCodeErrorCode,
  type RequestSyncPasswordResetErrorCode,
  type ResetSyncPasswordErrorCode,
} from "../../../sync/sync-account-recovery-service";
import type { SyncPreferencesRecord } from "../../../sync/sync-contract";
import type { SyncSecretStore } from "../../../security/sync-secret-store";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import { appStorage } from "../../../services/app-bootstrap-service";

export type SyncAccountSecurityStatus = "idle" | "submitting" | "success";

export type SyncAccountSecurityForgotStage =
  | "credentials"
  | "new_password"
  | "completed";

export type SyncAccountSecurityControllerOptions = {
  storage?: LocalAppStorage;
  syncSecretStore?: SyncSecretStore;
};

export function useSyncAccountSecurityController({
  storage = appStorage,
  syncSecretStore = defaultSyncSecretStore,
}: SyncAccountSecurityControllerOptions = {}) {
  const [preferences, setPreferences] = useState<SyncPreferencesRecord | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  // Change password
  const [changeCurrentPassword, setChangeCurrentPassword] = useState("");
  const [changeNewPassword, setChangeNewPassword] = useState("");
  const [changeStatus, setChangeStatus] =
    useState<SyncAccountSecurityStatus>("idle");
  const [changeErrorCode, setChangeErrorCode] =
    useState<ChangeSyncPasswordErrorCode | null>(null);

  // Forgot password (two-stage)
  const [forgotLogin, setForgotLogin] = useState("");
  const [forgotRecoveryCode, setForgotRecoveryCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotStage, setForgotStage] =
    useState<SyncAccountSecurityForgotStage>("credentials");
  const [forgotStatus, setForgotStatus] =
    useState<SyncAccountSecurityStatus>("idle");
  const [forgotResetToken, setForgotResetToken] = useState("");
  const [forgotResetTokenExpiresAt, setForgotResetTokenExpiresAt] =
    useState("");
  const [forgotErrorCode, setForgotErrorCode] = useState<
    RequestSyncPasswordResetErrorCode | ResetSyncPasswordErrorCode | null
  >(null);

  // Regenerate recovery code
  const [regeneratePassword, setRegeneratePassword] = useState("");
  const [regenerateStatus, setRegenerateStatus] =
    useState<SyncAccountSecurityStatus>("idle");
  const [regenerateErrorCode, setRegenerateErrorCode] =
    useState<RegenerateSyncRecoveryCodeErrorCode | null>(null);

  // Shared reveal modal (used by reset-password and regenerate flows)
  const [revealedRecoveryCode, setRevealedRecoveryCode] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await storage.readSyncPreferencesRecord();
      if (!cancelled) {
        setPreferences(loaded);
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storage]);

  async function handleChangePassword() {
    if (!preferences) {
      return;
    }
    setChangeErrorCode(null);
    setChangeStatus("submitting");
    const result = await changeSyncAccountPassword(
      syncSecretStore,
      preferences,
      {
        currentPassword: changeCurrentPassword,
        newPassword: changeNewPassword,
      },
    );
    if (result.ok) {
      setChangeStatus("success");
      setChangeCurrentPassword("");
      setChangeNewPassword("");
    } else {
      setChangeErrorCode(result.errorCode);
      setChangeStatus("idle");
    }
  }

  async function handleRequestReset() {
    if (!preferences) {
      return;
    }
    setForgotErrorCode(null);
    setForgotStatus("submitting");
    const result = await requestSyncPasswordReset(preferences, {
      loginOrEmail: forgotLogin,
      recoveryCode: forgotRecoveryCode,
    });
    if (result.ok) {
      setForgotResetToken(result.resetToken);
      setForgotResetTokenExpiresAt(result.resetTokenExpiresAt);
      setForgotStage("new_password");
      setForgotStatus("idle");
      setForgotRecoveryCode("");
    } else {
      setForgotErrorCode(result.errorCode);
      setForgotStatus("idle");
    }
  }

  async function handleSubmitResetPassword() {
    if (!preferences) {
      return;
    }
    setForgotErrorCode(null);
    setForgotStatus("submitting");
    const result = await resetSyncAccountPassword(
      storage,
      syncSecretStore,
      preferences,
      {
        resetToken: forgotResetToken,
        newPassword: forgotNewPassword,
      },
    );
    if (result.ok) {
      setPreferences(result.preferences);
      setRevealedRecoveryCode(result.recoveryCode);
      setForgotStage("completed");
      setForgotStatus("success");
      setForgotResetToken("");
      setForgotResetTokenExpiresAt("");
      setForgotNewPassword("");
      setForgotLogin("");
    } else {
      setForgotErrorCode(result.errorCode);
      setForgotStatus("idle");
    }
  }

  function handleCancelForgot() {
    setForgotStage("credentials");
    setForgotResetToken("");
    setForgotResetTokenExpiresAt("");
    setForgotNewPassword("");
    setForgotErrorCode(null);
    setForgotStatus("idle");
  }

  async function handleRegenerate() {
    if (!preferences) {
      return;
    }
    setRegenerateErrorCode(null);
    setRegenerateStatus("submitting");
    const result = await regenerateSyncAccountRecoveryCode(
      syncSecretStore,
      preferences,
      { currentPassword: regeneratePassword },
    );
    if (result.ok) {
      setRevealedRecoveryCode(result.recoveryCode);
      setRegenerateStatus("success");
      setRegeneratePassword("");
    } else {
      setRegenerateErrorCode(result.errorCode);
      setRegenerateStatus("idle");
    }
  }

  function handleAcknowledgeRecoveryCode() {
    setRevealedRecoveryCode("");
    // After acknowledging a regenerate-issued code, the success flag stays
    // long enough to show a confirmation banner if the screen still wants it;
    // we reset it explicitly so the form is ready for further changes.
    if (regenerateStatus === "success") {
      setRegenerateStatus("idle");
    }
  }

  return {
    isLoading,
    preferences,

    // change password
    changeCurrentPassword,
    setChangeCurrentPassword,
    changeNewPassword,
    setChangeNewPassword,
    changeStatus,
    changeErrorCode,
    handleChangePassword,

    // forgot password
    forgotLogin,
    setForgotLogin,
    forgotRecoveryCode,
    setForgotRecoveryCode,
    forgotNewPassword,
    setForgotNewPassword,
    forgotStage,
    forgotStatus,
    forgotErrorCode,
    forgotResetTokenExpiresAt,
    handleRequestReset,
    handleSubmitResetPassword,
    handleCancelForgot,

    // regenerate
    regeneratePassword,
    setRegeneratePassword,
    regenerateStatus,
    regenerateErrorCode,
    handleRegenerate,

    // reveal
    revealedRecoveryCode,
    handleAcknowledgeRecoveryCode,
  };
}
