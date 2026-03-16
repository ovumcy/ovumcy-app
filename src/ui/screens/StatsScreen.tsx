import { Text, View } from "react-native";

import { buildStatsShellViewData } from "../../services/stats-view-service";
import { FeatureCard } from "../components/FeatureCard";
import { ScreenScaffold } from "../components/ScreenScaffold";

export function StatsScreen() {
  const viewData = buildStatsShellViewData();

  return (
    <ScreenScaffold
      eyebrow={viewData.eyebrow}
      title={viewData.title}
      description={viewData.description}
    >
      <FeatureCard
        title={viewData.cardTitle}
        description={viewData.cardDescription}
      >
        <View>
          {viewData.bullets.map((bullet) => (
            <Text key={bullet}>- {bullet}</Text>
          ))}
        </View>
      </FeatureCard>
    </ScreenScaffold>
  );
}
