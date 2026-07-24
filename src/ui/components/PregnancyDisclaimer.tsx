import { StyleSheet, Text } from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type PregnancyDisclaimerProps = {
  text: string;
  testID?: string;
};

/**
 * Persistent "estimates, not medical advice — talk to your doctor or midwife"
 * disclaimer shown on every pregnancy-mode surface (the pregnancy dashboard and
 * the start wizard), unconditionally. Mirrors PredictionDisclaimer: it only
 * presents copy owned by the shared `pregnancy-copy` catalog so the surfaces
 * never drift. See SECURITY.md (Medical safety invariant).
 */
export function PregnancyDisclaimer({ text, testID }: PregnancyDisclaimerProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Text style={styles.disclaimerText} testID={testID}>
      {text}
    </Text>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    disclaimerText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
  });
