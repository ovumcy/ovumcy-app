import { useMemo, useRef, useState } from "react";

import { selectAccountChangeRecoveryCopy } from "../../../i18n/account-change-recovery-copy";
import { selectManagedRecoveryRotationCopy } from "../../../i18n/managed-recovery-rotation-copy";
import { prepareBackupSyncSetup } from "../../../services/backup-sync-screen-service";
import {
  shouldBlockManagedRecoveryAction,
  shouldRotateManagedRecoveryPhrase,
} from "../../../services/backup-sync-view-service";
import { deliverRecoveryPhraseArtifact } from "../../../services/recovery-phrase-delivery-service";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import {
  acknowledgeAccountChangeRecoveryPhrase,
  loadAccountChangeRecoveryPhraseState,
  readPendingAccountChangeRecoveryPhrase,
} from "../../../sync/account-change-recovery-phrase";
import {
  acknowledgeManagedRecoveryPhrase,
  prepareManagedRecoveryRotationCandidate,
  rotateManagedRecoveryPhrase,
} from "../../../sync/managed-recovery-rotation-service";
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
 * new phrase only after Ovumcy Cloud confirmed it. A key a sign-in to another
 * account replaced reveals its phrase behind the same confirm-then-device-auth
 * gate, or, once a process kill lost it, offers a new phrase through the
 * regular path. The phrase itself lives on the shared core because the
 * focus-load reset and the draft-save both clear it.
 */
