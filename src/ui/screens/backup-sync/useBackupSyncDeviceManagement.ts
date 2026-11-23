import { useRef, useState } from "react";

import { getDeviceCopy } from "../../../i18n/device-copy";
import { selectRecoveryKeyStepUpCopy } from "../../../i18n/recovery-key-stepup-copy";
import { buildSignedOutBackupSyncState } from "../../../services/backup-sync-screen-service";
import {
  buildBackupSyncDeviceListView,
  resolveBackupSyncDeviceErrorMessage,
  type BackupSyncDeviceListItemView,
} from "../../../services/backup-sync-view-service";
import type { SyncRecoveryKeyStepUp } from "../../../sync/sync-api-client";
import {
  listSyncDevices,
  removeSyncDevice,
  type SyncDeviceManagementErrorCode,
} from "../../../sync/sync-client-service";
import { openConfirmation } from "../../confirm/open-confirmation";
import type { RecoveryKeyStepUpPrompt } from "./useBackupSyncActions";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";

/**
 * Device-management concern: listing the devices attached to the sync account
 * and removing one to free its slot (issue: reinstalling past the device limit
 * used to dead-end in too_many_devices). The list loads on demand — never on
 * screen focus — so the section costs no network round-trip until opened.
 *
 * A managed sync host binds no session to a device, so removing the current
 * device leaves sync working here. A self-hosted server revokes every session
 * bound to the removed device: removing the current one signs this install
 * out, and with two-factor on the server first asks for the password and a
 * current code (the step-up card). Each case gets its own confirmation
 * wording. Dialog dismissal = keep.
 */
