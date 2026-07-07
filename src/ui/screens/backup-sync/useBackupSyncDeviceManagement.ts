import { useState } from "react";

import { getDeviceCopy } from "../../../i18n/device-copy";
import {
  buildBackupSyncDeviceListView,
  resolveBackupSyncDeviceErrorMessage,
  type BackupSyncDeviceListItemView,
} from "../../../services/backup-sync-view-service";
import {
  listSyncDevices,
  removeSyncDevice,
} from "../../../sync/sync-client-service";
import { openConfirmation } from "../../confirm/open-confirmation";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";

/**
 * Device-management concern: listing the devices attached to the sync account
 * and removing one to free its slot (issue: reinstalling past the device limit
 * used to dead-end in too_many_devices). The list loads on demand — never on
 * screen focus — so the section costs no network round-trip until opened.
 * Removing the CURRENT device is allowed (the server does not bind sessions to
 * devices; sync keeps working and the device re-registers on the next sign-in)
 * but gets a distinctly worded confirmation. Dialog dismissal = keep.
 */
export function useBackupSyncDeviceManagement(core: BackupSyncSessionCore) {
  const { language, state, syncSecretStore, viewData } = core;

  const [deviceListItems, setDeviceListItems] = useState<
    BackupSyncDeviceListItemView[] | null
  >(null);
  const [isDeviceBusy, setIsDeviceBusy] = useState(false);
  const [deviceErrorMessage, setDeviceErrorMessage] = useState("");
  const [deviceStatusMessage, setDeviceStatusMessage] = useState("");

  const deviceCopy = getDeviceCopy(language);

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
        resolveBackupSyncDeviceErrorMessage(result.errorCode, deviceCopy),
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
    const confirmed = await openConfirmation(
      item.isCurrentDevice
        ? deviceCopy.removeCurrentDevicePrompt(item.label)
        : deviceCopy.removeDevicePrompt(item.label),
      deviceCopy.removeConfirmAction,
      viewData.common.cancelAction,
    );
    if (!confirmed) {
      return;
    }

    setIsDeviceBusy(true);
    const result = await removeSyncDevice(
      syncSecretStore,
      state.savedSyncPreferences,
      deviceID,
    );
    if (!result.ok) {
      setDeviceErrorMessage(
        resolveBackupSyncDeviceErrorMessage(result.errorCode, deviceCopy),
      );
      if (result.errorCode === "device_not_found") {
        // Another device already removed this entry — the rendered list is
        // stale, so refresh it under the error banner.
        await loadDeviceList();
      }
      setIsDeviceBusy(false);
      return;
    }

    setDeviceStatusMessage(deviceCopy.statusRemoved);
    await loadDeviceList();
    setIsDeviceBusy(false);
  }

  return {
    deviceListItems,
    isDeviceBusy,
    deviceErrorMessage,
    deviceStatusMessage,
    handleLoadDevices,
    handleRemoveDevice,
  };
}
