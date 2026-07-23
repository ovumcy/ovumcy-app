import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SettingsHubNavigationRow as SettingsHubNavigationRowData } from "../../../services/settings-view-service";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

type SettingsHubNavigationRowProps = {
  onPress: () => void;
  row: SettingsHubNavigationRowData;
  testID?: string;
};

// A tappable hub entry for one settings section that lives on its own route.
// Visual language mirrors FeatureCard; the whole card is one button so screen
// readers announce "title, description, button" as a single navigation target.
export function SettingsHubNavigationRow({
  onPress,
  row,
  testID,
}: SettingsHubNavigationRowProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityLabel={
        row.description ? `${row.title}. ${row.description}` : row.title
      }
      accessibilityRole="button"
      onPress={onPress}
      style={styles.row}
      testID={testID}
    >
      <View style={styles.textColumn}>
        <Text style={styles.title}>{row.title}</Text>
        {row.description ? (
          <Text style={styles.description}>{row.description}</Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} style={styles.chevron} />
    </Pressable>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    row: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.lineSoft,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: 18,
      shadowColor: colors.shadowSoft,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.8,
      shadowRadius: 24,
    },
    textColumn: {
      flex: 1,
      gap: 4,
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
      lineHeight: 24,
    },
    description: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    chevron: {
      color: colors.textMuted,
    },
  });
