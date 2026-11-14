import { Text, View } from "react-native";

import type { StatsViewData } from "../../../services/stats-view-service";
import { FeatureCard } from "../../components/FeatureCard";
import { composeStatsAccessibilityLabel } from "./StatsOverviewShared";
import type { StatsOverviewStyles } from "./stats-overview-styles";

type StatsOverviewHistoryStatementsSectionProps = {
  styles: StatsOverviewStyles;
  viewData: StatsViewData;
};

export function StatsOverviewHistoryStatementsSection({
  styles,
  viewData,
}: StatsOverviewHistoryStatementsSectionProps) {
  const section = viewData.historyStatements;
  if (!section) {
    return null;
  }

  return (
    <FeatureCard
      description={section.subtitle}
      testID="stats-history-statements"
      title={section.title}
    >
      <View
        accessibilityLabel={section.title}
        accessibilityRole="list"
        style={styles.listStack}
      >
        {section.items.map((item) => (
          <View
            accessibilityLabel={composeStatsAccessibilityLabel([
              item.title,
              item.detail,
            ])}
            accessible
            key={item.key}
            style={styles.panel}
            testID="stats-history-statement"
          >
            <Text style={styles.rowValue}>
              {item.icon ? `${item.icon} ${item.title}` : item.title}
            </Text>
            {item.detail ? (
              <Text style={styles.helperText}>{item.detail}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </FeatureCard>
  );
}
