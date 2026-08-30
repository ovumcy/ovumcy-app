import {
  MIN_CYCLE_LENGTH,
  type LocalDateISO,
} from "../models/profile";
import {
  addDays,
  formatLocalDate,
  parseLocalDate,
} from "./profile-settings-policy";

export const DEFAULT_LUTEAL_PHASE_DAYS = 14;
const MIN_LUTEAL_PHASE_DAYS = 10;
const MIN_OVULATION_CYCLE_DAY = 5;

export type PredictedCycleWindow = {
  calculable: boolean;
  fertilityEnd: LocalDateISO | null;
  fertilityStart: LocalDateISO | null;
  isExact: boolean;
  ovulationDate: LocalDateISO | null;
};

export function resolveLutealPhase(value: number): number {
  if (value <= 0) {
    return DEFAULT_LUTEAL_PHASE_DAYS;
  }

  return Math.max(value, MIN_LUTEAL_PHASE_DAYS);
}

/**
 * Returns the one-based ovulation day within the cycle, where the cycle start
 * is cycle day 1. A 28-day cycle with a 14-day luteal phase ovulates on cycle
 * day 14.
 *
 * The luteal phase this consumes is the count of days that FOLLOW ovulation —
 * cycle days 15 through 28 in that example — and NOT the calendar span from the
 * ovulation date to the next period start, which counts the ovulation day
 * itself and is one day longer. `calcLutealPhase` is the inverse under exactly
 * that reading; the two directions have to move together, or an ovulation
 * observed on a cycle day trains a value that predicts the day before it.
 */
export function calcOvulationDay(
  cycleLength: number,
  lutealPhase = DEFAULT_LUTEAL_PHASE_DAYS,
): { day: number | null; isExact: boolean } {
  if (cycleLength < MIN_CYCLE_LENGTH) {
    return { day: null, isExact: false };
  }

  let resolvedLutealPhase = resolveLutealPhase(lutealPhase);
  let isExact = true;
  const maxSupportedLutealPhase = cycleLength - MIN_OVULATION_CYCLE_DAY;

  if (maxSupportedLutealPhase < MIN_LUTEAL_PHASE_DAYS) {
    return { day: null, isExact: false };
  }

  if (resolvedLutealPhase > maxSupportedLutealPhase) {
    resolvedLutealPhase = maxSupportedLutealPhase;
    isExact = false;
  }

  const ovulationDay = cycleLength - resolvedLutealPhase;
  if (ovulationDay < MIN_OVULATION_CYCLE_DAY) {
    return { day: null, isExact: false };
  }

  return {
    day: ovulationDay,
    isExact,
  };
}

/**
 * Inverse of `calcOvulationDay`'s arithmetic: given a cycle length and the
 * one-based cycle day an ovulation was OBSERVED on, returns the luteal-phase
 * parameter that makes `calcOvulationDay` reproduce that same cycle day. It is
 * the single place the observed→parameter direction is spelled out, so the
 * personalized path cannot drift away from the predicting one.
 *
 * The round trip is exact while the result stays inside the range
 * `calcOvulationDay` supports; below `MIN_LUTEAL_PHASE_DAYS`, or above the
 * cycle reserve, that function clamps and reports `isExact: false`, which is
 * the designed signal rather than a failure of this inverse.
 * `inferUserLutealPhase` filters its samples to the plausible window before any
 * of them reaches a prediction.
 *
 * Regression: cycle-luteal-round-trip.test.ts — its "round-trips through
 * prediction" cases and the projection case below them. NOT the "Step 2a
 * reference vectors" cases in cycle-prediction-policy.test.ts: those mirror the
 * doc's table over this function and `calcOvulationDay`, both of which stay
 * correct when the span reading returns, because the drift lives in the step
 * that derives this argument from logged signals.
 */
export function calcLutealPhase(
  cycleLength: number,
  ovulationDay: number,
): number {
  return cycleLength - ovulationDay;
}

export function predictCycleWindow(
  cycleStartDate: string,
  cycleLength: number,
  lutealPhase = DEFAULT_LUTEAL_PHASE_DAYS,
): PredictedCycleWindow {
  const cycleStart = parseLocalDate(cycleStartDate);
  if (!cycleStart || cycleLength <= 0) {
    return emptyPredictedCycleWindow();
  }

  const { day: ovulationDay, isExact } = calcOvulationDay(cycleLength, lutealPhase);
  if (!ovulationDay) {
    return emptyPredictedCycleWindow();
  }

  const nextPeriodStart = addDays(cycleStart, cycleLength);
  const ovulationDate = addDays(cycleStart, ovulationDay - 1);
  if (ovulationDate >= nextPeriodStart) {
    return emptyPredictedCycleWindow();
  }

  const fertilityStart = addDays(ovulationDate, -5);
  const clampedFertilityStart =
    fertilityStart < cycleStart ? cycleStart : fertilityStart;

  return {
    calculable: true,
    fertilityEnd: formatLocalDate(ovulationDate),
    fertilityStart: formatLocalDate(clampedFertilityStart),
    isExact,
    ovulationDate: formatLocalDate(ovulationDate),
  };
}

function emptyPredictedCycleWindow(): PredictedCycleWindow {
  return {
    calculable: false,
    fertilityEnd: null,
    fertilityStart: null,
    isExact: false,
    ovulationDate: null,
  };
}
