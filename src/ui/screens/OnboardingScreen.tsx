import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { onboardingCopy } from "../../i18n/app-copy";
import type {
  AgeGroupOption,
  DayOption,
  OnboardingRecord,
  OnboardingStep,
  OnboardingStepTwoValues,
  UsageGoal,
} from "../../models/onboarding";
import { appStorage } from "../../services/app-bootstrap-service";
import {
  addDays,
  buildCycleGuidanceState,
  createStepTwoDefaults,
  formatLocalDate,
  parseLocalDate,
  resolveOnboardingStep,
  sanitizeStepTwoValues,
  validateStepOneStartDate,
} from "../../services/onboarding-policy";
import { buildOnboardingViewData } from "../../services/onboarding-view-service";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { colors, spacing } from "../theme/tokens";

type OnboardingScreenProps = {
  storage?: LocalAppStorage;
  now?: Date;
  onFinished?: () => void;
};

type LoadedOnboardingState = {
  record: OnboardingRecord;
  step: OnboardingStep;
  selectedDate: string;
  stepTwoValues: OnboardingStepTwoValues;
};

export function OnboardingScreen({
  storage = appStorage,
  now = new Date(),
  onFinished,
}: OnboardingScreenProps) {
  const router = useRouter();
  const locale = useMemo(() => resolveLocale(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [state, setState] = useState<LoadedOnboardingState | null>(null);
  const [stepOneError, setStepOneError] = useState<string>("");
  const [stepTwoError, setStepTwoError] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const [bootstrapState, record] = await Promise.all([
        storage.readBootstrapState(),
        storage.readOnboardingRecord(),
      ]);

      if (!isMounted) {
        return;
      }

      if (bootstrapState.hasCompletedOnboarding) {
        navigateToDashboard(router, onFinished);
        return;
      }

      const loadedState: LoadedOnboardingState = {
        record,
        step: resolveOnboardingStep(record, false),
        selectedDate: record.lastPeriodStart ?? "",
        stepTwoValues: createStepTwoDefaults(record),
      };

      setState(loadedState);
      setIsLoading(false);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [onFinished, router, storage]);

  const viewData = useMemo(() => {
    if (!state) {
      return null;
    }

    return buildOnboardingViewData(state.record, now, locale);
  }, [locale, now, state]);

  const guidance = useMemo(() => {
    if (!state) {
      return null;
    }

    return buildCycleGuidanceState(
      state.stepTwoValues.cycleLength,
      state.stepTwoValues.periodLength,
    );
  }, [state]);

  if (isLoading || !state || !viewData || !guidance) {
    return (
      <OnboardingShell
        progressLabel="Ovumcy"
        title={onboardingCopy.loading}
        subtitle="Preparing your private onboarding flow."
      >
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </OnboardingShell>
    );
  }

  const currentState = state;
  const currentViewData = viewData;
  const currentGuidance = guidance;

  const selectedDate = parseLocalDate(currentState.selectedDate);
  const displayedDate =
    selectedDate !== null ? formatLongDate(selectedDate, locale) : "No date selected";
  const supportsNativeDatePicker = Platform.OS !== "web";
  const datePickerBounds = {
    ...(parseLocalDate(currentViewData.stepOne.maxDate)
      ? {
          maximumDate: parseLocalDate(currentViewData.stepOne.maxDate) as Date,
        }
      : {}),
    ...(parseLocalDate(currentViewData.stepOne.minDate)
      ? {
          minimumDate: parseLocalDate(currentViewData.stepOne.minDate) as Date,
        }
      : {}),
  };

  async function handleStepOneNext() {
    const errorCode = validateStepOneStartDate(currentState.selectedDate, now);
    if (errorCode) {
      setStepOneError(resolveStepOneError(errorCode, currentViewData));
      return;
    }

    setIsSaving(true);
    setStepOneError("");

    const nextRecord: OnboardingRecord = {
      ...currentState.record,
      lastPeriodStart: currentState.selectedDate,
    };

    try {
      await storage.writeOnboardingRecord(nextRecord);
      setState((current) =>
        current
          ? {
              ...current,
              record: nextRecord,
              step: 2,
            }
          : current,
      );
    } catch {
      setStepOneError(currentViewData.errors.generic);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFinish() {
    if (!currentState.record.lastPeriodStart) {
      setStepTwoError(currentViewData.errors.dateRequired);
      return;
    }

    setIsSaving(true);
    setStepTwoError("");

    const sanitizedValues = sanitizeStepTwoValues(currentState.stepTwoValues);
    const completedRecord: OnboardingRecord = {
      ...currentState.record,
      lastPeriodStart: currentState.record.lastPeriodStart,
      cycleLength: sanitizedValues.cycleLength,
      periodLength: sanitizedValues.periodLength,
      autoPeriodFill: sanitizedValues.autoPeriodFill,
      irregularCycle: sanitizedValues.irregularCycle,
      ageGroup: sanitizedValues.ageGroup,
      usageGoal: sanitizedValues.usageGoal,
    };

    try {
      await Promise.all([
        storage.writeOnboardingRecord(completedRecord),
        storage.writeBootstrapState({
          hasCompletedOnboarding: true,
          profileVersion: 1,
        }),
      ]);
      setState((current) =>
        current
          ? {
              ...current,
              record: completedRecord,
            }
          : current,
      );
      navigateToDashboard(router, onFinished);
    } catch {
      setStepTwoError(currentViewData.errors.generic);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <OnboardingShell
      progressLabel={
        currentState.step === 1
          ? currentViewData.progressLabel
          : onboardingCopy.progress.step2
      }
      subtitle={
        currentState.step === 1
          ? currentViewData.stepOne.subtitle
          : currentViewData.stepTwo.cycleLengthHint
      }
      title={
        currentState.step === 1
          ? currentViewData.stepOne.title
          : currentViewData.stepTwo.title
      }
    >
      {currentState.step === 1 ? (
        <StepOnePanel
          datePickerBounds={datePickerBounds}
          displayedDate={displayedDate}
          isSaving={isSaving}
          now={now}
          onDatePickerToggle={() => setShowDatePicker((current) => !current)}
          onDayOptionPress={(value) => {
            setState((current) =>
              current
                ? {
                    ...current,
                    selectedDate: value,
                  }
                : current,
            );
            setStepOneError("");
          }}
          onDatePickerChange={(event, value) =>
            handleDatePickerChange(event, value, setShowDatePicker, (iso) => {
              setState((current) =>
                current
                  ? {
                      ...current,
                      selectedDate: iso,
                    }
                  : current,
              );
              setStepOneError("");
            })
          }
          onNext={handleStepOneNext}
          selectedDate={selectedDate}
          selectedDateValue={currentState.selectedDate}
          showDatePicker={showDatePicker}
          stepOneError={stepOneError}
          supportsNativeDatePicker={supportsNativeDatePicker}
          viewData={currentViewData}
        />
      ) : (
        <StepTwoPanel
          guidance={currentGuidance}
          isSaving={isSaving}
          onAutoPeriodFillChange={(value) => {
            setState((current) =>
              current
                ? {
                    ...current,
                    stepTwoValues: {
                      ...current.stepTwoValues,
                      autoPeriodFill: value,
                    },
                  }
                : current,
            );
          }}
          onAgeGroupSelect={(value) => {
            setState((current) =>
              current
                ? {
                    ...current,
                    stepTwoValues: {
                      ...current.stepTwoValues,
                      ageGroup: value,
                    },
                  }
                : current,
            );
          }}
          onBack={() =>
            setState((current) => (current ? { ...current, step: 1 } : current))
          }
          onCycleLengthChange={(value) => {
            setState((current) =>
              current
                ? {
                    ...current,
                    stepTwoValues: sanitizeStepTwoValues({
                      ...current.stepTwoValues,
                      cycleLength: Math.round(value),
                    }),
                  }
                : current,
            );
            setStepTwoError("");
          }}
          onFinish={handleFinish}
          onIrregularCycleChange={(value) => {
            setState((current) =>
              current
                ? {
                    ...current,
                    stepTwoValues: {
                      ...current.stepTwoValues,
                      irregularCycle: value,
                    },
                  }
                : current,
            );
          }}
          onPeriodLengthChange={(value) => {
            setState((current) =>
              current
                ? {
                    ...current,
                    stepTwoValues: sanitizeStepTwoValues({
                      ...current.stepTwoValues,
                      periodLength: Math.round(value),
                    }),
                  }
                : current,
            );
            setStepTwoError("");
          }}
          onUsageGoalSelect={(value) => {
            setState((current) =>
              current
                ? {
                    ...current,
                    stepTwoValues: {
                      ...current.stepTwoValues,
                      usageGoal: value,
                    },
                  }
                : current,
            );
          }}
          stepTwoError={stepTwoError}
          stepTwoValues={currentState.stepTwoValues}
          viewData={currentViewData}
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
  selectedDate: Date | null;
  selectedDateValue: string;
  showDatePicker: boolean;
  stepOneError: string;
  supportsNativeDatePicker: boolean;
  viewData: ReturnType<typeof buildOnboardingViewData>;
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

      <View style={styles.dayOptionGrid}>
        {viewData.stepOne.dayOptions.map((option) => (
          <DayOptionButton
            key={option.value}
            isSelected={selectedDateValue === option.value}
            option={option}
            onPress={() => onDayOptionPress(option.value)}
          />
        ))}
      </View>

      {stepOneError ? <Text style={styles.errorText}>{stepOneError}</Text> : null}

      <PrimaryButton
        disabled={isSaving}
        label={viewData.stepOne.nextLabel}
        testID="onboarding-next-button"
        onPress={onNext}
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
  viewData: ReturnType<typeof buildOnboardingViewData>;
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
        value={stepTwoValues.autoPeriodFill}
        onValueChange={onAutoPeriodFillChange}
      />

      <BinaryToggleCard
        description={viewData.stepTwo.irregularCycleHint}
        icon="〰️"
        label={viewData.stepTwo.irregularCycleLabel}
        value={stepTwoValues.irregularCycle}
        onValueChange={onIrregularCycleChange}
      />

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{viewData.stepTwo.ageGroupLabel}</Text>
        <Text style={styles.helperText}>{viewData.stepTwo.ageGroupHint}</Text>
        <ChoiceGroup
          compact
          options={viewData.stepTwo.ageOptions}
          selectedValue={stepTwoValues.ageGroup}
          onSelect={onAgeGroupSelect}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{viewData.stepTwo.usageGoalLabel}</Text>
        <Text style={styles.helperText}>{viewData.stepTwo.usageGoalHint}</Text>
        <ChoiceGroup
          options={viewData.stepTwo.usageGoalOptions}
          selectedValue={stepTwoValues.usageGoal}
          onSelect={onUsageGoalSelect}
        />
      </View>

      <View style={styles.buttonRow}>
        <SecondaryButton
          label={viewData.stepTwo.backLabel}
          testID="onboarding-back-button"
          onPress={onBack}
        />
        <PrimaryButton
          disabled={isSaving}
          label={viewData.stepTwo.finishLabel}
          testID="onboarding-finish-button"
          onPress={onFinish}
        />
      </View>
    </>
  );
}

function DayOptionButton({
  option,
  isSelected,
  onPress,
}: {
  option: DayOption;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={[styles.dayOptionButton, isSelected ? styles.dayOptionButtonActive : null]}
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
          trackColor={{ false: colors.border, true: colors.accentSoft }}
          thumbColor={value ? colors.accent : "#ffffff"}
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
      style={[
        styles.primaryButton,
        disabled ? styles.buttonDisabled : null,
      ]}
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

function resolveStepOneError(
  code: "date_required" | "invalid_last_period_start" | "last_period_range",
  viewData: ReturnType<typeof buildOnboardingViewData>,
): string {
  switch (code) {
    case "date_required":
      return viewData.errors.dateRequired;
    case "invalid_last_period_start":
      return viewData.errors.invalidLastPeriodStart;
    case "last_period_range":
      return viewData.errors.lastPeriodRange;
  }
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

function navigateToDashboard(
  router: ReturnType<typeof useRouter>,
  onFinished?: () => void,
) {
  if (onFinished) {
    onFinished();
    return;
  }

  router.replace("/(tabs)/dashboard");
}

function resolveLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en";
  } catch {
    return "en";
  }
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
  },
  dayOptionButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    minWidth: "30%",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  dayOptionButtonActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
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
    color: colors.accent,
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
    borderColor: colors.accent,
  },
  choiceTileLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  choiceTileLabelActive: {
    color: colors.accent,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 999,
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
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
