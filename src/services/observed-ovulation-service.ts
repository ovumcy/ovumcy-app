import type { DayCycleFactorKey, DayLogRecord } from "../models/day-log";
import type { LocalDateISO } from "../models/profile";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";

// "3-over-6" coverline rule ported from ovumcy-web
// (internal/services/cycle_signals.go): the sliding coverline is the MAX of the
// 6 immediately preceding undisturbed recorded temperatures; a shift is 3
// calendar-consecutive recorded days, the first two strictly above the
// coverline and the third at least the third-day margin above it. Max, not
// mean, so ordinary follicular noise cannot slip past. See
// docs/cycle-prediction.md.
const BBT_COVERLINE_WINDOW = 6;
const BBT_ELEVATED_STREAK_DAYS = 3;
const BBT_THIRD_DAY_MARGIN_CELSIUS = 0.2;

// Cycle factors that distort basal temperature independently of ovulation and
// remove a day from the detection series entirely: a fever or short-sleep
// reading must neither inflate the coverline (masking a real shift) nor confirm
// an elevated streak (faking one). This is the only case where daily cycle
// factors influence a computation.
const BBT_DISTURBANCE_FACTORS: readonly DayCycleFactorKey[] = [
  "illness",
  "sleep_disruption",
];

export type SustainedThermalShift = {
  // First elevated cycle day of the sustained shift (the streak start), i.e. the
  // thermal-shift day. inferBBTOvulationDate subtracts one day from this to
  // estimate ovulation (temperature rises the day after ovulation).
  shiftStartDate: LocalDateISO;
  // Sliding coverline in effect for the detected shift: the MAX of the 6
  // immediately preceding undisturbed recorded temperatures (Celsius).
  coverline: number;
  // Average rise of the 3-day elevated streak above the coverline (Celsius).
  rise: number;
  // Total undisturbed in-cycle BBT points considered.
  sampleCount: number;
};

type BBTPoint = { date: LocalDateISO; bbt: number };

function isBBTDisturbed(record: DayLogRecord): boolean {
  return record.cycleFactorKeys.some((key) =>
    BBT_DISTURBANCE_FACTORS.includes(key),
  );
}

