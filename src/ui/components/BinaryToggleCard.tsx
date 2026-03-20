import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type BinaryToggleCardProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon?: string;
  stateText?: string;
  testID?: string;
  descriptionPosition?: "inside" | "below";
};

export function BinaryToggleCard({
  label,
  description,
  value,
  onValueChange,
  icon,
  stateText,
  testID,
  descriptionPosition = "inside",
}: BinaryToggleCardProps) {
  const styles = useThemedStyles(createStyles);
  const descriptionText = description?.trim() ?? "";
  const showDescriptionInside = descriptionPosition === "inside";
  const showDescription = descriptionText.length > 0;

  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        onPress={() => onValueChange(!value)}
        style={({ pressed }) => [
          styles.shell,
          value ? styles.shellActive : null,
          pressed ? styles.shellPressed : null,
        ]}
        testID={testID}
      >
        <View style={styles.copy}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>
              {icon ? `${icon} ` : ""}
              {label}
            </Text>
            {stateText ? <Text style={styles.stateBadge}>{stateText}</Text> : null}
          </View>
          {showDescriptionInside && showDescription ? (
            <Text style={styles.description}>{descriptionText}</Text>
          ) : null}
        </View>
        <View style={styles.controlColumn}>
          <View
            style={[styles.toggleTrack, value ? styles.toggleTrackActive : null]}
          >
            <View
              style={[styles.toggleThumb, value ? styles.toggleThumbActive : null]}
            />
          </View>
        </View>
      </Pressable>
      {!showDescriptionInside && showDescription ? (
        <Text style={styles.description}>{descriptionText}</Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  shell: {
    alignItems: "center",
    backgroundColor: colors.surfaceTint,
    borderColor: colors.lineSoft,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  shellActive: {
    backgroundColor: colors.toggleCardActiveBg,
    borderColor: colors.toggleCardActiveBorder,
  },
  shellPressed: {
    opacity: 0.92,
  },
  copy: {
    flex: 1,
    gap: 2,
    paddingRight: spacing.sm,
  },
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  description: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  stateBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.toggleCardBadgeBg,
    borderColor: colors.toggleCardBadgeBorder,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.toggleCardBadgeText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  controlColumn: {
    alignItems: "center",
  },
  toggleTrack: {
    backgroundColor: colors.toggleTrackIdleBg,
    borderColor: colors.toggleTrackIdleBorder,
    borderRadius: 999,
    borderWidth: 1,
    height: 20,
    justifyContent: "center",
    paddingHorizontal: 2,
    width: 38,
  },
  toggleTrackActive: {
    backgroundColor: colors.accentSecondary,
    borderColor: colors.accentStrong,
  },
  toggleThumb: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    height: 14,
    width: 14,
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
    backgroundColor: colors.accentStrong,
  },
  });
