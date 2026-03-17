import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

type MultiSelectChipGroupProps<T extends string> = {
  options: {
    value: T;
    label: string;
    icon?: string;
  }[];
  selectedValues: readonly T[];
  onToggle: (value: T) => void;
  compact?: boolean;
  testIDPrefix?: string;
};

export function MultiSelectChipGroup<T extends string>({
  options,
  selectedValues,
  onToggle,
  compact = false,
  testIDPrefix,
}: MultiSelectChipGroupProps<T>) {
  const selected = new Set(selectedValues);

  return (
    <View style={[styles.group, compact ? styles.groupCompact : null]}>
      {options.map((option) => {
        const isActive = selected.has(option.value);

        return (
          <Pressable
            key={option.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isActive }}
            onPress={() => onToggle(option.value)}
            style={[
              styles.chip,
              compact ? styles.chipCompact : null,
              isActive ? styles.chipActive : null,
            ]}
            testID={testIDPrefix ? `${testIDPrefix}-${option.value}` : undefined}
          >
            {option.icon ? <Text style={styles.icon}>{option.icon}</Text> : null}
            <Text style={[styles.label, isActive ? styles.labelActive : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
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
  chip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipCompact: {
    flexBasis: "31%",
    flexGrow: 1,
  },
  chipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentStrong,
  },
  icon: {
    fontSize: 16,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  labelActive: {
    color: colors.accentStrong,
  },
});
