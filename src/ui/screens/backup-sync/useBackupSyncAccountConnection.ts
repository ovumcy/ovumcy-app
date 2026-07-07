import { useState } from "react";

import {
  resolveBackupSyncConnectedStatusMessage,
} from "../../../services/backup-sync-view-service";
import {
  completeBackupSyncTOTPChallenge,
  connectBackupSyncAccount,
  disconnectBackupSyncAccount,
  recoverBackupSyncAccess,
} from "../../../services/backup-sync-screen-service";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import { clearManagedPartnerInviteToken } from "../../../security/managed-partner-invite-token-buffer";
import { openConfirmation } from "../../confirm/open-confirmation";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";

/**
 * Account-connection concern: register/login against the sync account (incl. the
 * short-lived TOTP challenge handoff), recovery-phrase re-auth on a new device,
 * and device-auth-gated disconnect. Draft is flushed through the shared core
 * before each network step, and disconnect clears the pending partner-invite
 * buffer so it cannot be redeemed under a different account after re-login.
 */
export function useBackupSyncAccountConnection(core: BackupSyncSessionCore) {
  const {
    effectiveNow,
    reloadPartnerAccess,
    resetFeedbackMessages,
    saveSyncDraftIfNeeded,
    setAccountStatusMessage,
    setErrorState,
    setPendingPartnerInviteToken,
    setRecoveryPhraseInputValue,
    setState,
    state,
    storage,
    syncSecretStore,
    viewData,
  } = core;

  const [accountLoginValue, setAccountLoginValue] = useState("");
  const [accountPasswordValue, setAccountPasswordValue] = useState("");
  const [isAuthenticatingSync, setIsAuthenticatingSync] = useState(false);
  const [isRecoveringSync, setIsRecoveringSync] = useState(false);
  // Pending TOTP challenge from login. Lives in memory only — the challenge id
  // is single-use and short-lived (~5 min); persisting it would defeat the
  // purpose of the second factor.
  const [pendingTOTPChallenge, setPendingTOTPChallenge] = useState<{
    challengeID: string;
    challengeExpiresAt: string;
    preferences: import("../../../sync/sync-contract").SyncPreferencesRecord;
  } | null>(null);
  const [totpChallengeCode, setTotpChallengeCode] = useState("");

  async function handleConnectSync(mode: "register" | "login") {
    if (!state) {
      return;
    }

    resetFeedbackMessages();
    setIsAuthenticatingSync(true);

    const syncReadyState = await saveSyncDraftIfNeeded("account");
    if (!syncReadyState) {
      setIsAuthenticatingSync(false);
      return;
    }

    const result = await connectBackupSyncAccount(
      storage,
      syncSecretStore,
      syncReadyState,
      {
        login: accountLoginValue,
        password: accountPasswordValue,
      },
      mode,
      effectiveNow,
    );
    if (!result.ok) {
      setErrorState({
        code: result.errorCode,
        scope: "account",
      });
      setIsAuthenticatingSync(false);
      return;
    }

    if ("totpChallengeRequired" in result) {
      // Keep the password we just verified out of state but DO remember the
      // challenge handoff so the user can type the 6-digit code on the next
      // screen. The challenge id is single-use and short-lived; if the user
      // cancels we drop it without persisting anywhere.
      setPendingTOTPChallenge({
        challengeID: result.challengeID,
        challengeExpiresAt: result.challengeExpiresAt,
        preferences: result.preferences,
      });
      setAccountPasswordValue("");
      setErrorState(null);
      setIsAuthenticatingSync(false);
      return;
    }

    setErrorState(null);
    setState(result.state);
    if (result.recoveryCode) {
      core.setGeneratedRecoveryCode(result.recoveryCode);
    }
    await reloadPartnerAccess(result.state);
    setAccountPasswordValue("");
    setAccountStatusMessage(
      resolveBackupSyncConnectedStatusMessage(result.state, viewData.account),
    );
    setIsAuthenticatingSync(false);
  }

  async function handleSubmitTOTPChallenge() {
    if (!state || !pendingTOTPChallenge) {
      return;
    }

    resetFeedbackMessages();
    setIsAuthenticatingSync(true);

    const result = await completeBackupSyncTOTPChallenge(
      storage,
      syncSecretStore,
      state,
      pendingTOTPChallenge.preferences,
      {
        challengeID: pendingTOTPChallenge.challengeID,
        code: totpChallengeCode,
      },
    );
    if (!result.ok) {
      setErrorState({
        code: result.errorCode,
        scope: "account",
      });
      // A `totp_challenge_invalid` (expired or replayed) is unrecoverable in
      // place — drop the pending handoff so the user goes back to the login
      // form. Any other error (wrong code, rate-limited, network) is
      // retryable, so we keep the challenge id alive.
      if (result.errorCode === "totp_challenge_invalid") {
        setPendingTOTPChallenge(null);
        setTotpChallengeCode("");
      }
      setIsAuthenticatingSync(false);
      return;
    }

    setErrorState(null);
    setState(result.state);
    setPendingTOTPChallenge(null);
    setTotpChallengeCode("");
    await reloadPartnerAccess(result.state);
    setAccountStatusMessage(
      resolveBackupSyncConnectedStatusMessage(result.state, viewData.account),
    );
    setIsAuthenticatingSync(false);
  }

  function handleCancelTOTPChallenge() {
    setPendingTOTPChallenge(null);
    setTotpChallengeCode("");
    setErrorState(null);
  }

  async function handleRecoverSync() {
    if (!state) {
      return;
    }

    resetFeedbackMessages();
    setIsRecoveringSync(true);

    const syncReadyState = await saveSyncDraftIfNeeded("account");
    if (!syncReadyState) {
      setIsRecoveringSync(false);
      return;
    }

    const result = await recoverBackupSyncAccess(
      storage,
      syncSecretStore,
      syncReadyState,
      {
        login: accountLoginValue,
        password: accountPasswordValue,
      },
      core.recoveryPhraseInputValue,
      effectiveNow,
    );
    if (!result.ok) {
      setErrorState({
        code: result.errorCode,
        scope: "account",
      });
      setIsRecoveringSync(false);
      return;
    }

    setErrorState(null);
    setState(result.state);
    await reloadPartnerAccess(result.state);
    setAccountPasswordValue("");
    setRecoveryPhraseInputValue("");
    setAccountStatusMessage(viewData.account.status.recovered);
    setIsRecoveringSync(false);
  }

  async function handleDisconnectSync() {
    if (!state) {
      return;
    }

    resetFeedbackMessages();
    const challengeResult = await requestSensitiveActionChallenge(
      viewData.account.disconnectDeviceAuthPrompt,
    );
    if (!challengeResult.ok) {
      if (challengeResult.reason === "unavailable") {
        setErrorState({
          code: "deviceAuthUnavailable",
          scope: "sync",
        });
      } else if (challengeResult.reason === "failed") {
        setErrorState({
          code: "deviceAuthFailed",
          scope: "sync",
        });
      }
      return;
    }
    const confirmed = await openConfirmation(
      viewData.account.disconnectPrompt,
      viewData.account.disconnectLabel,
    );
    if (!confirmed) {
      return;
    }

    const result = await disconnectBackupSyncAccount(
      storage,
      syncSecretStore,
      state,
    );
    // Drop any pending partner invite captured for the prior session so it
    // can't be redeemed under a different managed account after re-login.
    clearManagedPartnerInviteToken();
    setPendingPartnerInviteToken("");
    setErrorState(null);
    setState(result.state);
    await reloadPartnerAccess(result.state);
    setAccountStatusMessage(viewData.account.status.disconnected);
  }

  return {
    accountLoginValue,
    setAccountLoginValue,
    accountPasswordValue,
    setAccountPasswordValue,
    isAuthenticatingSync,
    isRecoveringSync,
    pendingTOTPChallenge,
    totpChallengeCode,
    setTotpChallengeCode,
    handleConnectSync,
    handleSubmitTOTPChallenge,
    handleCancelTOTPChallenge,
    handleRecoverSync,
    handleDisconnectSync,
  };
}
