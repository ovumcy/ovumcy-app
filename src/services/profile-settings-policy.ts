import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  DEFAULT_TEMPERATURE_UNIT,
  MAX_CYCLE_LENGTH,
  MAX_PERIOD_LENGTH,
  MIN_CYCLE_LENGTH,
  MIN_CYCLE_RESERVE_DAYS,
  MIN_PERIOD_LENGTH,
  type AgeGroup,
  type AgeGroupOption,
  type CycleSettingsValues,
  type LocalDateISO,
  type TemperatureUnit,
  type TrackingSettingsValues,
  type UsageGoal,
} from "../models/profile";

export type CycleGuidanceState = {
  invalid: boolean;
  warning: boolean;
  adjusted: boolean;
  periodLength: number;
  periodLong: boolean;
  cycleShort: boolean;
};

export type SettingsDateBounds = {
  minDate: LocalDateISO;
  maxDate: LocalDateISO;
};

export function normalizeAgeGroup(value: string): AgeGroup {
  switch (value.trim().toLowerCase()) {
    case "under_20":
      return "under_20";
    case "age_20_35":
      return "age_20_35";
    case "age_35_plus":
      return "age_35_plus";
    default:
      return "";
  }
}

export function normalizeUsageGoal(value: string): UsageGoal {
  switch (value.trim().toLowerCase()) {
    case "avoid_pregnancy":
      return "avoid_pregnancy";
    case "trying_to_conceive":
      return "trying_to_conceive";
    default:
      return "health";
  }
}

export function normalizeTemperatureUnit(value: string): TemperatureUnit {
  return value.trim().toLowerCase() === "f" ? "f" : DEFAULT_TEMPERATURE_UNIT;
}

export function resolveDisplayedAgeGroup(ageGroup: AgeGroup): AgeGroupOption {
  return normalizeAgeGroup(ageGroup) || "age_20_35";
}

export function clampCycleLength(value: number): number {
  return clampInteger(value, DEFAULT_CYCLE_LENGTH, MIN_CYCLE_LENGTH, MAX_CYCLE_LENGTH);
}

export function clampPeriodLength(value: number): number {
  return clampInteger(value, DEFAULT_PERIOD_LENGTH, MIN_PERIOD_LENGTH, MAX_PERIOD_LENGTH);
}

export function maxPeriodLengthForCycle(cycleLength: number): number {
  const safeCycleLength = clampCycleLength(cycleLength);
  const maxAllowed = safeCycleLength - MIN_CYCLE_RESERVE_DAYS;

  if (maxAllowed < MIN_PERIOD_LENGTH) {
    return MIN_PERIOD_LENGTH;
  }
  if (maxAllowed > MAX_PERIOD_LENGTH) {
    return MAX_PERIOD_LENGTH;
  }

  return maxAllowed;
}

export function isCompatibleCycleAndPeriod(
  cycleLength: number,
  periodLength: number,
): boolean {
  return clampPeriodLength(periodLength) <= maxPeriodLengthForCycle(cycleLength);
}

export function sanitizeCycleSettingsValues(
  values: CycleSettingsValues,
): CycleSettingsValues {
  const cycleLength = clampCycleLength(values.cycleLength);
  const periodLength = Math.min(
    clampPeriodLength(values.periodLength),
    maxPeriodLengthForCycle(cycleLength),
  );

  return {
    ...values,
    cycleLength,
    periodLength,
    autoPeriodFill: values.autoPeriodFill,
    irregularCycle: values.irregularCycle,
    unpredictableCycle: values.unpredictableCycle,
    ageGroup: normalizeAgeGroup(values.ageGroup),
    usageGoal: normalizeUsageGoal(values.usageGoal),
    lastPeriodStart: values.lastPeriodStart,
  };
}

export function sanitizeTrackingSettingsValues(
  values: TrackingSettingsValues,
): TrackingSettingsValues {
  return {
    trackBBT: values.trackBBT,
    temperatureUnit: normalizeTemperatureUnit(values.temperatureUnit),
    trackCervicalMucus: values.trackCervicalMucus,
    hideSexChip: values.hideSexChip,
  };
}

export function resolveCycleAndPeriodDefaults(
  cycleLength: number,
  periodLength: number,
): Pick<CycleSettingsValues, "cycleLength" | "periodLength"> {
  const resolvedCycleLength = Number.isFinite(cycleLength)
    ? clampCycleLength(cycleLength)
    : DEFAULT_CYCLE_LENGTH;
  const resolvedPeriodLength = Number.isFinite(periodLength)
    ? clampPeriodLength(periodLength)
    : DEFAULT_PERIOD_LENGTH;

  return {
    cycleLength: resolvedCycleLength,
    periodLength: resolvedPeriodLength,
  };
}

export function buildCycleGuidanceState(
  cycleLength: number,
  periodLength: number,
): CycleGuidanceState {
  const safeCycleLength = clampCycleLength(cycleLength);
  const safePeriodLength = clampPeriodLength(periodLength);
  const maxAllowedPeriodLength = maxPeriodLengthForCycle(safeCycleLength);
  const adjustedPeriodLength = Math.min(safePeriodLength, maxAllowedPeriodLength);

  return {
    invalid: false,
    warning: false,
    adjusted: adjustedPeriodLength !== safePeriodLength,
    periodLength: adjustedPeriodLength,
    periodLong: adjustedPeriodLength > 8,
    cycleShort: safeCycleLength < 24,
  };
}

export function getSettingsCycleStartDateBounds(now: Date): SettingsDateBounds {
  const today = atLocalDay(now);
  const minDate = new Date(today.getFullYear(), 0, 1);

  return {
    minDate: formatLocalDate(minDate),
    maxDate: formatLocalDate(today),
  };
}

export function parseLocalDate(value: string): Date | null {
  const normalized = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function formatLocalDate(value: Date): LocalDateISO {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return atLocalDay(next);
}

function clampInteger(
  value: number,
  fallback: number,
  minValue: number,
  maxValue: number,
): number {
  const numeric = Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(minValue, Math.min(maxValue, numeric));
}

function atLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
