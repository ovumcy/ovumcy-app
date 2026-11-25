import { useRef, useState } from "react";

import { selectAccountChangeRecoveryCopy } from "../../../i18n/account-change-recovery-copy";
import {
  resolveBackupSyncConnectedStatusMessage,
} from "../../../services/backup-sync-view-service";
import {
  completeBackupSyncRecoveryTOTPChallenge,
  completeBackupSyncTOTPChallenge,
  connectBackupSyncAccount,
  disconnectBackupSyncAccount,
  recoverBackupSyncAccess,
} from "../../../services/backup-sync-screen-service";
import {
  resolveSyncConsentPurpose,
  withdrawDataSharingConsent,
} from "../../../services/data-sharing-consent-service";
import { resolveSyncModeConsentPurposes } from "../../../sync/sync-contract";
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
    ensureDataSharingConsent,
    language,
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
  // The revoke call can run up to its timeout; the busy flag lets the screen
  // disable the other sync actions so an upload cannot rewrite `connected`
  // after the local clear, and the ref refuses a second tap before it renders.
  const [isDisconnectingSync, setIsDisconnectingSync] = useState(false);
  const disconnectInFlightRef = useRef(false);
  // Pending TOTP challenge from login. Lives in memory only — the challenge id
  // is single-use and short-lived (~5 min); persisting it would defeat the
  // purpose of the second factor. `purpose` says which flow the code resumes:
  // a connect, or a self-hosted phrase recovery (the phrase stays in its field).
  const [pendingTOTPChallenge, setPendingTOTPChallenge] = useState<{
    purpose: "connect" | "recover";
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
    // Asked after the draft is saved, so the consent names the destination
    // the request goes to.
    if (
      !(await ensureDataSharingConsent(
        resolveSyncConsentPurpose(syncReadyState.syncPreferences.mode),
      ))
    ) {
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
      if (result.recoveryCode) {
        core.setGeneratedRecoveryCode(result.recoveryCode);
      }
      setErrorState({
        code: result.errorCode,
        scope: "account",
        retryAfterSeconds: result.retryAfterSeconds,
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
        purpose: "connect",
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
      core.setGeneratedAccountLogin(result.accountLogin ?? "");
    }
    await reloadPartnerAccess(result.state);
    setAccountPasswordValue("");
    announceConnected(result.state, result.accountKeyReset === true);
    setIsAuthenticatingSync(false);
  }

  // A sign-in that replaced the sync key offers the gated reveal of the new
  // phrase instead of the plain connected status.
  function announceConnected(
    connectedState: NonNullable<typeof state>,
    accountKeyReset: boolean,
  ) {
    if (accountKeyReset) {
      core.setAccountChangeRecoveryPhrase("reveal");
      setAccountStatusMessage(selectAccountChangeRecoveryCopy(language).connectedStatus);
      return;
    }
    setAccountStatusMessage(
      resolveBackupSyncConnectedStatusMessage(connectedState, viewData.account),
    );
  }

  async function handleSubmitTOTPChallenge() {
    if (!state || !pendingTOTPChallenge) {
      return;
    }

    if (pendingTOTPChallenge.purpose === "recover") {
      await submitRecoveryTOTPChallenge(state, pendingTOTPChallenge);
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
      effectiveNow,
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
    announceConnected(result.state, result.accountKeyReset === true);
    setIsAuthenticatingSync(false);
  }

  async function submitRecoveryTOTPChallenge(
    currentState: NonNullable<typeof state>,
    challenge: NonNullable<typeof pendingTOTPChallenge>,
  ) {
    resetFeedbackMessages();
    setIsRecoveringSync(true);

    const result = await completeBackupSyncRecoveryTOTPChallenge(
      storage,
      syncSecretStore,
      currentState,
      challenge.preferences,
      {
        challengeID: challenge.challengeID,
        code: totpChallengeCode,
        recoveryPhrase: core.recoveryPhraseInputValue,
      },
      effectiveNow,
    );
    if (!result.ok) {
      setErrorState({
        code: result.errorCode,
        scope: "account",
      });
      // An expired or replayed challenge, or one the accepted code spent before
      // the recovery failed, sends the user back to the form; a refused code
      // is retried in place.
      if (
        result.errorCode === "totp_challenge_invalid" ||
        ("challengeSpent" in result && result.challengeSpent)
      ) {
        setPendingTOTPChallenge(null);
        setTotpChallengeCode("");
      }
      setIsRecoveringSync(false);
      return;
    }

    setErrorState(null);
    setState(result.state);
    setPendingTOTPChallenge(null);
    setTotpChallengeCode("");
    await reloadPartnerAccess(result.state);
    setRecoveryPhraseInputValue("");
    setAccountStatusMessage(viewData.account.status.recovered);
    setIsRecoveringSync(false);
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
    // Asked after the draft is saved, so the consent names the destination
    // the request goes to.
    if (
      !(await ensureDataSharingConsent(
        resolveSyncConsentPurpose(syncReadyState.syncPreferences.mode),
      ))
    ) {
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
        retryAfterSeconds: result.retryAfterSeconds,
      });
      setIsRecoveringSync(false);
      return;
    }

    if ("totpChallengeRequired" in result) {
      // The verified password leaves state; the phrase stays in its field
      // until the code completes the recovery.
      setPendingTOTPChallenge({
        purpose: "recover",
        challengeID: result.challengeID,
        challengeExpiresAt: result.challengeExpiresAt,
        preferences: syncReadyState.savedSyncPreferences,
      });
      setAccountPasswordValue("");
      setErrorState(null);
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
    if (!state || disconnectInFlightRef.current) {
      return;
    }

    disconnectInFlightRef.current = true;
    try {
      await runDisconnect(state);
    } finally {
      disconnectInFlightRef.current = false;
      setIsDisconnectingSync(false);
    }
  }

  async function runDisconnect(currentState: NonNullable<typeof state>) {
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
      currentState.syncPreferences.mode === "managed"
        ? viewData.account.disconnectPromptManaged
        : viewData.account.disconnectPrompt,
      viewData.account.disconnectLabel,
      viewData.common.cancelAction,
    );
    if (!confirmed) {
      return;
    }

    setIsDisconnectingSync(true);
    let result: Awaited<ReturnType<typeof disconnectBackupSyncAccount>>;
    try {
      result = await disconnectBackupSyncAccount(
        storage,
        syncSecretStore,
        currentState,
      );
    } catch {
      // The local sign-out could not finish and the session is kept.
      setErrorState({ code: "generic", scope: "sync" });
      return;
    }
    // Drop any pending partner invite captured for the prior session so it
    // can't be redeemed under a different managed account after re-login.
    clearManagedPartnerInviteToken();
    setPendingPartnerInviteToken("");
    // Disconnecting withdraws the consent, so a later connect asks again. A
    // failed clear leaves the disconnect itself in place.
    await withdrawDataSharingConsent(
      storage,
      resolveSyncModeConsentPurposes(currentState.savedSyncPreferences.mode),
    ).catch(() => undefined);
    setErrorState(null);
    setState(result.state);
    await reloadPartnerAccess(result.state);
    setAccountStatusMessage(
      result.remoteSignOut === "confirmed"
        ? viewData.account.status.disconnected
        : viewData.account.status.disconnectedRemoteUnconfirmed,
    );
  }

  return {
    accountLoginValue,
    setAccountLoginValue,
    accountPasswordValue,
    setAccountPasswordValue,
    isAuthenticatingSync,
    isRecoveringSync,
    isDisconnectingSync,
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
