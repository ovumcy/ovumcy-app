import { Text, View } from "react-native";

import type { StatsViewData } from "../../../services/stats-view-service";
import { FeatureCard } from "../../components/FeatureCard";
import { PremiumLockCard } from "../../components/PremiumLockCard";
import { composeStatsAccessibilityLabel } from "./StatsOverviewShared";
import type { StatsOverviewStyles } from "./stats-overview-styles";

type StatsOverviewExtendedReportsSectionProps = {
  styles: StatsOverviewStyles;
  viewData: StatsViewData;
  onPremiumCTAPress?: (() => void) | undefined;
};

export function StatsOverviewExtendedReportsSection({
  styles,
  viewData,
  onPremiumCTAPress,
}: StatsOverviewExtendedReportsSectionProps) {
  if (!viewData.extendedReports || viewData.extendedReports.rows.length === 0) {
    const lock = viewData.premiumLocks?.extendedReports;
    if (!lock) {
      return null;
    }

    return (
      <PremiumLockCard
        ctaLabel={lock.ctaLabel}
        description={lock.description}
        eyebrowLabel={lock.eyebrowLabel}
        onPress={onPremiumCTAPress ?? (() => {})}
        testID="stats-extended-reports-lock"
        title={lock.title}
      />
    );
  }

  return (
    <FeatureCard
      description={viewData.extendedReports.subtitle}
      testID="stats-extended-reports"
      title={viewData.extendedReports.title}
    >
      <Text style={styles.helperText}>{viewData.extendedReports.summary}</Text>
      <View style={styles.listStack}>
        {viewData.extendedReports.rows.map((row) => (
          <View
            accessibilityLabel={composeStatsAccessibilityLabel([
              row.title,
              row.comparisonLabel,
              row.cycleLengthLabel,
              row.periodLengthLabel,
            ])}
            accessible
            key={row.key}
            style={styles.panel}
          >
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{row.title}</Text>
              <Text style={styles.helperText}>{row.comparisonLabel}</Text>
            </View>
            <Text style={styles.rowValue}>{row.cycleLengthLabel}</Text>
            <Text style={styles.helperText}>{row.periodLengthLabel}</Text>
          </View>
        ))}
      </View>
    </FeatureCard>
  );
}
