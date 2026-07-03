import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type OfferCardProps = {
  title: string;
  body: string;
  ctaLabel: string;
  // Inert CTA support: "play_checkout" offers render a visible but disabled
  // CTA until Play Billing lands in a later phase.
  ctaDisabled?: boolean;
  eyebrowLabel: string;
  dismissAccessibilityLabel: string;
  onDismiss: () => void;
  onPressCTA?: (() => void) | undefined;
  testID?: string;
};

// OfferCard renders one billing-surface offer (promo or announcement).
// Visual language deliberately matches PremiumLockCard (eyebrow / title /
// description / accent CTA) so billing-area cards read as one family.
export function OfferCard({
  title,
  body,
  ctaLabel,
  ctaDisabled = false,
  eyebrowLabel,
  dismissAccessibilityLabel,
  onDismiss,
  onPressCTA,
  testID,
}: OfferCardProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow} testID={testID ? `${testID}-eyebrow` : undefined}>
          {eyebrowLabel}
        </Text>
        <Pressable
          accessibilityLabel={dismissAccessibilityLabel}
          accessibilityRole="button"
          hitSlop={12}
          onPress={onDismiss}
          style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
          testID={testID ? `${testID}-dismiss` : undefined}
        >
          <Text style={styles.dismissGlyph}>✕</Text>
        </Pressable>
      </View>
      <Text style={styles.title} testID={testID ? `${testID}-title` : undefined}>
        {title}
      </Text>
      <Text style={styles.body} testID={testID ? `${testID}-body` : undefined}>
        {body}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: ctaDisabled }}
        disabled={ctaDisabled || !onPressCTA}
        onPress={onPressCTA}
        style={({ pressed }) => [pressed && !ctaDisabled && styles.pressed]}
        testID={testID ? `${testID}-cta` : undefined}
      >
        <Text style={[styles.cta, ctaDisabled && styles.ctaDisabled]}>
          {ctaLabel}
        </Text>
      </Pressable>
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
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    eyebrow: {
      color: colors.accentStrong,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.1,
      lineHeight: 14,
      textTransform: "uppercase",
    },
    dismiss: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 28,
      minWidth: 28,
    },
    dismissGlyph: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
    },
    pressed: {
      opacity: 0.7,
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "700",
      lineHeight: 24,
      marginTop: spacing.xs / 2,
    },
    body: {
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
    ctaDisabled: {
      color: colors.textMuted,
    },
  });
