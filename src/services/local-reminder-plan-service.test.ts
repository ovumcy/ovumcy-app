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
});
