import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { type ReactNode, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { OnboardingViewData } from "../../services/onboarding-view-service";
import type { LoadedOnboardingState } from "../../services/onboarding-screen-service";
import {
  addDays,
  buildCycleGuidanceState,
  formatLocalDate,
  parseLocalDate,
} from "../../services/onboarding-policy";
import type {
  AgeGroupOption,
  DayOption,
  OnboardingStepTwoValues,
  UsageGoal,
} from "../../models/onboarding";
import { onboardingCopy } from "../../i18n/app-copy";
import { BinaryToggleCard } from "../components/BinaryToggleCard";
import { LabeledSliderField } from "../components/LabeledSliderField";
import { colors, spacing } from "../theme/tokens";

export type OnboardingFlowScreenProps = {
  guidance: ReturnType<typeof buildCycleGuidanceState>;
  isSaving: boolean;
  locale: string;
  now: Date;
  onAutoPeriodFillChange: (value: boolean) => void;
  onAgeGroupSelect: (value: AgeGroupOption) => void;
  onBack: () => void;
  onCycleLengthChange: (value: number) => void;
  onDateSelected: (value: string) => void;
  onFinish: () => void | Promise<void>;
  onIrregularCycleChange: (value: boolean) => void;
  onNext: () => void | Promise<void>;
  onPeriodLengthChange: (value: number) => void;
  onUsageGoalSelect: (value: UsageGoal) => void;
  state: LoadedOnboardingState;
  stepOneError: string;
  stepTwoError: string;
  viewData: OnboardingViewData;
};

export function OnboardingLoadingScreen() {
  return (
    <OnboardingShell
      progressLabel="Ovumcy"
      subtitle="Preparing your private onboarding flow."
      title={onboardingCopy.loading}
    >
      <View style={styles.loadingBlock}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    </OnboardingShell>
  );
}

export function OnboardingFlowScreen({
  guidance,
  isSaving,
  locale,
  now,
  onAutoPeriodFillChange,
  onAgeGroupSelect,
  onBack,
  onCycleLengthChange,
  onDateSelected,
  onFinish,
  onIrregularCycleChange,
  onNext,
  onPeriodLengthChange,
  onUsageGoalSelect,
  state,
  stepOneError,
  stepTwoError,
  viewData,
}: OnboardingFlowScreenProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { width } = useWindowDimensions();
  const selectedDate = parseLocalDate(state.selectedDate);
  const dayOptionColumns = width >= 1180 ? 6 : width >= 820 ? 4 : 3;
  const displayedDate = useMemo(() => {
    if (selectedDate === null) {
      return viewData.stepOne.datePlaceholder;
    }

    return formatLongDate(selectedDate, locale);
  }, [locale, selectedDate, viewData.stepOne.datePlaceholder]);
  const supportsNativeDatePicker = Platform.OS !== "web";
  const datePickerBounds = useMemo(
    () => ({
      ...(parseLocalDate(viewData.stepOne.maxDate)
        ? {
            maximumDate: parseLocalDate(viewData.stepOne.maxDate) as Date,
          }
        : {}),
      ...(parseLocalDate(viewData.stepOne.minDate)
        ? {
            minimumDate: parseLocalDate(viewData.stepOne.minDate) as Date,
          }
        : {}),
    }),
    [viewData.stepOne.maxDate, viewData.stepOne.minDate],
  );

  return (
    <OnboardingShell
      progressLabel={
        state.step === 1 ? viewData.progressLabel : onboardingCopy.progress.step2
      }
      title={state.step === 1 ? viewData.stepOne.title : viewData.stepTwo.title}
      {...(state.step === 1 ? { subtitle: viewData.stepOne.subtitle } : {})}
    >
      {state.step === 1 ? (
        <StepOnePanel
          datePickerBounds={datePickerBounds}
          displayedDate={displayedDate}
          isSaving={isSaving}
          now={now}
          onDatePickerChange={(event, value) =>
            handleDatePickerChange(event, value, setShowDatePicker, onDateSelected)
          }
          onDatePickerToggle={() => setShowDatePicker((current) => !current)}
          onDayOptionPress={onDateSelected}
          onNext={onNext}
          dayOptionColumns={dayOptionColumns}
          selectedDate={selectedDate}
          selectedDateValue={state.selectedDate}
          showDatePicker={showDatePicker}
          stepOneError={stepOneError}
          supportsNativeDatePicker={supportsNativeDatePicker}
          viewData={viewData}
        />
      ) : (
        <StepTwoPanel
          guidance={guidance}
          isSaving={isSaving}
          onAutoPeriodFillChange={onAutoPeriodFillChange}
          onAgeGroupSelect={onAgeGroupSelect}
          onBack={onBack}
          onCycleLengthChange={onCycleLengthChange}
          onFinish={onFinish}
          onIrregularCycleChange={onIrregularCycleChange}
          onPeriodLengthChange={onPeriodLengthChange}
          onUsageGoalSelect={onUsageGoalSelect}
          stepTwoError={stepTwoError}
          stepTwoValues={state.stepTwoValues}
          viewData={viewData}
        />
      )}
    </OnboardingShell>
  );
}

function OnboardingShell({
  progressLabel,
  title,
  subtitle,
  children,
}: {
  progressLabel: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.screenContent,
          { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom + 18, 24) },
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <View style={styles.heroCard}>
          <View style={styles.progressBlock}>
            <Text style={styles.kicker}>{progressLabel}</Text>
            <View style={styles.progressPanel}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width:
                        progressLabel === onboardingCopy.progress.step1 ? "50%" : "100%",
                    },
                  ]}
                />
              </View>
            </View>
          </View>
          <View style={styles.panel}>
            <Text style={styles.heroTitle}>{title}</Text>
            {subtitle ? <Text style={styles.heroMuted}>{subtitle}</Text> : null}
            {children}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function StepOnePanel({
  datePickerBounds,
  displayedDate,
  isSaving,
  now,
  onDatePickerToggle,
  onDayOptionPress,
  onDatePickerChange,
  onNext,
  dayOptionColumns,
  selectedDate,
  selectedDateValue,
  showDatePicker,
  stepOneError,
  supportsNativeDatePicker,
  viewData,
}: {
  datePickerBounds: { maximumDate?: Date; minimumDate?: Date };
  displayedDate: string;
  isSaving: boolean;
  now: Date;
  onDatePickerToggle: () => void;
  onDayOptionPress: (value: string) => void;
  onDatePickerChange: (event: DateTimePickerEvent, value: Date | undefined) => void;
  onNext: () => void | Promise<void>;
  dayOptionColumns: number;
  selectedDate: Date | null;
  selectedDateValue: string;
  showDatePicker: boolean;
  stepOneError: string;
  supportsNativeDatePicker: boolean;
  viewData: OnboardingViewData;
}) {
  return (
    <>
      <Text style={styles.helperText}>{viewData.stepOne.day1Tip}</Text>
      <Text style={styles.helperText}>{viewData.stepOne.privacy}</Text>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{viewData.stepOne.fieldLabel}</Text>
        <View style={styles.dateFieldShell}>
          <Text
            style={[
              styles.dateFieldValue,
              !selectedDateValue ? styles.dateFieldValueMuted : null,
            ]}
          >
            {displayedDate}
          </Text>
          {supportsNativeDatePicker ? (
            <Pressable onPress={onDatePickerToggle} style={styles.secondaryLinkButton}>
              <Text style={styles.secondaryLinkButtonText}>
                {viewData.stepOne.changeDateLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {supportsNativeDatePicker && showDatePicker ? (
          <DateTimePicker
            display="default"
            mode="date"
            onChange={onDatePickerChange}
            value={selectedDate ?? parseLocalDate(viewData.stepOne.maxDate) ?? addDays(now, 0)}
            {...datePickerBounds}
          />
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.dayOptionGrid}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.dayOptionScroll}
      >
        {viewData.stepOne.dayOptions.map((option) => (
          <DayOptionButton
            key={option.value}
            columns={dayOptionColumns}
            isSelected={selectedDateValue === option.value}
            onPress={() => onDayOptionPress(option.value)}
            option={option}
          />
        ))}
      </ScrollView>

      {stepOneError ? <Text style={styles.errorText}>{stepOneError}</Text> : null}

      <PrimaryButton
        disabled={isSaving}
        label={viewData.stepOne.nextLabel}
        onPress={onNext}
        testID="onboarding-next-button"
      />
    </>
  );
}

function StepTwoPanel({
  guidance,
  isSaving,
  onAutoPeriodFillChange,
  onAgeGroupSelect,
  onBack,
  onCycleLengthChange,
  onFinish,
  onIrregularCycleChange,
  onPeriodLengthChange,
  onUsageGoalSelect,
  stepTwoError,
  stepTwoValues,
  viewData,
}: {
  guidance: ReturnType<typeof buildCycleGuidanceState>;
  isSaving: boolean;
  onAutoPeriodFillChange: (value: boolean) => void;
  onAgeGroupSelect: (value: AgeGroupOption) => void;
  onBack: () => void;
  onCycleLengthChange: (value: number) => void;
  onFinish: () => void | Promise<void>;
  onIrregularCycleChange: (value: boolean) => void;
  onPeriodLengthChange: (value: number) => void;
  onUsageGoalSelect: (value: UsageGoal) => void;
  stepTwoError: string;
  stepTwoValues: OnboardingStepTwoValues;
  viewData: OnboardingViewData;
}) {
  return (
    <>
      <LabeledSliderField
        hint={viewData.stepTwo.cycleLengthHint}
        label={viewData.stepTwo.cycleLengthLabel}
        maximumValue={90}
        minimumValue={15}
        onValueChange={onCycleLengthChange}
        testID="onboarding-cycle-length-slider"
        value={stepTwoValues.cycleLength}
        valueSuffix=" days"
      />

      <LabeledSliderField
        hint={viewData.stepTwo.periodLengthHint}
        label={viewData.stepTwo.periodLengthLabel}
        maximumValue={14}
        minimumValue={1}
        onValueChange={onPeriodLengthChange}
        testID="onboarding-period-length-slider"
        value={stepTwoValues.periodLength}
        valueSuffix=" days"
      />

      <View style={styles.messageStack}>
        {guidance.adjusted ? (
          <Text style={styles.infoText}>{viewData.stepTwo.messages.infoAdjusted}</Text>
        ) : null}
        {guidance.periodLong ? (
          <Text style={styles.infoText}>{viewData.stepTwo.messages.infoPeriodLong}</Text>
        ) : null}
        {guidance.cycleShort ? (
          <Text style={styles.infoText}>{viewData.stepTwo.messages.infoCycleShort}</Text>
        ) : null}
        {stepTwoError ? <Text style={styles.errorText}>{stepTwoError}</Text> : null}
      </View>

      <BinaryToggleCard
        description={viewData.stepTwo.autoPeriodFillHint}
        descriptionPosition="below"
        icon="🩸"
        label={viewData.stepTwo.autoPeriodFillLabel}
        onValueChange={onAutoPeriodFillChange}
        testID="onboarding-toggle-auto-period-fill"
        value={stepTwoValues.autoPeriodFill}
      />

      <BinaryToggleCard
        description={viewData.stepTwo.irregularCycleHint}
        descriptionPosition="below"
        icon="〰️"
        label={viewData.stepTwo.irregularCycleLabel}
        onValueChange={onIrregularCycleChange}
        testID="onboarding-toggle-irregular-cycle"
        value={stepTwoValues.irregularCycle}
      />

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{viewData.stepTwo.ageGroupLabel}</Text>
        <Text style={styles.helperText}>{viewData.stepTwo.ageGroupHint}</Text>
        <ChoiceGroup
          compact
          onSelect={onAgeGroupSelect}
          options={viewData.stepTwo.ageOptions}
          selectedValue={stepTwoValues.ageGroup}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{viewData.stepTwo.usageGoalLabel}</Text>
        <Text style={styles.helperText}>{viewData.stepTwo.usageGoalHint}</Text>
        <ChoiceGroup
          onSelect={onUsageGoalSelect}
          options={viewData.stepTwo.usageGoalOptions}
          selectedValue={stepTwoValues.usageGoal}
        />
      </View>

      <View style={styles.buttonRow}>
        <SecondaryButton
          label={viewData.stepTwo.backLabel}
          onPress={onBack}
          testID="onboarding-back-button"
        />
        <PrimaryButton
          disabled={isSaving}
          label={viewData.stepTwo.finishLabel}
          onPress={onFinish}
          testID="onboarding-finish-button"
        />
      </View>
    </>
  );
}

function DayOptionButton({
  columns,
  option,
  isSelected,
  onPress,
}: {
  columns: number;
  option: DayOption;
  isSelected: boolean;
  onPress: () => void;
}) {
  const widthStyle =
    columns >= 6
      ? styles.dayOptionButtonSixColumns
      : columns === 4
        ? styles.dayOptionButtonFourColumns
        : styles.dayOptionButtonThreeColumns;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={[
        styles.dayOptionButton,
        widthStyle,
        option.isToday ? styles.dayOptionButtonToday : null,
        isSelected ? styles.dayOptionButtonActive : null,
      ]}
      testID={`onboarding-day-option-${option.value}`}
    >
      <Text style={[styles.dayOptionLabel, isSelected ? styles.dayOptionLabelActive : null]}>
        {option.label}
      </Text>
      {option.secondaryLabel ? (
        <Text
          style={[
            styles.dayOptionSecondaryLabel,
            isSelected ? styles.dayOptionLabelActive : null,
          ]}
        >
          {option.secondaryLabel}
        </Text>
      ) : null}
    </Pressable>
  );
}

function ChoiceGroup<T extends string>({
  options,
  selectedValue,
  onSelect,
  compact = false,
}: {
  options: { value: T; label: string }[];
  selectedValue: T;
  onSelect: (value: T) => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.choiceGroup, compact ? styles.choiceGroupCompact : null]}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedValue === option.value }}
          onPress={() => onSelect(option.value)}
          style={[
            styles.choiceTile,
            compact ? styles.choiceTileCompact : null,
            selectedValue === option.value ? styles.choiceTileActive : null,
          ]}
        >
          <Text
            style={[
              styles.choiceTileLabel,
              selectedValue === option.value ? styles.choiceTileLabelActive : null,
            ]}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, disabled ? styles.buttonDisabled : null]}
      testID={testID}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable onPress={onPress} style={styles.secondaryButton} testID={testID}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function handleDatePickerChange(
  event: DateTimePickerEvent,
  value: Date | undefined,
  setVisible: (value: boolean) => void,
  onValidDate: (iso: string) => void,
) {
  if (event.type === "dismissed") {
    setVisible(false);
    return;
  }

  if (value) {
    onValidDate(formatLocalDate(value));
  }

  setVisible(false);
}

