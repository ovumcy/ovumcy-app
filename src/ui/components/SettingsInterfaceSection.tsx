import { StyleSheet, Text, View } from "react-native";

import type {
  InterfaceSettingsValues,
  InterfaceLanguage,
  ThemePreference,
} from "../../models/profile";
import type { SettingsViewData } from "../../services/settings-view-service";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";
import { AppButton } from "./AppButton";
import { ChoiceGroup } from "./ChoiceGroup";
import { FeatureCard } from "./FeatureCard";
import { StatusBanner } from "./StatusBanner";

type SettingsInterfaceSectionProps = {
  errorMessage: string;
  isSaving: boolean;
  onLanguageSelect: (value: InterfaceLanguage) => void;
  onSave: () => void | Promise<void>;
  onThemeSelect: (value: ThemePreference) => void;
  statusMessage: string;
  value: InterfaceSettingsValues;
  viewData: SettingsViewData["interface"];
};

export function SettingsInterfaceSection({
  errorMessage,
  isSaving,
  onLanguageSelect,
  onSave,
  onThemeSelect,
  statusMessage,
  value,
  viewData,
}: SettingsInterfaceSectionProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <FeatureCard
      description={viewData.subtitle}
      testID="settings-interface-section"
      title={viewData.title}
    >
      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{viewData.languageLabel}</Text>
        <Text style={styles.helperText}>{viewData.languageHint}</Text>
        <ChoiceGroup
          layout="grid3"
          onSelect={onLanguageSelect}
          options={viewData.languageOptions}
          selectedValue={value.languageOverride ?? "en"}
          testIDPrefix="settings-interface-language"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.fieldLabel}>{viewData.themeLabel}</Text>
        <Text style={styles.helperText}>{viewData.themeHint}</Text>
        <ChoiceGroup
          layout="grid2"
          onSelect={onThemeSelect}
          options={viewData.themeOptions}
          selectedValue={value.themeOverride ?? "light"}
          testIDPrefix="settings-interface-theme"
        />
      </View>

      <Text style={styles.helperText}>{viewData.previewHint}</Text>

      {errorMessage ? (
        <StatusBanner
          message={errorMessage}
          testID="settings-interface-error-banner"
          tone="error"
        />
      ) : null}
      {statusMessage ? (
        <StatusBanner
          message={statusMessage}
          testID="settings-interface-status-banner"
          tone="success"
        />
      ) : null}

      <AppButton
        disabled={isSaving}
        label={viewData.saveLabel}
        onPress={onSave}
        testID="settings-save-interface-button"
        variant="secondary"
      />
    </FeatureCard>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    formGroup: {
      gap: spacing.sm,
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
  });