export function useBackupSyncDeviceManagement(core: BackupSyncSessionCore) {
  const {
    language,
    setAccountStatusMessage,
    setState,
    state,
    storage,
    syncSecretStore,
    viewData,
  } = core;

  const [deviceListItems, setDeviceListItems] = useState<
    BackupSyncDeviceListItemView[] | null
  >(null);
  const [isDeviceBusy, setIsDeviceBusy] = useState(false);
  const [deviceErrorMessage, setDeviceErrorMessage] = useState("");
  const [deviceStatusMessage, setDeviceStatusMessage] = useState("");
  const removalInFlightRef = useRef(false);
  const [pendingStepUp, setPendingStepUp] = useState<{
    deviceID: string;
    prompt: RecoveryKeyStepUpPrompt;
    // A reload or another account replaces `state` and retires the prompt.
    forState: NonNullable<typeof state>;
  } | null>(null);

  const deviceCopy = getDeviceCopy(language);
  const activeStepUp =
    pendingStepUp && pendingStepUp.forState === state ? pendingStepUp : null;
  const deviceRemovalStepUpPrompt = activeStepUp?.prompt ?? null;
  const deviceRemovalStepUpCopy = {
    ...selectRecoveryKeyStepUpCopy(language),
    explanation: deviceCopy.removeStepUpExplanation,
  };

  function resetDeviceFeedback() {
    setDeviceErrorMessage("");
    setDeviceStatusMessage("");
  }

  // Fetches the list and replaces the rendered items. Leaves any error message
  // already on screen untouched when the fetch succeeds, so a remove failure
  // stays visible while the stale list refreshes underneath it.
  async function loadDeviceList(): Promise<void> {
    if (!state) {
      return;
    }

    const result = await listSyncDevices(
      syncSecretStore,
      state.savedSyncPreferences,
    );
    if (!result.ok) {
      setDeviceErrorMessage(
        resolveBackupSyncDeviceErrorMessage(
          result.errorCode,
          deviceCopy,
          undefined,
          state.managedPremiumAccess.planStatus,
        ),
      );
      return;
    }

    setDeviceListItems(
      buildBackupSyncDeviceListView(
        result.devices,
        result.currentDeviceID,
        language,
        deviceCopy,
      ),
    );
  }

  async function handleLoadDevices() {
    if (!state) {
      return;
    }

    resetDeviceFeedback();
    setIsDeviceBusy(true);
    await loadDeviceList();
    setIsDeviceBusy(false);
  }

  async function handleRemoveDevice(deviceID: string) {
    if (!state) {
      return;
    }
    const item = deviceListItems?.find((entry) => entry.deviceID === deviceID);
    if (!item) {
      return;
    }

    resetDeviceFeedback();
    setPendingStepUp(null);
    const selfHosted = state.savedSyncPreferences.mode === "self_hosted";
    const prompt = item.isCurrentDevice
      ? selfHosted
        ? deviceCopy.removeCurrentSelfHostedDevicePrompt(item.label)
        : deviceCopy.removeCurrentDevicePrompt(item.label)
      : selfHosted
        ? deviceCopy.removeSelfHostedDevicePrompt(item.label)
        : deviceCopy.removeDevicePrompt(item.label);
    const confirmed = await openConfirmation(
      prompt,
      deviceCopy.removeConfirmAction,
      viewData.common.cancelAction,
    );
    if (!confirmed) {
      return;
    }

    await runRemoval(state, deviceID, undefined);
  }

  // The password and code live only in the card's own field state and this
  // call's arguments; they are never stored, logged or put in route params.
  async function handleSubmitDeviceRemovalStepUp(stepUp: SyncRecoveryKeyStepUp) {
    if (!state || !activeStepUp) {
      return;
    }
    resetDeviceFeedback();
    const code = stepUp.code?.trim();
    await runRemoval(
      state,
      activeStepUp.deviceID,
      code
        ? { currentPassword: stepUp.currentPassword, code }
        : { currentPassword: stepUp.currentPassword },
    );
  }

  function handleCancelDeviceRemovalStepUp() {
    setPendingStepUp(null);
  }

  async function runRemoval(
    forState: NonNullable<typeof state>,
    deviceID: string,
    stepUp: SyncRecoveryKeyStepUp | undefined,
  ) {
    // A second tap before the busy flag renders would replay the same code.
    if (removalInFlightRef.current) {
      return;
    }
    removalInFlightRef.current = true;
    setIsDeviceBusy(true);
    try {
      await removeAndSettle(forState, deviceID, stepUp);
    } finally {
      removalInFlightRef.current = false;
      setIsDeviceBusy(false);
    }
  }

  async function removeAndSettle(
    forState: NonNullable<typeof state>,
    deviceID: string,
    stepUp: SyncRecoveryKeyStepUp | undefined,
  ) {
    const result = await removeSyncDevice(
      storage,
      syncSecretStore,
      forState.savedSyncPreferences,
      deviceID,
      stepUp,
    );
    if (!result.ok) {
      const prompt = resolveStepUpPrompt(result.errorCode, stepUp);
      setPendingStepUp(prompt ? { deviceID, prompt, forState } : null);
      if (prompt) {
        return;
      }
      setDeviceErrorMessage(
        resolveBackupSyncDeviceErrorMessage(
          result.errorCode,
          deviceCopy,
          {
            retryAfterSeconds: result.retryAfterSeconds,
            template: viewData.account.errors.retryInSeconds,
          },
          forState.managedPremiumAccess.planStatus,
        ),
      );
      if (result.errorCode === "device_not_found") {
        // Another device already removed this entry — the rendered list is
        // stale, so refresh it under the error banner.
        await loadDeviceList();
      }
      return;
    }

    setPendingStepUp(null);
    if (result.preferences) {
      // The server revoked this install's session with the device. Signed
      // out, the device section is hidden, so the notice goes to the account
      // banner that stays on screen.
      setDeviceListItems(null);
      setState(buildSignedOutBackupSyncState(forState, result.preferences));
      setAccountStatusMessage(deviceCopy.statusRemovedSignedOut);
      return;
    }

    setDeviceStatusMessage(deviceCopy.statusRemoved);
    await loadDeviceList();
  }

  return {
    deviceListItems,
    deviceRemovalStepUpCopy,
    deviceRemovalStepUpPrompt,
    isDeviceBusy,
    deviceErrorMessage,
    deviceStatusMessage,
    handleCancelDeviceRemovalStepUp,
    handleLoadDevices,
    handleRemoveDevice,
    handleSubmitDeviceRemovalStepUp,
  };
}

// The server asks for the step-up only once two-factor is on, so the card
// always shows the code field.
function resolveStepUpPrompt(
  errorCode: SyncDeviceManagementErrorCode,
  stepUp: SyncRecoveryKeyStepUp | undefined,
): RecoveryKeyStepUpPrompt | null {
  switch (errorCode) {
    case "device_step_up_required":
      return { codeRequired: true, errorCode: null };
    case "invalid_current_password":
    case "totp_invalid_code":
    case "totp_replayed":
      return { codeRequired: true, errorCode };
    case "rate_limited":
      return stepUp === undefined ? null : { codeRequired: true, errorCode };
    default:
      return null;
  }
}
