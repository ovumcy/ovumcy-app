import { createDefaultProfileRecord } from "../models/profile";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { syncLocalReminderSchedule } from "./local-reminder-sync-service";
import type { LocalReminderScheduler } from "./local-reminder-scheduler-contract";

describe("local-reminder-sync-service", () => {
  it("cancels reminders when premium access is unavailable", async () => {
    const storage = createLocalAppStorageMock();
    const scheduler: LocalReminderScheduler = {
      sync: jest.fn().mockResolvedValue("scheduled"),
    };

    await expect(
      syncLocalReminderSchedule(storage, scheduler, createDefaultProfileRecord(), {
        now: new Date(2026, 3, 5, 10, 0, 0, 0),
        premiumEnabled: false,
      }),
    ).resolves.toBe("disabled");

    expect(scheduler.sync).toHaveBeenCalledWith([]);
  });

  it("builds and syncs local reminder plans when premium access is enabled", async () => {
    const storage = createLocalAppStorageMock({
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([
        {
          date: "2026-03-01",
          isPeriod: true,
          cycleStart: true,
          isUncertain: false,
          flow: "medium",
          mood: 0,
          sexActivity: "none",
          bbt: 0,
          cervicalMucus: "none",
          cycleFactorKeys: [],
          symptomIDs: [],
          notes: "",
        },
        {
          date: "2026-03-28",
          isPeriod: true,
          cycleStart: true,
          isUncertain: false,
          flow: "medium",
          mood: 0,
          sexActivity: "none",
          bbt: 0,
          cervicalMucus: "none",
          cycleFactorKeys: [],
          symptomIDs: [],
          notes: "",
        },
      ]),
    });
    const scheduler: LocalReminderScheduler = {
      sync: jest.fn().mockResolvedValue("scheduled"),
    };
    const profile = {
      ...createDefaultProfileRecord(),
      dailyLogReminderEnabled: true,
      upcomingPeriodReminderEnabled: true,
      fertileWindowReminderEnabled: true,
      reminderTime: "21:30",
    };

    await expect(
      syncLocalReminderSchedule(storage, scheduler, profile, {
        now: new Date(2026, 3, 5, 10, 0, 0, 0),
        premiumEnabled: true,
      }),
    ).resolves.toBe("scheduled");

    expect(scheduler.sync).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "daily_log",
          trigger: {
            type: "daily",
            hour: 21,
            minute: 30,
          },
        }),
      ]),
    );
  });
});
