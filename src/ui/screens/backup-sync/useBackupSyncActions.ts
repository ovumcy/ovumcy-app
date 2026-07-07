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

  async function handleSyncNow() {
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

    const result = await uploadBackupSyncSnapshot(
      storage,
      syncSecretStore,
      syncReadyState,
      effectiveNow,
      {
        // Destructive gate: fresh install about to overwrite an existing
        // server backup. Dialog dismissal resolves false = do NOT upload.
        confirmUploadOverExistingBackup: () =>
          openConfirmation(
            viewData.account.uploadOverBackupPrompt,
            viewData.account.uploadOverBackupAccept,
            viewData.common.cancelAction,
          ),
      },
    );
    if (!result.ok) {
      if (result.errorCode === "upload_over_backup_declined") {
        // Owner declined the overwrite — not an error, just stop quietly like
        // every other declined confirmation.
        setIsSyncingNow(false);
        return;
      }
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

    setErrorState(null);
    setState(result.state);
    await reloadPartnerAccess(result.state);
    setAccountStatusMessage(viewData.account.status.uploaded);
    setIsSyncingNow(false);
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
    );
    if (!result.ok) {
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
  };
}
