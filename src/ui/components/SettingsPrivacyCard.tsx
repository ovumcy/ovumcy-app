import type { SettingsViewData } from "../../services/settings-view-service";
import { AppButton } from "./AppButton";
import { FeatureCard } from "./FeatureCard";

type SettingsPrivacyCardProps = {
  onOpen: () => void | Promise<void>;
  viewData: SettingsViewData["privacy"];
};

export function SettingsPrivacyCard({
  onOpen,
  viewData,
}: SettingsPrivacyCardProps) {
  return (
    <FeatureCard
      description={viewData.subtitle}
      testID="settings-privacy-card"
      title={viewData.title}
    >
      <AppButton
        label={viewData.openLabel}
        onPress={onOpen}
        testID="settings-open-privacy-notice-button"
        variant="secondary"
      />
    </FeatureCard>
  );
}
