import Slider from "@react-native-community/slider";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

type LabeledSliderFieldProps = {
  label: string;
  hint: string;
  minimumValue: number;
  maximumValue: number;
  value: number;
  onValueChange: (value: number) => void;
  testID: string;
  valueSuffix?: string;
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
}: LabeledSliderFieldProps) {
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
        value={value}
      />
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 15,
    fontWeight: "700",
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
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
});
