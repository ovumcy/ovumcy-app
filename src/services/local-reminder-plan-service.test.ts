import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord } from "../models/profile";
import { buildLocalReminderPlans } from "./local-reminder-plan-service";
import { buildManagedReminderEmailSchedules } from "./managed-reminder-email-schedule-service";

// The calendar day a UTC instant falls on when viewed in `timeZone`.
function localDayIn(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

describe("local-reminder-plan-service", () => {
  it("builds a daily reminder and predictive reminders from managed-eligible settings", () => {
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

  // FIX 5.1: push (device-built trigger Date) and the managed email schedule
  // must resolve the SAME local day. Before the fix the email recomputed its
  // delivery in `options.timeZone` while push used device-local Date math, so
  // a near-midnight reminder could fire on different local days when the two
  // zones differed. Now the resolved zone is carried on the plan and both
  // channels read it. A near-midnight time in a far-offset zone is the case
  // that would have diverged.
  describe("FIX 5.1 push/email same local day across diverging zones", () => {
    const reminderTimeZone = "Pacific/Kiritimati"; // UTC+14
    const divergentEmailArg = "Pacific/Pago_Pago"; // UTC-11 — would diverge pre-fix

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

    it("email schedule honors the plan zone even when a different arg is passed", () => {
      const plans = nearMidnightPlans();
      const schedules = buildManagedReminderEmailSchedules(
        plans,
        "en",
        divergentEmailArg,
      );
      for (const schedule of schedules) {
        expect(schedule.timeZone).toBe(reminderTimeZone);
      }
    });

    it("the one-shot push instant and email delivery land on the same local day", () => {
      const plans = nearMidnightPlans();
      const schedules = buildManagedReminderEmailSchedules(
        plans,
        "en",
        divergentEmailArg,
      );

      const oncePlans = plans.filter(
        (plan) => plan.trigger.type === "once",
      );
      expect(oncePlans.length).toBeGreaterThan(0);

      for (const plan of oncePlans) {
        if (plan.trigger.type !== "once") {
          continue;
        }
        const schedule = schedules.find((entry) => entry.kind === plan.kind);
        expect(schedule).toBeDefined();
        const pushInstant = plan.trigger.at;
        const emailInstant = new Date(schedule!.nextDeliveryAt);

        // Email reuses the plan instant verbatim, so they share the same UTC
        // moment and therefore the same local day in the shared zone.
        expect(emailInstant.toISOString()).toBe(pushInstant.toISOString());
        expect(localDayIn(emailInstant, reminderTimeZone)).toBe(
          localDayIn(pushInstant, reminderTimeZone),
        );

        // The reminder fires on the user's local wall-clock day, not the UTC
        // day — the near-midnight + far-offset case that previously diverged.
        const wall = new Intl.DateTimeFormat("en-GB", {
          timeZone: reminderTimeZone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(pushInstant);
        expect(wall).toBe("23:30");
      }
    });

    it("the daily push hour and the daily email delivery agree in the shared zone", () => {
      const plans = nearMidnightPlans();
      const schedules = buildManagedReminderEmailSchedules(
        plans,
        "en",
        divergentEmailArg,
      );
      const dailyPlan = plans.find((plan) => plan.trigger.type === "daily");
      const dailySchedule = schedules.find(
        (entry) => entry.scheduleType === "daily",
      );
      expect(dailyPlan).toBeDefined();
      expect(dailySchedule).toBeDefined();
      if (dailyPlan?.trigger.type !== "daily") {
        throw new Error("expected a daily plan");
      }

      // The email's daily delivery instant, viewed in the shared zone, falls on
      // the same wall-clock hour:minute the OS-scheduled push uses.
      const emailWall = new Intl.DateTimeFormat("en-GB", {
        timeZone: reminderTimeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(dailySchedule!.nextDeliveryAt));
      const expected = `${String(dailyPlan.trigger.hour).padStart(2, "0")}:${String(
        dailyPlan.trigger.minute,
      ).padStart(2, "0")}`;
      expect(emailWall).toBe(expected);
      expect(dailySchedule!.dailyHour).toBe(dailyPlan.trigger.hour);
      expect(dailySchedule!.dailyMinute).toBe(dailyPlan.trigger.minute);
    });
  });
});
