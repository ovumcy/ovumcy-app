import type { DayLogRecord } from "../models/day-log";
import type { LocalDateISO } from "../models/profile";
import { diffLocalDays } from "./profile-settings-policy";

const MIN_BBT_POINTS_FOR_OVULATION = 5;
const BBT_BASELINE_WINDOW = 5;
const BBT_SHIFT_STREAK_LENGTH = 3;
const BBT_SHIFT_THRESHOLD_CELSIUS = 0.2;

export type SustainedThermalShift = {
  // First day of the sustained shift (streak start), i.e. the observed
  // ovulation/thermal-shift day. Same anchor inferBBTOvulationDate returns.
  shiftStartDate: LocalDateISO;
  // Average rise of the 3-day sustained streak above the first-5-day baseline.
  rise: number;
  // Total in-cycle BBT points considered (>= MIN_BBT_POINTS_FOR_OVULATION).
  sampleCount: number;
};

// Canonical thermal-shift detector: first-5-day baseline + 0.2C threshold +
// 3-day sustained streak. The shift day is the streak start. This is the single
// source of truth for both the calendar's observed-ovulation marker
// (inferBBTOvulationDate) and the advanced-fertility thermal-shift panel.
//
// The 3-day streak must fall on strictly consecutive calendar days: a point
// continues the streak only when it is exactly 1 day after the previous logged
// point, so sparse logging cannot fabricate a shift from an isolated spike.
//
// cycleEndDate is optional and exclusive: when omitted the window is
// open-ended (used by the current, in-progress cycle which has no next start).
export function detectSustainedThermalShift(
  records: readonly DayLogRecord[],
  cycleStartDate: LocalDateISO,
  cycleEndDate?: LocalDateISO,
): SustainedThermalShift | null {
  const points = records
    .filter(
      (record) =>
        record.bbt > 0 &&
        record.date >= cycleStartDate &&
        (cycleEndDate === undefined || record.date < cycleEndDate),
    )
    .sort((left, right) => left.date.localeCompare(right.date));

  if (points.length < MIN_BBT_POINTS_FOR_OVULATION) {
    return null;
  }

  const baselineTotal = points
    .slice(0, BBT_BASELINE_WINDOW)
    .reduce((sum, point) => sum + point.bbt, 0);
  const baseline = baselineTotal / BBT_BASELINE_WINDOW;
  const threshold = baseline + BBT_SHIFT_THRESHOLD_CELSIUS;

  let streak = 0;
  for (let index = BBT_BASELINE_WINDOW; index < points.length; index += 1) {
    const point = points[index];
    if (!point) {
      continue;
    }
    if (point.bbt >= threshold) {
      const previous = points[index - 1];
      const isAdjacent =
        previous !== undefined &&
        diffLocalDays(previous.date, point.date) === 1;
      streak = isAdjacent ? streak + 1 : 1;
    } else {
      streak = 0;
    }
    if (streak >= BBT_SHIFT_STREAK_LENGTH) {
      const shiftStart = points[index - 2];
      if (!shiftStart) {
        return null;
      }
      const streakPoints = points.slice(
        index - 2,
        index + 1,
      );
      const streakAverage =
        streakPoints.reduce((sum, streakPoint) => sum + streakPoint.bbt, 0) /
        streakPoints.length;
      return {
        shiftStartDate: shiftStart.date,
        rise: streakAverage - baseline,
        sampleCount: points.length,
      };
    }
  }

  return null;
}

export function inferBBTOvulationDate(
  records: readonly DayLogRecord[],
  cycleStartDate: LocalDateISO,
  cycleEndDate: LocalDateISO,
): LocalDateISO | null {
  return (
    detectSustainedThermalShift(records, cycleStartDate, cycleEndDate)
      ?.shiftStartDate ?? null
  );
}

export function inferEggWhiteOvulationDate(
  records: readonly DayLogRecord[],
  cycleStartDate: LocalDateISO,
  cycleEndDate: LocalDateISO,
): LocalDateISO | null {
  const eggwhite = records
    .filter(
      (record) =>
        record.cervicalMucus === "eggwhite" &&
        record.date >= cycleStartDate &&
        record.date < cycleEndDate,
    )
    .sort((left, right) => left.date.localeCompare(right.date));

  return eggwhite[eggwhite.length - 1]?.date ?? null;
}

export function inferObservedOvulationDate(
  records: readonly DayLogRecord[],
  cycleStartDate: LocalDateISO,
  cycleEndDate: LocalDateISO,
): LocalDateISO | null {
  const bbtDate = inferBBTOvulationDate(records, cycleStartDate, cycleEndDate);
  if (bbtDate) {
    return bbtDate;
  }
  return inferEggWhiteOvulationDate(records, cycleStartDate, cycleEndDate);
}
