import type { DayLogRecord } from "../models/day-log";
import { DEFAULT_REMINDER_TIME, type ProfileRecord } from "../models/profile";
import { getReminderCopy } from "../i18n/reminder-copy";
import {
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
} from "./cycle-history-service";
import { predictCycleWindow } from "./cycle-prediction-policy";
import {
  addDays,
  normalizeReminderTime,
  parseLocalDate,
} from "./profile-settings-policy";

export type LocalReminderKind =
  | "daily_log"
  | "upcoming_period"
  | "fertile_window";

export type LocalReminderPlan =
  | {
      kind: LocalReminderKind;
      title: string;
      body: string;
      trigger: {
        type: "daily";
        hour: number;
        minute: number;
      };
    }
  | {
      kind: LocalReminderKind;
      title: string;
      body: string;
      trigger: {
        type: "once";
        at: Date;
      };
    };

export function buildLocalReminderPlans(
  profile: ProfileRecord,
  records: readonly DayLogRecord[],
  now: Date,
  locale = "en",
): LocalReminderPlan[] {
  const reminderTime = normalizeReminderTime(
    profile.reminderTime ?? DEFAULT_REMINDER_TIME,
  );
  const [parsedHour, parsedMinute] = reminderTime
    .split(":")
    .map((value) => Number(value));
  const hour =
    typeof parsedHour === "number" && Number.isInteger(parsedHour)
      ? parsedHour
      : 20;
  const minute =
    typeof parsedMinute === "number" && Number.isInteger(parsedMinute)
      ? parsedMinute
      : 0;
  const copy = getReminderCopy(locale);
  const plans: LocalReminderPlan[] = [];

  if (profile.dailyLogReminderEnabled === true) {
    plans.push({
      kind: "daily_log",
      title: copy.notificationTitle,
      body: copy.dailyLogBody,
      trigger: {
        type: "daily",
        hour,
        minute,
      },
    });
  }

  if (profile.unpredictableCycle) {
    return plans;
  }

  const mutableRecords = [...records];
  const history = buildCycleHistorySummary(profile, mutableRecords, now);
  const projection = buildCurrentCycleProjection(profile, history, mutableRecords, now);

  // After a positive pregnancy test (with no later period), cycle predictions
  // are paused — the calendar already hides predicted period/fertile cells, so
  // the matching reminders must stay silent too. The upcoming-period reminder
  // is suppressed implicitly (null next-period dates), but the fertile-window
  // reminder recomputes its window from the still-set cycle anchor, so it would
  // otherwise fire at a pregnant user. Suppress both here.
  if (projection.isPregnancyPaused) {
    return plans;
  }

  if (profile.upcomingPeriodReminderEnabled === true) {
    const targetDate =
      projection.nextPeriodWindowStartDate ?? projection.nextPeriodDate;
    const triggerAt = resolveUpcomingTriggerDate(targetDate, 3, now, hour, minute);
    if (triggerAt) {
      plans.push({
        kind: "upcoming_period",
        title: copy.notificationTitle,
        body: copy.cycleBody,
        trigger: {
          type: "once",
          at: triggerAt,
        },
      });
    }
  }

  if (
    profile.fertileWindowReminderEnabled === true &&
    projection.cycleAnchorDate
  ) {
    const window = predictCycleWindow(
      projection.cycleAnchorDate,
      projection.predictionCycleLength,
      projection.lutealPhase,
    );
    const triggerAt = resolveUpcomingTriggerDate(
      window.fertilityStart,
      1,
      now,
      hour,
      minute,
    );
    if (window.calculable && triggerAt) {
      plans.push({
        kind: "fertile_window",
        title: copy.notificationTitle,
        body: copy.cycleBody,
        trigger: {
          type: "once",
          at: triggerAt,
        },
      });
    }
  }

  return plans;
}

function resolveUpcomingTriggerDate(
  targetDateValue: string | null | undefined,
  leadDays: number,
  now: Date,
  hour: number,
  minute: number,
): Date | null {
  if (!targetDateValue) {
    return null;
  }

  const targetDate = parseLocalDate(targetDateValue);
  if (!targetDate) {
    return null;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const candidateDate = addDays(targetDate, -leadDays);
  const baseDate = candidateDate < today ? today : candidateDate;
  let triggerAt = atLocalTime(baseDate, hour, minute);
  if (triggerAt <= now) {
    triggerAt = atLocalTime(addDays(baseDate, 1), hour, minute);
  }

  const lastAllowed = atLocalTime(targetDate, 23, 59);
  return triggerAt <= lastAllowed ? triggerAt : null;
}

function atLocalTime(value: Date, hour: number, minute: number): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    hour,
    minute,
    0,
    0,
  );
}
