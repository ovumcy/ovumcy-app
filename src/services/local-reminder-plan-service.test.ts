import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord } from "../models/profile";
import { createPregnancyRecord } from "../models/pregnancy";
import { buildLocalReminderPlans } from "./local-reminder-plan-service";
import { addDays, parseLocalDate } from "./profile-settings-policy";

describe("local-reminder-plan-service", () => {
  it("builds a daily reminder and predictive reminders from the enabled settings", () => {
    const profile = {
      ...createDefaultProfileRecord(),
      dailyLogReminderEnabled: true,
      upcomingPeriodReminderEnabled: true,
      fertileWindowReminderEnabled: true,
      reminderTime: "20:00",
    };
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        isPeriod: true,
        cycleStart: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-28"),
        isPeriod: true,
        cycleStart: true,
      },
    ];

    const plans = buildLocalReminderPlans(
      profile,
      records,
      new Date(2026, 3, 5, 10, 0, 0, 0),
      "en",
    );

    expect(plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "daily_log",
          trigger: {
            type: "daily",
            hour: 20,
            minute: 0,
          },
        }),
        expect.objectContaining({
          kind: "upcoming_period",
          trigger: expect.objectContaining({
            type: "once",
          }),
        }),
        expect.objectContaining({
          kind: "fertile_window",
          trigger: expect.objectContaining({
            type: "once",
          }),
        }),
      ]),
    );
  });

  describe("reminder lead days (web parity: reminder_lead_days)", () => {
    const now = new Date(2026, 3, 5, 10, 0, 0, 0);
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        isPeriod: true,
        cycleStart: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-28"),
        isPeriod: true,
        cycleStart: true,
      },
    ];

    function upcomingPeriodTriggerAt(reminderLeadDays?: number): Date {
      const profile = {
        ...createDefaultProfileRecord(),
        upcomingPeriodReminderEnabled: true,
        fertileWindowReminderEnabled: true,
        reminderTime: "20:00",
      };
      if (reminderLeadDays === undefined) {
        // Simulate a profile persisted before the field existed.
        delete profile.reminderLeadDays;
      } else {
        profile.reminderLeadDays = reminderLeadDays;
      }
      const plan = buildLocalReminderPlans(profile, records, now, "en").find(
        (candidate) => candidate.kind === "upcoming_period",
      );
      if (!plan || plan.trigger.type !== "once") {
        throw new Error("expected a one-shot upcoming-period plan");
      }
      return plan.trigger.at;
    }

    function fertileWindowTriggerAt(reminderLeadDays: number): Date {
      const profile = {
        ...createDefaultProfileRecord(),
        fertileWindowReminderEnabled: true,
        reminderTime: "20:00",
        reminderLeadDays,
      };
      const plan = buildLocalReminderPlans(profile, records, now, "en").find(
        (candidate) => candidate.kind === "fertile_window",
      );
      if (!plan || plan.trigger.type !== "once") {
        throw new Error("expected a one-shot fertile-window plan");
      }
      return plan.trigger.at;
    }

    it("moves the upcoming-period trigger by exactly the configured lead", () => {
      const dayInMs = 24 * 60 * 60 * 1000;
      const leadZero = upcomingPeriodTriggerAt(0);
      const leadSeven = upcomingPeriodTriggerAt(7);

      // Same target date, same wall-clock time — a 7-day lead fires exactly
      // 7 days earlier than a 0-day ("on the day itself") lead.
      expect(leadZero.getTime() - leadSeven.getTime()).toBe(7 * dayInMs);
    });

    it("defaults to the previous hardcoded 3-day lead when the profile has no value", () => {
      expect(upcomingPeriodTriggerAt().toISOString()).toBe(
        upcomingPeriodTriggerAt(3).toISOString(),
      );
    });

    it("clamps an out-of-range stored lead to the shared maximum", () => {
      expect(upcomingPeriodTriggerAt(99).toISOString()).toBe(
        upcomingPeriodTriggerAt(14).toISOString(),
      );
    });

    it("does not shift the fertile-window reminder, which keeps its fixed window-start lead", () => {
      expect(fertileWindowTriggerAt(0).toISOString()).toBe(
        fertileWindowTriggerAt(7).toISOString(),
      );
    });
  });

  it("keeps only the daily reminder in facts-only mode", () => {
    const profile = {
      ...createDefaultProfileRecord(),
      unpredictableCycle: true,
      dailyLogReminderEnabled: true,
      upcomingPeriodReminderEnabled: true,
      fertileWindowReminderEnabled: true,
    };

    const plans = buildLocalReminderPlans(
      profile,
      [],
      new Date(2026, 3, 5, 10, 0, 0, 0),
      "en",
    );

    expect(plans).toEqual([
      expect.objectContaining({
        kind: "daily_log",
      }),
    ]);
  });

  it("suppresses period and fertile reminders after a positive pregnancy test", () => {
    const profile = {
      ...createDefaultProfileRecord(),
      dailyLogReminderEnabled: true,
      upcomingPeriodReminderEnabled: true,
      fertileWindowReminderEnabled: true,
      cycleLength: 28,
      reminderTime: "20:00",
    };
    const now = new Date(2026, 2, 12, 10, 0, 0, 0);
    const baseRecords = [
      {
        ...createEmptyDayLogRecord("2026-03-05"),
        isPeriod: true,
        cycleStart: true,
      },
    ];

    // Baseline: this cycle does produce a fertile-window reminder, so the
    // suppression below is meaningful and this test fails if the pause breaks.
    const baseline = buildLocalReminderPlans(profile, baseRecords, now, "en");
    expect(baseline.some((plan) => plan.kind === "fertile_window")).toBe(true);

    // A positive pregnancy test with no later period pauses predictions, so only
    // the (pregnancy-agnostic) daily logging reminder may remain.
    const pregnantRecords = [
      ...baseRecords,
      {
        ...createEmptyDayLogRecord("2026-03-10"),
        pregnancyTest: "positive" as const,
      },
    ];
    const plans = buildLocalReminderPlans(profile, pregnantRecords, now, "en");

    expect(plans.map((plan) => plan.kind)).toEqual(["daily_log"]);
  });

  // Suppression ORs the two signals (SECURITY.md medical safety): the day-log
  // pause cannot be relied on during an active pregnancy — a period logged
  // mid-pregnancy lifts it, and a pregnancy dated from an LMP/ultrasound never
  // sets it at all. Neither of those may repaint period/fertile reminders.
  it("suppresses period and fertile reminders for an active pregnancy record with no day-log pause", () => {
    const profile = {
      ...createDefaultProfileRecord(),
      dailyLogReminderEnabled: true,
      upcomingPeriodReminderEnabled: true,
      fertileWindowReminderEnabled: true,
      cycleLength: 28,
      reminderTime: "20:00",
    };
    const now = new Date(2026, 2, 12, 10, 0, 0, 0);
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-05"),
        isPeriod: true,
        cycleStart: true,
      },
    ];
    const activeRecord = createPregnancyRecord({
      edd: "2026-10-08",
      eddBasis: "lmp",
      lmpDate: "2026-01-01",
      startedAt: "2026-03-01",
    });

    // Baseline: no positive test is logged anywhere, so the day-log pause never
    // engages and these reminders are planned for the very same records.
    const baseline = buildLocalReminderPlans(profile, records, now, "en");
    expect(baseline.map((plan) => plan.kind)).toEqual([
      "daily_log",
      "upcoming_period",
      "fertile_window",
    ]);

    const plans = buildLocalReminderPlans(
      profile,
      records,
      now,
      "en",
      undefined,
      activeRecord,
    );
    expect(plans.map((plan) => plan.kind)).toEqual(["daily_log"]);

    // An ENDED record resumes them: the pregnancy is over, the cycle is not.
    const ended = buildLocalReminderPlans(profile, records, now, "en", undefined, {
      ...activeRecord,
      status: "ended" as const,
      endedAt: "2026-03-10",
      endReason: "loss" as const,
      modeOfDelivery: null,
    });
    expect(ended.map((plan) => plan.kind)).toEqual([
      "daily_log",
      "upcoming_period",
      "fertile_window",
    ]);
  });

  // The resolved reminder zone is carried on the plan itself, so a
  // near-midnight reminder time fires on the owner's local wall-clock day even
  // in a far-offset zone. Device-local Date math alone would have resolved a
  // 23:30 reminder onto the neighbouring local day there.
  describe("near-midnight reminders in a far-offset zone", () => {
    const reminderTimeZone = "Pacific/Kiritimati"; // UTC+14

    function nearMidnightPlans() {
      const profile = {
        ...createDefaultProfileRecord(),
        dailyLogReminderEnabled: true,
        upcomingPeriodReminderEnabled: true,
        fertileWindowReminderEnabled: true,
        reminderTime: "23:30",
      };
      const records = [
        { ...createEmptyDayLogRecord("2026-03-01"), isPeriod: true, cycleStart: true },
        { ...createEmptyDayLogRecord("2026-03-28"), isPeriod: true, cycleStart: true },
      ];
      return buildLocalReminderPlans(
        profile,
        records,
        new Date("2026-03-05T10:00:00.000Z"),
        "en",
        reminderTimeZone,
      );
    }

    it("stamps the resolved zone on every plan", () => {
      const plans = nearMidnightPlans();
      expect(plans.length).toBeGreaterThan(0);
      for (const plan of plans) {
        expect(plan.timeZone).toBe(reminderTimeZone);
      }
    });

    it("fires one-shot triggers at the configured wall-clock time in that zone", () => {
      const plans = nearMidnightPlans();
      const oncePlans = plans.filter((plan) => plan.trigger.type === "once");
      expect(oncePlans.length).toBeGreaterThan(0);

      for (const plan of oncePlans) {
        if (plan.trigger.type !== "once") {
          continue;
        }
        const wall = new Intl.DateTimeFormat("en-GB", {
          timeZone: reminderTimeZone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(plan.trigger.at);
        expect(wall).toBe("23:30");
      }
    });
  });

  describe("kick-count reminder(optional, default off)", () => {
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

    function baseProfile(overrides: Partial<ReturnType<typeof createDefaultProfileRecord>>) {
      return {
        ...createDefaultProfileRecord(),
        reminderTime: "09:00",
        ...overrides,
      };
    }

    it("never plans it when the flag is off, even with an otherwise-eligible pregnancy", () => {
      const plans = buildLocalReminderPlans(
        baseProfile({ kickCountReminderEnabled: false }),
        [],
        nowForGaDays(30 * 7),
        "en",
        undefined,
        activePregnancyRecord(),
      );
      expect(plans.some((plan) => plan.kind === "kick_count")).toBe(false);
    });

    it("plans a daily reminder when the flag is on, the pregnancy is active, and gaWeeks >= 28", () => {
      const plans = buildLocalReminderPlans(
        baseProfile({ kickCountReminderEnabled: true }),
        [],
        nowForGaDays(28 * 7),
        "en",
        undefined,
        activePregnancyRecord(),
      );
      const plan = plans.find((candidate) => candidate.kind === "kick_count");
      expect(plan).toBeDefined();
      expect(plan?.trigger).toEqual({ type: "daily", hour: 9, minute: 0 });
    });

    it("does not plan it one week before the start week (27+6)", () => {
      const plans = buildLocalReminderPlans(
        baseProfile({ kickCountReminderEnabled: true }),
        [],
        nowForGaDays(27 * 7 + 6),
        "en",
        undefined,
        activePregnancyRecord(),
      );
      expect(plans.some((plan) => plan.kind === "kick_count")).toBe(false);
    });

    it("does not plan it with no active pregnancy", () => {
      const plans = buildLocalReminderPlans(
        baseProfile({ kickCountReminderEnabled: true }),
        [],
        new Date(2026, 5, 1),
        "en",
        undefined,
        null,
      );
      expect(plans.some((plan) => plan.kind === "kick_count")).toBe(false);
    });

    it("does not plan it for an ended pregnancy", () => {
      const ended = {
        ...activePregnancyRecord(),
        status: "ended" as const,
        endedAt: "2026-09-01",
        endReason: "birth" as const,
        modeOfDelivery: "vaginal" as const,
      };
      const plans = buildLocalReminderPlans(
        baseProfile({ kickCountReminderEnabled: true }),
        [],
        nowForGaDays(30 * 7),
        "en",
        undefined,
        ended,
      );
      expect(plans.some((plan) => plan.kind === "kick_count")).toBe(false);
    });

    it("is independent of cycle predictability -- still plans in facts-only mode", () => {
      const plans = buildLocalReminderPlans(
        baseProfile({ kickCountReminderEnabled: true, unpredictableCycle: true }),
        [],
        nowForGaDays(30 * 7),
        "en",
        undefined,
        activePregnancyRecord(),
      );
      expect(plans.some((plan) => plan.kind === "kick_count")).toBe(true);
    });

    it("uses the existing generic notification copy, with no kick/pregnancy wording", () => {
      const plans = buildLocalReminderPlans(
        baseProfile({ kickCountReminderEnabled: true }),
        [],
        nowForGaDays(30 * 7),
        "en",
        undefined,
        activePregnancyRecord(),
      );
      const plan = plans.find((candidate) => candidate.kind === "kick_count");
      expect(plan).toBeDefined();
      expect(plan?.title).toBe("Ovumcy reminder");
      expect(plan?.body).toBe("Open Ovumcy to update today's entry.");
      expect(plan?.title.toLowerCase()).not.toMatch(/kick|pregnan/);
      expect(plan?.body.toLowerCase()).not.toMatch(/kick|pregnan/);
    });
  });
});
