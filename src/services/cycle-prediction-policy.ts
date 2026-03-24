import {
  MIN_CYCLE_LENGTH,
  type LocalDateISO,
} from "../models/profile";
import {
  addDays,
  formatLocalDate,
  parseLocalDate,
} from "./profile-settings-policy";

const DEFAULT_LUTEAL_PHASE_DAYS = 14;
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
