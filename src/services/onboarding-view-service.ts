import { getOnboardingCopy } from "../i18n/app-copy";
import type {
  AgeGroupOption,
  OnboardingRecord,
  OnboardingStepTwoValues,
  UsageGoal,
} from "../models/onboarding";
import type { PredictionMode } from "../models/profile";
import {
  buildCycleGuidanceState,
  buildDayOptions,
  createStepTwoDefaults,
  getOnboardingDateBounds,
} from "./onboarding-policy";

export type OnboardingViewData = {
  progressLabel: string;
  stepOne: {
    title: string;
    subtitle: string;
    day1Tip: string;
    dismissTip: string;
    datePlaceholder: string;
    selectedDateLabel: string;
    nextLabel: string;
    dayOptions: ReturnType<typeof buildDayOptions>;
    minDate: string;
    maxDate: string;
  };
  stepTwo: {
    title: string;
    cycleLengthLabel: string;
    daysShort: string;
    cycleLengthHint: string;
    periodLengthLabel: string;
    periodLengthHint: string;
    autoPeriodFillLabel: string;
    autoPeriodFillHint: string;
    predictionModeLabel: string;
    predictionModeHint: string;
    ageGroupLabel: string;
    ageGroupHint: string;
    usageGoalLabel: string;
    usageGoalHint: string;
    backLabel: string;
    finishLabel: string;
    messages: {
      errorIncompatible: string;
      warningApproximate: string;
      infoAdjusted: string;
      infoPeriodLong: string;
      infoCycleShort: string;
    };
    ageOptions: {
      value: AgeGroupOption;
      label: string;
    }[];
    predictionModeOptions: {
      value: PredictionMode;
      label: string;
      secondaryLabel: string;
    }[];
    usageGoalOptions: {
      value: UsageGoal;
      label: string;
    }[];
    initialValues: OnboardingStepTwoValues;
    guidance: ReturnType<typeof buildCycleGuidanceState>;
  };
  errors: {
    dateRequired: string;
    dismissError: string;
    invalidLastPeriodStart: string;
    lastPeriodRange: string;
    generic: string;
  };
};

export function buildOnboardingViewData(
  record: OnboardingRecord,
  now: Date,
  locale = "en",
): OnboardingViewData {
  const onboardingCopy = getOnboardingCopy(locale);
  const bounds = getOnboardingDateBounds(now);
  const initialStepTwoValues = createStepTwoDefaults(record);
  const guidance = buildCycleGuidanceState(
    initialStepTwoValues.cycleLength,
    initialStepTwoValues.periodLength,
  );

  return {
    progressLabel:
      record.lastPeriodStart === null
        ? onboardingCopy.progress.step1
        : onboardingCopy.progress.step2,
    stepOne: {
      title: onboardingCopy.step1.title,
      subtitle: onboardingCopy.step1.subtitle,
      day1Tip: onboardingCopy.step1.day1Tip,
      dismissTip: onboardingCopy.step1.dismissTip,
      datePlaceholder: onboardingCopy.step1.datePlaceholder,
      selectedDateLabel: onboardingCopy.step1.selectedDate,
      nextLabel: onboardingCopy.buttons.next,
      dayOptions: buildDayOptions(bounds.minDate, bounds.maxDate, locale, {
        today: onboardingCopy.step1.today,
        yesterday: onboardingCopy.step1.yesterday,
        twoDaysAgo: onboardingCopy.step1.twoDaysAgo,
      }),
      minDate: bounds.minDate,
      maxDate: bounds.maxDate,
    },
    stepTwo: {
      title: onboardingCopy.step2.title,
      cycleLengthLabel: onboardingCopy.step2.cycleLength,
      daysShort: onboardingCopy.step2.daysShort,
      cycleLengthHint: onboardingCopy.step2.cycleLengthHint,
      periodLengthLabel: onboardingCopy.step2.periodLength,
      periodLengthHint: onboardingCopy.step2.periodLengthHint,
      autoPeriodFillLabel: onboardingCopy.step2.autoPeriodFill,
      autoPeriodFillHint: onboardingCopy.step2.autoPeriodFillHint,
      predictionModeLabel: onboardingCopy.step2.predictionMode,
      predictionModeHint: onboardingCopy.step2.predictionModeHint,
      ageGroupLabel: onboardingCopy.step2.ageGroup,
      ageGroupHint: onboardingCopy.step2.ageGroupHint,
      usageGoalLabel: onboardingCopy.step2.usageGoal,
      usageGoalHint: onboardingCopy.step2.usageGoalHint,
      backLabel: onboardingCopy.buttons.back,
      finishLabel: onboardingCopy.buttons.finish,
      messages: {
        errorIncompatible: onboardingCopy.step2.errorIncompatible,
        warningApproximate: onboardingCopy.step2.warningApproximate,
        infoAdjusted: onboardingCopy.step2.infoAdjusted,
        infoPeriodLong: onboardingCopy.step2.infoPeriodLong,
        infoCycleShort: onboardingCopy.step2.infoCycleShort,
      },
      ageOptions: [
        { value: "under_20", label: onboardingCopy.ageGroup.under20 },
        { value: "age_20_35", label: onboardingCopy.ageGroup.age20to35 },
        { value: "age_35_plus", label: onboardingCopy.ageGroup.age35plus },
      ],
      predictionModeOptions: [
        {
          value: "regular",
          label: onboardingCopy.step2.predictionModeRegular,
          secondaryLabel: onboardingCopy.step2.predictionModeRegularHint,
        },
        {
          value: "irregular",
          label: onboardingCopy.step2.predictionModeIrregular,
          secondaryLabel: onboardingCopy.step2.predictionModeIrregularHint,
        },
        {
          value: "facts_only",
          label: onboardingCopy.step2.predictionModeFactsOnly,
          secondaryLabel: onboardingCopy.step2.predictionModeFactsOnlyHint,
        },
      ],
      usageGoalOptions: [
        {
          value: "avoid_pregnancy",
          label: onboardingCopy.usageGoal.avoidPregnancy,
        },
        {
          value: "trying_to_conceive",
          label: onboardingCopy.usageGoal.tryingToConceive,
        },
        {
          value: "health",
          label: onboardingCopy.usageGoal.health,
        },
      ],
      initialValues: initialStepTwoValues,
      guidance,
    },
    errors: {
      dateRequired: onboardingCopy.errors.dateRequired,
      dismissError: onboardingCopy.errors.dismissError,
      invalidLastPeriodStart: onboardingCopy.errors.invalidLastPeriodStart,
      lastPeriodRange: onboardingCopy.errors.lastPeriodRange,
      generic: onboardingCopy.errors.generic,
    },
  };
}
