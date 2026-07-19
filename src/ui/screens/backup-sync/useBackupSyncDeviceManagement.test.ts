import { act, renderHook } from "@testing-library/react-native";

import { getDeviceCopy } from "../../../i18n/device-copy";
import {
  buildBackupSyncDeviceListView,
  resolveBackupSyncDeviceErrorMessage,
} from "../../../services/backup-sync-view-service";
import * as syncClientService from "../../../sync/sync-client-service";
import type { SyncDeviceRecord } from "../../../sync/sync-contract";
import { createBackupSyncSessionCoreMock } from "../../../test/create-backup-sync-session-core-mock";
import { openConfirmation } from "../../confirm/open-confirmation";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";
import { useBackupSyncDeviceManagement } from "./useBackupSyncDeviceManagement";

jest.mock("../../confirm/open-confirmation", () => ({
  openConfirmation: jest.fn(),
  openLeaveConfirmation: jest.fn(),
}));

jest.mock("../../../sync/sync-client-service");

const mockOpenConfirmation = jest.mocked(openConfirmation);
const mockListSyncDevices = jest.mocked(syncClientService.listSyncDevices);
const mockRemoveSyncDevice = jest.mocked(syncClientService.removeSyncDevice);

// buildBackupSyncDeviceListView / resolveBackupSyncDeviceErrorMessage are pure
// i18n/view mapping (already covered by backup-sync-view-service.test.ts) --
// used for real here to compute expected values instead of duplicating the
// mapping logic in this suite.
const deviceCopy = getDeviceCopy("en");

const DEVICE_A: SyncDeviceRecord = {
  deviceID: "device-a",
  deviceLabel: "Pixel 7",
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSeenAt: "2026-03-18T00:00:00.000Z",
};
const DEVICE_B: SyncDeviceRecord = {
  deviceID: "device-b",
  deviceLabel: "",
  createdAt: "2026-01-02T00:00:00.000Z",
  lastSeenAt: "2026-03-19T00:00:00.000Z",
};

async function renderHookWithLoadedDevices(
  core: BackupSyncSessionCore,
  devices: SyncDeviceRecord[],
  currentDeviceID: string,
) {
  mockListSyncDevices.mockResolvedValueOnce({
    ok: true,
    devices,
    currentDeviceID,
  });
  const rendered = renderHook(() => useBackupSyncDeviceManagement(core));
  await act(async () => {
    await rendered.result.current.handleLoadDevices();
  });
  return rendered;
}

