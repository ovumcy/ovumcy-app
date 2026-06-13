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
import type {
  SyncPreferencesRecord,
  SyncTOTPEnrollmentStart,
} from "../../../sync/sync-contract";
import {
  disableTOTP,
  startTOTPEnrollment,
  verifyTOTPEnrollment,
  type DisableTOTPErrorCode,
  type StartTOTPEnrollmentErrorCode,
  type VerifyTOTPEnrollmentErrorCode,
} from "../../../sync/sync-totp-service";
import { describeSyncAccountTwoFactor } from "../../../sync/sync-account-session-service";
import type { SyncSecretStore } from "../../../security/sync-secret-store";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import { appStorage } from "../../../services/app-bootstrap-service";

export type SyncAccountSecurityStatus = "idle" | "submitting" | "success";

export type SyncAccountSecurityForgotStage =
  | "credentials"
  | "new_password"
  | "completed";

export type SyncAccountSecurityTOTPMode = "enable" | "disable";

export type SyncAccountSecurityTOTPStage =
  | "idle"
  | "enrolling" // captured password, waiting for user to add secret + enter code
  | "verifying" // submitting code
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
  // Live "is 2FA currently on" for this account: null = unknown (not connected
  // or the server could not be reached), true/false = the server's answer.
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(
    null,
  );

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
  // A successful reset revokes every session, so this device is now signed out.
  // The screen surfaces an explicit "reconnect with your new password" notice
  // off this flag; without it the next security action would silently fail with
  // not_connected.
  const [forgotSignedOut, setForgotSignedOut] = useState(false);

  // Regenerate recovery code
  const [regeneratePassword, setRegeneratePassword] = useState("");
  const [regenerateStatus, setRegenerateStatus] =
    useState<SyncAccountSecurityStatus>("idle");
  const [regenerateErrorCode, setRegenerateErrorCode] =
    useState<RegenerateSyncRecoveryCodeErrorCode | null>(null);

  // Shared reveal modal (used by reset-password and regenerate flows)
  const [revealedRecoveryCode, setRevealedRecoveryCode] = useState("");

  // Two-factor authentication (TOTP)
  const [totpMode, setTotpMode] =
    useState<SyncAccountSecurityTOTPMode>("enable");
  const [totpStage, setTotpStage] =
    useState<SyncAccountSecurityTOTPStage>("idle");
  const [totpEnrollPassword, setTotpEnrollPassword] = useState("");
  const [totpEnrollment, setTotpEnrollment] =
    useState<SyncTOTPEnrollmentStart | null>(null);
  const [totpVerifyCode, setTotpVerifyCode] = useState("");
  const [totpDisablePassword, setTotpDisablePassword] = useState("");
  const [totpDisableCode, setTotpDisableCode] = useState("");
  const [totpStatus, setTotpStatus] =
    useState<SyncAccountSecurityStatus>("idle");
  const [totpErrorCode, setTotpErrorCode] = useState<
    | StartTOTPEnrollmentErrorCode
    | VerifyTOTPEnrollmentErrorCode
    | DisableTOTPErrorCode
    | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await storage.readSyncPreferencesRecord();
      if (cancelled) {
        return;
      }
      setPreferences(loaded);
      setIsLoading(false);
      if (loaded) {
        const status = await describeSyncAccountTwoFactor(
          syncSecretStore,
          loaded,
        );
        if (!cancelled) {
          setTwoFactorEnabled(status ? status.twoFactorEnabled : null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storage, syncSecretStore]);

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
      setForgotSignedOut(true);
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
    setForgotSignedOut(false);
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

  function handleTOTPModeChange(nextMode: SyncAccountSecurityTOTPMode) {
    setTotpMode(nextMode);
    setTotpErrorCode(null);
    setTotpStatus("idle");
    setTotpStage("idle");
    setTotpEnrollment(null);
    setTotpEnrollPassword("");
    setTotpVerifyCode("");
    setTotpDisablePassword("");
    setTotpDisableCode("");
  }

  async function handleStartTOTPEnrollment() {
    if (!preferences) {
      return;
    }
    setTotpErrorCode(null);
    setTotpStatus("submitting");
    const result = await startTOTPEnrollment(syncSecretStore, preferences, {
      currentPassword: totpEnrollPassword,
    });
    if (!result.ok) {
      setTotpErrorCode(result.errorCode);
      setTotpStatus("idle");
      return;
    }
    setTotpEnrollment(result.enrollment);
    setTotpStage("enrolling");
    setTotpStatus("idle");
    setTotpEnrollPassword("");
  }

  async function handleVerifyTOTPEnrollment() {
    if (!preferences) {
      return;
    }
    setTotpErrorCode(null);
    setTotpStatus("submitting");
    const result = await verifyTOTPEnrollment(syncSecretStore, preferences, {
      code: totpVerifyCode,
    });
    if (!result.ok) {
      setTotpErrorCode(result.errorCode);
      setTotpStatus("idle");
      return;
    }
    setTotpStage("completed");
    setTotpStatus("success");
    setTotpVerifyCode("");
    setTotpEnrollment(null);
    const status = await describeSyncAccountTwoFactor(syncSecretStore, preferences);
    setTwoFactorEnabled(status ? status.twoFactorEnabled : twoFactorEnabled);
  }

  async function handleDisableTOTP() {
    if (!preferences) {
      return;
    }
    setTotpErrorCode(null);
    setTotpStatus("submitting");
    const result = await disableTOTP(syncSecretStore, preferences, {
      currentPassword: totpDisablePassword,
      code: totpDisableCode,
    });
    if (!result.ok) {
      setTotpErrorCode(result.errorCode);
      setTotpStatus("idle");
      return;
    }
    setTotpStage("completed");
    setTotpStatus("success");
    setTotpDisablePassword("");
    setTotpDisableCode("");
    const status = await describeSyncAccountTwoFactor(syncSecretStore, preferences);
    setTwoFactorEnabled(status ? status.twoFactorEnabled : twoFactorEnabled);
  }

  function handleCancelTOTPEnrollment() {
    setTotpStage("idle");
    setTotpEnrollment(null);
    setTotpVerifyCode("");
    setTotpErrorCode(null);
    setTotpStatus("idle");
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
    forgotSignedOut,
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

    // two-factor
    twoFactorEnabled,
    totpMode,
    handleTOTPModeChange,
    totpStage,
    totpEnrollPassword,
    setTotpEnrollPassword,
    totpEnrollment,
    totpVerifyCode,
    setTotpVerifyCode,
    totpDisablePassword,
    setTotpDisablePassword,
    totpDisableCode,
    setTotpDisableCode,
    totpStatus,
    totpErrorCode,
    handleStartTOTPEnrollment,
    handleVerifyTOTPEnrollment,
    handleDisableTOTP,
    handleCancelTOTPEnrollment,
  };
}
