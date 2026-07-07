import { StyleSheet, Text } from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type PredictionDisclaimerProps = {
  text: string;
  testID?: string;
};

/**
 * Persistent "estimates, not medical advice or contraception" disclaimer shown
 * near every prediction surface (dashboard, calendar, stats). Web parity: all
 * three templates render `dashboard.prediction_disclaimer` in the same muted
 * footer (`data-*-prediction-disclaimer`). The copy is owned by the shared
 * `predictionDisclaimer` i18n key; this component only presents it, so the
 * three surfaces never drift. See SECURITY.md (Medical safety invariant).
 */
export function PredictionDisclaimer({ text, testID }: PredictionDisclaimerProps) {
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
