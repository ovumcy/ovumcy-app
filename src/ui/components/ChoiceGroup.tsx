import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

type ChoiceGroupProps<T extends string> = {
  options: { value: T; label: string; secondaryLabel?: string }[];
  selectedValue: T;
  onSelect: (value: T) => void;
  compact?: boolean;
  testIDPrefix?: string;
};

export function ChoiceGroup<T extends string>({
  options,
  selectedValue,
  onSelect,
  compact = false,
  testIDPrefix,
}: ChoiceGroupProps<T>) {
  return (
    <View style={[styles.group, compact ? styles.groupCompact : null]}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedValue === option.value }}
          onPress={() => onSelect(option.value)}
          style={[
            styles.tile,
            compact ? styles.tileCompact : null,
            selectedValue === option.value ? styles.tileActive : null,
          ]}
          testID={testIDPrefix ? `${testIDPrefix}-${option.value}` : undefined}
        >
          <Text
            style={[
              styles.label,
              selectedValue === option.value ? styles.labelActive : null,
            ]}
          >
            {option.label}
          </Text>
          {option.secondaryLabel ? (
            <Text
              style={[
                styles.secondaryLabel,
                selectedValue === option.value ? styles.labelActive : null,
              ]}
            >
              {option.secondaryLabel}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  groupCompact: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  tileCompact: {
    flexBasis: "31%",
    flexGrow: 1,
  },
  tileActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentStrong,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryLabel: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  labelActive: {
    color: colors.accentStrong,
  },
});
