import { Text, View } from "react-native";

import { buildSettingsShellViewData } from "../../services/settings-view-service";
import { FeatureCard } from "../components/FeatureCard";
import { ScreenScaffold } from "../components/ScreenScaffold";

export function SettingsScreen() {
  const viewData = buildSettingsShellViewData();

  return (
    <ScreenScaffold
      eyebrow={viewData.eyebrow}
      title={viewData.title}
      description={viewData.description}
    >
      {viewData.cards.map((card) => (
        <FeatureCard
          key={card.title}
          title={card.title}
          description={card.description}
        >
          {card.bullets ? (
            <View>
              {card.bullets.map((bullet) => (
                <Text key={bullet}>- {bullet}</Text>
              ))}
            </View>
          ) : null}
        </FeatureCard>
      ))}
    </ScreenScaffold>
  );
}
