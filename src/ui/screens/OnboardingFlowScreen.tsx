import { type ReactNode, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  buildCycleGuidanceState,
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
import { AppScreenSurface } from "../components/AppScreenSurface";
import { StatusBanner } from "../components/StatusBanner";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

export type OnboardingFlowScreenProps = {
  guidance: ReturnType<typeof buildCycleGuidanceState>;
  isSaving: boolean;
  locale: string;
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
  const { height, width } = useWindowDimensions();
  const onboardingCopy = getOnboardingCopy(language);
  const appInfo = getAppInfo(language);

  return (
    <OnboardingShell
      compact={width < 430}
      progressLabel={appInfo.name}
      progressPercent={0}
      screenHeight={height}
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
  const { height, width } = useWindowDimensions();
  const onboardingCopy = getOnboardingCopy(locale);
  const selectedDate = parseLocalDate(state.selectedDate);
  const compactLayout = width < 430;
  const dayOptionColumns = width >= 1180 ? 6 : width >= 820 ? 4 : 3;
  const displayedDate = useMemo(() => {
    if (selectedDate === null) {
      return viewData.stepOne.datePlaceholder;
    }

    return formatLongDate(selectedDate, locale);
  }, [locale, selectedDate, viewData.stepOne.datePlaceholder]);
  return (
    <OnboardingShell
      compact={compactLayout}
      progressLabel={state.step === 1 ? viewData.progressLabel : onboardingCopy.progress.step2}
      progressPercent={state.step === 1 ? 50 : 100}
      screenHeight={height}
      styles={styles}
      title={state.step === 1 ? viewData.stepOne.title : viewData.stepTwo.title}
      {...(state.step === 1 ? { subtitle: viewData.stepOne.subtitle } : {})}
    >
      {state.step === 1 ? (
        <StepOnePanel
          compact={compactLayout}
          displayedDate={displayedDate}
          isSaving={isSaving}
          onDayOptionPress={onDateSelected}
          onNext={onNext}
          dayOptionColumns={dayOptionColumns}
          selectedDateValue={state.selectedDate}
          stepOneError={stepOneError}
          styles={styles}
          viewData={viewData}
        />
      ) : (
        <StepTwoPanel
          compact={compactLayout}
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
  compact,
  progressLabel,
  progressPercent,
  screenHeight,
  title,
  subtitle,
  children,
  styles,
}: {
  compact: boolean;
  progressLabel: string;
  progressPercent: number;
  screenHeight: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const minCardHeight =
    width < 760
      ? Math.max(screenHeight - insets.top - insets.bottom - 42, 0)
      : 0;

  return (
    <AppScreenSurface>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.screenContent,
            compact ? styles.screenContentCompact : null,
            {
              paddingTop: insets.top + (compact ? 10 : 12),
              paddingBottom: Math.max(insets.bottom + (compact ? 14 : 18), compact ? 18 : 24),
            },
          ]}
          showsVerticalScrollIndicator={false}
          style={styles.screen}
        >
          <View
            style={[
              styles.heroCard,
              compact ? styles.heroCardCompact : null,
              minCardHeight > 0 ? { minHeight: minCardHeight } : null,
            ]}
          >
            <View style={[styles.progressBlock, compact ? styles.progressBlockCompact : null]}>
              <Text style={[styles.kicker, compact ? styles.kickerCompact : null]}>{progressLabel}</Text>
              <View style={[styles.progressPanel, compact ? styles.progressPanelCompact : null]}>
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
            <View style={[styles.panel, compact ? styles.panelCompact : null]}>
              <Text style={[styles.heroTitle, compact ? styles.heroTitleCompact : null]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.heroMuted, compact ? styles.heroMutedCompact : null]}>
                  {subtitle}
                </Text>
              ) : null}
              {children}
            </View>
          </View>
        </ScrollView>
      </View>
    </AppScreenSurface>
  );
}

