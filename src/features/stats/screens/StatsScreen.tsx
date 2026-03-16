import { Text, View } from "react-native";

import { FeatureCard } from "../../../ui/components/FeatureCard";
import { ScreenScaffold } from "../../../ui/components/ScreenScaffold";

export function StatsScreen() {
  return (
    <ScreenScaffold
      eyebrow="Insights"
      title="Stats shell"
      description="This screen will host reliability messaging, cycle summaries, and factor context built from local history."
    >
      <FeatureCard
        title="Conservative by design"
        description="Stats and predictions will stay honest with sparse data and keep medical claims out of the product."
      >
        <View>
          <Text>- reliability summary</Text>
          <Text>- cycle overview cards</Text>
          <Text>- factor explanation blocks</Text>
        </View>
      </FeatureCard>
    </ScreenScaffold>
  );
}
