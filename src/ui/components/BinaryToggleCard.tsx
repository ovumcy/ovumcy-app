import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

type BinaryToggleCardProps = {
  label: string;
  description: string;
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
  const showDescriptionInside = descriptionPosition === "inside";

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
          <Text style={styles.label}>
            {icon ? `${icon} ` : ""}
            {label}
          </Text>
          {showDescriptionInside ? (
            <Text style={styles.description}>{description}</Text>
          ) : null}
          {stateText ? <Text style={styles.state}>{stateText}</Text> : null}
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
      {!showDescriptionInside ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  shell: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  shellActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentStrong,
  },
  shellPressed: {
    opacity: 0.92,
  },
  copy: {
    flex: 1,
    gap: 4,
    paddingRight: spacing.md,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  state: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  controlColumn: {
    alignItems: "center",
  },
  toggleTrack: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    paddingHorizontal: 2,
    width: 48,
  },
  toggleTrackActive: {
    backgroundColor: colors.accentSecondary,
    borderColor: colors.accentStrong,
  },
  toggleThumb: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 20,
    width: 20,
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
    backgroundColor: colors.accentStrong,
  },
});
