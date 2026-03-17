import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";
import { type ReactNode, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

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
      subtitle={
        state.step === 1
          ? viewData.stepOne.subtitle
          : viewData.stepTwo.cycleLengthHint
      }
      title={state.step === 1 ? viewData.stepOne.title : viewData.stepTwo.title}
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
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.screenContent}
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
      <View style={styles.formGroup}>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{viewData.stepTwo.cycleLengthLabel}</Text>
          <Text style={styles.inlineValue}>{stepTwoValues.cycleLength} days</Text>
        </View>
        <Slider
          accessibilityLabel={viewData.stepTwo.cycleLengthLabel}
          maximumTrackTintColor={colors.border}
          maximumValue={90}
          minimumTrackTintColor={colors.accent}
          minimumValue={15}
          onValueChange={onCycleLengthChange}
          step={1}
          style={styles.slider}
          testID="onboarding-cycle-length-slider"
          value={stepTwoValues.cycleLength}
        />
        <Text style={styles.helperText}>{viewData.stepTwo.cycleLengthHint}</Text>
      </View>

      <View style={styles.formGroup}>
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{viewData.stepTwo.periodLengthLabel}</Text>
          <Text style={styles.inlineValue}>{stepTwoValues.periodLength} days</Text>
        </View>
        <Slider
          accessibilityLabel={viewData.stepTwo.periodLengthLabel}
          maximumTrackTintColor={colors.border}
          maximumValue={14}
          minimumTrackTintColor={colors.accent}
          minimumValue={1}
          onValueChange={onPeriodLengthChange}
          step={1}
          style={styles.slider}
          testID="onboarding-period-length-slider"
          value={stepTwoValues.periodLength}
        />
        <Text style={styles.helperText}>{viewData.stepTwo.periodLengthHint}</Text>
      </View>

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
        icon="🩸"
        label={viewData.stepTwo.autoPeriodFillLabel}
        onValueChange={onAutoPeriodFillChange}
        value={stepTwoValues.autoPeriodFill}
      />

      <BinaryToggleCard
        description={viewData.stepTwo.irregularCycleHint}
        icon="〰️"
        label={viewData.stepTwo.irregularCycleLabel}
        onValueChange={onIrregularCycleChange}
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

function BinaryToggleCard({
  label,
  icon,
  description,
  value,
  onValueChange,
}: {
  label: string;
  icon: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.formGroup}>
      <View style={[styles.toggleShell, value ? styles.toggleShellActive : null]}>
        <View style={styles.toggleCopy}>
          <Text style={styles.toggleMain}>
            {icon} {label}
          </Text>
        </View>
        <Switch
          onValueChange={onValueChange}
          thumbColor={value ? colors.accent : "#ffffff"}
          trackColor={{ false: colors.border, true: colors.accentSoft }}
          value={value}
        />
      </View>
      <Text style={styles.helperText}>{description}</Text>
    </View>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 32,
    borderWidth: 1,
    gap: spacing.lg,
    maxWidth: 860,
    overflow: "hidden",
    padding: spacing.lg,
    width: "100%",
  },
  loadingBlock: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  panel: {
    gap: spacing.md,
  },
  progressBlock: {
    gap: spacing.sm,
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
    borderRadius: 20,
    padding: spacing.sm,
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
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
  },
  heroMuted: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
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
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dateFieldValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  dateFieldValueMuted: {
    color: colors.textMuted,
  },
  secondaryLinkButton: {
    alignSelf: "flex-start",
    paddingTop: spacing.xs,
  },
  secondaryLinkButtonText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  dayOptionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingRight: 4,
  },
  dayOptionScroll: {
    maxHeight: 288,
  },
  dayOptionButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  dayOptionButtonThreeColumns: {
    flexBasis: "31%",
  },
  dayOptionButtonFourColumns: {
    flexBasis: "23.5%",
  },
  dayOptionButtonSixColumns: {
    flexBasis: "15.5%",
  },
  dayOptionButtonToday: {
    minHeight: 54,
  },
  dayOptionButtonActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentStrong,
  },
  dayOptionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  dayOptionSecondaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  dayOptionLabelActive: {
    color: colors.accentStrong,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  fieldRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  inlineValue: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  slider: {
    height: 40,
    width: "100%",
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
  toggleShell: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleShellActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  toggleCopy: {
    flex: 1,
    paddingRight: spacing.md,
  },
  toggleMain: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
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
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
    fontSize: 15,
    fontWeight: "600",
  },
  choiceTileLabelActive: {
    color: colors.accentStrong,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderColor: colors.accentStrong,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: colors.accentStrong,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
