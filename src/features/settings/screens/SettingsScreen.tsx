import { Text, View } from "react-native";

import { FeatureCard } from "../../../ui/components/FeatureCard";
import { ScreenScaffold } from "../../../ui/components/ScreenScaffold";

export function SettingsScreen() {
  return (
    <ScreenScaffold
      eyebrow="Preferences"
      title="Settings shell"
      description="This screen will manage local tracking preferences, custom symptoms, exports, and later optional sync setup."
    >
      <FeatureCard
        title="Tracking toggles"
        description="Settings will explain how advanced tracking fields affect new entries without hiding what remains in local history."
      />
      <FeatureCard
        title="Optional sync later"
        description="Self-hosted or managed sync should appear here as an additive capability, not as a requirement for core use."
      >
        <View>
          <Text>- local profile</Text>
          <Text>- custom symptoms</Text>
          <Text>- export and backup</Text>
        </View>
      </FeatureCard>
    </ScreenScaffold>
  );
}
