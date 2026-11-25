import { createDefaultProfileRecord, type ProfileRecord } from "../models/profile";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { STORED_CYCLE_START_REPOINT_TIMEOUT_MS, runAppLaunchTasks } from "./app-launch-tasks";
import { cleanupStaleExportArtifacts } from "./export-artifact-cleanup";
import { acknowledgePregnancyModulePurchase } from "./pregnancy-purchase-service";

async function waitForCalls(mock: jest.Mock): Promise<void> {
  for (let turn = 0; turn < 50 && mock.mock.calls.length === 0; turn += 1) {
    await Promise.resolve();
  }
  expect(mock).toHaveBeenCalled();
}

jest.mock("./export-artifact-cleanup", () => ({
  cleanupStaleExportArtifacts: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("./pregnancy-purchase-service", () => ({
  acknowledgePregnancyModulePurchase: jest.fn().mockResolvedValue(undefined),
}));

const mockCleanup = jest.mocked(cleanupStaleExportArtifacts);
const mockAcknowledge = jest.mocked(acknowledgePregnancyModulePurchase);

function createScheduler() {
  return { sync: jest.fn().mockResolvedValue("scheduled") };
}

describe("runAppLaunchTasks", () => {
  beforeEach(() => {
    mockCleanup.mockReset();
    mockCleanup.mockResolvedValue(undefined);
    mockAcknowledge.mockReset();
    mockAcknowledge.mockResolvedValue(undefined);
  });

  it("acknowledges an owed store purchase on every launch without delaying the reminder rebuild", async () => {
    let finishAcknowledge: () => void = () => undefined;
    mockAcknowledge.mockReturnValue(
      new Promise<void>((resolve) => {
        finishAcknowledge = resolve;
      }),
    );
    const scheduler = createScheduler();
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue({
        dailyLogReminderEnabled: false,
        languageOverride: "en",
      }),
    });

    const launch = runAppLaunchTasks(storage, scheduler);
    await waitForCalls(scheduler.sync);

    // The rebuild finished while the store call was still open.
    expect(mockAcknowledge).toHaveBeenCalledTimes(1);
    expect(mockAcknowledge).toHaveBeenCalledWith();

    finishAcknowledge();
    await expect(launch).resolves.toBeUndefined();
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

  it("settles the profile gate only after the repoint has written the profile", async () => {
    let stored: ProfileRecord = createDefaultProfileRecord();
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn(async () => stored),
      writeProfileRecord: jest.fn(async (profile) => {
        await Promise.resolve();
        stored = profile;
      }),
    });
    const seenAtSettle: unknown[] = [];

    await runAppLaunchTasks(storage, createScheduler(), () => {
      seenAtSettle.push(stored.storedCycleStartRepointVersion);
    });

    expect(seenAtSettle).toHaveLength(1);
    expect(seenAtSettle[0]).toBeDefined();
  });

  it("settles the profile gate and still loads when the repoint fails", async () => {
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockRejectedValue(new Error("locked")),
    });
    const onSettled = jest.fn();

    await expect(
      runAppLaunchTasks(storage, createScheduler(), onSettled),
    ).resolves.toBeUndefined();

    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("settles the profile gate, sweeps and rebuilds when the repoint hangs past the timeout", async () => {
    jest.useFakeTimers();
    try {
      let profileReads = 0;
      const storage = createLocalAppStorageMock({
        readProfileRecord: jest.fn(() => {
          profileReads += 1;
          return profileReads === 1
            ? new Promise<ProfileRecord>(() => undefined)
            : Promise.resolve({ ...createDefaultProfileRecord(), dailyLogReminderEnabled: false });
        }),
      });
      const scheduler = createScheduler();
      const onSettled = jest.fn();

      const launch = runAppLaunchTasks(storage, scheduler, onSettled);
      await jest.advanceTimersByTimeAsync(STORED_CYCLE_START_REPOINT_TIMEOUT_MS - 1);
      expect(onSettled).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      await launch;

      expect(onSettled).toHaveBeenCalledTimes(1);
      expect(mockCleanup).toHaveBeenCalledTimes(1);
      expect(scheduler.sync).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("writes nothing when a timed-out repoint finishes late", async () => {
    jest.useFakeTimers();
    try {
      let finishRead: (records: never[]) => void = () => undefined;
      const storage = createLocalAppStorageMock({
        readProfileRecord: jest.fn().mockResolvedValue({
          ...createDefaultProfileRecord(),
          dailyLogReminderEnabled: false,
        }),
        listDayLogRecordsInRange: jest
          .fn()
          .mockImplementationOnce(
            () => new Promise<never[]>((resolve) => {
              finishRead = resolve;
            }),
          )
          .mockResolvedValue([]),
        writeProfileRecord: jest.fn().mockResolvedValue(undefined),
      });

      const launch = runAppLaunchTasks(storage, createScheduler());
      await jest.advanceTimersByTimeAsync(STORED_CYCLE_START_REPOINT_TIMEOUT_MS);
      finishRead([]);
      await launch;
      await jest.advanceTimersByTimeAsync(0);

      expect(storage.writeProfileRecord).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
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
