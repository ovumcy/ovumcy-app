import Slider from "@react-native-community/slider";
import { StyleSheet, Text, View } from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useAppTheme, useThemedStyles } from "../theme/useThemedStyles";

type LabeledSliderFieldProps = {
  label: string;
  hint?: string;
  minimumValue: number;
  maximumValue: number;
  value: number;
  onValueChange: (value: number) => void;
  testID: string;
  valueSuffix?: string;
  showRange?: boolean;
  compact?: boolean;
};

export function LabeledSliderField({
  label,
  hint,
  minimumValue,
  maximumValue,
  value,
  onValueChange,
  testID,
  valueSuffix = "",
  showRange = false,
  compact = false,
}: LabeledSliderFieldProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.group}>
      <View style={styles.row}>
        <Text style={[styles.label, compact ? styles.labelCompact : null]}>
          {label}
        </Text>
        <Text style={[styles.inlineValue, compact ? styles.inlineValueCompact : null]}>
          {value}
          {valueSuffix}
        </Text>
      </View>
      <Slider
        accessibilityLabel={label}
        maximumTrackTintColor={colors.accentSecondary}
        maximumValue={maximumValue}
        minimumTrackTintColor={colors.accent}
        minimumValue={minimumValue}
        onValueChange={onValueChange}
        step={1}
        style={[styles.slider, compact ? styles.sliderCompact : null]}
        testID={testID}
        thumbTintColor={colors.accentStrong}
        value={value}
      />
      {showRange ? (
        <View style={styles.rangeRow}>
          <Text style={[styles.rangeLabel, compact ? styles.rangeLabelCompact : null]}>
            {minimumValue}
            {valueSuffix}
          </Text>
          <Text style={[styles.rangeLabel, compact ? styles.rangeLabelCompact : null]}>
            {maximumValue}
            {valueSuffix}
          </Text>
        </View>
      ) : null}
      {hint ? <Text style={[styles.hint, compact ? styles.hintCompact : null]}>{hint}</Text> : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  labelCompact: {
    fontSize: 13,
  },
  inlineValue: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  inlineValueCompact: {
    fontSize: 12,
  },
  slider: {
    height: 36,
    width: "100%",
  },
  sliderCompact: {
    height: 28,
  },
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rangeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  rangeLabelCompact: {
    fontSize: 11,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  hintCompact: {
    fontSize: 12,
    lineHeight: 17,
  },
  });
