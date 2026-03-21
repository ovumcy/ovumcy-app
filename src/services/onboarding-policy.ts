import {
  ONBOARDING_LOOKBACK_DAYS,
  type DayOption,
  type LocalDateISO,
  type OnboardingRecord,
  type OnboardingStep,
  type OnboardingStepTwoValues,
} from "../models/onboarding";
import {
  createDefaultProfileRecord,
  resolvePredictionMode,
  resolvePredictionModeFlags,
  type ProfileRecord,
} from "../models/profile";
import {
  addDays,
  buildCycleGuidanceState as buildSharedCycleGuidanceState,
  clampCycleLength,
  clampPeriodLength,
  formatLocalDate,
  normalizeUsageGoal,
  parseLocalDate,
  resolveCycleAndPeriodDefaults as resolveSharedCycleAndPeriodDefaults,
  resolveDisplayedAgeGroup,
  sanitizeCycleSettingsValues,
} from "./profile-settings-policy";
export {
  addDays,
  formatLocalDate,
  normalizeAgeGroup,
  normalizeUsageGoal,
  parseLocalDate,
} from "./profile-settings-policy";

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

export function clampOnboardingCycleLength(value: number): number {
  return clampCycleLength(value);
}

export function clampOnboardingPeriodLength(value: number): number {
  return clampPeriodLength(value);
}

export function sanitizeOnboardingCycleAndPeriod(
  cycleLength: number,
  periodLength: number,
): Pick<OnboardingStepTwoValues, "cycleLength" | "periodLength"> {
  const resolved = sanitizeCycleSettingsValues({
    ...createDefaultProfileRecord(),
    cycleLength,
    periodLength,
  });

  return {
    cycleLength: resolved.cycleLength,
    periodLength: resolved.periodLength,
  };
}

export function resolveCycleAndPeriodDefaults(
  cycleLength: number,
  periodLength: number,
): Pick<OnboardingStepTwoValues, "cycleLength" | "periodLength"> {
  return resolveSharedCycleAndPeriodDefaults(cycleLength, periodLength);
}

export function buildCycleGuidanceState(
  cycleLength: number,
  periodLength: number,
){
  return buildSharedCycleGuidanceState(cycleLength, periodLength);
}

export function sanitizeStepTwoValues(
  values: OnboardingStepTwoValues,
): OnboardingStepTwoValues {
  const predictionModeFlags = resolvePredictionModeFlags(values.predictionMode);
  const sanitizedCycle = sanitizeCycleSettingsValues({
    ...createDefaultProfileRecord(),
    cycleLength: values.cycleLength,
    periodLength: values.periodLength,
    autoPeriodFill: values.autoPeriodFill,
    ...predictionModeFlags,
    ageGroup: values.ageGroup,
    usageGoal: values.usageGoal,
  });

  return {
    cycleLength: sanitizedCycle.cycleLength,
    periodLength: sanitizedCycle.periodLength,
    autoPeriodFill: sanitizedCycle.autoPeriodFill,
    predictionMode: resolvePredictionMode(sanitizedCycle),
    ageGroup: resolveDisplayedAgeGroup(sanitizedCycle.ageGroup),
    usageGoal: sanitizedCycle.usageGoal,
  };
}

export function createDefaultOnboardingRecord(): OnboardingRecord {
  return profileToOnboardingRecord(createDefaultProfileRecord());
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
    predictionMode: resolvePredictionMode(record),
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

export function profileToOnboardingRecord(
  profile: ProfileRecord,
): OnboardingRecord {
  return {
    lastPeriodStart: profile.lastPeriodStart,
    cycleLength: profile.cycleLength,
    periodLength: profile.periodLength,
    autoPeriodFill: profile.autoPeriodFill,
    irregularCycle: profile.irregularCycle,
    unpredictableCycle: profile.unpredictableCycle,
    ageGroup: profile.ageGroup,
    usageGoal: profile.usageGoal,
  };
}

export function applyOnboardingRecordToProfile(
  currentProfile: ProfileRecord,
  onboardingRecord: OnboardingRecord,
): ProfileRecord {
  return {
    ...currentProfile,
    ...sanitizeCycleSettingsValues({
      ...currentProfile,
      ...onboardingRecord,
    }),
  };
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

function atLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
