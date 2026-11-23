import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

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
import { clearLocalSyncSession } from "../../../sync/sync-client-service";
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

// UI-only: 2FA turned on but the rotated recovery code never reached the screen.
export type TOTPRecoveryCodeLostErrorCode = "totp_recovery_code_lost";

// UI-only: a sent regenerate got no readable answer. Both servers rotate the
// code before answering, so the previous code may already be dead.
export type RegenerateResponseLostErrorCode = "regenerate_response_lost";

const REGENERATE_RESPONSE_MAY_BE_LOST_CODES: ReadonlySet<RegenerateSyncRecoveryCodeErrorCode> =
  new Set(["network_failed", "generic"]);

// UI-only: a sent self-hosted password change got no readable answer. The
// server rotates the recovery code with the password, so both may have changed.
export type ChangePasswordResponseLostErrorCode = "change_password_response_lost";

const CHANGE_PASSWORD_RESPONSE_MAY_BE_LOST_CODES: ReadonlySet<ChangeSyncPasswordErrorCode> =
  new Set(["network_failed", "generic"]);

const RESPONSE_MAY_BE_LOST_CODES: ReadonlySet<VerifyTOTPEnrollmentErrorCode> =
  new Set(["network_failed", "generic", "totp_already_enabled"]);

export type SyncAccountSecurityControllerOptions = {
  storage?: LocalAppStorage;
  syncSecretStore?: SyncSecretStore;
};

