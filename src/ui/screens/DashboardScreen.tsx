import { Text, View } from "react-native";

import { buildDashboardShellViewData } from "../../services/dashboard-view-service";
import { FeatureCard } from "../components/FeatureCard";
import { ScreenScaffold } from "../components/ScreenScaffold";

export function DashboardScreen() {
  const viewData = buildDashboardShellViewData();

  return (
    <ScreenScaffold
      eyebrow={viewData.eyebrow}
      title={viewData.title}
      description={viewData.description}
    >
      <FeatureCard
        title={viewData.section.title}
        description="Mood, flow, symptoms, and advanced tracking fields will live here without needing sync."
      >
        <View>
          {viewData.section.bullets.map((bullet) => (
            <Text key={bullet}>- {bullet}</Text>
          ))}
        </View>
      </FeatureCard>
    </ScreenScaffold>
  );
}
