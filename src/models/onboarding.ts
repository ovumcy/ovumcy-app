import type {
  AgeGroup,
  AgeGroupOption,
  LocalDateISO,
  ProfileRecord,
  UsageGoal,
} from "./profile";

export const ONBOARDING_LOOKBACK_DAYS = 60;

export {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  MAX_CYCLE_LENGTH,
  MAX_PERIOD_LENGTH,
  MIN_CYCLE_LENGTH,
  MIN_CYCLE_RESERVE_DAYS,
  MIN_PERIOD_LENGTH,
} from "./profile";

export type { AgeGroup, AgeGroupOption, LocalDateISO, UsageGoal };

export type OnboardingStep = 1 | 2;

export type OnboardingRecord = Pick<
  ProfileRecord,
  | "lastPeriodStart"
  | "cycleLength"
  | "periodLength"
  | "autoPeriodFill"
  | "irregularCycle"
  | "ageGroup"
  | "usageGoal"
>;

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
