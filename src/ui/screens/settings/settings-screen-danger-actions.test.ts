import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import { buildSettingsViewData } from "../../../services/settings-view-service";
import { createSettingsStorageMock } from "../../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../../test/create-sync-secret-store-mock";
import { runClearAllDataAction } from "./settings-screen-danger-actions";

jest.mock("../../../security/sensitive-action-auth", () => ({
  requestSensitiveActionChallenge: jest.fn(),
}));

const mockChallenge = jest.mocked(requestSensitiveActionChallenge);

const viewData = buildSettingsViewData(new Date(2026, 2, 17), "en");

function createContext() {
  const storage = createSettingsStorageMock();
  const reminderScheduler = { sync: jest.fn().mockResolvedValue("scheduled") };
  const context = {
    clearDataConfirmationValue: "CLEAR",
    reminderScheduler,
    resetClearDataMessages: jest.fn(),
    router: { replace: jest.fn() },
    setClearDataErrorMessage: jest.fn(),
    setIsClearingData: jest.fn(),
    storage,
    syncProfilePreferences: jest.fn(),
    syncSecretStore: createSyncSecretStoreMock(),
    viewData,
  };
  return { context, reminderScheduler, storage };
}

describe("clear-all-data reminder rebuild", () => {
  beforeEach(() => {
    mockChallenge.mockReset();
    mockChallenge.mockResolvedValue({ ok: true });
  });

  it("clears the OS schedule once, after the local data is wiped", async () => {
    const { context, reminderScheduler, storage } = createContext();

    await runClearAllDataAction(context);

    expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1);
    expect(reminderScheduler.sync).toHaveBeenCalledTimes(1);
    expect(reminderScheduler.sync).toHaveBeenCalledWith([]);
    expect(
      jest.mocked(storage.clearAllLocalData).mock.invocationCallOrder[0],
    ).toBeLessThan(reminderScheduler.sync.mock.invocationCallOrder[0]!);
    expect(context.router.replace).toHaveBeenCalledTimes(1);
  });

  it("leaves the schedule untouched when the wipe fails", async () => {
    const { context, reminderScheduler, storage } = createContext();
    jest.mocked(storage.clearAllLocalData).mockRejectedValue(new Error("busy"));

    await runClearAllDataAction(context);

    expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1);
    expect(context.setClearDataErrorMessage).toHaveBeenLastCalledWith(
      viewData.danger.status.failed,
    );
    expect(reminderScheduler.sync).not.toHaveBeenCalled();
    expect(context.router.replace).not.toHaveBeenCalled();
  });

  it.each(["failed", "unavailable", "cancelled"] as const)(
    "wipes nothing and leaves the schedule untouched when the device challenge is refused (%s)",
    async (reason) => {
      const { context, reminderScheduler, storage } = createContext();
      mockChallenge.mockResolvedValue({ ok: false, reason } as never);

      await runClearAllDataAction(context);

      expect(mockChallenge).toHaveBeenCalledTimes(1);
      expect(storage.clearAllLocalData).not.toHaveBeenCalled();
      expect(reminderScheduler.sync).not.toHaveBeenCalled();
      expect(context.router.replace).not.toHaveBeenCalled();
    },
  );
});