function formatLongDate(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContent: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    maxWidth: 840,
    overflow: "hidden",
    padding: 18,
    width: "100%",
  },
  loadingBlock: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  panel: {
    gap: 10,
  },
  progressBlock: {
    gap: 8,
  },
  kicker: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  progressPanel: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 6,
  },
  progressTrack: {
    backgroundColor: "rgba(232,196,168,0.35)",
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
  },
  progressFill: {
    backgroundColor: "#d4a574",
    borderRadius: 999,
    height: 8,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 31,
  },
  heroMuted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  formGroup: {
    gap: spacing.sm,
  },
  dateFieldShell: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateFieldValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  dateFieldValueMuted: {
    color: colors.textMuted,
  },
  secondaryLinkButton: {
    alignSelf: "flex-start",
    paddingTop: 4,
  },
  secondaryLinkButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  dayOptionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingRight: 4,
  },
  dayOptionScroll: {
    maxHeight: 276,
  },
  dayOptionButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  dayOptionButtonThreeColumns: {
    flexBasis: "31.8%",
  },
  dayOptionButtonFourColumns: {
    flexBasis: "23.75%",
  },
  dayOptionButtonSixColumns: {
    flexBasis: "15.8%",
  },
  dayOptionButtonToday: {
    minHeight: 46,
  },
  dayOptionButtonActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentStrong,
  },
  dayOptionLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  dayOptionSecondaryLabel: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  dayOptionLabelActive: {
    color: colors.accentStrong,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  messageStack: {
    gap: spacing.xs,
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  errorText: {
    color: "#b42318",
    fontSize: 14,
    lineHeight: 21,
  },
  choiceGroup: {
    gap: spacing.sm,
  },
  choiceGroupCompact: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  choiceTile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceTileCompact: {
    flexBasis: "31%",
    flexGrow: 1,
  },
  choiceTileActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentStrong,
  },
  choiceTileLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  choiceTileLabelActive: {
    color: colors.accentStrong,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderColor: colors.accentStrong,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: colors.accentStrong,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
