import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord } from "../models/profile";
import { buildLocalReminderPlans } from "./local-reminder-plan-service";

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
});
