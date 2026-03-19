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
}: LabeledSliderFieldProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.group}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.inlineValue}>
          {value}
          {valueSuffix}
        </Text>
      </View>
      <Slider
        accessibilityLabel={label}
        maximumTrackTintColor={colors.border}
        maximumValue={maximumValue}
        minimumTrackTintColor={colors.accent}
        minimumValue={minimumValue}
        onValueChange={onValueChange}
        step={1}
        style={styles.slider}
        testID={testID}
        thumbTintColor={colors.accentStrong}
        value={value}
      />
      {showRange ? (
        <View style={styles.rangeRow}>
          <Text style={styles.rangeLabel}>
            {minimumValue}
            {valueSuffix}
          </Text>
          <Text style={styles.rangeLabel}>
            {maximumValue}
            {valueSuffix}
          </Text>
        </View>
      ) : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
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
  inlineValue: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  slider: {
    height: 32,
    width: "100%",
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
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  });
