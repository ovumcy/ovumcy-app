import { useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { fontScale, spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type MultiSelectChipGroupProps<T extends string> = {
  options: readonly {
    value: T;
    label: string;
    icon?: string;
  }[];
  selectedValues: readonly T[];
  onToggle: (value: T) => void;
  compact?: boolean;
  /**
   * Visible field label that introduces this group (e.g. "Symptoms"). Same
   * contract as `ChoiceGroup.groupLabel`: the checkboxes otherwise announce
   * only their own option name with no sense of what is being chosen.
   */
  groupLabel?: string | undefined;
  testIDPrefix?: string;
};

export function MultiSelectChipGroup<T extends string>({
  options,
  selectedValues,
  onToggle,
  compact = false,
  groupLabel,
  testIDPrefix,
}: MultiSelectChipGroupProps<T>) {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const selected = new Set(selectedValues);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const compactColumnCount = resolveMultiSelectChipColumnCount(
    compact,
    measuredWidth ?? width,
  );

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    setMeasuredWidth((current) =>
      current === nextWidth || nextWidth <= 0 ? current : nextWidth,
    );
  }

  return (
    <View
      accessibilityLabel={groupLabel}
      onLayout={handleLayout}
      style={[styles.group, compact ? styles.groupCompact : null]}
      testID={testIDPrefix ? `${testIDPrefix}-group` : undefined}
    >
      {options.map((option) => {
        const isActive = selected.has(option.value);

        return (
          <Pressable
            key={option.value}
            // The chip's emoji is decoration for the word next to it; naming
            // the chip explicitly keeps the announcement to the option itself
            // instead of "grimacing face, Cramps" (same pattern as the
            // dashboard quick actions).
            accessibilityLabel={option.label}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isActive }}
            onPress={() => onToggle(option.value)}
            style={[
              styles.chip,
              compact && compactColumnCount === 1 ? styles.chipCompactSingle : null,
              compact && compactColumnCount === 2 ? styles.chipCompactTwo : null,
              compact && compactColumnCount === 3 ? styles.chipCompactThree : null,
              isActive ? styles.chipActive : null,
            ]}
            testID={testIDPrefix ? `${testIDPrefix}-${option.value}` : undefined}
          >
            {option.icon ? (
              <Text
                maxFontSizeMultiplier={fontScale.compact}
                style={styles.icon}
              >
                {option.icon}
              </Text>
            ) : null}
            <Text
              maxFontSizeMultiplier={fontScale.compact}
              style={[styles.label, isActive ? styles.labelActive : null]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    group: {
      gap: spacing.sm,
    },
    groupCompact: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    chip: {
      alignItems: "flex-start",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      minWidth: 0,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipCompactSingle: {
      flexBasis: "100%",
      flexGrow: 1,
      minWidth: 0,
    },
    chipCompactTwo: {
      flexBasis: "48%",
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    chipCompactThree: {
      flexBasis: "31%",
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
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
      flexGrow: 1,
      flexShrink: 1,
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 18,
      minWidth: 0,
    },
    labelActive: {
      color: colors.accentStrong,
    },
  });

export function resolveMultiSelectChipColumnCount(
  compact: boolean,
  availableWidth: number,
) {
  if (!compact) {
    return 1;
  }

  if (availableWidth >= 520) {
    return 3;
  }

  return availableWidth >= 360 ? 2 : 1;
}
