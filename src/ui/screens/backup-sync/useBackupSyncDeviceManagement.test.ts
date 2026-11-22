import { act, renderHook } from "@testing-library/react-native";

import { getDeviceCopy } from "../../../i18n/device-copy";
import { buildSignedOutBackupSyncState } from "../../../services/backup-sync-screen-service";
import {
  buildBackupSyncDeviceListView,
  resolveBackupSyncDeviceErrorMessage,
} from "../../../services/backup-sync-view-service";
import * as syncClientService from "../../../sync/sync-client-service";
import {
  createDefaultSyncPreferencesRecord,
  type SyncDeviceRecord,
} from "../../../sync/sync-contract";
import {
  createBackupSyncSessionCoreMock,
  createLoadedSettingsStateFixture,
} from "../../../test/create-backup-sync-session-core-mock";
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
  const rendered = await renderHook(() => useBackupSyncDeviceManagement(core));
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
      const { result } = await renderHook(() => useBackupSyncDeviceManagement(core));

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
      const { result } = await renderHook(() => useBackupSyncDeviceManagement(core));

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
      const { result } = await renderHook(() => useBackupSyncDeviceManagement(core));

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
      const { result } = await renderHook(() => useBackupSyncDeviceManagement(core));

      await act(async () => {
        await result.current.handleRemoveDevice("device-a");
      });

      expect(mockOpenConfirmation).not.toHaveBeenCalled();
      expect(mockRemoveSyncDevice).not.toHaveBeenCalled();
    });

    it("does nothing when the device list has no matching item (not loaded yet)", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncDeviceManagement(core));

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
        preferences: null,
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
        core.storage,
        core.syncSecretStore,
        core.state!.savedSyncPreferences,
        "device-b",
        undefined,
      );
      expect(result.current.deviceStatusMessage).toBe(deviceCopy.statusRemoved);
      expect(result.current.deviceListItems).toEqual(
        buildBackupSyncDeviceListView([DEVICE_A], "device-a", "en", deviceCopy),
      );
      expect(result.current.isDeviceBusy).toBe(false);
    });
  });

  describe("self-hosted removal", () => {
    const SELF_HOSTED = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
      normalizedEndpoint: "http://192.168.1.20:8080",
      setupStatus: "connected" as const,
    };
    const PASSWORD = "very secure password 12345";

    function createSelfHostedCore() {
      return createBackupSyncSessionCoreMock({
        state: createLoadedSettingsStateFixture({
          savedSyncPreferences: SELF_HOSTED,
        }),
      });
    }

    async function removeWithStepUp(core: BackupSyncSessionCore) {
      const rendered = await renderHookWithLoadedDevices(
        core,
        [DEVICE_A, DEVICE_B],
        "device-a",
      );
      mockOpenConfirmation.mockResolvedValue(true);
      mockRemoveSyncDevice.mockResolvedValueOnce({
        ok: false,
        errorCode: "device_step_up_required",
      });
      await act(async () => {
        await rendered.result.current.handleRemoveDevice("device-b");
      });
      return rendered;
    }

    it.each([
      ["device-a", deviceCopy.removeCurrentSelfHostedDevicePrompt("Pixel 7")],
      [
        "device-b",
        deviceCopy.removeSelfHostedDevicePrompt(deviceCopy.fallbackDeviceLabel),
      ],
    ])("says removing %s signs that device out", async (deviceID, prompt) => {
      const core = createSelfHostedCore();
      const { result } = await renderHookWithLoadedDevices(
        core,
        [DEVICE_A, DEVICE_B],
        "device-a",
      );
      mockOpenConfirmation.mockResolvedValue(false);

      await act(async () => {
        await result.current.handleRemoveDevice(deviceID);
      });

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        prompt,
        deviceCopy.removeConfirmAction,
        core.viewData.common.cancelAction,
      );
    });

    it("opens the step-up card with the code field when the server asks for it", async () => {
      const core = createSelfHostedCore();
      const { result } = await removeWithStepUp(core);

      expect(result.current.deviceRemovalStepUpPrompt).toEqual({
        codeRequired: true,
        errorCode: null,
      });
      expect(result.current.deviceRemovalStepUpCopy.explanation).toBe(
        deviceCopy.removeStepUpExplanation,
      );
      expect(result.current.deviceErrorMessage).toBe("");
      expect(result.current.isDeviceBusy).toBe(false);
    });

    it("retries the same device with the password and trimmed code", async () => {
      const core = createSelfHostedCore();
      const { result } = await removeWithStepUp(core);
      mockRemoveSyncDevice.mockResolvedValueOnce({
        ok: true,
        removedCurrentDevice: false,
        preferences: null,
      });

      await act(async () => {
        await result.current.handleSubmitDeviceRemovalStepUp({
          currentPassword: PASSWORD,
          code: " 123456 ",
        });
      });

      expect(mockRemoveSyncDevice).toHaveBeenLastCalledWith(
        core.storage,
        core.syncSecretStore,
        SELF_HOSTED,
        "device-b",
        { currentPassword: PASSWORD, code: "123456" },
      );
      expect(result.current.deviceRemovalStepUpPrompt).toBeNull();
      expect(result.current.deviceStatusMessage).toBe(deviceCopy.statusRemoved);
    });

    it("drops an empty code and keeps the card after a wrong password", async () => {
      const core = createSelfHostedCore();
      const { result } = await removeWithStepUp(core);
      mockRemoveSyncDevice.mockResolvedValueOnce({
        ok: false,
        errorCode: "invalid_current_password",
      });

      await act(async () => {
        await result.current.handleSubmitDeviceRemovalStepUp({
          currentPassword: PASSWORD,
          code: "  ",
        });
      });

      expect(mockRemoveSyncDevice.mock.calls.at(-1)?.[4]).toEqual({
        currentPassword: PASSWORD,
      });
      expect(result.current.deviceRemovalStepUpPrompt).toEqual({
        codeRequired: true,
        errorCode: "invalid_current_password",
      });
    });

    it.each(["totp_invalid_code", "totp_replayed", "rate_limited"] as const)(
      "keeps the card with the server's %s answer",
      async (errorCode) => {
        const core = createSelfHostedCore();
        const { result } = await removeWithStepUp(core);
        mockRemoveSyncDevice.mockResolvedValueOnce({ ok: false, errorCode });

        await act(async () => {
          await result.current.handleSubmitDeviceRemovalStepUp({
            currentPassword: PASSWORD,
            code: "123456",
          });
        });

        expect(result.current.deviceRemovalStepUpPrompt).toEqual({
          codeRequired: true,
          errorCode,
        });
        expect(result.current.deviceErrorMessage).toBe("");
      },
    );

    it("closes the card and shows the banner for any other failure", async () => {
      const core = createSelfHostedCore();
      const { result } = await removeWithStepUp(core);
      mockRemoveSyncDevice.mockResolvedValueOnce({
        ok: false,
        errorCode: "network_failed",
      });

      await act(async () => {
        await result.current.handleSubmitDeviceRemovalStepUp({
          currentPassword: PASSWORD,
          code: "123456",
        });
      });

      expect(result.current.deviceRemovalStepUpPrompt).toBeNull();
      expect(result.current.deviceErrorMessage).toBe(
        resolveBackupSyncDeviceErrorMessage("network_failed", deviceCopy),
      );
    });

    it("cancel closes the card without another removal", async () => {
      const core = createSelfHostedCore();
      const { result } = await removeWithStepUp(core);

      await act(async () => {
        result.current.handleCancelDeviceRemovalStepUp();
      });
      await act(async () => {
        await result.current.handleSubmitDeviceRemovalStepUp({
          currentPassword: PASSWORD,
        });
      });

      expect(result.current.deviceRemovalStepUpPrompt).toBeNull();
      expect(mockRemoveSyncDevice).toHaveBeenCalledTimes(1);
    });

    it("sends one removal for two submits in the same frame", async () => {
      const core = createSelfHostedCore();
      const { result } = await removeWithStepUp(core);
      mockRemoveSyncDevice.mockResolvedValueOnce({
        ok: true,
        removedCurrentDevice: false,
        preferences: null,
      });

      await act(async () => {
        const submit = result.current.handleSubmitDeviceRemovalStepUp;
        await Promise.all([
          submit({ currentPassword: PASSWORD, code: "123456" }),
          submit({ currentPassword: PASSWORD, code: "123456" }),
        ]);
      });

      expect(mockRemoveSyncDevice).toHaveBeenCalledTimes(2);
    });

    it("shows the banner, not the card, for a rate limit before any step-up", async () => {
      const core = createSelfHostedCore();
      const { result } = await renderHookWithLoadedDevices(
        core,
        [DEVICE_A, DEVICE_B],
        "device-a",
      );
      mockOpenConfirmation.mockResolvedValue(true);
      mockRemoveSyncDevice.mockResolvedValueOnce({
        ok: false,
        errorCode: "rate_limited",
      });

      await act(async () => {
        await result.current.handleRemoveDevice("device-b");
      });

      expect(result.current.deviceRemovalStepUpPrompt).toBeNull();
      expect(result.current.deviceErrorMessage).toBe(
        resolveBackupSyncDeviceErrorMessage("rate_limited", deviceCopy),
      );
    });

    it("signs this install out after removing its own device", async () => {
      const core = createSelfHostedCore();
      const { result } = await renderHookWithLoadedDevices(
        core,
        [DEVICE_A, DEVICE_B],
        "device-a",
      );
      const signedOut = { ...SELF_HOSTED, setupStatus: "local_ready" as const };
      mockOpenConfirmation.mockResolvedValue(true);
      mockRemoveSyncDevice.mockResolvedValueOnce({
        ok: true,
        removedCurrentDevice: true,
        preferences: signedOut,
      });
      mockListSyncDevices.mockClear();

      await act(async () => {
        await result.current.handleRemoveDevice("device-a");
      });

      expect(core.setState).toHaveBeenCalledWith(
        buildSignedOutBackupSyncState(core.state!, signedOut),
      );
      expect(result.current.deviceStatusMessage).toBe(
        deviceCopy.statusRemovedSignedOut,
      );
      expect(result.current.deviceListItems).toBeNull();
      expect(mockListSyncDevices).not.toHaveBeenCalled();
      expect(result.current.isDeviceBusy).toBe(false);
    });
  });
});