export function useBackupSyncRecoveryMaterials(core: BackupSyncSessionCore) {
  const {
    accountChangeRecoveryPhrase,
    effectiveNow,
    exportDeliveryClient,
    generatedRecoveryPhrase,
    language,
    reloadPartnerAccess,
    resetFeedbackMessages,
    setAccountStatusMessage,
    setErrorState,
    setAccountChangeRecoveryPhrase,
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
  const revealInFlightRef = useRef(false);
  const prepareInFlightRef = useRef(false);
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
  const accountChangeCopy = useMemo(
    () => selectAccountChangeRecoveryCopy(language),
    [language],
  );

  function reportDeviceAuthFailure(reason: string) {
    if (reason === "unavailable") {
      setErrorState({ code: "deviceAuthUnavailable", scope: "local" });
    } else if (reason === "failed") {
      setErrorState({ code: "deviceAuthFailed", scope: "local" });
    }
  }

  // A second tap during the confirm or device-auth await would start a second
  // regeneration or rotation.
  async function handlePrepareSyncSetup() {
    if (prepareInFlightRef.current) {
      return;
    }
    prepareInFlightRef.current = true;
    try {
      await prepareSyncSetup();
    } finally {
      prepareInFlightRef.current = false;
    }
  }

  async function prepareSyncSetup() {
    if (!state) {
      return;
    }

    resetFeedbackMessages();

    if (
      shouldBlockManagedRecoveryAction({
        hasStoredSyncSecrets: state.hasStoredSyncSecrets,
        hasSyncSession: state.hasSyncSession,
        preferences: state.savedSyncPreferences,
      })
    ) {
      return;
    }

    const rotates = shouldRotateManagedRecoveryPhrase({
      hasStoredSyncSecrets: state.hasStoredSyncSecrets,
      hasSyncSession: state.hasSyncSession,
      preferences: state.savedSyncPreferences,
    });

    if (state.hasStoredSyncSecrets) {
      const confirmed = rotates
        ? await openConfirmation(
            rotationCopy.confirmPrompt,
            rotationCopy.confirmAccept,
            viewData.common.cancelAction,
          )
        : await openConfirmation(
            viewData.account.regeneratePrompt,
            viewData.account.regenerateAccept,
            viewData.common.cancelAction,
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
        reportDeviceAuthFailure(challengeResult.reason);
        return;
      }
    }

    if (rotates) {
      // Asked up front: a code-less try would spend the shared step-up budget.
      setIsPreparingSync(true);
      const codeRequired = await isCodeFieldNeeded(state);
      const candidatePhrase = await readRotationCandidate();
      setIsPreparingSync(false);
      if (!candidatePhrase) {
        setErrorState({ code: "not_connected", scope: "local" });
        return;
      }
      setPendingRotationStepUp({
        prompt: { codeRequired, errorCode: null, candidatePhrase },
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
    // A new key has a phrase of its own, revealed right below.
    setAccountChangeRecoveryPhrase("none");
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
        // The service also keeps the phrase until it is acknowledged, so an
        // unmount or a focus reload before that cannot lose it.
        setPendingRotationStepUp(null);
        setErrorState(null);
        setGeneratedRecoveryPhrase(result.recoveryPhrase);
        setAccountStatusMessage(rotationCopy.rotatedStatus);
        return;
      }

      if (result.errorCode === "not_connected" || result.errorCode === "unauthorized") {
        setPendingRotationStepUp(null);
        setErrorState({ code: result.errorCode, scope: "local" });
        return;
      }
      // Usually the same phrase again; a refused or dropped candidate is
      // replaced, and the card asks for a new acknowledgement.
      const candidatePhrase = await readRotationCandidate();
      if (!candidatePhrase) {
        setPendingRotationStepUp(null);
        setErrorState({ code: "not_connected", scope: "local" });
        return;
      }
      const codeRequired =
        result.errorCode === "totp_invalid_code" ||
        result.errorCode === "totp_replayed" ||
        result.errorCode === "totp_fresh_code_required" ||
        codeFieldShown;
      setPendingRotationStepUp({
        prompt: { codeRequired, errorCode: result.errorCode, candidatePhrase },
        forState,
      });
    } finally {
      rotationInFlightRef.current = false;
      setIsRotatingRecoveryPhrase(false);
    }
  }

  function handleCancelManagedRecoveryRotationStepUp() {
    setPendingRotationStepUp(null);
  }

  async function readRotationCandidate(): Promise<string | null> {
    try {
      return await prepareManagedRecoveryRotationCandidate(syncSecretStore);
    } catch {
      return null;
    }
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

  // Only the explicit confirm reveals: a dismissed confirm or a failed device
  // auth keeps the offer, and the phrase stays in its buffer for a retry.
  async function handleRevealAccountChangeRecoveryPhrase() {
    if (accountChangeRecoveryPhrase !== "reveal") {
      return;
    }
    // A second tap during the confirm or device-auth await would open a second flow.
    if (revealInFlightRef.current) {
      return;
    }
    revealInFlightRef.current = true;
    try {
      resetFeedbackMessages();

      const confirmed = await openConfirmation(
        accountChangeCopy.confirmPrompt,
        accountChangeCopy.confirmAccept,
        viewData.common.cancelAction,
      );
      if (!confirmed) {
        return;
      }

      const challengeResult = await requestSensitiveActionChallenge(
        accountChangeCopy.deviceAuthPrompt,
      );
      if (!challengeResult.ok) {
        reportDeviceAuthFailure(challengeResult.reason);
        return;
      }

      const phrase = await readPendingAccountChangeRecoveryPhrase(syncSecretStore);
      if (phrase === null) {
        setAccountChangeRecoveryPhrase(
          await loadAccountChangeRecoveryPhraseState(syncSecretStore),
        );
        return;
      }
      setErrorState(null);
      setGeneratedRecoveryPhrase(phrase);
    } finally {
      revealInFlightRef.current = false;
    }
  }

  function handleAcknowledgeRecoveryPhrase() {
    setGeneratedRecoveryPhrase("");
    acknowledgeManagedRecoveryPhrase();
    setAccountChangeRecoveryPhrase("none");
    // A failed write leaves the flag, so the next load offers a new phrase:
    // the safe side of a lost acknowledgement.
    void acknowledgeAccountChangeRecoveryPhrase(syncSecretStore).catch(() => undefined);
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
    accountChangeRecoveryCopy: accountChangeCopy,
    accountChangeRecoveryPhrase,
    managedRecoveryRotationStepUpPrompt,
    handlePrepareSyncSetup,
    handleRevealAccountChangeRecoveryPhrase,
    handleSubmitManagedRecoveryRotationStepUp,
    handleCancelManagedRecoveryRotationStepUp,
    handleAcknowledgeRecoveryCode,
    handleAcknowledgeRecoveryPhrase,
    handleExportRecoveryPhrase,
  };
}
