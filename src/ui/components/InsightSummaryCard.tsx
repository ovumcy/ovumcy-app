import { StyleSheet, Text, View } from "react-native";

import type { CurrentCycleAdvancedFertilitySummaryViewData } from "../../services/current-cycle-advanced-fertility-summary-service";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type InsightSummaryCardProps = {
  testID: string;
  viewData: CurrentCycleAdvancedFertilitySummaryViewData;
};

export function InsightSummaryCard({
  testID,
  viewData,
}: InsightSummaryCardProps) {
  const styles = useThemedStyles(createStyles);
  const toneStyles =
    viewData.tone === "success" ? styles.successCard : styles.infoCard;
  const toneTextStyles =
    viewData.tone === "success"
      ? styles.successValue
      : styles.infoValue;

  return (
    <View style={[styles.card, toneStyles]} testID={testID}>
      <Text style={styles.title} testID={`${testID}-title`}>
        {viewData.title}
      </Text>
      <Text style={styles.eyebrow} testID={`${testID}-label`}>
        {viewData.signalLabel}
      </Text>
      <Text style={[styles.value, toneTextStyles]} testID={`${testID}-value`}>
        {viewData.value}
      </Text>
      <Text style={styles.detail} testID={`${testID}-detail`}>
        {viewData.detail}
      </Text>
      <Text style={styles.hint} testID={`${testID}-hint`}>
        {viewData.hint}
      </Text>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    card: {
      borderRadius: 16,
      borderWidth: 1,
      gap: 4,
      padding: 14,
    },
    infoCard: {
      backgroundColor: colors.statusInfoBg,
      borderColor: colors.statusInfoBorder,
    },
    successCard: {
      backgroundColor: colors.statusSuccessBg,
      borderColor: colors.statusSuccessBorder,
    },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
      lineHeight: 20,
    },
    eyebrow: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 16,
      marginTop: spacing.xs / 2,
      textTransform: "uppercase",
    },
    value: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      lineHeight: 22,
    },
    infoValue: {
      color: colors.text,
    },
    successValue: {
      color: colors.statusSuccessText,
    },
    detail: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    hint: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 19,
      marginTop: 2,
    },
  });
