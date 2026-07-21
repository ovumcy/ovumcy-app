import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { DayOption } from "../../../models/onboarding";
import type { OnboardingViewData } from "../../../services/onboarding-view-service";
import { StatusBanner } from "../../components/StatusBanner";
import { OnboardingPrimaryButton } from "./OnboardingButtons";
import type { OnboardingFlowStyles } from "./onboarding-flow-styles";

type OnboardingStepOnePanelProps = {
  compact: boolean;
  dayOptionColumns: number;
  displayedDate: string;
  isSaving: boolean;
  onDayOptionPress: (value: string) => void;
  onDismissStepOneError: (() => void | Promise<void>) | undefined;
  onDismissStepOneNotice: (() => void | Promise<void>) | undefined;
  onNext: () => void | Promise<void>;
  onOpenPrivacyNotice: () => void | Promise<void>;
  selectedDateValue: string;
  stepOneError: string;
  stepOneNotice: {
    dismissLabel: string;
    message: string;
  } | null;
  styles: OnboardingFlowStyles;
  viewData: OnboardingViewData;
};

type DayOptionButtonProps = {
  columns: number;
  compact: boolean;
  isSelected: boolean;
  onPress: () => void;
  option: DayOption;
  styles: OnboardingFlowStyles;
  width: number | null;
};

export function OnboardingStepOnePanel({
  compact,
  dayOptionColumns,
  displayedDate,
  isSaving,
  onDayOptionPress,
  onDismissStepOneError,
  onDismissStepOneNotice,
  onNext,
  onOpenPrivacyNotice,
  selectedDateValue,
  stepOneError,
  stepOneNotice,
  styles,
  viewData,
}: OnboardingStepOnePanelProps) {
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

  return (
    <View style={styles.stepOneLayout}>
      <View style={styles.stepOneHeaderStack}>
        {stepOneNotice ? (
          <StatusBanner
            dismissLabel={stepOneNotice.dismissLabel}
            message={stepOneNotice.message}
            onDismiss={onDismissStepOneNotice}
            testID="onboarding-step-one-note"
            tone="info"
          />
        ) : null}

        <View style={[styles.formGroup, compact ? styles.formGroupCompact : null]}>
          <View style={[styles.dateFieldShell, compact ? styles.dateFieldShellCompact : null]}>
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
          </View>
        </View>
      </View>

      <View style={styles.stepOneScrollRegion}>
        <ScrollView
          contentContainerStyle={[styles.dayOptionGrid, compact ? styles.dayOptionGridCompact : null]}
          nestedScrollEnabled
          onLayout={(event) => setDayOptionGridWidth(event.nativeEvent.layout.width)}
          persistentScrollbar
          showsVerticalScrollIndicator
          style={[
            styles.dayOptionScroll,
            compact ? styles.dayOptionScrollCompact : null,
          ]}
        >
          {viewData.stepOne.dayOptions.map((option) => (
            <DayOptionButton
              key={option.value}
              columns={dayOptionColumns}
              compact={compact}
              isSelected={selectedDateValue === option.value}
              onPress={() => onDayOptionPress(option.value)}
              option={option}
              styles={styles}
              width={dayOptionWidth}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.stepOneFooter}>
        {stepOneError ? (
          <StatusBanner
            dismissLabel={viewData.errors.dismissError}
            message={stepOneError}
            onDismiss={onDismissStepOneError}
            testID="onboarding-step-one-error"
            tone="error"
          />
        ) : null}

        <OnboardingPrimaryButton
          compact={compact}
          disabled={isSaving}
          label={viewData.stepOne.nextLabel}
          onPress={onNext}
          styles={styles}
          testID="onboarding-next-button"
        />

        <View style={styles.privacyNoticeRow}>
          {/* One size at every width: this line is already the small style,
              and a compact variant would only shave a pixel off text that has
              to stay legible on the narrowest phone. */}
          <Text style={styles.infoText}>
            {viewData.stepOne.privacyNotice}
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={onOpenPrivacyNotice}
            testID="onboarding-privacy-notice-link"
          >
            <Text style={styles.privacyNoticeLink}>
              {viewData.stepOne.privacyNoticeLink}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function DayOptionButton({
  columns,
  compact,
  isSelected,
  onPress,
  option,
  styles,
  width,
}: DayOptionButtonProps) {
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
