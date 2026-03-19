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
import { getAppInfo, getOnboardingCopy } from "../../i18n/app-copy";
import { BinaryToggleCard } from "../components/BinaryToggleCard";
import { ChoiceGroup } from "../components/ChoiceGroup";
import { LabeledSliderField } from "../components/LabeledSliderField";
import { StatusBanner } from "../components/StatusBanner";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

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
  const styles = useThemedStyles(createStyles);
  const { colors, language } = useAppPreferences();
  const onboardingCopy = getOnboardingCopy(language);
  const appInfo = getAppInfo(language);

  return (
    <OnboardingShell
      progressLabel={appInfo.name}
      progressPercent={0}
      styles={styles}
      subtitle={appInfo.tagline}
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
  const styles = useThemedStyles(createStyles);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { width } = useWindowDimensions();
  const onboardingCopy = getOnboardingCopy(locale);
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
      progressLabel={state.step === 1 ? viewData.progressLabel : onboardingCopy.progress.step2}
      progressPercent={state.step === 1 ? 50 : 100}
      styles={styles}
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
          styles={styles}
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
          styles={styles}
          viewData={viewData}
        />
      )}
    </OnboardingShell>
  );
}

function OnboardingShell({
  progressLabel,
  progressPercent,
  title,
  subtitle,
  children,
  styles,
}: {
  progressLabel: string;
  progressPercent: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  styles: ReturnType<typeof createStyles>;
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
                    { width: `${progressPercent}%` },
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
  styles,
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
  styles: ReturnType<typeof createStyles>;
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
          {selectedDateValue ? (
            <Text style={styles.selectedDateLabel}>
              {viewData.stepOne.selectedDateLabel}
            </Text>
          ) : null}
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
            styles={styles}
          />
        ))}
      </ScrollView>

      {stepOneError ? (
        <StatusBanner message={stepOneError} tone="error" testID="onboarding-step-one-error" />
      ) : null}

      <PrimaryButton
        disabled={isSaving}
        label={viewData.stepOne.nextLabel}
        onPress={onNext}
        styles={styles}
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
  styles,
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
  styles: ReturnType<typeof createStyles>;
  viewData: OnboardingViewData;
}) {
  return (
    <>
      <LabeledSliderField
        label={viewData.stepTwo.cycleLengthLabel}
        maximumValue={90}
        minimumValue={15}
        onValueChange={onCycleLengthChange}
        showRange
        testID="onboarding-cycle-length-slider"
        value={stepTwoValues.cycleLength}
        valueSuffix={` ${viewData.stepTwo.daysShort}`}
      />

      <LabeledSliderField
        label={viewData.stepTwo.periodLengthLabel}
        maximumValue={14}
        minimumValue={1}
        onValueChange={onPeriodLengthChange}
        showRange
        testID="onboarding-period-length-slider"
        value={stepTwoValues.periodLength}
        valueSuffix={` ${viewData.stepTwo.daysShort}`}
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
      </View>
      {stepTwoError ? (
        <StatusBanner message={stepTwoError} tone="error" testID="onboarding-step-two-error" />
      ) : null}

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
        <ChoiceGroup
          layout="stack"
          onSelect={onAgeGroupSelect}
          options={viewData.stepTwo.ageOptions}
          selectedValue={stepTwoValues.ageGroup}
          testIDPrefix="onboarding-age-group"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{viewData.stepTwo.usageGoalLabel}</Text>
        <ChoiceGroup
          layout="stack"
          onSelect={onUsageGoalSelect}
          options={viewData.stepTwo.usageGoalOptions}
          selectedValue={stepTwoValues.usageGoal}
          testIDPrefix="onboarding-usage-goal"
        />
      </View>

      <View style={styles.buttonRow}>
        <SecondaryButton
          label={viewData.stepTwo.backLabel}
          onPress={onBack}
          styles={styles}
          testID="onboarding-back-button"
        />
        <PrimaryButton
          disabled={isSaving}
          label={viewData.stepTwo.finishLabel}
          onPress={onFinish}
          styles={styles}
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
  styles,
}: {
  columns: number;
  option: DayOption;
  isSelected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
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

function PrimaryButton({
  label,
  onPress,
  disabled,
  styles,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof createStyles>;
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
  styles,
  testID,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
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

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
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
      gap: 8,
      maxWidth: 840,
      overflow: "hidden",
      padding: 16,
      width: "100%",
    },
    loadingBlock: {
      alignItems: "center",
      paddingVertical: spacing.xl,
    },
    panel: {
      gap: 8,
    },
    progressBlock: {
      gap: 6,
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
      backgroundColor: colors.accent,
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
      fontSize: 13,
      lineHeight: 20,
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    formGroup: {
      gap: spacing.sm,
    },
    dateFieldShell: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    selectedDateLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.3,
      textTransform: "uppercase",
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
      maxHeight: 232,
    },
    dayOptionButton: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 40,
      paddingHorizontal: 8,
      paddingVertical: 6,
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
      minHeight: 42,
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
      fontSize: 13,
      lineHeight: 19,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.accent,
      borderColor: colors.accentStrong,
      borderRadius: 999,
      borderWidth: 1,
      flex: 1,
      minHeight: 42,
      paddingHorizontal: 18,
      paddingVertical: 9,
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
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flex: 1,
      minHeight: 42,
      paddingHorizontal: 18,
      paddingVertical: 9,
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
