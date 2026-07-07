import { useState } from "react";

import { prepareBackupSyncSetup } from "../../../services/backup-sync-screen-service";
import { deliverRecoveryPhraseArtifact } from "../../../services/recovery-phrase-delivery-service";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import { openConfirmation } from "../../confirm/open-confirmation";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";

/**
 * Recovery-materials concern: generating/regenerating the local encryption keys
 * (which reveals the recovery phrase once) and exporting that phrase. The
 * regenerate path keeps its confirm-then-device-auth gate; the phrase itself
 * lives on the shared core because the focus-load reset and the draft-save both
 * clear it.
 */
export function useBackupSyncRecoveryMaterials(core: BackupSyncSessionCore) {
  const {
    effectiveNow,
    exportDeliveryClient,
    generatedRecoveryPhrase,
    reloadPartnerAccess,
    resetFeedbackMessages,
    setAccountStatusMessage,
    setErrorState,
    setGeneratedRecoveryPhrase,
    setState,
    state,
    storage,
    syncSecretStore,
    viewData,
  } = core;

  const [isPreparingSync, setIsPreparingSync] = useState(false);
  const [isExportingRecoveryPhrase, setIsExportingRecoveryPhrase] = useState(false);

  async function handlePrepareSyncSetup() {
    if (!state) {
      return;
    }

    resetFeedbackMessages();

    if (state.hasStoredSyncSecrets) {
      const confirmed = await openConfirmation(
        viewData.account.regeneratePrompt,
        viewData.account.regenerateAccept,
      );
      if (!confirmed) {
        return;
      }

      const challengeResult = await requestSensitiveActionChallenge(
        viewData.account.regenerateDeviceAuthPrompt,
      );
      if (!challengeResult.ok) {
        if (challengeResult.reason === "unavailable") {
          setErrorState({
            code: "deviceAuthUnavailable",
            scope: "local",
          });
        } else if (challengeResult.reason === "failed") {
          setErrorState({
            code: "deviceAuthFailed",
            scope: "local",
          });
        }
        return;
      }
    }

    setIsPreparingSync(true);

    const result = await prepareBackupSyncSetup(
      storage,
      syncSecretStore,
      state,
      effectiveNow,
    );
    if (!result.ok) {
      setErrorState({
        code: result.errorCode,
        scope: "local",
      });
      setIsPreparingSync(false);
      return;
    }

    setErrorState(null);
    setState(result.state);
    await reloadPartnerAccess(result.state);
    setGeneratedRecoveryPhrase(result.recoveryPhrase);
    setAccountStatusMessage(
      result.regenerated
        ? viewData.account.status.regenerated
        : viewData.account.status.prepared,
    );
    setIsPreparingSync(false);
  }

  function handleAcknowledgeRecoveryCode() {
    core.setGeneratedRecoveryCode("");
  }

  async function handleExportRecoveryPhrase() {
    if (!generatedRecoveryPhrase) {
      return;
    }

    resetFeedbackMessages();
    setIsExportingRecoveryPhrase(true);

    const result = await deliverRecoveryPhraseArtifact(
      exportDeliveryClient,
      generatedRecoveryPhrase,
      effectiveNow,
    );

    if (!result.ok) {
      setErrorState({
        code:
          result.errorCode === "delivery_unavailable"
            ? "recovery_export_unavailable"
            : "recovery_export_failed",
        scope: "local",
      });
    }

    setIsExportingRecoveryPhrase(false);
  }

  return {
    isPreparingSync,
    isExportingRecoveryPhrase,
    handlePrepareSyncSetup,
    handleAcknowledgeRecoveryCode,
    handleExportRecoveryPhrase,
  };
}
