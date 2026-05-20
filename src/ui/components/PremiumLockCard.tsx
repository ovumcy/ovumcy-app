import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type PremiumLockCardProps = {
  title: string;
  description: string;
  ctaLabel?: string | undefined;
  eyebrowLabel: string;
  onPress?: (() => void) | undefined;
  testID?: string;
};

export function PremiumLockCard({
  title,
  description,
  ctaLabel,
  eyebrowLabel,
  onPress,
  testID,
}: PremiumLockCardProps) {
  const styles = useThemedStyles(createStyles);
  const hasCTA = Boolean(ctaLabel && onPress);
  const body = (
    <>
      <Text style={styles.eyebrow} testID={testID ? `${testID}-eyebrow` : undefined}>
        {eyebrowLabel}
      </Text>
      <Text style={styles.title} testID={testID ? `${testID}-title` : undefined}>
        {title}
      </Text>
      <Text
        style={styles.description}
        testID={testID ? `${testID}-description` : undefined}
      >
        {description}
      </Text>
      {hasCTA && ctaLabel ? (
        <Text style={styles.cta} testID={testID ? `${testID}-cta` : undefined}>
          {ctaLabel}
        </Text>
      ) : null}
    </>
  );

  if (hasCTA && onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        testID={testID}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View style={styles.card} testID={testID}>
      {body}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.statusInfoBg,
      borderColor: colors.statusInfoBorder,
      borderRadius: 18,
      borderWidth: 1,
      gap: 6,
      padding: 18,
    },
    cardPressed: {
      opacity: 0.7,
    },
    eyebrow: {
      color: colors.accentStrong,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.1,
      lineHeight: 14,
      textTransform: "uppercase",
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
      lineHeight: 24,
      marginTop: spacing.xs / 2,
    },
    description: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    cta: {
      color: colors.accentStrong,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 20,
      marginTop: spacing.xs / 2,
    },
  });
