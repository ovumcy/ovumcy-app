import {
  buildManagedReminderEmailSchedules,
} from "./managed-reminder-email-schedule-service";

describe("managed-reminder-email-schedule-service", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("builds daily and one-shot managed reminder schedules", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-05T08:15:00.000Z"));

    const schedules = buildManagedReminderEmailSchedules(
      [
        {
          kind: "daily_log",
          title: "Ovumcy reminder",
          body: "Open Ovumcy to update today's entry.",
          trigger: {
            type: "daily",
            hour: 21,
            minute: 30,
          },
        },
        {
          kind: "upcoming_period",
          title: "Ovumcy reminder",
          body: "Open Ovumcy to review your next cycle dates.",
          trigger: {
            type: "once",
            at: new Date("2026-04-07T18:00:00.000Z"),
          },
        },
      ],
      "ru",
      "UTC",
    );

    expect(schedules).toEqual([
      {
        kind: "daily_log",
        scheduleType: "daily",
        locale: "ru",
        timeZone: "UTC",
        dailyHour: 21,
        dailyMinute: 30,
        nextDeliveryAt: "2026-04-05T21:30:00.000Z",
      },
      {
        kind: "upcoming_period",
        scheduleType: "once",
        locale: "ru",
        timeZone: "UTC",
        dailyHour: 0,
        dailyMinute: 0,
        nextDeliveryAt: "2026-04-07T18:00:00.000Z",
      },
    ]);
  });

  it("rolls a daily reminder to the next day after the scheduled time passes", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-05T22:15:00.000Z"));

    const schedules = buildManagedReminderEmailSchedules(
      [
        {
          kind: "daily_log",
          title: "Ovumcy reminder",
          body: "Open Ovumcy to update today's entry.",
          trigger: {
            type: "daily",
            hour: 21,
            minute: 30,
          },
        },
      ],
      "it",
      "UTC",
    );

    expect(schedules).toEqual([
      {
        kind: "daily_log",
        scheduleType: "daily",
        locale: "en",
        timeZone: "UTC",
        dailyHour: 21,
        dailyMinute: 30,
        nextDeliveryAt: "2026-04-06T21:30:00.000Z",
      },
    ]);
  });
});