describe("useBackupSyncDeviceManagement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleLoadDevices", () => {
    it("does nothing when there is no loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = renderHook(() => useBackupSyncDeviceManagement(core));

      await act(async () => {
        await result.current.handleLoadDevices();
      });

      expect(mockListSyncDevices).not.toHaveBeenCalled();
      expect(result.current.isDeviceBusy).toBe(false);
      expect(result.current.deviceListItems).toBeNull();
    });

    it("lists devices on success and builds the view items with a current-device flag", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHookWithLoadedDevices(
        core,
        [DEVICE_A, DEVICE_B],
        "device-a",
      );

      expect(mockListSyncDevices).toHaveBeenCalledWith(
        core.syncSecretStore,
        core.state!.savedSyncPreferences,
      );
      expect(result.current.deviceListItems).toEqual(
        buildBackupSyncDeviceListView(
          [DEVICE_A, DEVICE_B],
          "device-a",
          "en",
          deviceCopy,
        ),
      );
      expect(result.current.isDeviceBusy).toBe(false);
    });

    it("surfaces a mapped error and leaves the list unset when the initial load fails", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockListSyncDevices.mockResolvedValue({
        ok: false,
        errorCode: "network_failed",
      });
      const { result } = renderHook(() => useBackupSyncDeviceManagement(core));

      await act(async () => {
        await result.current.handleLoadDevices();
      });

      expect(result.current.deviceErrorMessage).toBe(
        resolveBackupSyncDeviceErrorMessage("network_failed", deviceCopy),
      );
      expect(result.current.deviceListItems).toBeNull();
      expect(result.current.isDeviceBusy).toBe(false);
    });

    it("clears a prior error message once a subsequent load succeeds", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockListSyncDevices.mockResolvedValueOnce({
        ok: false,
        errorCode: "network_failed",
      });
      const { result } = renderHook(() => useBackupSyncDeviceManagement(core));

      await act(async () => {
        await result.current.handleLoadDevices();
      });
      expect(result.current.deviceErrorMessage).not.toBe("");

      mockListSyncDevices.mockResolvedValueOnce({
        ok: true,
        devices: [DEVICE_A],
        currentDeviceID: "device-a",
      });
      await act(async () => {
        await result.current.handleLoadDevices();
      });

      expect(result.current.deviceErrorMessage).toBe("");
    });
  });

  describe("handleRemoveDevice", () => {
    it("does nothing when there is no loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = renderHook(() => useBackupSyncDeviceManagement(core));

      await act(async () => {
        await result.current.handleRemoveDevice("device-a");
      });

      expect(mockOpenConfirmation).not.toHaveBeenCalled();
      expect(mockRemoveSyncDevice).not.toHaveBeenCalled();
    });

    it("does nothing when the device list has no matching item (not loaded yet)", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = renderHook(() => useBackupSyncDeviceManagement(core));

      await act(async () => {
        await result.current.handleRemoveDevice("device-a");
      });

      expect(mockOpenConfirmation).not.toHaveBeenCalled();
      expect(mockRemoveSyncDevice).not.toHaveBeenCalled();
    });

    it("asks for confirmation with the current-device wording when removing the current device", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHookWithLoadedDevices(
        core,
        [DEVICE_A],
        "device-a",
      );
      mockOpenConfirmation.mockResolvedValue(false);

      await act(async () => {
        await result.current.handleRemoveDevice("device-a");
      });

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        deviceCopy.removeCurrentDevicePrompt("Pixel 7"),
        deviceCopy.removeConfirmAction,
        core.viewData.common.cancelAction,
      );
    });

    it("asks for confirmation with the standard wording when removing another device", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHookWithLoadedDevices(
        core,
        [DEVICE_A, DEVICE_B],
        "device-a",
      );
      mockOpenConfirmation.mockResolvedValue(false);

      await act(async () => {
        await result.current.handleRemoveDevice("device-b");
      });

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        deviceCopy.removeDevicePrompt(deviceCopy.fallbackDeviceLabel),
        deviceCopy.removeConfirmAction,
        core.viewData.common.cancelAction,
      );
    });

    it("keeps the device when the removal confirm is dismissed", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHookWithLoadedDevices(
        core,
        [DEVICE_A, DEVICE_B],
        "device-a",
      );
      mockOpenConfirmation.mockResolvedValue(false);

      await act(async () => {
        await result.current.handleRemoveDevice("device-b");
      });

      expect(mockRemoveSyncDevice).not.toHaveBeenCalled();
      expect(result.current.isDeviceBusy).toBe(false);
    });

    it("surfaces a mapped error without refreshing the list for a non-device_not_found failure", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHookWithLoadedDevices(
        core,
        [DEVICE_A, DEVICE_B],
        "device-a",
      );
      mockOpenConfirmation.mockResolvedValue(true);
      mockRemoveSyncDevice.mockResolvedValue({
        ok: false,
        errorCode: "network_failed",
      });
      mockListSyncDevices.mockClear();

      await act(async () => {
        await result.current.handleRemoveDevice("device-b");
      });

      expect(result.current.deviceErrorMessage).toBe(
        resolveBackupSyncDeviceErrorMessage("network_failed", deviceCopy),
      );
      expect(mockListSyncDevices).not.toHaveBeenCalled();
      expect(result.current.isDeviceBusy).toBe(false);
    });

    it("reloads the stale list when removal fails with device_not_found", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHookWithLoadedDevices(
        core,
        [DEVICE_A, DEVICE_B],
        "device-a",
      );
      mockOpenConfirmation.mockResolvedValue(true);
      mockRemoveSyncDevice.mockResolvedValue({
        ok: false,
        errorCode: "device_not_found",
      });
      mockListSyncDevices.mockClear();
      mockListSyncDevices.mockResolvedValueOnce({
        ok: true,
        devices: [DEVICE_A],
        currentDeviceID: "device-a",
      });

      await act(async () => {
        await result.current.handleRemoveDevice("device-b");
      });

      expect(result.current.deviceErrorMessage).toBe(
        resolveBackupSyncDeviceErrorMessage("device_not_found", deviceCopy),
      );
      expect(mockListSyncDevices).toHaveBeenCalledTimes(1);
      expect(result.current.deviceListItems).toEqual(
        buildBackupSyncDeviceListView([DEVICE_A], "device-a", "en", deviceCopy),
      );
      expect(result.current.isDeviceBusy).toBe(false);
    });

    it("removes the device, reloads the list, and reports removed on success", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHookWithLoadedDevices(
        core,
        [DEVICE_A, DEVICE_B],
        "device-a",
      );
      mockOpenConfirmation.mockResolvedValue(true);
      mockRemoveSyncDevice.mockResolvedValue({
        ok: true,
        removedCurrentDevice: false,
      });
      mockListSyncDevices.mockResolvedValueOnce({
        ok: true,
        devices: [DEVICE_A],
        currentDeviceID: "device-a",
      });

      await act(async () => {
        await result.current.handleRemoveDevice("device-b");
      });

      expect(mockRemoveSyncDevice).toHaveBeenCalledWith(
        core.syncSecretStore,
        core.state!.savedSyncPreferences,
        "device-b",
      );
      expect(result.current.deviceStatusMessage).toBe(deviceCopy.statusRemoved);
      expect(result.current.deviceListItems).toEqual(
        buildBackupSyncDeviceListView([DEVICE_A], "device-a", "en", deviceCopy),
      );
      expect(result.current.isDeviceBusy).toBe(false);
    });
  });
});
