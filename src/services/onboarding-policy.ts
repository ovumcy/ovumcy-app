import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  MAX_CYCLE_LENGTH,
  MAX_PERIOD_LENGTH,
  MIN_CYCLE_LENGTH,
  MIN_CYCLE_RESERVE_DAYS,
  MIN_PERIOD_LENGTH,
  ONBOARDING_LOOKBACK_DAYS,
  type AgeGroup,
  type AgeGroupOption,
  type DayOption,
  type LocalDateISO,
  type OnboardingRecord,
  type OnboardingStep,
  type OnboardingStepTwoValues,
  type UsageGoal,
} from "../models/onboarding";

export type OnboardingDateBounds = {
  minDate: LocalDateISO;
  maxDate: LocalDateISO;
};

export type RelativeDayLabels = {
  today: string;
  yesterday: string;
  twoDaysAgo: string;
};

export type StepOneValidationCode =
  | "date_required"
  | "invalid_last_period_start"
  | "last_period_range";

export type CycleGuidanceState = {
  invalid: boolean;
  warning: boolean;
  adjusted: boolean;
  periodLength: number;
  periodLong: boolean;
  cycleShort: boolean;
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

export function resolveDisplayedAgeGroup(ageGroup: AgeGroup): AgeGroupOption {
  return normalizeAgeGroup(ageGroup) || "age_20_35";
}

export function clampOnboardingCycleLength(value: number): number {
  return clampInteger(value, DEFAULT_CYCLE_LENGTH, MIN_CYCLE_LENGTH, MAX_CYCLE_LENGTH);
}

export function clampOnboardingPeriodLength(value: number): number {
  return clampInteger(value, DEFAULT_PERIOD_LENGTH, MIN_PERIOD_LENGTH, MAX_PERIOD_LENGTH);
}

export function maxPeriodLengthForCycle(cycleLength: number): number {
  const safeCycleLength = clampOnboardingCycleLength(cycleLength);
  const maxPeriodLength = safeCycleLength - MIN_CYCLE_RESERVE_DAYS;

  if (maxPeriodLength < MIN_PERIOD_LENGTH) {
    return MIN_PERIOD_LENGTH;
  }
  if (maxPeriodLength > MAX_PERIOD_LENGTH) {
    return MAX_PERIOD_LENGTH;
  }
  return maxPeriodLength;
}

export function sanitizeOnboardingCycleAndPeriod(
  cycleLength: number,
  periodLength: number,
): Pick<OnboardingStepTwoValues, "cycleLength" | "periodLength"> {
  const safeCycleLength = clampOnboardingCycleLength(cycleLength);
  const safePeriodLength = Math.min(
    clampOnboardingPeriodLength(periodLength),
    maxPeriodLengthForCycle(safeCycleLength),
  );

  return {
    cycleLength: safeCycleLength,
    periodLength: safePeriodLength,
  };
}

export function resolveCycleAndPeriodDefaults(
  cycleLength: number,
  periodLength: number,
): Pick<OnboardingStepTwoValues, "cycleLength" | "periodLength"> {
  const resolvedCycleLength = Number.isFinite(cycleLength)
    ? clampOnboardingCycleLength(cycleLength)
    : DEFAULT_CYCLE_LENGTH;
  const resolvedPeriodLength = Number.isFinite(periodLength)
    ? clampOnboardingPeriodLength(periodLength)
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
  const safeCycleLength = clampOnboardingCycleLength(cycleLength);
  const safePeriodLength = clampOnboardingPeriodLength(periodLength);
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

export function sanitizeStepTwoValues(
  values: OnboardingStepTwoValues,
): OnboardingStepTwoValues {
  const sanitizedCycle = buildCycleGuidanceState(
    values.cycleLength,
    values.periodLength,
  );

  return {
    cycleLength: clampOnboardingCycleLength(values.cycleLength),
    periodLength: sanitizedCycle.periodLength,
    autoPeriodFill: values.autoPeriodFill,
    irregularCycle: values.irregularCycle,
    ageGroup: resolveDisplayedAgeGroup(values.ageGroup),
    usageGoal: normalizeUsageGoal(values.usageGoal),
  };
}

export function createDefaultOnboardingRecord(): OnboardingRecord {
  return {
    lastPeriodStart: null,
    cycleLength: DEFAULT_CYCLE_LENGTH,
    periodLength: DEFAULT_PERIOD_LENGTH,
    autoPeriodFill: false,
    irregularCycle: false,
    ageGroup: "",
    usageGoal: "health",
  };
}

export function createStepTwoDefaults(record: OnboardingRecord): OnboardingStepTwoValues {
  const defaults = resolveCycleAndPeriodDefaults(
    record.cycleLength,
    record.periodLength,
  );

  return {
    cycleLength: defaults.cycleLength,
    periodLength: defaults.periodLength,
    autoPeriodFill: record.autoPeriodFill,
    irregularCycle: record.irregularCycle,
    ageGroup: resolveDisplayedAgeGroup(record.ageGroup),
    usageGoal: normalizeUsageGoal(record.usageGoal),
  };
}

export function resolveOnboardingStep(
  record: OnboardingRecord,
  hasCompletedOnboarding: boolean,
): OnboardingStep {
  if (hasCompletedOnboarding) {
    return 2;
  }
  return record.lastPeriodStart ? 2 : 1;
}

export function getOnboardingDateBounds(now: Date): OnboardingDateBounds {
  const today = atLocalDay(now);
  const currentYearStart = new Date(today.getFullYear(), 0, 1);
  const lookbackStart = addDays(today, -ONBOARDING_LOOKBACK_DAYS);
  const minDate = currentYearStart > lookbackStart ? currentYearStart : lookbackStart;

  return {
    minDate: formatLocalDate(minDate),
    maxDate: formatLocalDate(today),
  };
}

export function validateStepOneStartDate(
  rawValue: string,
  now: Date,
): StepOneValidationCode | null {
  const value = rawValue.trim();
  if (!value) {
    return "date_required";
  }

  const parsed = parseLocalDate(value);
  if (!parsed) {
    return "invalid_last_period_start";
  }

  const bounds = getOnboardingDateBounds(now);
  if (value < bounds.minDate || value > bounds.maxDate) {
    return "last_period_range";
  }

  return null;
}

export function buildDayOptions(
  minDateRaw: LocalDateISO,
  maxDateRaw: LocalDateISO,
  locale: string,
  relativeLabels: RelativeDayLabels,
): DayOption[] {
  const minDate = parseLocalDate(minDateRaw);
  const maxDate = parseLocalDate(maxDateRaw);

  if (!minDate || !maxDate || minDate > maxDate) {
    return [];
  }

  const formatter = new Intl.DateTimeFormat(locale || "en", {
    day: "numeric",
    month: "short",
  });
  const result: DayOption[] = [];

  for (let cursor = new Date(maxDate); cursor >= minDate; cursor = addDays(cursor, -1)) {
    const current = new Date(cursor);
    const dayOffset = Math.round(
      (maxDate.getTime() - current.getTime()) / 86400000,
    );
    const relativeLabel = resolveRelativeDayLabel(dayOffset, locale, relativeLabels);
    const formattedDate = formatter.format(current);

    result.push({
      value: formatLocalDate(current),
      label: relativeLabel || formattedDate,
      secondaryLabel: relativeLabel ? formattedDate : "",
      isToday: dayOffset === 0,
    });
  }

  return result;
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

function resolveRelativeDayLabel(
  dayOffset: number,
  locale: string,
  relativeLabels: RelativeDayLabels,
): string {
  if (dayOffset === 0 && relativeLabels.today.trim()) {
    return relativeLabels.today.trim();
  }
  if (dayOffset === 1 && relativeLabels.yesterday.trim()) {
    return relativeLabels.yesterday.trim();
  }
  if (dayOffset === 2 && relativeLabels.twoDaysAgo.trim()) {
    return relativeLabels.twoDaysAgo.trim();
  }

  return localizedRelativeDayFallback(dayOffset, locale);
}

function localizedRelativeDayFallback(dayOffset: number, locale: string): string {
  const resolvedLocale = locale.trim() || "en";

  try {
    const formatter = new Intl.RelativeTimeFormat(resolvedLocale, {
      numeric: dayOffset === 2 ? "always" : "auto",
    });

    if (dayOffset === 0) {
      return formatter.format(0, "day");
    }
    if (dayOffset === 1) {
      return formatter.format(-1, "day");
    }
    if (dayOffset === 2) {
      return formatter.format(-2, "day");
    }
  } catch {
    // Fall back to stable English copy below when Intl locale data is unavailable.
  }

  if (dayOffset === 0) {
    return "Today";
  }
  if (dayOffset === 1) {
    return "Yesterday";
  }
  if (dayOffset === 2) {
    return "2 days ago";
  }

  return "";
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
