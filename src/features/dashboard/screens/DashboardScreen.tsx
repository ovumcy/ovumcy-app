import { Text, View } from "react-native";

import { FeatureCard } from "../../../ui/components/FeatureCard";
import { ScreenScaffold } from "../../../ui/components/ScreenScaffold";

export function DashboardScreen() {
  return (
    <ScreenScaffold
      eyebrow="Today"
      title="Dashboard shell"
      description="This screen will become the local-first logging home for today, cycle context, and quick-entry actions."
    >
      <FeatureCard
        title="Owner-first quick logging"
        description="Mood, flow, symptoms, and advanced tracking fields will live here without needing sync."
      >
        <View>
          <Text>- cycle context card</Text>
          <Text>- quick symptom entry</Text>
          <Text>- advanced tracking shortcuts</Text>
        </View>
      </FeatureCard>
    </ScreenScaffold>
  );
}
