import { useState } from "react";

import {
  clearUnauthorizedBackupSyncSession,
  restoreBackupSyncSnapshot,
  uploadBackupSyncSnapshot,
} from "../../../services/backup-sync-screen-service";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import { clearManagedPartnerInviteToken } from "../../../security/managed-partner-invite-token-buffer";
import { openConfirmation } from "../../confirm/open-confirmation";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";
import type { SyncRecoveryKeyStepUp } from "../../../sync/sync-api-client";
import { describeSyncAccountTwoFactor } from "../../../sync/sync-account-session-service";

// Shown when an upload would replace the server's recovery-key package on a
// self-hosted account: the server wants the account password, plus a current
// TOTP code when 2FA is on. `errorCode` judges the previous attempt.
export type RecoveryKeyStepUpPrompt = {
  codeRequired: boolean;
  errorCode:
    | "invalid_current_password"
    | "totp_invalid_code"
    | "totp_replayed"
    | "rate_limited"
    // Managed recovery-phrase rotation only.
    | "rotation_unconfirmed"
    | "generic"
    | null;
};

/**
 * Sync-actions concern: uploading the local snapshot ("sync now") and restoring
 * from the server. Upload guards a fresh-install overwrite behind a destructive
 * confirm; restore is device-auth gated with its own confirm. Either action, on
 * an `unauthorized` result, tears down the stale session through the shared core
 * and drops the pending partner-invite buffer.
 */
