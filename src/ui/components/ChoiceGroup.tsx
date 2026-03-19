import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { colors, spacing } from "../theme/tokens";

type ChoiceGroupProps<T extends string | number> = {
  options: { value: T; label: string; secondaryLabel?: string }[];
  selectedValue?: T | undefined;
  onSelect: (value: T) => void;
  layout?: "stack" | "grid2" | "grid3";
  compact?: boolean;
  testIDPrefix?: string;
};

export function ChoiceGroup<T extends string | number>({
  options,
  selectedValue,
  onSelect,
  layout = "stack",
  compact = false,
  testIDPrefix,
}: ChoiceGroupProps<T>) {
  const { width } = useWindowDimensions();
  const resolvedColumnCount =
    layout === "grid2"
      ? 2
      : layout === "grid3"
        ? width >= 340
          ? 3
          : 2
        : compact
          ? width >= 520
            ? 3
            : 2
          : 1;

  return (
    <View
      style={[
        styles.group,
        resolvedColumnCount > 1 ? styles.groupWrapped : null,
      ]}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedValue === option.value }}
          onPress={() => onSelect(option.value)}
          style={[
            styles.tile,
            resolvedColumnCount === 2 ? styles.tileGridTwo : null,
            resolvedColumnCount === 3 ? styles.tileGridThree : null,
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
  groupWrapped: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tile: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tileGridTwo: {
    flexBasis: "48%",
    flexGrow: 1,
  },
  tileGridThree: {
    flexBasis: "31%",
    flexGrow: 1,
  },
  tileActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentStrong,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  secondaryLabel: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  labelActive: {
    color: colors.accentStrong,
  },
});
