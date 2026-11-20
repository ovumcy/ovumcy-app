import { useMemo, useRef, useState } from "react";

import { selectManagedRecoveryRotationCopy } from "../../../i18n/managed-recovery-rotation-copy";
import { prepareBackupSyncSetup } from "../../../services/backup-sync-screen-service";
import { shouldRotateManagedRecoveryPhrase } from "../../../services/backup-sync-view-service";
import { deliverRecoveryPhraseArtifact } from "../../../services/recovery-phrase-delivery-service";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import { rotateManagedRecoveryPhrase } from "../../../sync/managed-recovery-rotation-service";
import { describeSyncAccountTwoFactor } from "../../../sync/sync-account-session-service";
import type { SyncRecoveryKeyStepUp } from "../../../sync/sync-api-client";
import { openConfirmation } from "../../confirm/open-confirmation";
import type { RecoveryKeyStepUpPrompt } from "./useBackupSyncActions";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";

/**
 * Recovery-materials concern: generating/regenerating the local encryption keys
 * (which reveals the recovery phrase once), rotating a connected managed
 * account's phrase, and exporting that phrase. Both paths keep a
 * confirm-then-device-auth gate; rotation adds the step-up card and reveals the
 * new phrase only after Ovumcy Cloud confirmed it. The phrase itself lives on
 * the shared core because the focus-load reset and the draft-save both clear it.
 */
export function useBackupSyncRecoveryMaterials(core: BackupSyncSessionCore) {
  const {
    effectiveNow,
    exportDeliveryClient,
    generatedRecoveryPhrase,
    language,
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
  const [isRotatingRecoveryPhrase, setIsRotatingRecoveryPhrase] = useState(false);
  const [isExportingRecoveryPhrase, setIsExportingRecoveryPhrase] = useState(false);
  const rotationInFlightRef = useRef(false);
  const [pendingRotationStepUp, setPendingRotationStepUp] = useState<{
    prompt: RecoveryKeyStepUpPrompt;
    forState: NonNullable<typeof state>;
  } | null>(null);
  const managedRecoveryRotationStepUpPrompt =
    pendingRotationStepUp && pendingRotationStepUp.forState === state
      ? pendingRotationStepUp.prompt
      : null;
  const rotationCopy = useMemo(
    () => selectManagedRecoveryRotationCopy(language),
    [language],
  );

  async function handlePrepareSyncSetup() {
    if (!state) {
      return;
    }

    resetFeedbackMessages();

    const rotates = shouldRotateManagedRecoveryPhrase({
      hasStoredSyncSecrets: state.hasStoredSyncSecrets,
      hasSyncSession: state.hasSyncSession,
      preferences: state.savedSyncPreferences,
    });

    if (state.hasStoredSyncSecrets) {
      const confirmed = rotates
        ? await openConfirmation(rotationCopy.confirmPrompt, rotationCopy.confirmAccept)
        : await openConfirmation(
            viewData.account.regeneratePrompt,
            viewData.account.regenerateAccept,
          );
      if (!confirmed) {
        return;
      }

      const challengeResult = await requestSensitiveActionChallenge(
        rotates
          ? rotationCopy.deviceAuthPrompt
          : viewData.account.regenerateDeviceAuthPrompt,
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

    if (rotates) {
      // Asked up front: a code-less try would spend the shared step-up budget.
      setIsPreparingSync(true);
      const codeRequired = await isCodeFieldNeeded(state);
      setIsPreparingSync(false);
      setPendingRotationStepUp({
        prompt: { codeRequired, errorCode: null },
        forState: state,
      });
      return;
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

  // The password and code live only in the card's own field state and this
  // call's arguments; they are never stored, logged or put in route params.
  async function handleSubmitManagedRecoveryRotationStepUp(
    stepUp: SyncRecoveryKeyStepUp,
  ) {
    if (!pendingRotationStepUp || !managedRecoveryRotationStepUpPrompt) {
      return;
    }
    // A second tap before the busy flag renders would replay the same code.
    if (rotationInFlightRef.current) {
      return;
    }
    rotationInFlightRef.current = true;
    const forState = pendingRotationStepUp.forState;
    const codeFieldShown = managedRecoveryRotationStepUpPrompt.codeRequired;
    resetFeedbackMessages();
    setIsRotatingRecoveryPhrase(true);
    try {
      let result: Awaited<ReturnType<typeof rotateManagedRecoveryPhrase>>;
      try {
        result = await rotateManagedRecoveryPhrase(syncSecretStore, stepUp, effectiveNow);
      } catch {
        result = { ok: false, errorCode: "generic" };
      }

      if (result.ok) {
        // The service also stashes the phrase: the screen's next load shows
        // it again, so an unmount or a focus reload cannot lose it.
        setPendingRotationStepUp(null);
        setErrorState(null);
        setGeneratedRecoveryPhrase(result.recoveryPhrase);
        setAccountStatusMessage(rotationCopy.rotatedStatus);
        return;
      }

      switch (result.errorCode) {
        case "not_connected":
        case "unauthorized":
          setPendingRotationStepUp(null);
          setErrorState({ code: result.errorCode, scope: "local" });
          return;
        case "totp_invalid_code":
        case "totp_replayed":
          setPendingRotationStepUp({
            prompt: { codeRequired: true, errorCode: result.errorCode },
            forState,
          });
          return;
        default:
          setPendingRotationStepUp({
            prompt: { codeRequired: codeFieldShown, errorCode: result.errorCode },
            forState,
          });
      }
    } finally {
      rotationInFlightRef.current = false;
      setIsRotatingRecoveryPhrase(false);
    }
  }

  function handleCancelManagedRecoveryRotationStepUp() {
    setPendingRotationStepUp(null);
  }

  // Unknown two-factor status shows the field; an empty code is not sent.
  async function isCodeFieldNeeded(forState: NonNullable<typeof state>) {
    try {
      const twoFactor = await describeSyncAccountTwoFactor(
        syncSecretStore,
        forState.savedSyncPreferences,
      );
      return twoFactor?.twoFactorEnabled ?? true;
    } catch {
      return true;
    }
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
    isRotatingRecoveryPhrase,
    isExportingRecoveryPhrase,
    managedRecoveryRotationCopy: rotationCopy,
    managedRecoveryRotationStepUpPrompt,
    handlePrepareSyncSetup,
    handleSubmitManagedRecoveryRotationStepUp,
    handleCancelManagedRecoveryRotationStepUp,
    handleAcknowledgeRecoveryCode,
    handleExportRecoveryPhrase,
  };
}