// Detection series: one undisturbed reading per calendar day within the cycle,
// excluding illness / sleep_disruption days entirely. The latest same-day
// reading wins (matching the chart series). cycleEndDate is exclusive; omit it
// for the open-ended current, in-progress cycle.
function collectCycleBBTPoints(
  records: readonly DayLogRecord[],
  cycleStartDate: LocalDateISO,
  cycleEndDate?: LocalDateISO,
): BBTPoint[] {
  const bbtByDay = new Map<LocalDateISO, number>();
  const sorted = [...records].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  for (const record of sorted) {
    if (
      record.bbt <= 0 ||
      record.date < cycleStartDate ||
      (cycleEndDate !== undefined && record.date >= cycleEndDate) ||
      isBBTDisturbed(record)
    ) {
      continue;
    }
    bbtByDay.set(record.date, record.bbt);
  }
  return [...bbtByDay.entries()]
    .map(([date, bbt]) => ({ date, bbt }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function calendarDaysApart(from: LocalDateISO, to: LocalDateISO): number {
  const start = parseLocalDate(from);
  const end = parseLocalDate(to);
  if (!start || !end) {
    return 0;
  }
  return Math.round(
    (Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) -
      Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
      86400000,
  );
}

// Canonical "3-over-6" thermal-shift detector — the single source of truth for
// the calendar's observed-ovulation marker (via inferBBTOvulationDate), the
// premium advanced-fertility thermal-shift panel, and the doctor PDF. Returns
// the first elevated cycle day and the coverline in effect; ovulation itself is
// the day before (inferBBTOvulationDate).
//
// The first candidate first-elevated day is the 7th recorded day: a full
// 6-value coverline window must precede it, and a 3-day elevated streak must
// follow, so at least 9 undisturbed recorded days are required for any shift.
export function detectSustainedThermalShift(
  records: readonly DayLogRecord[],
  cycleStartDate: LocalDateISO,
  cycleEndDate?: LocalDateISO,
): SustainedThermalShift | null {
  const points = collectCycleBBTPoints(records, cycleStartDate, cycleEndDate);

  for (
    let index = BBT_COVERLINE_WINDOW;
    index + BBT_ELEVATED_STREAK_DAYS - 1 < points.length;
    index += 1
  ) {
    const dayOne = points[index];
    const dayTwo = points[index + 1];
    const dayThree = points[index + 2];
    /* istanbul ignore next -- unreachable: the loop bound guarantees index+2 is
       an in-range index of the dense points array, so all three are defined;
       the guard exists only to satisfy noUncheckedIndexedAccess. */
    if (!dayOne || !dayTwo || !dayThree) {
      continue;
    }

    // The elevated streak must fall on strictly consecutive calendar days, so
    // sparse logging cannot fabricate a shift from an isolated spike.
    if (
      calendarDaysApart(dayOne.date, dayTwo.date) !== 1 ||
      calendarDaysApart(dayTwo.date, dayThree.date) !== 1
    ) {
      continue;
    }

    // Sliding coverline = MAX of the 6 immediately preceding recorded temps.
    /* istanbul ignore next -- the ?./?? fallbacks are unreachable: index >=
       BBT_COVERLINE_WINDOW keeps this index in range of the dense array and
       collectCycleBBTPoints only admits bbt > 0, so neither the optional chain
       nor the ?? 0 ever fires; both are compiler-only (noUncheckedIndexedAccess). */
    let coverline = points[index - BBT_COVERLINE_WINDOW]?.bbt ?? 0;
    for (
      let windowIndex = index - BBT_COVERLINE_WINDOW + 1;
      windowIndex < index;
      windowIndex += 1
    ) {
      /* istanbul ignore next -- windowIndex stays within [index-5, index-1],
         all in-range indices of the dense array whose bbt is > 0, so the ?./??
         fallbacks never fire (compiler-only, noUncheckedIndexedAccess). */
      const value = points[windowIndex]?.bbt ?? 0;
      if (value > coverline) {
        coverline = value;
      }
    }

    // First two elevated days strictly above the coverline; the third at least
    // the third-day margin above it.
    if (dayOne.bbt <= coverline || dayTwo.bbt <= coverline) {
      continue;
    }
    if (dayThree.bbt < coverline + BBT_THIRD_DAY_MARGIN_CELSIUS) {
      continue;
    }

    const streakAverage =
      (dayOne.bbt + dayTwo.bbt + dayThree.bbt) / BBT_ELEVATED_STREAK_DAYS;
    return {
      shiftStartDate: dayOne.date,
      coverline,
      rise: streakAverage - coverline,
      sampleCount: points.length,
    };
  }

  return null;
}

export function inferBBTOvulationDate(
  records: readonly DayLogRecord[],
  cycleStartDate: LocalDateISO,
  cycleEndDate: LocalDateISO,
): LocalDateISO | null {
  const shift = detectSustainedThermalShift(
    records,
    cycleStartDate,
    cycleEndDate,
  );
  if (!shift) {
    return null;
  }

  // Ovulation precedes the sustained thermal shift: basal temperature rises the
  // day after ovulation, so the estimate is the calendar day before the first
  // elevated day. The detector requires a full 6-value coverline window, so the
  // first elevated day is always well after the cycle start and this stays
  // inside the cycle.
  const shiftStart = parseLocalDate(shift.shiftStartDate);
  /* istanbul ignore next -- unreachable: detectSustainedThermalShift only
     returns a shift once calendarDaysApart(shiftStartDate, …) === 1, which is
     impossible unless shiftStartDate parses; kept as a defensive fallback. */
  if (!shiftStart) {
    return shift.shiftStartDate;
  }
  return formatLocalDate(addDays(shiftStart, -1));
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

  const lastEggWhite = eggwhite[eggwhite.length - 1]?.date ?? null;
  if (!lastEggWhite) {
    return null;
  }

  // Peak-day rule ported from ovumcy-web (inferEggWhiteOvulationDate): the last
  // fertile-quality (egg-white) day is the peak signal and ovulation most
  // commonly follows it by about a day. Estimate ovulation as the day after the
  // peak, clamped to stay before the next cycle start (a peak on the final
  // cycle day keeps the peak day itself).
  const parsed = parseLocalDate(lastEggWhite);
  if (!parsed) {
    return lastEggWhite;
  }
  const estimated = formatLocalDate(addDays(parsed, 1));
  if (estimated >= cycleEndDate) {
    return lastEggWhite;
  }
  return estimated;
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
