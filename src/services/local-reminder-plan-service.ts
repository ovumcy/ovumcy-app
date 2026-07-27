import type { DayLogRecord } from "../models/day-log";
import {
  DEFAULT_REMINDER_LEAD_DAYS,
  DEFAULT_REMINDER_TIME,
  type ProfileRecord,
} from "../models/profile";
import { KICK_COUNTS_START_WEEK, type PregnancyRecord } from "../models/pregnancy";
import { getReminderCopy } from "../i18n/reminder-copy";
import {
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
} from "./cycle-history-service";
import { predictCycleWindow } from "./cycle-prediction-policy";
import { calcGestationalAge } from "./pregnancy-timeline-service";
import {
  addDays,
  clampReminderLeadDays,
  formatLocalDate,
  normalizeReminderTime,
  parseLocalDate,
} from "./profile-settings-policy";

export type LocalReminderKind =
  | "daily_log"
  | "upcoming_period"
  | "fertile_window"
  | "kick_count";

export type LocalReminderPlan =
  | {
      kind: LocalReminderKind;
      title: string;
      body: string;
      // Resolved IANA time zone the reminder's local day is anchored to. Both
      // the device push trigger and the managed email schedule must read this
      // single value so the two channels never resolve to different local days.
      timeZone?: string;
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
      timeZone?: string;
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
  timeZone?: string,
  // Optional and defaulted to null so every pre-existing call site (which
  // knows nothing about pregnancy state) keeps compiling and behaving
  // identically -- omitting it simply means no kick_count plan is ever
  // produced, the same as before this parameter existed.
  activePregnancy: PregnancyRecord | null = null,
): LocalReminderPlan[] {
  // One resolved zone, stamped on every plan and used to turn calendar days
  // into concrete instants. Defaults to the device zone so the non-managed
  // (push-only) path keeps its previous device-local behavior unchanged.
  const resolvedTimeZone = resolveReminderTimeZone(timeZone);
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
      timeZone: resolvedTimeZone,
      trigger: {
        type: "daily",
        hour,
        minute,
      },
    });
  }

  // Kick-count reminder: gated purely by pregnancy state (an active
  // record at/after KICK_COUNTS_START_WEEK), never by cycle
  // predictability/pause -- evaluated before the unpredictableCycle early
  // return below, which only concerns period/fertile-window predictions.
  // Notification copy deliberately reuses the existing generic daily_log
  // title/body: no "kick" or "pregnancy" wording reaches the notification,
  // matching the privacy posture of every other local reminder kind.
  if (
    profile.kickCountReminderEnabled === true &&
    activePregnancy &&
    activePregnancy.status === "active"
  ) {
    const gestationalAge = calcGestationalAge(
      activePregnancy.edd,
      formatLocalDate(now),
    );
    if (gestationalAge && gestationalAge.weeks >= KICK_COUNTS_START_WEEK) {
      plans.push({
        kind: "kick_count",
        title: copy.notificationTitle,
        body: copy.dailyLogBody,
        timeZone: resolvedTimeZone,
        trigger: {
          type: "daily",
          hour,
          minute,
        },
      });
    }
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
  // An ACTIVE pregnancy record suppresses them independently of that pause, so
  // the two signals are ORed: a period logged mid-pregnancy lifts the day-log
  // pause (resolvePregnancyPause, untouched) and an LMP/ultrasound-dated
  // pregnancy never sets it at all. Status is checked so an ENDED record
  // correctly resumes predictions.
  if (projection.isPregnancyPaused || activePregnancy?.status === "active") {
    return plans;
  }

  if (profile.upcomingPeriodReminderEnabled === true) {
    const targetDate =
      projection.nextPeriodWindowStartDate ?? projection.nextPeriodDate;
    // The owner's lead-days preference (web parity: reminder_lead_days) sets
    // how far ahead of the predicted period window the reminder fires; 0
    // means on the day itself. Re-clamped here defensively in case a value
    // reaches the profile through a path that skipped the settings sanitize.
    const triggerAt = resolveUpcomingTriggerDate(
      targetDate,
      clampReminderLeadDays(profile.reminderLeadDays ?? DEFAULT_REMINDER_LEAD_DAYS),
      now,
      hour,
      minute,
      resolvedTimeZone,
    );
    if (triggerAt) {
      plans.push({
        kind: "upcoming_period",
        title: copy.notificationTitle,
        body: copy.cycleBody,
        timeZone: resolvedTimeZone,
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
    // Deliberately NOT governed by reminderLeadDays: web's ovulation lead
    // anchors on the ovulation date, while this reminder anchors on the
    // fertile-window START, which already precedes ovulation by several
    // days — applying the shared lead here would double-count the head
    // start. A fixed 1-day heads-up before the window keeps prior behavior.
    const triggerAt = resolveUpcomingTriggerDate(
      window.fertilityStart,
      1,
      now,
      hour,
      minute,
      resolvedTimeZone,
    );
    if (window.calculable && triggerAt) {
      plans.push({
        kind: "fertile_window",
        title: copy.notificationTitle,
        body: copy.cycleBody,
        timeZone: resolvedTimeZone,
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
  timeZone: string,
): Date | null {
  if (!targetDateValue) {
    return null;
  }

  const targetDate = parseLocalDate(targetDateValue);
  if (!targetDate) {
    return null;
  }

  // "Today" is the calendar day in the reminder's resolved zone — not the
  // device zone — so the lead-day floor matches the day the email channel
  // delivers on when the two zones differ.
  const today = zonedCalendarDay(now, timeZone);
  const candidateDate = addDays(targetDate, -leadDays);
  const baseDate = candidateDate < today ? today : candidateDate;
  let triggerAt = atZonedTime(baseDate, hour, minute, timeZone);
  if (triggerAt <= now) {
    triggerAt = atZonedTime(addDays(baseDate, 1), hour, minute, timeZone);
  }

  const lastAllowed = atZonedTime(targetDate, 23, 59, timeZone);
  return triggerAt <= lastAllowed ? triggerAt : null;
}

// Resolve the requested zone, falling back to the device zone and finally UTC.
// Kept identical in spirit to the email service's resolver so a plan built
// without an explicit zone lands on the same value the email path would pick.
export function resolveReminderTimeZone(timeZone: string | undefined): string {
  const normalized = String(timeZone ?? "").trim();
  if (normalized.length > 0) {
    return normalized;
  }

  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return resolved?.trim() ? resolved : "UTC";
  } catch {
    return "UTC";
  }
}

// The calendar day (as a device-local Date carrying y/m/d) that `instant`
// falls on when viewed in `timeZone`.
function zonedCalendarDay(instant: Date, timeZone: string): Date {
  const parts = zonedParts(instant, timeZone);
  return new Date(parts.year, parts.month - 1, parts.day);
}

// Turn a (calendar day, wall-clock hour:minute) in `timeZone` into the UTC
// instant it denotes. When `timeZone` equals the device zone this returns the
// same instant as `new Date(y, m, d, hour, minute)`, preserving prior behavior.
function atZonedTime(
  value: Date,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  return zonedWallTimeToUTC(
    timeZone,
    value.getFullYear(),
    value.getMonth() + 1,
    value.getDate(),
    hour,
    minute,
  );
}

export function zonedWallTimeToUTC(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const approximate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const zoned = zonedParts(approximate, timeZone);
  const zonedAsUTC = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second,
    0,
  );
  const targetAsUTC = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  return new Date(approximate.getTime() - (zonedAsUTC - targetAsUTC));
}

function zonedParts(
  instant: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const pick = (type: string, fallback: number) =>
    Number(parts.find((part) => part.type === type)?.value ?? fallback);
  return {
    year: pick("year", 0),
    month: pick("month", 1),
    day: pick("day", 1),
    // Intl renders midnight as "24" in some zones/runtimes; normalize to 0.
    hour: pick("hour", 0) % 24,
    minute: pick("minute", 0),
    second: pick("second", 0),
  };
}
