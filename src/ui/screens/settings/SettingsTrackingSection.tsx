import { Text, View } from "react-native";

import type { LoadedSettingsState, SettingsViewData } from "../../../services/settings-view-service";
import { AppButton } from "../../components/AppButton";
import { BinaryToggleCard } from "../../components/BinaryToggleCard";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { FeatureCard } from "../../components/FeatureCard";
import { StatusBanner } from "../../components/StatusBanner";
import type { SettingsFlowStyles } from "./settings-flow-styles";

type SettingsTrackingSectionProps = {
  isSavingTracking: boolean;
  onHideSexChipChange: (value: boolean) => void;
  onSaveTrackingSettings: () => void | Promise<void>;
  onTemperatureUnitSelect: (
    value: LoadedSettingsState["trackingValues"]["temperatureUnit"],
  ) => void;
  onTrackBBTChange: (value: boolean) => void;
  onTrackCervicalMucusChange: (value: boolean) => void;
  state: LoadedSettingsState;
  styles: SettingsFlowStyles;
  trackingStatusMessage: string;
  viewData: SettingsViewData;
};

export function SettingsTrackingSection({
  isSavingTracking,
  onHideSexChipChange,
  onSaveTrackingSettings,
  onTemperatureUnitSelect,
  onTrackBBTChange,
  onTrackCervicalMucusChange,
  state,
  styles,
  trackingStatusMessage,
  viewData,
}: SettingsTrackingSectionProps) {
  return (
    <FeatureCard
      description={viewData.tracking.subtitle}
      testID="settings-tracking-section"
      title={viewData.tracking.title}
    >
      <BinaryToggleCard
        description={viewData.tracking.trackBBT.hint}
        descriptionPosition="below"
        icon="🌡️"
        label={viewData.tracking.trackBBT.label}
        onValueChange={onTrackBBTChange}
        testID="settings-toggle-track-bbt"
        value={state.trackingValues.trackBBT}
      />

      <BinaryToggleCard
        description={viewData.tracking.trackCervicalMucus.hint}
        descriptionPosition="below"
        icon="💧"
        label={viewData.tracking.trackCervicalMucus.label}
        onValueChange={onTrackCervicalMucusChange}
        testID="settings-toggle-track-cervical-mucus"
        value={state.trackingValues.trackCervicalMucus}
      />

      <BinaryToggleCard
        description={viewData.tracking.hideSexChip.hint}
        descriptionPosition="below"
        icon="◦"
        label={viewData.tracking.hideSexChip.label}
        onValueChange={onHideSexChipChange}
        testID="settings-toggle-hide-sex-chip"
        value={state.trackingValues.hideSexChip}
      />

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{viewData.tracking.temperatureUnit.label}</Text>
        <Text style={styles.helperText}>{viewData.tracking.temperatureUnit.hint}</Text>
        <ChoiceGroup
          layout="grid2"
          onSelect={onTemperatureUnitSelect}
          options={viewData.tracking.temperatureUnit.options}
          selectedValue={state.trackingValues.temperatureUnit}
          testIDPrefix="settings-temperature-unit"
        />
      </View>

      {trackingStatusMessage ? (
        <StatusBanner
          message={trackingStatusMessage}
          testID="settings-tracking-status-banner"
          tone="success"
        />
      ) : null}

      <AppButton
        disabled={isSavingTracking}
        label={viewData.tracking.saveLabel}
        onPress={onSaveTrackingSettings}
        testID="settings-save-tracking-button"
        variant="secondary"
      />
    </FeatureCard>
  );
}
