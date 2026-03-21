export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;
export const DEFAULT_AUTO_PERIOD_FILL = true;
export const DEFAULT_TEMPERATURE_UNIT = "c";

export const MIN_CYCLE_LENGTH = 15;
export const MAX_CYCLE_LENGTH = 90;
export const MIN_PERIOD_LENGTH = 1;
export const MAX_PERIOD_LENGTH = 14;
export const MIN_CYCLE_RESERVE_DAYS = 10;

export type LocalDateISO = string;

export type AgeGroup = "" | "under_20" | "age_20_35" | "age_35_plus";
export type AgeGroupOption = Exclude<AgeGroup, "">;

export type UsageGoal = "health" | "avoid_pregnancy" | "trying_to_conceive";

export type TemperatureUnit = "c" | "f";
export type InterfaceLanguage = "en" | "ru" | "es";
export type ThemePreference = "light" | "dark";
export type PredictionMode = "regular" | "irregular" | "facts_only";
export type CalendarPredictionNoticeKey =
  | "calendar_irregular_prediction_notice_v1"
  | "calendar_unpredictable_prediction_notice_v1";
export type OnboardingHelperNoticeKey = "onboarding_day1_tip_notice_v1";

export const SUPPORTED_INTERFACE_LANGUAGES = ["en", "ru", "es"] as const;
export const SUPPORTED_THEME_PREFERENCES = ["light", "dark"] as const;
export const SUPPORTED_CALENDAR_PREDICTION_NOTICE_KEYS = [
  "calendar_irregular_prediction_notice_v1",
  "calendar_unpredictable_prediction_notice_v1",
] as const;
export const SUPPORTED_ONBOARDING_HELPER_NOTICE_KEYS = [
  "onboarding_day1_tip_notice_v1",
] as const;

export type ProfileRecord = {
  lastPeriodStart: LocalDateISO | null;
  cycleLength: number;
  periodLength: number;
  autoPeriodFill: boolean;
  irregularCycle: boolean;
  unpredictableCycle: boolean;
  ageGroup: AgeGroup;
  usageGoal: UsageGoal;
  trackBBT: boolean;
  temperatureUnit: TemperatureUnit;
  trackCervicalMucus: boolean;
  hideSexChip: boolean;
  languageOverride: InterfaceLanguage | null;
  themeOverride: ThemePreference | null;
  dismissedCalendarPredictionNoticeKey?: CalendarPredictionNoticeKey | null;
  dismissedOnboardingHelperNoticeKey?: OnboardingHelperNoticeKey | null;
};

export type CycleSettingsValues = Pick<
  ProfileRecord,
  | "lastPeriodStart"
  | "cycleLength"
  | "periodLength"
  | "autoPeriodFill"
  | "irregularCycle"
  | "unpredictableCycle"
  | "ageGroup"
  | "usageGoal"
>;

export type TrackingSettingsValues = Pick<
  ProfileRecord,
  "trackBBT" | "temperatureUnit" | "trackCervicalMucus" | "hideSexChip"
>;

export type InterfaceSettingsValues = Pick<
  ProfileRecord,
  "languageOverride" | "themeOverride"
>;

export function normalizeInterfaceLanguage(
  value: string | null | undefined,
): InterfaceLanguage | null {
  if (!value) {
    return null;
  }

  return SUPPORTED_INTERFACE_LANGUAGES.includes(value as InterfaceLanguage)
    ? (value as InterfaceLanguage)
    : null;
}

export function normalizeThemePreference(
  value: string | null | undefined,
): ThemePreference | null {
  if (!value) {
    return null;
  }

  return SUPPORTED_THEME_PREFERENCES.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : null;
}

export function normalizeCalendarPredictionNoticeKey(
  value: string | null | undefined,
): CalendarPredictionNoticeKey | null {
  if (!value) {
    return null;
  }

  return SUPPORTED_CALENDAR_PREDICTION_NOTICE_KEYS.includes(
    value as CalendarPredictionNoticeKey,
  )
    ? (value as CalendarPredictionNoticeKey)
    : null;
}

export function normalizeOnboardingHelperNoticeKey(
  value: string | null | undefined,
): OnboardingHelperNoticeKey | null {
  if (!value) {
    return null;
  }

  return SUPPORTED_ONBOARDING_HELPER_NOTICE_KEYS.includes(
    value as OnboardingHelperNoticeKey,
  )
    ? (value as OnboardingHelperNoticeKey)
    : null;
}

export function resolvePredictionMode(
  value: Pick<ProfileRecord, "irregularCycle" | "unpredictableCycle">,
): PredictionMode {
  if (value.unpredictableCycle) {
    return "facts_only";
  }

  if (value.irregularCycle) {
    return "irregular";
  }

  return "regular";
}

export function resolvePredictionModeFlags(
  mode: PredictionMode,
): Pick<ProfileRecord, "irregularCycle" | "unpredictableCycle"> {
  switch (mode) {
    case "irregular":
      return {
        irregularCycle: true,
        unpredictableCycle: false,
      };
    case "facts_only":
      return {
        irregularCycle: false,
        unpredictableCycle: true,
      };
    default:
      return {
        irregularCycle: false,
        unpredictableCycle: false,
      };
  }
}

export function createDefaultProfileRecord(): ProfileRecord {
  return {
    lastPeriodStart: null,
    cycleLength: DEFAULT_CYCLE_LENGTH,
    periodLength: DEFAULT_PERIOD_LENGTH,
    autoPeriodFill: DEFAULT_AUTO_PERIOD_FILL,
    irregularCycle: false,
    unpredictableCycle: false,
    ageGroup: "",
    usageGoal: "health",
    trackBBT: false,
    temperatureUnit: DEFAULT_TEMPERATURE_UNIT,
    trackCervicalMucus: false,
    hideSexChip: false,
    languageOverride: null,
    themeOverride: null,
    dismissedCalendarPredictionNoticeKey: null,
    dismissedOnboardingHelperNoticeKey: null,
  };
}
