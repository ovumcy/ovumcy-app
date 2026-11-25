import { useState } from "react";

import { upgradeBackupSyncGuestAccount } from "../../../services/backup-sync-screen-service";
import {
  isGuestPartnerAccount,
  resolveGuestSessionExpiryNudgeDays,
} from "../../../services/backup-sync-view-service";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import { isPasswordTooLong, isPasswordTooShort } from "../../../sync/password-policy";
import { resolveGuestUpgradeErrorMessage } from "./backup-sync-partner-errors";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";

/**
 * Guest-account-upgrade concern (ovumcy-app#118): a guest partner turns
 * their single-device, no-password guest session into a normal
 * password Ovumcy Cloud account with a server-generated Account ID via POST /account/upgrade. The whole
 * flow is scoped to this one hook and kept off the shared core state
 * (`errorState`/`generatedRecoveryCode`) on purpose — it is a distinct
 * concern from account connect/recovery-materials with its own copy
 * (`partnerCopy.guestUpgrade`) and its own one-time reveal, so reusing the
 * core's fields would risk cross-flow interference for no benefit.
 *
 * Guest-mode visibility and the expiry nudge both derive live from
 * `state.syncPreferences.guestSessionExpiresAt` (see
 * `isGuestPartnerAccount` / `resolveGuestSessionExpiryNudgeDays`) — never a
 * separately-tracked boolean — so they can never drift from what the last
 * loaded session state actually says.
 */
export function useBackupSyncGuestUpgrade(core: BackupSyncSessionCore) {
  const { effectiveNow, partnerCopy, setState, state, storage, syncSecretStore } = core;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState("");
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState("");
  // The Account ID the upgrade generated; shown with the recovery code and
  // held in memory only.
  const [generatedAccountLogin, setGeneratedAccountLogin] = useState("");

  const isGuestPartner = state ? isGuestPartnerAccount(state.syncPreferences) : false;
  const expiryNudgeDays = state
    ? resolveGuestSessionExpiryNudgeDays(
        state.syncPreferences.guestSessionExpiresAt,
        effectiveNow.toISOString(),
        state.syncPreferences.guestSessionRenewable,
      )
    : null;
  const nudgeMessage =
    expiryNudgeDays !== null ? partnerCopy.guestUpgrade.nudgeMessage(expiryNudgeDays) : "";

  function resetFormFeedback() {
    setFormErrorMessage("");
  }

  async function handleTapKeepAccess() {
    resetFormFeedback();

    const challengeResult = await requestSensitiveActionChallenge(
      partnerCopy.guestUpgrade.deviceAuthPrompt,
    );
    if (!challengeResult.ok) {
      if (challengeResult.reason === "unavailable") {
        setFormErrorMessage(partnerCopy.guestUpgrade.errors.deviceAuthUnavailable);
      } else if (challengeResult.reason === "failed") {
        setFormErrorMessage(partnerCopy.guestUpgrade.errors.deviceAuthFailed);
      }
      return;
    }

    setIsFormOpen(true);
  }

  function handleCancelForm() {
    setIsFormOpen(false);
    setPasswordValue("");
    resetFormFeedback();
  }

  async function handleSubmitUpgrade() {
    if (!state) {
      return;
    }

    resetFormFeedback();

    if (passwordValue.length === 0) {
      setFormErrorMessage(partnerCopy.guestUpgrade.errors.passwordRequired);
      return;
    }
    if (isPasswordTooShort(passwordValue)) {
      setFormErrorMessage(partnerCopy.guestUpgrade.errors.passwordTooShort);
      return;
    }
    if (isPasswordTooLong(passwordValue)) {
      setFormErrorMessage(partnerCopy.guestUpgrade.errors.passwordTooLong);
      return;
    }

    setIsSubmitting(true);
    const result = await upgradeBackupSyncGuestAccount(
      storage,
      syncSecretStore,
      state,
      { password: passwordValue },
      effectiveNow,
    );

    // Applies on both branches: even a failed upgrade can legitimately
    // change local state (the account_not_guest race clears the local guest
    // marker in upgradeGuestPartnerAccount exactly like success does).
    setState(result.state);

    if (!result.ok) {
      setFormErrorMessage(resolveGuestUpgradeErrorMessage(result.errorCode, partnerCopy));
      setIsSubmitting(false);
      // account_not_guest means the CTA is about to disappear on its own
      // (isGuestPartner flips false from the state update above) — closing
      // the form now avoids leaving a dead form open behind a vanished CTA.
      if (result.errorCode === "account_not_guest") {
        setIsFormOpen(false);
        setPasswordValue("");
      }
      return;
    }

    setIsFormOpen(false);
    setPasswordValue("");
    setGeneratedAccountLogin(result.login);
    setGeneratedRecoveryCode(result.recoveryCode);
    // The upgrade replaced a key that served another account: the new phrase
    // goes through the same gated reveal as an account-change sign-in.
    if (result.accountKeyReset) {
      core.setAccountChangeRecoveryPhrase("reveal");
    }
    setIsSubmitting(false);
  }

  function handleAcknowledgeUpgradeRecoveryCode() {
    setGeneratedRecoveryCode("");
    setGeneratedAccountLogin("");
  }

  return {
    isGuestPartner,
    nudgeMessage,
    isFormOpen,
    passwordValue,
    setPasswordValue,
    isSubmitting,
    formErrorMessage,
    generatedRecoveryCode,
    generatedAccountLogin,
    handleTapKeepAccess,
    handleCancelForm,
    handleSubmitUpgrade,
    handleAcknowledgeUpgradeRecoveryCode,
  };
}
