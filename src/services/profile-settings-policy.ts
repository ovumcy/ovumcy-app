import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  DEFAULT_REMINDER_TIME,
  DEFAULT_TEMPERATURE_UNIT,
  MAX_CYCLE_LENGTH,
  MAX_PERIOD_LENGTH,
  MIN_CYCLE_LENGTH,
  MIN_CYCLE_RESERVE_DAYS,
  MIN_PERIOD_LENGTH,
  type AgeGroup,
  type AgeGroupOption,
  type CycleSettingsValues,
  type InterfaceSettingsValues,
  type LocalDateISO,
  type ReminderSettingsValues,
  type TemperatureUnit,
  type TrackingSettingsValues,
  type UsageGoal,
  normalizeInterfaceLanguage,
  normalizeThemePreference,
} from "../models/profile";

export type CycleGuidanceState = {
  invalid: boolean;
  warning: boolean;
  adjusted: boolean;
  periodLength: number;
  periodLong: boolean;
  cycleLong: boolean;
  cycleShort: boolean;
};

const CYCLE_LENGTH_LONG_WARNING_THRESHOLD = 45;
const CYCLE_LENGTH_SHORT_WARNING_THRESHOLD = 21;

export type SettingsDateBounds = {
  minDate: LocalDateISO;
  maxDate: LocalDateISO;
};

export function normalizeAgeGroup(value: string): AgeGroup {
  switch (value.trim().toLowerCase()) {
    case "under_40":
      return "under_40";
    case "age_40_45":
      return "age_40_45";
    case "age_45_plus":
      return "age_45_plus";
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
  return normalizeAgeGroup(ageGroup) || "under_40";
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
  const periodLength = clampPeriodLength(values.periodLength);

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
    hideNotes: values.hideNotes,
  };
}

export function normalizeReminderTime(value: string): string {
  const normalized = String(value ?? "").trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(normalized);
  if (!match) {
    return DEFAULT_REMINDER_TIME;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return DEFAULT_REMINDER_TIME;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function isValidReminderTime(value: string): boolean {
  return normalizeReminderTime(value) === String(value ?? "").trim();
}

export function sanitizeReminderSettingsValues(
  values: ReminderSettingsValues,
): ReminderSettingsValues {
  return {
    dailyLogReminderEnabled: values.dailyLogReminderEnabled,
    upcomingPeriodReminderEnabled: values.upcomingPeriodReminderEnabled,
    fertileWindowReminderEnabled: values.fertileWindowReminderEnabled,
    managedReminderEmailsEnabled: values.managedReminderEmailsEnabled,
    reminderTime: normalizeReminderTime(values.reminderTime),
  };
}

export function sanitizeInterfaceSettingsValues(
  values: InterfaceSettingsValues,
): InterfaceSettingsValues {
  return {
    languageOverride: normalizeInterfaceLanguage(values.languageOverride),
    themeOverride: normalizeThemePreference(values.themeOverride),
    screenCaptureProtectionEnabled: values.screenCaptureProtectionEnabled !== false,
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
  const incompatible = !isCompatibleCycleAndPeriod(safeCycleLength, safePeriodLength);

  return {
    invalid: incompatible,
    warning: false,
    adjusted: false,
    periodLength: safePeriodLength,
    periodLong: safePeriodLength > 8,
    cycleLong: safeCycleLength > CYCLE_LENGTH_LONG_WARNING_THRESHOLD,
    cycleShort: safeCycleLength < CYCLE_LENGTH_SHORT_WARNING_THRESHOLD,
  };
}

export function sanitizeLocalDateInput(raw: string): string {
  const digits = String(raw).replace(/\D+/g, "").slice(0, 8);
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
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
