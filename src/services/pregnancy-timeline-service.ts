import {
  BIRTH_OPTION_MIN_WEEK,
  GESTATION_DAYS,
  KICK_COUNTS_START_WEEK,
  TRIMESTER_1_MAX_WEEK,
  TRIMESTER_2_MAX_WEEK,
  type PregnancySchedulePreset,
} from "../models/pregnancy";
import type { LocalDateISO } from "../models/profile";
import { addDays, diffLocalDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";

// This engine reads ONLY the pregnancy record's own `edd` (estimated due
// date) passed in by the caller. It must never read or react to
// `profile.lastPeriodStart`: per ACOG Committee Opinion 700, the EDD is
// fixed once established (by LMP, ultrasound, or ART) and is not
// recalculated as new cycle data arrives later in the pregnancy.

// Upper bound of a "sane" gestational age. 43 weeks is past the outer limit
// of any recognized post-term definition; beyond it the edd/today pair is
// treated as not representing a current pregnancy rather than extrapolated.
export const MAX_GESTATIONAL_AGE_DAYS = 43 * 7;

export type GestationalAge = {
  gaDays: number;
  weeks: number;
  days: number;
  trimester: 1 | 2 | 3;
};

// Naegele's rule: EDD = LMP + 280 days (40 weeks).
export function calcEddFromLmp(lmp: LocalDateISO): LocalDateISO {
  const parsedLmp = parseLocalDate(lmp);
  if (!parsedLmp) {
    // Malformed input: pass through unchanged rather than fabricate a date
    // from an unparseable string. Callers on the sync-restore/import path
    // validate shape via sanitizePregnancyRecord before this is ever reached;
    // this is a defensive fallback for a directly-called malformed value.
    return lmp;
  }

  return formatLocalDate(addDays(parsedLmp, GESTATION_DAYS));
}

// gaDays = 280 - diffLocalDays(today, edd). diffLocalDays(today, edd) is the
// exact whole-calendar-day count from today to edd (edd - today), computed
// via the DST-safe UTC-anchored calendarDayCount in profile-settings-policy.ts
// -- never a raw getTime()/86400000 subtraction, which would drift by +-1h
// across a spring-forward/fall-back boundary (see that file's calendarDayCount
// comment and profile-settings-date-diff.test.ts). At today === edd this is
// 0, so gaDays = 280 (40 weeks + 0 days, full term on the due date itself).
export function calcGestationalAge(
  edd: LocalDateISO,
  today: LocalDateISO,
): GestationalAge | null {
  if (!parseLocalDate(edd) || !parseLocalDate(today)) {
    return null;
  }

  const gaDays = GESTATION_DAYS - diffLocalDays(today, edd);
  if (gaDays < 0 || gaDays > MAX_GESTATIONAL_AGE_DAYS) {
    return null;
  }

  const weeks = Math.floor(gaDays / 7);
  const days = gaDays % 7;

  return { gaDays, weeks, days, trimester: resolveTrimester(weeks) };
}

// Classifies why calcGestationalAge(edd, today) returned null for this pair.
// The sane 0..43-week window has exactly two ways to miss: `today` has
// drifted more than 3 weeks (MAX_GESTATIONAL_AGE_DAYS - GESTATION_DAYS = 21
// days) past `edd` -- "past_window", a stale/concluded-but-not-marked-ended
// pregnancy -- or every other case: an EDD implausibly far in the future, or
// a date that fails to parse at all -- "future_or_malformed". Only
// meaningful to call after calcGestationalAge has already returned null for
// the same edd/today; undefined relative to a pair it accepts.
export type OutOfWindowReason = "past_window" | "future_or_malformed";

export function resolveOutOfWindowReason(
  edd: LocalDateISO,
  today: LocalDateISO,
): OutOfWindowReason {
  const parsedEdd = parseLocalDate(edd);
  const parsedToday = parseLocalDate(today);
  if (!parsedEdd || !parsedToday) {
    return "future_or_malformed";
  }

  const gaDays = GESTATION_DAYS - diffLocalDays(today, edd);
  return gaDays > MAX_GESTATIONAL_AGE_DAYS ? "past_window" : "future_or_malformed";
}

// Whether the UI should offer "I gave birth" for this edd/today pair (see
// BIRTH_OPTION_MIN_WEEK's own comment in models/pregnancy.ts for the
// loss-taxonomy rationale). A null GA defaults by cause: a past-window record
// (today well past the due date) is almost certainly well beyond
// BIRTH_OPTION_MIN_WEEK, so it stays visible; a future/malformed EDD has no
// plausible birth to record, so it stays hidden. This governs the UI
// offering only -- see endPregnancy in pregnancy-mode-service.ts.
export function resolveBirthOptionVisible(
  edd: LocalDateISO,
  today: LocalDateISO,
): boolean {
  const ga = calcGestationalAge(edd, today);
  if (ga) {
    return ga.weeks >= BIRTH_OPTION_MIN_WEEK;
  }
  return resolveOutOfWindowReason(edd, today) === "past_window";
}

function resolveTrimester(weeks: number): 1 | 2 | 3 {
  if (weeks <= TRIMESTER_1_MAX_WEEK) {
    return 1;
  }
  if (weeks <= TRIMESTER_2_MAX_WEEK) {
    return 2;
  }
  return 3;
}

// Milestone windows are CONTENT anchors (catalog keys pointing at later i18n
// copy, added in a follow-up task) -- not medical verdicts, diagnoses, or
// personalized advice. This engine only reports which window(s) a given
// gestational age falls inside.
export type PregnancyMilestoneID =
  | "nipt"
  | "nt_scan"
  | "anatomy_scan"
  | "gdm_screen"
  | "anti_d"
  | "tdap"
  | "gbs"
  | "kick_counts_start"
  | "birth_prep";

export type PregnancyMilestoneWindow = {
  id: PregnancyMilestoneID;
  fromWeek: number;
  toWeek: number | null;
};

const WHO2016_MILESTONE_WINDOWS: readonly PregnancyMilestoneWindow[] = [
  // Bounded to the early-screening offer window: NIPT is commonly offered
  // from week 10 through roughly the anatomy-scan point, not open-ended --
  // an early-screening card should not still be surfacing at week 38.
  { id: "nipt", fromWeek: 10, toWeek: 22 },
  { id: "nt_scan", fromWeek: 11, toWeek: 14 },
  { id: "anatomy_scan", fromWeek: 18, toWeek: 22 },
  { id: "gdm_screen", fromWeek: 24, toWeek: 28 },
  { id: "anti_d", fromWeek: 28, toWeek: 28 },
  { id: "tdap", fromWeek: 27, toWeek: 36 },
  { id: "gbs", fromWeek: 35, toWeek: 37 },
  // One-week window marking the start only: the standing kick-teaser card
  // (buildPregnancyDashboardViewData's kickTeaser, visible from
  // KICK_COUNTS_START_WEEK onward) already covers every week from here on,
  // so this milestone card would otherwise duplicate it forever.
  { id: "kick_counts_start", fromWeek: KICK_COUNTS_START_WEEK, toWeek: KICK_COUNTS_START_WEEK + 1 },
  // Birth-preparation milestone: education only (signs labor may be
  // starting, the 5-1-1 guideline that lives in the contraction timer, and
  // "when your care team told you to come in") -- never instructions-as-
  // verdicts. Bounded like every other window post-CHANGE-4; closes at week
  // 42 rather than staying open-ended. In practice a record rarely reaches
  // week 43 at all -- MAX_GESTATIONAL_AGE_DAYS (43*7) is the outer edge of
  // calcGestationalAge's sane window, so this window's own close at 42 is
  // moot for all but the single boundary day.
  { id: "birth_prep", fromWeek: 36, toWeek: 42 },
];

// Keyed by the full PregnancySchedulePreset union so adding a preset without
// a matching entry here fails the build, not silently falls back at runtime.
const MILESTONE_WINDOWS_BY_PRESET: Record<
  PregnancySchedulePreset,
  readonly PregnancyMilestoneWindow[]
> = {
  who2016: WHO2016_MILESTONE_WINDOWS,
};

export function resolveMilestoneWindows(
  preset: PregnancySchedulePreset,
): readonly PregnancyMilestoneWindow[] {
  return MILESTONE_WINDOWS_BY_PRESET[preset];
}

// Windows containing gaWeeks, boundaries inclusive on both ends. An
// open-ended window (toWeek === null) matches from fromWeek onward with no
// upper bound.
export function resolveCurrentMilestones(
  preset: PregnancySchedulePreset,
  gaWeeks: number,
): readonly PregnancyMilestoneWindow[] {
  return resolveMilestoneWindows(preset).filter(
    (window) =>
      gaWeeks >= window.fromWeek &&
      (window.toWeek === null || gaWeeks <= window.toWeek),
  );
}
