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
          <View style={styles.labelRow}>
            <Text style={styles.label}>
              {icon ? `${icon} ` : ""}
              {label}
            </Text>
            {stateText ? <Text style={styles.stateBadge}>{stateText}</Text> : null}
          </View>
          {showDescriptionInside ? (
            <Text style={styles.description}>{description}</Text>
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
    backgroundColor: "rgba(255, 248, 240, 0.82)",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  shellActive: {
    backgroundColor: "rgba(255, 240, 236, 0.96)",
    borderColor: "rgba(199,117,109,0.52)",
  },
  shellPressed: {
    opacity: 0.92,
  },
  copy: {
    flex: 1,
    gap: 3,
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
    fontSize: 13,
    lineHeight: 18,
  },
  stateBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.58)",
    borderColor: "rgba(188,165,138,0.32)",
    borderRadius: 999,
    borderWidth: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    paddingHorizontal: 9,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  controlColumn: {
    alignItems: "center",
  },
  toggleTrack: {
    backgroundColor: "rgba(218,205,189,0.36)",
    borderColor: "rgba(188,165,138,0.48)",
    borderRadius: 999,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    paddingHorizontal: 2,
    width: 42,
  },
  toggleTrackActive: {
    backgroundColor: colors.accentSecondary,
    borderColor: colors.accentStrong,
  },
  toggleThumb: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    height: 16,
    width: 16,
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
    backgroundColor: colors.accentStrong,
  },
});
