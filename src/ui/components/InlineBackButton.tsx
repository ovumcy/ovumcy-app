import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type InlineBackButtonProps = {
  label: string;
  onPress: () => void;
  testID?: string;
};

export function InlineBackButton({
  label,
  onPress,
  testID,
}: InlineBackButtonProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.button}
      testID={testID}
    >
      <View style={styles.content}>
        <Feather name="arrow-left" size={16} style={styles.icon} />
        <Text style={styles.label}>{label}</Text>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    button: {
      alignSelf: "flex-start",
      borderRadius: 999,
      marginBottom: spacing.xs,
      marginLeft: -4,
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    content: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    icon: {
      color: colors.textMuted,
    },
    label: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
  });
