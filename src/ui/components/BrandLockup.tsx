import { Image, StyleSheet, Text, View } from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type BrandLockupProps = {
  subtitle?: string;
};

export function BrandLockup({ subtitle }: BrandLockupProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.lockup}>
      {/* The mark repeats the wordmark that follows it, so it is decorative:
          announcing it would make a screen reader say "Ovumcy" twice. */}
      <Image
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        source={require("../../../assets/branding/ovumcy-icon-192.png")}
        style={styles.icon}
      />
      <View style={styles.copy}>
        <Text style={styles.title}>Ovumcy</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    lockup: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    icon: {
      borderRadius: 14,
      height: 32,
      width: 32,
    },
    copy: {
      gap: 1,
    },
    title: {
      color: colors.brand,
      fontSize: 18,
      fontWeight: "800",
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
  });
