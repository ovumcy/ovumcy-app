import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type ChoiceGroupProps<T extends string | number> = {
  options: readonly {
    value: T;
    label: string;
    secondaryLabel?: string;
  }[];
  selectedValue?: T | undefined;
  onSelect: (value: T) => void;
  layout?: "stack" | "grid2" | "grid3" | "grid5";
  contentAlign?: "leading" | "center";
  compact?: boolean;
  onClearSelection?: () => void;
  testIDPrefix?: string;
};

export function ChoiceGroup<T extends string | number>({
  options,
  selectedValue,
  onSelect,
  layout = "stack",
  contentAlign = "leading",
  compact = false,
  onClearSelection,
  testIDPrefix,
}: ChoiceGroupProps<T>) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const resolvedColumnCount =
    layout === "grid2"
      ? 2
      : layout === "grid3"
        ? width >= 340
          ? 3
          : 2
        : layout === "grid5"
          ? width >= 320
            ? 5
            : 3
        : compact
          ? width >= 520
            ? 3
            : 2
          : 1;

  return (
    <View
      style={[
        styles.group,
        resolvedColumnCount === 5 ? styles.groupFive : null,
        resolvedColumnCount > 1 ? styles.groupWrapped : null,
      ]}
    >
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: selectedValue === option.value }}
          onPress={() => {
            if (selectedValue === option.value && onClearSelection) {
              onClearSelection();
              return;
            }

            onSelect(option.value);
          }}
          style={[
            styles.tile,
            compact ? styles.tileCompact : null,
            resolvedColumnCount === 2 ? styles.tileGridTwo : null,
            resolvedColumnCount === 3 ? styles.tileGridThree : null,
            resolvedColumnCount === 5 ? styles.tileGridFive : null,
            resolvedColumnCount === 5 && compact ? styles.tileGridFiveCompact : null,
            contentAlign === "center" ? styles.tileCentered : null,
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

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  groupFive: {
    columnGap: 0,
    justifyContent: "space-between",
    rowGap: spacing.xs,
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
  tileCompact: {
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tileGridTwo: {
    flexBasis: "48%",
    flexGrow: 1,
  },
  tileGridThree: {
    flexBasis: "31%",
    flexGrow: 1,
  },
  tileGridFive: {
    flexBasis: "18%",
    flexGrow: 0,
    flexShrink: 0,
  },
  tileGridFiveCompact: {
    minHeight: 32,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  tileCentered: {
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 10,
    lineHeight: 13,
  },
  labelActive: {
    color: colors.accentStrong,
  },
  });
