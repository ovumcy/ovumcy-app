export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;
export const MIN_CYCLE_LENGTH = 15;
export const MAX_CYCLE_LENGTH = 90;
export const MIN_PERIOD_LENGTH = 1;
export const MAX_PERIOD_LENGTH = 14;
export const MIN_CYCLE_RESERVE_DAYS = 10;
export const ONBOARDING_LOOKBACK_DAYS = 60;

export type LocalDateISO = string;

export type AgeGroup = "" | "under_20" | "age_20_35" | "age_35_plus";

export type AgeGroupOption = "under_20" | "age_20_35" | "age_35_plus";

export type UsageGoal = "health" | "avoid_pregnancy" | "trying_to_conceive";

export type OnboardingStep = 1 | 2;

export type OnboardingRecord = {
  lastPeriodStart: LocalDateISO | null;
  cycleLength: number;
  periodLength: number;
  autoPeriodFill: boolean;
  irregularCycle: boolean;
  ageGroup: AgeGroup;
  usageGoal: UsageGoal;
};

export type OnboardingStepTwoValues = {
  cycleLength: number;
  periodLength: number;
  autoPeriodFill: boolean;
  irregularCycle: boolean;
  ageGroup: AgeGroupOption;
  usageGoal: UsageGoal;
};

export type DayOption = {
  value: LocalDateISO;
  label: string;
  secondaryLabel: string;
  isToday: boolean;
};