export function useBackupSyncActions(core: BackupSyncSessionCore) {
  const {
    effectiveNow,
    reloadPartnerAccess,
    resetFeedbackMessages,
    saveSyncDraftIfNeeded,
    setAccountStatusMessage,
    setErrorState,
    setPendingPartnerInviteToken,
    setState,
    state,
    storage,
    syncSecretStore,
    viewData,
  } = core;

  const [isRestoringSync, setIsRestoringSync] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [pendingStepUp, setPendingStepUp] = useState<{
    prompt: RecoveryKeyStepUpPrompt;
    // The loaded session the prompt was opened for. A reload, disconnect or
    // another account replaces `state` and so retires the prompt.
    forState: NonNullable<typeof state>;
    // Whether that same attempt already passed the upload-over-backup confirm.
    overwriteConfirmed: boolean;
  } | null>(null);
  const recoveryKeyStepUpPrompt =
    pendingStepUp && pendingStepUp.forState === state ? pendingStepUp.prompt : null;

  async function handleSyncNow() {
    setPendingStepUp(null);
    await runUpload();
  }

  // The password and code live only in the prompt's own field state and this
  // call's arguments; they are never stored, logged or put in route params.
  async function handleSubmitRecoveryKeyStepUp(stepUp: SyncRecoveryKeyStepUp) {
    if (!recoveryKeyStepUpPrompt) {
      return;
    }
    await runUpload(stepUp);
  }

  function handleCancelRecoveryKeyStepUp() {
    setPendingStepUp(null);
  }

  async function runUpload(stepUp?: SyncRecoveryKeyStepUp) {
    if (!state) {
      return;
    }

    resetFeedbackMessages();
    setIsSyncingNow(true);

    const syncReadyState = await saveSyncDraftIfNeeded("sync");
    if (!syncReadyState) {
      setIsSyncingNow(false);
      return;
    }

    // A step-up retry skips the confirm only when it continues the attempt
    // that passed it, on the same loaded session.
    let overwriteConfirmed =
      stepUp !== undefined &&
      pendingStepUp !== null &&
      pendingStepUp.forState === syncReadyState &&
      pendingStepUp.overwriteConfirmed;
    const result = await uploadBackupSyncSnapshot(
      storage,
      syncSecretStore,
      syncReadyState,
      effectiveNow,
      {
        // Destructive gate: fresh install about to overwrite an existing
        // server backup. Dialog dismissal resolves false = do NOT upload.
        confirmUploadOverExistingBackup: async () => {
          if (overwriteConfirmed) {
            return true;
          }
          overwriteConfirmed = await openConfirmation(
            viewData.account.uploadOverBackupPrompt,
            viewData.account.uploadOverBackupAccept,
            viewData.common.cancelAction,
          );
          return overwriteConfirmed;
        },
      },
      stepUp,
    );
    if (!result.ok) {
      if (result.errorCode === "upload_over_backup_declined") {
        // Owner declined the overwrite — not an error, just stop quietly like
        // every other declined confirmation.
        setPendingStepUp(null);
        setIsSyncingNow(false);
        return;
      }
      const prompt = await resolveRecoveryKeyStepUpPrompt(
        result.errorCode,
        stepUp,
        syncReadyState,
      );
      if (prompt) {
        setPendingStepUp({ prompt, forState: syncReadyState, overwriteConfirmed });
        setIsSyncingNow(false);
        return;
      }
      setPendingStepUp(null);
      if (result.errorCode === "unauthorized") {
        const clearedState = await clearUnauthorizedBackupSyncSession(
          storage,
          syncSecretStore,
          syncReadyState,
        );
        clearManagedPartnerInviteToken();
        setPendingPartnerInviteToken("");
        setState(clearedState);
        await reloadPartnerAccess(clearedState);
      }
      setErrorState({
        code: result.errorCode,
        scope: "sync",
      });
      setIsSyncingNow(false);
      return;
    }

    setPendingStepUp(null);
    setErrorState(null);
    setState(result.state);
    await reloadPartnerAccess(result.state);
    setAccountStatusMessage(viewData.account.status.uploaded);
    setIsSyncingNow(false);
  }

  async function resolveRecoveryKeyStepUpPrompt(
    errorCode: string,
    stepUp: SyncRecoveryKeyStepUp | undefined,
    syncReadyState: NonNullable<typeof state>,
  ): Promise<RecoveryKeyStepUpPrompt | null> {
    // The server checks the password first, so after a wrong one the code
    // field stays exactly as it was.
    const codeFieldShown = stepUp?.code !== undefined;
    switch (errorCode) {
      case "recovery_key_step_up_required": {
        const twoFactor = await describeSyncAccountTwoFactor(
          syncSecretStore,
          syncReadyState.savedSyncPreferences,
        );
        return {
          // Unknown status shows the field; an empty code is not sent.
          codeRequired: twoFactor?.twoFactorEnabled ?? true,
          errorCode: null,
        };
      }
      case "recovery_key_code_required":
        return { codeRequired: true, errorCode: null };
      case "invalid_current_password":
        return { codeRequired: codeFieldShown, errorCode };
      case "totp_invalid_code":
      case "totp_replayed":
        return { codeRequired: true, errorCode };
      case "recovery_key_step_up_rate_limited":
        return { codeRequired: codeFieldShown, errorCode: "rate_limited" };
      default:
        return null;
    }
  }

  async function handleRestoreSync() {
    if (!state) {
      return;
    }

    resetFeedbackMessages();

    const challengeResult = await requestSensitiveActionChallenge(
      viewData.account.restoreDeviceAuthPrompt,
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
      viewData.account.restorePrompt,
      viewData.account.restoreAccept,
    );
    if (!confirmed) {
      return;
    }

    setIsRestoringSync(true);
    const result = await restoreBackupSyncSnapshot(
      storage,
      syncSecretStore,
      state,
      effectiveNow,
      {
        // Rollback gate: the server's blob may be older than what this device
        // last synced. Dialog dismissal resolves false = do NOT restore.
        confirmRestoreOlderBackup: () =>
          openConfirmation(
            viewData.account.restoreOlderBackupPrompt,
            viewData.account.restoreOlderBackupAccept,
            viewData.common.cancelAction,
          ),
      },
    );
    if (!result.ok) {
      if (result.errorCode === "restore_older_backup_declined") {
        setIsRestoringSync(false);
        return;
      }
      if (result.errorCode === "unauthorized") {
        const clearedState = await clearUnauthorizedBackupSyncSession(
          storage,
          syncSecretStore,
          state,
        );
        clearManagedPartnerInviteToken();
        setPendingPartnerInviteToken("");
        setState(clearedState);
        await reloadPartnerAccess(clearedState);
      }
      setErrorState({
        code: result.errorCode,
        scope: "sync",
      });
      setIsRestoringSync(false);
      return;
    }

    setErrorState(null);
    setState(result.state);
    await reloadPartnerAccess(result.state);
    setAccountStatusMessage(viewData.account.status.restored);
    setIsRestoringSync(false);
  }

  return {
    isRestoringSync,
    isSyncingNow,
    handleSyncNow,
    handleRestoreSync,
    recoveryKeyStepUpPrompt,
    handleSubmitRecoveryKeyStepUp,
    handleCancelRecoveryKeyStepUp,
  };
}
