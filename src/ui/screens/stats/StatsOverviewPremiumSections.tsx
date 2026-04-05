import { Text, View } from "react-native";

import type { StatsViewData } from "../../../services/stats-view-service";
import { FeatureCard } from "../../components/FeatureCard";
import type { StatsOverviewStyles } from "./stats-overview-styles";

type StatsOverviewPremiumSectionsProps = {
  styles: StatsOverviewStyles;
  viewData: StatsViewData;
};

export function StatsOverviewPremiumSections({
  styles,
  viewData,
}: StatsOverviewPremiumSectionsProps) {
  const sections = [
    {
      section: viewData.personalForecasts,
      testID: "stats-personal-forecasts",
    },
    {
      section: viewData.advancedFertility,
      testID: "stats-advanced-fertility",
    },
    {
      section: viewData.advancedInsights,
      testID: "stats-advanced-insights",
    },
  ].filter(
    (
      entry,
    ): entry is {
      section: NonNullable<StatsViewData["advancedInsights"]>;
      testID: string;
    } => Boolean(entry.section && entry.section.items.length > 0),
  );

  if (sections.length === 0) {
    return null;
  }

  return (
    <>
      {sections.map(({ section, testID }) => (
        <FeatureCard
          description={section.subtitle}
          key={testID}
          testID={testID}
          title={section.title}
        >
          <View style={styles.sectionGrid}>
            {section.items.map((item) => (
              <View key={item.key} style={styles.panel}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{item.title}</Text>
                  <Text style={styles.rowValue}>{item.value}</Text>
                </View>
                <Text style={styles.helperText}>{item.description}</Text>
              </View>
            ))}
          </View>
        </FeatureCard>
      ))}
    </>
  );
}
