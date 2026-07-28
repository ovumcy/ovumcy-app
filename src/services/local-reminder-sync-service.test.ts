import { createPregnancyRecord } from "../models/pregnancy";
import { createDefaultProfileRecord } from "../models/profile";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { syncLocalReminderSchedule } from "./local-reminder-sync-service";
import { addDays, parseLocalDate } from "./profile-settings-policy";
import type { LocalReminderScheduler } from "./local-reminder-scheduler-contract";

function createScheduler(): LocalReminderScheduler {
  return {
    sync: jest.fn().mockResolvedValue("scheduled"),
  };
}

const cycleStartRecords = [
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
];

describe("local-reminder-sync-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("schedules local reminder plans without any account or premium access", async () => {
    const storage = createLocalAppStorageMock({
      listDayLogRecordsInRange: jest.fn().mockResolvedValue(cycleStartRecords),
    });
    const scheduler = createScheduler();
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
    // Reminders never leave the device: no sync preferences, no managed
    // session, no billing snapshot are consulted on this path. Regression
    // against re-coupling the local channel to an account.
    expect(storage.readSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("returns disabled and clears the device schedule without touching storage when nothing is enabled", async () => {
    const storage = createLocalAppStorageMock();
    const scheduler = createScheduler();

    await expect(
      syncLocalReminderSchedule(
        storage,
        scheduler,
        createDefaultProfileRecord(),
        { now: new Date(2026, 3, 5, 10, 0, 0, 0) },
      ),
    ).resolves.toBe("disabled");

    expect(scheduler.sync).toHaveBeenCalledWith([]);
    expect(storage.listDayLogRecordsInRange).not.toHaveBeenCalled();
    expect(storage.readSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  // The plan builder suppresses period/fertile reminders for an ACTIVE
  // pregnancy record, but it can only do so if this service actually reads one.
  // The read used to be short-circuited on the kick-count flag alone — off by
  // default — so for a typical pregnant owner the record never arrived and the
  // device kept firing cycle reminders.
  describe("active-pregnancy suppression of the cycle reminders", () => {
    const now = new Date(2026, 3, 5, 10, 0, 0, 0);

    function cyclePredictionProfile() {
      return {
        ...createDefaultProfileRecord(),
        dailyLogReminderEnabled: true,
        upcomingPeriodReminderEnabled: true,
        fertileWindowReminderEnabled: true,
        // The kick-count toggle stays OFF (its default) — the state in which
        // the pregnancy read was previously skipped altogether.
        kickCountReminderEnabled: false,
      };
    }

    function syncedPlanKinds(scheduler: LocalReminderScheduler): string[] {
      const [plans] = (scheduler.sync as jest.Mock).mock.calls[0] as [
        { kind: string }[],
      ];
      return plans.map((plan) => plan.kind);
    }

    it("plans period and fertile reminders when no pregnancy record exists", async () => {
      const storage = createLocalAppStorageMock({
        listDayLogRecordsInRange: jest.fn().mockResolvedValue(cycleStartRecords),
        readActivePregnancy: jest.fn().mockResolvedValue(null),
      });
      const scheduler = createScheduler();

      await syncLocalReminderSchedule(storage, scheduler, cyclePredictionProfile(), {
        now,
      });

      expect(syncedPlanKinds(scheduler)).toEqual([
        "daily_log",
        "upcoming_period",
        "fertile_window",
      ]);
    });

    it("suppresses them on the device during an active pregnancy", async () => {
      const storage = createLocalAppStorageMock({
        listDayLogRecordsInRange: jest.fn().mockResolvedValue(cycleStartRecords),
        readActivePregnancy: jest.fn().mockResolvedValue(
          createPregnancyRecord({
            edd: "2026-10-08",
            eddBasis: "lmp",
            lmpDate: "2026-01-01",
            startedAt: "2026-03-01",
          }),
        ),
      });
      const scheduler = createScheduler();

      await syncLocalReminderSchedule(
        storage,
        scheduler,
        cyclePredictionProfile(),
        { now },
      );

      expect(storage.readActivePregnancy).toHaveBeenCalledTimes(1);
      expect(syncedPlanKinds(scheduler)).toEqual(["daily_log"]);
    });
  });

  describe("kick-count reminder wiring(end-to-end through the sync service)", () => {
    const KICK_EDD = "2026-10-08";

    function nowForGaDays(gaDays: number): Date {
      return addDays(parseLocalDate(KICK_EDD)!, gaDays - 280);
    }

    function activePregnancyRecord() {
      return createPregnancyRecord({
        edd: KICK_EDD,
        eddBasis: "lmp",
        lmpDate: "2026-01-01",
        startedAt: "2026-03-01",
      });
    }

    it("never reads pregnancy state when the kick flag is off, and schedules no kick plan", async () => {
      const storage = createLocalAppStorageMock({
        listDayLogRecordsInRange: jest.fn().mockResolvedValue(cycleStartRecords),
      });
      const scheduler = createScheduler();
      const profile = {
        ...createDefaultProfileRecord(),
        dailyLogReminderEnabled: true,
        kickCountReminderEnabled: false,
      };

      await expect(
        syncLocalReminderSchedule(storage, scheduler, profile, {
          now: new Date(2026, 3, 5, 10, 0, 0, 0),
        }),
      ).resolves.toBe("scheduled");

      // Plain cycle load stays free of the extra pregnancy read.
      expect(storage.readActivePregnancy).not.toHaveBeenCalled();
      const [plans] = (scheduler.sync as jest.Mock).mock.calls[0] as [
        { kind: string }[],
      ];
      expect(plans.some((plan) => plan.kind === "kick_count")).toBe(false);
    });

    it("schedules the kick reminder at the profile reminder time when on, active, and >= 28 weeks", async () => {
      // Kick is the ONLY enabled reminder: this exercises both edits at once —
      // the hasAnyReminderEnabled gate no longer short-circuits, and the
      // plan-builder receives the active pregnancy.
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(activePregnancyRecord()),
      });
      const scheduler = createScheduler();
      const profile = {
        ...createDefaultProfileRecord(),
        kickCountReminderEnabled: true,
        reminderTime: "09:15",
      };

      const result = await syncLocalReminderSchedule(storage, scheduler, profile, {
        now: nowForGaDays(28 * 7),
      });

      expect(result).toBe("scheduled");
      expect(storage.readActivePregnancy).toHaveBeenCalledTimes(1);
      expect(scheduler.sync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "kick_count",
            trigger: { type: "daily", hour: 9, minute: 15 },
          }),
        ]),
      );
    });

    it("schedules nothing when the flag is on but there is no active pregnancy", async () => {
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(null),
      });
      const scheduler = createScheduler();
      const profile = {
        ...createDefaultProfileRecord(),
        kickCountReminderEnabled: true,
      };

      await expect(
        syncLocalReminderSchedule(storage, scheduler, profile, {
          now: new Date(2026, 5, 1, 10, 0, 0, 0),
        }),
      ).resolves.toBe("disabled");

      expect(storage.readActivePregnancy).toHaveBeenCalledTimes(1);
      expect(scheduler.sync).toHaveBeenCalledWith([]);
    });

    it("schedules nothing for an ended pregnancy (defense-in-depth on the status field)", async () => {
      // The real repo's readActivePregnancy never returns an ended record;
      // mocking one here proves the plan-builder's own status check holds
      // end-to-end even if that repo contract were violated.
      const ended = {
        ...activePregnancyRecord(),
        status: "ended" as const,
        endedAt: "2026-09-01",
        endReason: "birth" as const,
        modeOfDelivery: "vaginal" as const,
      };
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(ended),
      });
      const scheduler = createScheduler();
      const profile = {
        ...createDefaultProfileRecord(),
        kickCountReminderEnabled: true,
      };

      await expect(
        syncLocalReminderSchedule(storage, scheduler, profile, {
          now: nowForGaDays(30 * 7),
        }),
      ).resolves.toBe("disabled");

      expect(scheduler.sync).toHaveBeenCalledWith([]);
    });
  });
});
