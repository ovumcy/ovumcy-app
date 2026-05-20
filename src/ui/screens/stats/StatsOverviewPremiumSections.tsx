import { Text, View } from "react-native";

import type {
  StatsPremiumLockViewData,
  StatsPremiumSectionViewData,
  StatsViewData,
} from "../../../services/stats-view-service";
import { FeatureCard } from "../../components/FeatureCard";
import { PremiumLockCard } from "../../components/PremiumLockCard";
import type { StatsOverviewStyles } from "./stats-overview-styles";

type StatsOverviewPremiumSectionsProps = {
  styles: StatsOverviewStyles;
  viewData: StatsViewData;
  onPremiumCTAPress?: (() => void) | undefined;
};

export function StatsOverviewPremiumSections({
  styles,
  viewData,
  onPremiumCTAPress,
}: StatsOverviewPremiumSectionsProps) {
  const sections: {
    section: StatsPremiumSectionViewData;
    testID: string;
  }[] = [
    { section: viewData.personalForecasts, testID: "stats-personal-forecasts" },
    { section: viewData.advancedFertility, testID: "stats-advanced-fertility" },
    { section: viewData.advancedInsights, testID: "stats-advanced-insights" },
  ].filter(
    (
      entry,
    ): entry is {
      section: StatsPremiumSectionViewData;
      testID: string;
    } => Boolean(entry.section && entry.section.items.length > 0),
  );

  const locks: {
    lock: StatsPremiumLockViewData;
    testID: string;
  }[] = [
    {
      lock: viewData.premiumLocks?.advancedFertility,
      testID: "stats-advanced-fertility-lock",
    },
    {
      lock: viewData.premiumLocks?.advancedInsights,
      testID: "stats-advanced-insights-lock",
    },
  ].filter(
    (entry): entry is { lock: StatsPremiumLockViewData; testID: string } =>
      Boolean(entry.lock),
  );

  if (sections.length === 0 && locks.length === 0) {
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
      {locks.map(({ lock, testID }) => (
        <PremiumLockCard
          ctaLabel={lock.ctaLabel}
          description={lock.description}
          eyebrowLabel={lock.eyebrowLabel}
          key={testID}
          onPress={onPremiumCTAPress ?? (() => {})}
          testID={testID}
          title={lock.title}
        />
      ))}
    </>
  );
}
