import { Text, View } from "react-native";

import { FeatureCard } from "../../../ui/components/FeatureCard";
import { ScreenScaffold } from "../../../ui/components/ScreenScaffold";

export function CalendarScreen() {
  return (
    <ScreenScaffold
      eyebrow="History"
      title="Calendar shell"
      description="This screen will hold day-by-day tracking, period markers, and future prediction presentation driven by local data."
    >
      <FeatureCard
        title="Navigation first"
        description="The calendar shell exists now so domain and storage work can target a stable navigation surface."
      >
        <View>
          <Text>- month grid</Text>
          <Text>- selected day summary</Text>
          <Text>- prediction badges</Text>
        </View>
      </FeatureCard>
    </ScreenScaffold>
  );
}
