import { StyleSheet, Text, View } from "react-native";

import type { SettingsSyncSummaryViewData } from "../../services/settings-view-service";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";
import { AppButton } from "./AppButton";
import { FeatureCard } from "./FeatureCard";
import { StatusBanner } from "./StatusBanner";

type SettingsSyncSummaryCardProps = {
  onOpen: () => void | Promise<void>;
  summary: SettingsSyncSummaryViewData;
};

export function SettingsSyncSummaryCard({
  onOpen,
  summary,
}: SettingsSyncSummaryCardProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <FeatureCard
      description={summary.description}
      testID="settings-sync-summary-card"
      title={summary.title}
    >
      <StatusBanner
        message={summary.statusMessage}
        testID="settings-sync-summary-status"
        tone={summary.statusTone}
      />

      <View style={styles.detailStack}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{summary.destinationLabel}</Text>
          <Text style={styles.detailValue}>{summary.destinationValue}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{summary.lastSyncLabel}</Text>
          <Text style={styles.detailValue}>{summary.lastSyncValue}</Text>
        </View>
      </View>

      <AppButton
        label={summary.actionLabel}
        onPress={onOpen}
        testID="settings-open-backup-sync-button"
      />
    </FeatureCard>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    detailStack: {
      gap: spacing.sm,
    },
    detailRow: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    detailLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    detailValue: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
  });