// A rate_limited error disables the form's submit, and only an edit or a new
// attempt may lift it; other errors stay visible until the next submit.
function clearRateLimitOnEdit<E extends string>(
  setValue: (value: string) => void,
  setError: Dispatch<SetStateAction<E | null>>,
) {
  return (value: string) => {
    setValue(value);
    setError((current) => (current === "rate_limited" ? null : current));
  };
}

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
  const [changeErrorCode, setChangeErrorCode] = useState<
    ChangeSyncPasswordErrorCode | ChangePasswordResponseLostErrorCode | null
  >(null);
  const [changeCode, setChangeCode] = useState("");
  // Set when the server refused the change for a TOTP code, so the field
  // stays reachable even when the two-factor status could not be read.
  const [changeCodeDemanded, setChangeCodeDemanded] = useState(false);

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
  const [regenerateCode, setRegenerateCode] = useState("");
  // Set when the server refused the rotation for a TOTP code, so the field
  // stays reachable even when the two-factor status could not be read.
  const [regenerateCodeDemanded, setRegenerateCodeDemanded] = useState(false);
  const [regenerateStatus, setRegenerateStatus] =
    useState<SyncAccountSecurityStatus>("idle");
  const [regenerateErrorCode, setRegenerateErrorCode] = useState<
    RegenerateSyncRecoveryCodeErrorCode | RegenerateResponseLostErrorCode | null
  >(null);

  // Shared reveal modal (used by reset-password and regenerate flows)
  const [revealedRecoveryCode, setRevealedRecoveryCode] = useState("");
  // True when the revealed code came from completing TOTP enrollment, which
  // silently replaced the code from registration or the last regeneration.
  const [revealedRecoveryCodeFromTOTP, setRevealedRecoveryCodeFromTOTP] =
    useState(false);
  // True when the revealed code came from a password change, which replaced
  // the previous code on the server.
  const [
    revealedRecoveryCodeFromPasswordChange,
    setRevealedRecoveryCodeFromPasswordChange,
  ] = useState(false);

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
    | TOTPRecoveryCodeLostErrorCode
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

  // Ovumcy Cloud takes no code on this route, so the field is self-hosted only.
  const changeCodeVisible =
    preferences !== null &&
    preferences.mode !== "managed" &&
    (twoFactorEnabled === true || changeCodeDemanded);

  async function handleChangePassword() {
    if (!preferences) {
      return;
    }
    setChangeErrorCode(null);
    setChangeStatus("submitting");
    const result = await changeSyncAccountPassword(
      syncSecretStore,
      preferences,
      changeCodeVisible
        ? {
            currentPassword: changeCurrentPassword,
            newPassword: changeNewPassword,
            code: changeCode,
          }
        : {
            currentPassword: changeCurrentPassword,
            newPassword: changeNewPassword,
          },
    );
    if (result.ok) {
      setChangeStatus("success");
      setChangeCurrentPassword("");
      setChangeNewPassword("");
      setChangeCode("");
      if (result.recoveryCode) {
        setRevealedRecoveryCode(result.recoveryCode);
        setRevealedRecoveryCodeFromTOTP(false);
        setRevealedRecoveryCodeFromPasswordChange(true);
      }
      return;
    }
    if (
      result.errorCode === "totp_invalid_code" ||
      result.errorCode === "totp_replayed"
    ) {
      setChangeCodeDemanded(true);
      setChangeCode("");
    }
    // No code was sent, so the server is asking for one, not judging one.
    setChangeErrorCode(
      result.errorCode === "totp_invalid_code" && !changeCodeVisible
        ? "totp_code_required"
        : preferences.mode !== "managed" &&
            CHANGE_PASSWORD_RESPONSE_MAY_BE_LOST_CODES.has(result.errorCode)
          ? "change_password_response_lost"
          : result.errorCode,
    );
    setChangeStatus("idle");
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
      setRevealedRecoveryCodeFromTOTP(false);
      setRevealedRecoveryCodeFromPasswordChange(false);
      setForgotStage("completed");
      setForgotStatus("success");
      setForgotSignedOut(result.signedOut);
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

  const regenerateCodeVisible =
    preferences !== null &&
    (twoFactorEnabled === true || regenerateCodeDemanded);

  async function handleRegenerate() {
    if (!preferences) {
      return;
    }
    setRegenerateErrorCode(null);
    setRegenerateStatus("submitting");
    const result = await regenerateSyncAccountRecoveryCode(
      syncSecretStore,
      preferences,
      regenerateCodeVisible
        ? { currentPassword: regeneratePassword, code: regenerateCode }
        : { currentPassword: regeneratePassword },
    );
    if (result.ok) {
      setRevealedRecoveryCode(result.recoveryCode);
      setRevealedRecoveryCodeFromTOTP(false);
      setRevealedRecoveryCodeFromPasswordChange(false);
      setRegenerateStatus("success");
      setRegeneratePassword("");
      setRegenerateCode("");
    } else {
      if (
        result.errorCode === "totp_invalid_code" ||
        result.errorCode === "totp_replayed"
      ) {
        setRegenerateCodeDemanded(true);
      }
      // No code was sent, so the server is asking for one, not judging one.
      setRegenerateErrorCode(
        result.errorCode === "totp_invalid_code" && !regenerateCodeVisible
          ? "totp_code_required"
          : REGENERATE_RESPONSE_MAY_BE_LOST_CODES.has(result.errorCode)
            ? "regenerate_response_lost"
            : result.errorCode,
      );
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
      if (result.errorCode === "totp_enrollment_not_started") {
        setTotpStatus("idle");
        setTotpStage("idle");
        setTotpEnrollment(null);
        setTotpVerifyCode("");
        return;
      }
      // Both servers enable 2FA and rotate the recovery code before they
      // answer, so a lost or unreadable response can leave the account with a
      // code this device never saw.
      if (RESPONSE_MAY_BE_LOST_CODES.has(result.errorCode)) {
        const status = await describeSyncAccountTwoFactor(
          syncSecretStore,
          preferences,
        );
        if (status?.twoFactorEnabled) {
          setTwoFactorEnabled(true);
          setTotpErrorCode("totp_recovery_code_lost");
          setTotpStage("idle");
          setTotpEnrollment(null);
          setTotpVerifyCode("");
        }
      }
      // Stays "submitting" through the re-check so verify cannot be re-sent.
      setTotpStatus("idle");
      return;
    }
    setTotpStage("completed");
    setTotpStatus("success");
    setTotpVerifyCode("");
    setTotpEnrollment(null);
    if (result.recoveryCode) {
      setRevealedRecoveryCode(result.recoveryCode);
      setRevealedRecoveryCodeFromTOTP(true);
      setRevealedRecoveryCodeFromPasswordChange(false);
    }
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
      if (result.errorCode === "totp_already_disabled") {
        setTotpMode("enable");
        setTotpDisablePassword("");
        setTotpDisableCode("");
        setRegenerateCodeDemanded(false);
        setChangeCodeDemanded(false);
        const status = await describeSyncAccountTwoFactor(
          syncSecretStore,
          preferences,
        );
        setTwoFactorEnabled(status ? status.twoFactorEnabled : false);
      }
      setTotpStatus("idle");
      return;
    }
    // Both servers revoke every session of the account on disable, this
    // device's included, so the local session goes with them.
    try {
      setPreferences(
        await clearLocalSyncSession(storage, syncSecretStore, preferences),
      );
    } catch {
      // Two-factor is already off on the server; the stale session fails its
      // next call and is cleared there.
    }
    setTotpStage("completed");
    setTotpStatus("success");
    setTotpDisablePassword("");
    setTotpDisableCode("");
    setRegenerateCodeDemanded(false);
    setChangeCodeDemanded(false);
    setTwoFactorEnabled(false);
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
    setRevealedRecoveryCodeFromTOTP(false);
    setRevealedRecoveryCodeFromPasswordChange(false);
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
    setChangeCurrentPassword: clearRateLimitOnEdit(
      setChangeCurrentPassword,
      setChangeErrorCode,
    ),
    changeNewPassword,
    setChangeNewPassword: clearRateLimitOnEdit(
      setChangeNewPassword,
      setChangeErrorCode,
    ),
    changeCode,
    setChangeCode: clearRateLimitOnEdit(setChangeCode, setChangeErrorCode),
    changeCodeVisible,
    changeStatus,
    changeErrorCode,
    handleChangePassword,

    // forgot password
    forgotLogin,
    setForgotLogin: clearRateLimitOnEdit(setForgotLogin, setForgotErrorCode),
    forgotRecoveryCode,
    setForgotRecoveryCode: clearRateLimitOnEdit(
      setForgotRecoveryCode,
      setForgotErrorCode,
    ),
    forgotNewPassword,
    setForgotNewPassword: clearRateLimitOnEdit(
      setForgotNewPassword,
      setForgotErrorCode,
    ),
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
    setRegeneratePassword: clearRateLimitOnEdit(
      setRegeneratePassword,
      setRegenerateErrorCode,
    ),
    regenerateCode,
    setRegenerateCode: clearRateLimitOnEdit(
      setRegenerateCode,
      setRegenerateErrorCode,
    ),
    regenerateCodeVisible,
    regenerateStatus,
    regenerateErrorCode,
    handleRegenerate,

    // reveal
    revealedRecoveryCode,
    revealedRecoveryCodeFromTOTP,
    revealedRecoveryCodeFromPasswordChange,
    handleAcknowledgeRecoveryCode,

    // two-factor
    twoFactorEnabled,
    totpMode,
    handleTOTPModeChange,
    totpStage,
    totpEnrollPassword,
    setTotpEnrollPassword: clearRateLimitOnEdit(
      setTotpEnrollPassword,
      setTotpErrorCode,
    ),
    totpEnrollment,
    totpVerifyCode,
    setTotpVerifyCode: clearRateLimitOnEdit(setTotpVerifyCode, setTotpErrorCode),
    totpDisablePassword,
    setTotpDisablePassword: clearRateLimitOnEdit(
      setTotpDisablePassword,
      setTotpErrorCode,
    ),
    totpDisableCode,
    setTotpDisableCode: clearRateLimitOnEdit(
      setTotpDisableCode,
      setTotpErrorCode,
    ),
    totpStatus,
    totpErrorCode,
    handleStartTOTPEnrollment,
    handleVerifyTOTPEnrollment,
    handleDisableTOTP,
    handleCancelTOTPEnrollment,
  };
}