function StepOnePanel({
  compact,
  displayedDate,
  isSaving,
  onDayOptionPress,
  onNext,
  dayOptionColumns,
  selectedDateValue,
  stepOneError,
  styles,
  viewData,
}: {
  compact: boolean;
  displayedDate: string;
  isSaving: boolean;
  onDayOptionPress: (value: string) => void;
  onNext: () => void | Promise<void>;
  dayOptionColumns: number;
  selectedDateValue: string;
  stepOneError: string;
  styles: ReturnType<typeof createStyles>;
  viewData: OnboardingViewData;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const [dayOptionGridWidth, setDayOptionGridWidth] = useState(0);
  const dayOptionWidth = useMemo(() => {
    if (dayOptionGridWidth <= 0) {
      return null;
    }

    const gap = 6;
    return Math.floor(
      (dayOptionGridWidth - gap * (dayOptionColumns - 1)) / dayOptionColumns,
    );
  }, [dayOptionColumns, dayOptionGridWidth]);
  const dateFieldContent = (
    <>
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
    </>
  );

  return (
    <>
      <Text style={[styles.helperText, compact ? styles.helperTextCompact : null]}>
        {viewData.stepOne.day1Tip}
      </Text>
      <Text style={[styles.helperText, compact ? styles.helperTextCompact : null]}>
        {viewData.stepOne.privacy}
      </Text>

      <View style={[styles.formGroup, compact ? styles.formGroupCompact : null]}>
        <Text style={[styles.fieldLabel, compact ? styles.fieldLabelCompact : null]}>
          {viewData.stepOne.fieldLabel}
        </Text>
        <View style={[styles.dateFieldShell, compact ? styles.dateFieldShellCompact : null]}>
          {dateFieldContent}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.dayOptionGrid, compact ? styles.dayOptionGridCompact : null]}
        nestedScrollEnabled
        onLayout={(event) => setDayOptionGridWidth(event.nativeEvent.layout.width)}
        persistentScrollbar
        showsVerticalScrollIndicator
        style={[
          styles.dayOptionScroll,
          compact ? styles.dayOptionScrollCompact : null,
          {
            maxHeight: compact
              ? Math.max(232, Math.min(320, Math.round(windowHeight * 0.34)))
              : Math.max(272, Math.min(388, Math.round(windowHeight * 0.4))),
          },
        ]}
      >
        {viewData.stepOne.dayOptions.map((option) => (
          <DayOptionButton
            key={option.value}
            columns={dayOptionColumns}
            isSelected={selectedDateValue === option.value}
            onPress={() => onDayOptionPress(option.value)}
            option={option}
            width={dayOptionWidth}
            styles={styles}
            compact={compact}
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
        compact={compact}
      />
    </>
  );
}

function StepTwoPanel({
  compact,
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
  compact: boolean;
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
        {guidance.cycleShort ? (
          <Text style={[styles.infoText, compact ? styles.infoTextCompact : null]}>
            {viewData.stepTwo.messages.infoCycleShort}
          </Text>
        ) : null}
      </View>
      {stepTwoError ? (
        <StatusBanner message={stepTwoError} tone="error" testID="onboarding-step-two-error" />
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

      <BinaryToggleCard
        compact={compact}
        description={viewData.stepTwo.irregularCycleHint}
        descriptionPosition="below"
        icon="〰️"
        label={viewData.stepTwo.irregularCycleLabel}
        onValueChange={onIrregularCycleChange}
        testID="onboarding-toggle-irregular-cycle"
        value={stepTwoValues.irregularCycle}
      />

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
        <SecondaryButton
          compact={compact}
          label={viewData.stepTwo.backLabel}
          onPress={onBack}
          styles={styles}
          testID="onboarding-back-button"
        />
        <PrimaryButton
          compact={compact}
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
  compact,
  columns,
  option,
  isSelected,
  onPress,
  width,
  styles,
}: {
  compact: boolean;
  columns: number;
  option: DayOption;
  isSelected: boolean;
  onPress: () => void;
  width: number | null;
  styles: ReturnType<typeof createStyles>;
}) {
  const widthStyle =
    width !== null
      ? { width }
      : columns >= 6
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
        compact ? styles.dayOptionButtonCompact : null,
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
            compact ? styles.dayOptionSecondaryLabelCompact : null,
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
  compact = false,
  label,
  onPress,
  disabled,
  styles,
  testID,
}: {
  compact?: boolean;
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
      style={[
        styles.primaryButton,
        compact ? styles.primaryButtonCompact : null,
        disabled ? styles.buttonDisabled : null,
      ]}
      testID={testID}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  compact = false,
  label,
  onPress,
  styles,
  testID,
}: {
  compact?: boolean;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.secondaryButton, compact ? styles.secondaryButtonCompact : null]}
      testID={testID}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
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
      backgroundColor: "transparent",
    },
    screenContent: {
      alignItems: "center",
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingVertical: 18,
      width: "100%",
    },
    screenContentCompact: {
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    heroCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.lineSoft,
      borderRadius: 20,
      borderWidth: 1,
      gap: 8,
      maxWidth: 840,
      overflow: "hidden",
      padding: 16,
      shadowColor: colors.shadowSoft,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.82,
      shadowRadius: 26,
      width: "100%",
    },
    heroCardCompact: {
      borderRadius: 18,
      gap: 6,
      padding: 14,
    },
    loadingBlock: {
      alignItems: "center",
      paddingVertical: spacing.xl,
    },
    panel: {
      flex: 1,
      gap: 8,
    },
    panelCompact: {
      gap: 6,
    },
    progressBlock: {
      gap: 6,
    },
    progressBlockCompact: {
      gap: 4,
    },
    kicker: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 1.1,
      textTransform: "uppercase",
    },
    kickerCompact: {
      fontSize: 12,
    },
    progressPanel: {
      backgroundColor: colors.surfaceTint,
      borderRadius: 14,
      padding: 6,
    },
    progressPanelCompact: {
      padding: 5,
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
    heroTitleCompact: {
      fontSize: 23,
      lineHeight: 28,
    },
    heroMuted: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
    heroMutedCompact: {
      fontSize: 12,
      lineHeight: 18,
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    helperTextCompact: {
      fontSize: 12,
      lineHeight: 17,
    },
    formGroup: {
      gap: spacing.sm,
    },
    formGroupCompact: {
      gap: spacing.xs,
    },
    dateFieldShell: {
      backgroundColor: colors.surfaceTint,
      borderColor: colors.lineSoft,
      borderRadius: 12,
      borderWidth: 1,
      gap: 4,
      justifyContent: "center",
      minHeight: 72,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    dateFieldShellCompact: {
      minHeight: 64,
      paddingHorizontal: 10,
      paddingVertical: 8,
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
    dayOptionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    dayOptionGridCompact: {
      gap: 4,
    },
    dayOptionScroll: {
      flexGrow: 1,
      minHeight: 272,
    },
    dayOptionScrollCompact: {
      minHeight: 232,
    },
    dayOptionButton: {
      backgroundColor: colors.surfaceTint,
      borderColor: colors.lineSoft,
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 40,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    dayOptionButtonCompact: {
      borderRadius: 10,
      minHeight: 36,
      paddingHorizontal: 6,
      paddingVertical: 5,
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
    dayOptionSecondaryLabelCompact: {
      fontSize: 9,
      marginTop: 1,
    },
    dayOptionLabelActive: {
      color: colors.accentStrong,
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    fieldLabelCompact: {
      fontSize: 12,
    },
    messageStack: {
      gap: spacing.xs,
    },
    messageStackCompact: {
      gap: 4,
    },
    infoText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    infoTextCompact: {
      fontSize: 12,
      lineHeight: 17,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
    },
    buttonRowCompact: {
      gap: 8,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.accent,
      borderColor: colors.accentStrong,
      borderRadius: 999,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 42,
      paddingHorizontal: 18,
      paddingVertical: 9,
      shadowColor: colors.accentStrong,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
    },
    primaryButtonCompact: {
      minHeight: 40,
      paddingHorizontal: 16,
      paddingVertical: 0,
    },
    primaryButtonText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 42,
      paddingHorizontal: 18,
      paddingVertical: 9,
    },
    secondaryButtonCompact: {
      minHeight: 40,
      paddingHorizontal: 16,
      paddingVertical: 0,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
