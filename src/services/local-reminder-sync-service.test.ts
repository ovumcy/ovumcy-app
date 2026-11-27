import { createEmptyDayLogRecord } from "../models/day-log";
import { createPregnancyRecord } from "../models/pregnancy";
import { createVolatileWebAppStorage } from "../storage/local/volatile-web-app-storage";
import { completedCycleHistory } from "./__fixtures__/completed-cycles";
import { buildLocalReminderPlans } from "./local-reminder-plan-service";
import { createDefaultProfileRecord } from "../models/profile";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { getReminderCopy } from "../i18n/reminder-copy";
import {
  rebuildLocalReminderScheduleFromStorage,
  syncLocalReminderSchedule,
} from "./local-reminder-sync-service";
import { addDays, parseLocalDate } from "./profile-settings-policy";
import type { LocalReminderScheduler } from "./local-reminder-scheduler-contract";

function createScheduler(): LocalReminderScheduler {
  return {
    sync: jest.fn().mockResolvedValue("scheduled"),
  };
}

const cycleStartRecords = [
  // Three completed cycles behind the running one, so the fertile reminder is
  // not held back by the completed-cycle floor.
  ...completedCycleHistory({ currentStart: "2026-03-01" }),
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

  it.each([
    ["the day-log history", "listDayLogRecordsInRange"],
    ["the active pregnancy record", "readActivePregnancy"],
  ] as const)(
    "clears the armed schedule and reports failed when %s cannot be read",
    async (_label, failingRead) => {
      const storage = createLocalAppStorageMock({
        listDayLogRecordsInRange: jest.fn().mockResolvedValue(cycleStartRecords),
        [failingRead]: jest.fn().mockRejectedValue(new Error("storage read failed")),
      });
      const scheduler = createScheduler();
      const profile = {
        ...createDefaultProfileRecord(),
        upcomingPeriodReminderEnabled: true,
        fertileWindowReminderEnabled: true,
      };

      await expect(
        syncLocalReminderSchedule(storage, scheduler, profile, {
          now: new Date(2026, 3, 5, 10, 0, 0, 0),
        }),
      ).resolves.toBe("failed");

      expect(scheduler.sync).toHaveBeenCalledTimes(1);
      expect(scheduler.sync).toHaveBeenCalledWith([]);
    },
  );

  it("still reports failed when clearing the schedule after a failed read also fails", async () => {
    const storage = createLocalAppStorageMock({
      listDayLogRecordsInRange: jest.fn().mockRejectedValue(new Error("storage read failed")),
    });
    const scheduler: LocalReminderScheduler = {
      sync: jest.fn().mockRejectedValue(new Error("scheduler unavailable")),
    };

    await expect(
      syncLocalReminderSchedule(
        storage,
        scheduler,
        { ...createDefaultProfileRecord(), dailyLogReminderEnabled: true },
        { now: new Date(2026, 3, 5, 10, 0, 0, 0) },
      ),
    ).resolves.toBe("failed");
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

    // A profile whose only reminders are cycle-day rules has every toggle off,
    // so the pregnancy read must be triggered by the rules themselves.
    it("reads the pregnancy state for cycle-day rules alone and suppresses them", async () => {
      const rulesOnly = {
        ...createDefaultProfileRecord(),
        cycleDayReminders: [
          { id: "cdr_a", cycleDay: 14, remindAtHour: 9, label: "", showLabel: false },
        ],
      };
      const notPregnant = createLocalAppStorageMock({
        listDayLogRecordsInRange: jest.fn().mockResolvedValue(cycleStartRecords),
      });
      const notPregnantScheduler = createScheduler();
      await syncLocalReminderSchedule(notPregnant, notPregnantScheduler, rulesOnly, { now });
      expect(syncedPlanKinds(notPregnantScheduler)).toEqual(["cycle_day"]);

      const pregnant = createLocalAppStorageMock({
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
      const pregnantScheduler = createScheduler();
      await syncLocalReminderSchedule(pregnant, pregnantScheduler, rulesOnly, { now });

      expect(pregnant.readActivePregnancy).toHaveBeenCalledTimes(1);
      expect(syncedPlanKinds(pregnantScheduler)).toEqual([]);
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

  describe("cycle history window", () => {
    it("plans from a run straddling the two-year bound as one cycle start", async () => {
      const now = new Date(2026, 5, 20, 9, 0, 0, 0);
      const period = (date: string) => ({ ...createEmptyDayLogRecord(date), isPeriod: true });
      // 2024-06-20 is the two-year bound; the run's first day lies before it.
      const records = [
        period("2024-06-19"),
        period("2024-06-20"),
        period("2024-07-25"),
        period("2024-07-26"),
        period("2026-05-20"),
        period("2026-05-21"),
        period("2026-06-15"),
        period("2026-06-16"),
      ];
      const storage = createVolatileWebAppStorage();
      for (const record of records) {
        await storage.writeDayLogRecord(record);
      }
      const profile = {
        ...createDefaultProfileRecord(),
        autoPeriodFill: false,
        lastPeriodStart: null,
        upcomingPeriodReminderEnabled: true,
        fertileWindowReminderEnabled: true,
      };
      const scheduler = createScheduler();

      await syncLocalReminderSchedule(storage, scheduler, profile, { now });

      const planned = jest.mocked(scheduler.sync).mock.calls[0]?.[0];
      expect(planned).toEqual(buildLocalReminderPlans(profile, records, now, "en"));
      // A window cut at the bound would plan different dates.
      expect(planned).not.toEqual(
        buildLocalReminderPlans(
          profile,
          records.filter((record) => record.date >= "2024-06-20"),
          now,
          "en",
        ),
      );
      expect(planned?.map((plan) => plan.kind)).toEqual(["upcoming_period", "fertile_window"]);
    });
  });

  describe("planning instant", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("reads the clock at plan time when no instant is injected", async () => {
      jest.useFakeTimers({ now: new Date(2026, 3, 6, 0, 30, 0, 0) });
      const storage = createLocalAppStorageMock({
        listDayLogRecordsInRange: jest.fn().mockResolvedValue(cycleStartRecords),
      });

      await syncLocalReminderSchedule(
        storage,
        createScheduler(),
        { ...createDefaultProfileRecord(), upcomingPeriodReminderEnabled: true },
        {},
      );

      // "today" is the day after midnight, not a day captured earlier
      expect(storage.listDayLogRecordsInRange).toHaveBeenCalledWith(
        expect.any(String),
        "2026-04-06",
      );
    });
  });

  describe("rebuildLocalReminderScheduleFromStorage", () => {
    it("plans from the stored profile in its interface language", async () => {
      const storage = createLocalAppStorageMock({
        readProfileRecord: jest.fn().mockResolvedValue({
          ...createDefaultProfileRecord(),
          dailyLogReminderEnabled: true,
          languageOverride: "de",
          reminderTime: "08:05",
        }),
      });
      const scheduler = createScheduler();

      await expect(
        rebuildLocalReminderScheduleFromStorage(storage, scheduler, {
          now: new Date(2026, 3, 5, 10, 0, 0, 0),
        }),
      ).resolves.toBe("scheduled");

      expect(scheduler.sync).toHaveBeenCalledWith([
        expect.objectContaining({
          kind: "daily_log",
          title: getReminderCopy("de").notificationTitle,
          body: getReminderCopy("de").dailyLogBody,
          trigger: { type: "daily", hour: 8, minute: 5 },
        }),
      ]);
    });

    it("clears the schedule when the stored profile has every reminder off", async () => {
      const storage = createLocalAppStorageMock();
      const scheduler = createScheduler();

      await expect(
        rebuildLocalReminderScheduleFromStorage(storage, scheduler),
      ).resolves.toBe("disabled");

      expect(scheduler.sync).toHaveBeenCalledWith([]);
    });

    it("resolves to failed instead of throwing when the rebuild fails", async () => {
      const storage = createLocalAppStorageMock({
        readProfileRecord: jest.fn().mockRejectedValue(new Error("locked")),
      });
      const scheduler = createScheduler();

      await expect(
        rebuildLocalReminderScheduleFromStorage(storage, scheduler),
      ).resolves.toBe("failed");
      expect(scheduler.sync).not.toHaveBeenCalled();
    });
  });
});
