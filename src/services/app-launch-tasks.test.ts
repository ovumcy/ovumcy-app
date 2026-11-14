import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { runAppLaunchTasks } from "./app-launch-tasks";
import { cleanupStaleExportArtifacts } from "./export-artifact-cleanup";

jest.mock("./export-artifact-cleanup", () => ({
  cleanupStaleExportArtifacts: jest.fn().mockResolvedValue(undefined),
}));

const mockCleanup = jest.mocked(cleanupStaleExportArtifacts);

function createScheduler() {
  return { sync: jest.fn().mockResolvedValue("scheduled") };
}

describe("runAppLaunchTasks", () => {
  beforeEach(() => {
    mockCleanup.mockReset();
    mockCleanup.mockResolvedValue(undefined);
  });

  it("sweeps stale export artifacts and rebuilds the reminder schedule once", async () => {
    const scheduler = createScheduler();
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue({
        dailyLogReminderEnabled: false,
        languageOverride: "en",
      }),
    });

    await runAppLaunchTasks(storage, scheduler);

    expect(mockCleanup).toHaveBeenCalledTimes(1);
    // Once for the stored cycle-start repoint, once for the rebuild.
    expect(storage.readProfileRecord).toHaveBeenCalledTimes(2);
    // Every toggle off: the rebuild clears the schedule.
    expect(scheduler.sync).toHaveBeenCalledTimes(1);
    expect(scheduler.sync).toHaveBeenCalledWith([]);
  });

  it("still rebuilds the schedule when the artifact sweep fails", async () => {
    mockCleanup.mockRejectedValue(new Error("cache unavailable"));
    const scheduler = createScheduler();
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue({ languageOverride: "en" }),
    });

    await expect(runAppLaunchTasks(storage, scheduler)).resolves.toBeUndefined();

    expect(scheduler.sync).toHaveBeenCalledTimes(1);
  });

  it("resolves without throwing when the stored profile cannot be read", async () => {
    const scheduler = createScheduler();
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockRejectedValue(new Error("locked")),
    });

    await expect(runAppLaunchTasks(storage, scheduler)).resolves.toBeUndefined();

    expect(mockCleanup).toHaveBeenCalledTimes(1);
    expect(scheduler.sync).not.toHaveBeenCalled();
  });
});
