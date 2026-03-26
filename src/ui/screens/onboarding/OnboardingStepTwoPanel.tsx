import { Text, View } from "react-native";

import type {
  AgeGroupOption,
  OnboardingStepTwoValues,
  UsageGoal,
} from "../../../models/onboarding";
import type { PredictionMode } from "../../../models/profile";
import { type OnboardingViewData } from "../../../services/onboarding-view-service";
import { type buildCycleGuidanceState } from "../../../services/onboarding-policy";
import { BinaryToggleCard } from "../../components/BinaryToggleCard";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { LabeledSliderField } from "../../components/LabeledSliderField";
import { StatusBanner } from "../../components/StatusBanner";
import {
  OnboardingPrimaryButton,
  OnboardingSecondaryButton,
} from "./OnboardingButtons";
import type { OnboardingFlowStyles } from "./onboarding-flow-styles";

type OnboardingStepTwoPanelProps = {
  compact: boolean;
  guidance: ReturnType<typeof buildCycleGuidanceState>;
  isSaving: boolean;
  onAutoPeriodFillChange: (value: boolean) => void;
  onAgeGroupSelect: (value: AgeGroupOption) => void;
  onBack: () => void | Promise<void>;
  onCycleLengthChange: (value: number) => void;
  onDismissStepTwoError: (() => void | Promise<void>) | undefined;
  onFinish: () => void | Promise<void>;
  onPredictionModeSelect: (value: PredictionMode) => void;
  onPeriodLengthChange: (value: number) => void;
  onUsageGoalSelect: (value: UsageGoal) => void;
  stepTwoError: string;
  stepTwoValues: OnboardingStepTwoValues;
  styles: OnboardingFlowStyles;
  viewData: OnboardingViewData;
};

export function OnboardingStepTwoPanel({
  compact,
  guidance,
  isSaving,
  onAutoPeriodFillChange,
  onAgeGroupSelect,
  onBack,
  onCycleLengthChange,
  onDismissStepTwoError,
  onFinish,
  onPredictionModeSelect,
  onPeriodLengthChange,
  onUsageGoalSelect,
  stepTwoError,
  stepTwoValues,
  styles,
  viewData,
}: OnboardingStepTwoPanelProps) {
  const effectiveStepTwoError = guidance.invalid
    ? viewData.stepTwo.messages.errorIncompatible
    : stepTwoError;

  return (
    <>
      <LabeledSliderField
        compact={compact}
        label={viewData.stepTwo.cycleLengthLabel}
        maximumValue={90}
        minimumValue={15}
        onValueChange={onCycleLengthChange}
        testID="onboarding-cycle-length-slider"
        value={stepTwoValues.cycleLength}
        valueSuffix={` ${viewData.stepTwo.daysShort}`}
      />

      <LabeledSliderField
        compact={compact}
        label={viewData.stepTwo.periodLengthLabel}
        maximumValue={14}
        minimumValue={1}
        onValueChange={onPeriodLengthChange}
        testID="onboarding-period-length-slider"
        value={stepTwoValues.periodLength}
        valueSuffix={` ${viewData.stepTwo.daysShort}`}
      />

      <View style={[styles.messageStack, compact ? styles.messageStackCompact : null]}>
        {guidance.adjusted ? (
          <Text style={[styles.infoText, compact ? styles.infoTextCompact : null]}>
            {viewData.stepTwo.messages.infoAdjusted}
          </Text>
        ) : null}
        {guidance.periodLong ? (
          <Text style={[styles.infoText, compact ? styles.infoTextCompact : null]}>
            {viewData.stepTwo.messages.infoPeriodLong}
          </Text>
        ) : null}
        {guidance.cycleLong ? (
          <Text style={[styles.infoText, compact ? styles.infoTextCompact : null]}>
            {viewData.stepTwo.messages.infoCycleLong}
          </Text>
        ) : null}
        {guidance.cycleShort ? (
          <Text style={[styles.infoText, compact ? styles.infoTextCompact : null]}>
            {viewData.stepTwo.messages.infoCycleShort}
          </Text>
        ) : null}
      </View>

      {effectiveStepTwoError ? (
        <StatusBanner
          dismissLabel={viewData.errors.dismissError}
          message={effectiveStepTwoError}
          onDismiss={onDismissStepTwoError}
          testID="onboarding-step-two-error"
          tone="error"
        />
      ) : null}

      <BinaryToggleCard
        compact={compact}
        description={viewData.stepTwo.autoPeriodFillHint}
        descriptionPosition="below"
        icon="🩸"
        label={viewData.stepTwo.autoPeriodFillLabel}
        onValueChange={onAutoPeriodFillChange}
        testID="onboarding-toggle-auto-period-fill"
        value={stepTwoValues.autoPeriodFill}
      />

      <View style={[styles.formGroup, compact ? styles.formGroupCompact : null]}>
        <Text style={[styles.fieldLabel, compact ? styles.fieldLabelCompact : null]}>
          {viewData.stepTwo.predictionModeLabel}
        </Text>
        <ChoiceGroup
          contentAlign={compact ? "leading" : "center"}
          layout={compact ? "stack" : "grid3"}
          onSelect={(value) => onPredictionModeSelect(value as PredictionMode)}
          options={viewData.stepTwo.predictionModeOptions}
          selectedValue={stepTwoValues.predictionMode}
          testIDPrefix="onboarding-prediction-mode"
        />
        <Text style={[styles.infoText, compact ? styles.infoTextCompact : null]}>
          {viewData.stepTwo.predictionModeHint}
        </Text>
      </View>

      <View style={[styles.formGroup, compact ? styles.formGroupCompact : null]}>
        <Text style={[styles.fieldLabel, compact ? styles.fieldLabelCompact : null]}>
          {viewData.stepTwo.ageGroupLabel}
        </Text>
        <ChoiceGroup
          compact={compact}
          contentAlign={compact ? "center" : "leading"}
          layout={compact ? "grid3" : "stack"}
          onSelect={onAgeGroupSelect}
          options={viewData.stepTwo.ageOptions}
          selectedValue={stepTwoValues.ageGroup}
          testIDPrefix="onboarding-age-group"
        />
      </View>

      <View style={[styles.formGroup, compact ? styles.formGroupCompact : null]}>
        <Text style={[styles.fieldLabel, compact ? styles.fieldLabelCompact : null]}>
          {viewData.stepTwo.usageGoalLabel}
        </Text>
        <ChoiceGroup
          compact={compact}
          contentAlign={compact ? "center" : "leading"}
          layout={compact ? "grid2" : "stack"}
          onSelect={onUsageGoalSelect}
          options={viewData.stepTwo.usageGoalOptions}
          selectedValue={stepTwoValues.usageGoal}
          testIDPrefix="onboarding-usage-goal"
        />
      </View>

      <View style={[styles.buttonRow, compact ? styles.buttonRowCompact : null]}>
        <OnboardingSecondaryButton
          compact={compact}
          grow
          label={viewData.stepTwo.backLabel}
          onPress={onBack}
          styles={styles}
          testID="onboarding-back-button"
        />
        <OnboardingPrimaryButton
          compact={compact}
          disabled={isSaving || guidance.invalid}
          grow
          label={viewData.stepTwo.finishLabel}
          onPress={onFinish}
          styles={styles}
          testID="onboarding-finish-button"
        />
      </View>
    </>
  );
}
