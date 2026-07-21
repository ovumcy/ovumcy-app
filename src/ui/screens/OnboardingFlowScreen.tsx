import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

import type { OnboardingViewData } from "../../services/onboarding-view-service";
import type { LoadedOnboardingState } from "../../services/onboarding-screen-service";
import {
  buildCycleGuidanceState,
  parseLocalDate,
} from "../../services/onboarding-policy";
import type {
  AgeGroupOption,
  UsageGoal,
} from "../../models/onboarding";
import type { PredictionMode } from "../../models/profile";
import { getOnboardingCopy } from "../../i18n/app-copy";
import { useThemedStyles } from "../theme/useThemedStyles";
import { formatOnboardingLongDate } from "./onboarding/onboarding-flow-format";
import { createOnboardingFlowStyles } from "./onboarding/onboarding-flow-styles";
import { OnboardingShell } from "./onboarding/OnboardingShell";
import { OnboardingStepOnePanel } from "./onboarding/OnboardingStepOnePanel";
import { OnboardingStepTwoPanel } from "./onboarding/OnboardingStepTwoPanel";

export type OnboardingFlowScreenProps = {
  guidance: ReturnType<typeof buildCycleGuidanceState>;
  isSaving: boolean;
  locale: string;
  onAutoPeriodFillChange: (value: boolean) => void;
  onAgeGroupSelect: (value: AgeGroupOption) => void;
  onBack: () => void;
  onCycleLengthChange: (value: number) => void;
  onDateSelected: (value: string) => void;
  onDismissStepOneError?: () => void | Promise<void>;
  onDismissStepOneNotice?: () => void | Promise<void>;
  onDismissStepTwoError?: () => void | Promise<void>;
  onFinish: () => void | Promise<void>;
  onPredictionModeSelect: (value: PredictionMode) => void;
  onNext: () => void | Promise<void>;
  onOpenPrivacyNotice: () => void | Promise<void>;
  onPeriodLengthChange: (value: number) => void;
  onUsageGoalSelect: (value: UsageGoal) => void;
  state: LoadedOnboardingState;
  stepOneNotice: {
    dismissLabel: string;
    message: string;
  } | null;
  stepOneError: string;
  stepTwoError: string;
  viewData: OnboardingViewData;
};

export function OnboardingFlowScreen({
  guidance,
  isSaving,
  locale,
  onAutoPeriodFillChange,
  onAgeGroupSelect,
  onBack,
  onCycleLengthChange,
  onDateSelected,
  onDismissStepOneError,
  onDismissStepOneNotice,
  onDismissStepTwoError,
  onFinish,
  onPredictionModeSelect,
  onNext,
  onOpenPrivacyNotice,
  onPeriodLengthChange,
  onUsageGoalSelect,
  state,
  stepOneNotice,
  stepOneError,
  stepTwoError,
  viewData,
}: OnboardingFlowScreenProps) {
  const styles = useThemedStyles(createOnboardingFlowStyles);
  const { height, width } = useWindowDimensions();
  const onboardingCopy = getOnboardingCopy(locale);
  const selectedDate = parseLocalDate(state.selectedDate);
  const compactLayout = width < 430;
  const dayOptionColumns = width >= 1180 ? 6 : width >= 820 ? 4 : 3;
  const displayedDate = useMemo(() => {
    if (selectedDate === null) {
      return viewData.stepOne.datePlaceholder;
    }

    return formatOnboardingLongDate(selectedDate, locale);
  }, [locale, selectedDate, viewData.stepOne.datePlaceholder]);

  return (
    <OnboardingShell
      compact={compactLayout}
      progressLabel={
        state.step === 1
          ? onboardingCopy.progress.step1
          : onboardingCopy.progress.step2
      }
      progressPercent={state.step === 1 ? 50 : 100}
      screenHeight={height}
      scrollEnabled={state.step !== 1}
      styles={styles}
      subtitle={state.step === 1 ? viewData.stepOne.subtitle : undefined}
      title={state.step === 1 ? viewData.stepOne.title : viewData.stepTwo.title}
    >
      {state.step === 1 ? (
        <OnboardingStepOnePanel
          compact={compactLayout}
          dayOptionColumns={dayOptionColumns}
          displayedDate={displayedDate}
          isSaving={isSaving}
          onDayOptionPress={onDateSelected}
          onDismissStepOneError={onDismissStepOneError}
          onDismissStepOneNotice={onDismissStepOneNotice}
          onNext={onNext}
          onOpenPrivacyNotice={onOpenPrivacyNotice}
          selectedDateValue={state.selectedDate}
          stepOneError={stepOneError}
          stepOneNotice={stepOneNotice}
          styles={styles}
          viewData={viewData}
        />
      ) : (
        <OnboardingStepTwoPanel
          compact={compactLayout}
          guidance={guidance}
          isSaving={isSaving}
          onAgeGroupSelect={onAgeGroupSelect}
          onAutoPeriodFillChange={onAutoPeriodFillChange}
          onBack={onBack}
          onCycleLengthChange={onCycleLengthChange}
          onDismissStepTwoError={onDismissStepTwoError}
          onFinish={onFinish}
          onPeriodLengthChange={onPeriodLengthChange}
          onPredictionModeSelect={onPredictionModeSelect}
          onUsageGoalSelect={onUsageGoalSelect}
          stepTwoError={stepTwoError}
          stepTwoValues={state.stepTwoValues}
          styles={styles}
          viewData={viewData}
        />
      )}
    </OnboardingShell>
  );
}
