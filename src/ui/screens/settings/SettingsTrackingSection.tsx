import { Text, View } from "react-native";

import type { LoadedSettingsState, SettingsViewData } from "../../../services/settings-view-service";
import { BinaryToggleCard } from "../../components/BinaryToggleCard";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { FeatureCard } from "../../components/FeatureCard";
import { StatusBanner } from "../../components/StatusBanner";
import type { SettingsFlowStyles } from "./settings-flow-styles";

type SettingsTrackingSectionProps = {
  onHideNotesChange: (value: boolean) => void;
  onShowHistoricalPhasesChange: (value: boolean) => void;
  onHideCycleFactorsChange: (value: boolean) => void;
  onHideSexChipChange: (value: boolean) => void;
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
  onHideNotesChange,
  onShowHistoricalPhasesChange,
  onHideCycleFactorsChange,
  onHideSexChipChange,
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
        onValueChange={(value) => {
          onHideSexChipChange(!value);
        }}
        testID="settings-toggle-hide-sex-chip"
        value={!state.trackingValues.hideSexChip}
      />

      <BinaryToggleCard
        description={viewData.tracking.hideNotes.hint}
        descriptionPosition="below"
        icon="📝"
        label={viewData.tracking.hideNotes.label}
        onValueChange={(value) => {
          onHideNotesChange(!value);
        }}
        testID="settings-toggle-hide-notes"
        value={!state.trackingValues.hideNotes}
      />

      <BinaryToggleCard
        description={viewData.tracking.showHistoricalPhases.hint}
        descriptionPosition="below"
        icon="📅"
        label={viewData.tracking.showHistoricalPhases.label}
        onValueChange={onShowHistoricalPhasesChange}
        testID="settings-toggle-show-historical-phases"
        value={state.trackingValues.showHistoricalPhases}
      />

      <BinaryToggleCard
        description={viewData.tracking.hideCycleFactors.hint}
        descriptionPosition="below"
        icon="🏷️"
        label={viewData.tracking.hideCycleFactors.label}
        onValueChange={(value) => {
          onHideCycleFactorsChange(!value);
        }}
        testID="settings-toggle-hide-cycle-factors"
        value={!state.trackingValues.hideCycleFactors}
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
    </FeatureCard>
  );
}
