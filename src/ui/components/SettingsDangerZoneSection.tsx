import { StyleSheet, Text, View } from "react-native";

import type { SettingsViewData } from "../../services/settings-view-service";
import { AppButton } from "./AppButton";
import { AppTextInput } from "./AppTextInput";
import { StatusBanner } from "./StatusBanner";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type SettingsDangerZoneSectionProps = {
  confirmationValue: string;
  errorMessage: string;
  isClearingData: boolean;
  onChangeConfirmationValue: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  statusMessage: string;
  viewData: SettingsViewData["danger"];
};

export function SettingsDangerZoneSection({
  confirmationValue,
  errorMessage,
  isClearingData,
  onChangeConfirmationValue,
  onSubmit,
  statusMessage,
  viewData,
}: SettingsDangerZoneSectionProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card} testID="settings-danger-zone-section">
      <View style={styles.header}>
        <Text style={styles.title}>{viewData.title}</Text>
        <Text style={styles.subtitle}>{viewData.subtitle}</Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>{viewData.clearTitle}</Text>
          <Text style={styles.panelSubtitle}>{viewData.clearSubtitle}</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>{viewData.confirmationLabel}</Text>
          <AppTextInput
            accessibilityLabel={viewData.confirmationLabel}
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={onChangeConfirmationValue}
            placeholder={viewData.confirmationPlaceholder}
            style={styles.input}
            testID="settings-clear-data-confirmation-input"
            value={confirmationValue}
          />
          <Text style={styles.hint}>{viewData.confirmationHint}</Text>
        </View>

        {errorMessage ? (
          <StatusBanner
            message={errorMessage}
            tone="error"
            testID="settings-danger-error-banner"
          />
        ) : null}
        {statusMessage ? (
          <StatusBanner
            message={statusMessage}
            tone="success"
            testID="settings-danger-status-banner"
          />
        ) : null}

        <AppButton
          disabled={isClearingData}
          label={viewData.action}
          onPress={onSubmit}
          testID="settings-clear-data-button"
          variant="danger"
        />
      </View>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.dangerCardBg,
      borderColor: colors.dangerCardBorder,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.md,
      padding: 18,
    },
    header: {
      gap: 4,
    },
    title: {
      color: colors.dangerTitle,
      fontSize: 17,
      fontWeight: "700",
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    panel: {
      backgroundColor: colors.dangerPanelBg,
      borderColor: colors.dangerPanelBorder,
      borderRadius: 14,
      borderWidth: 1,
      gap: spacing.sm,
      padding: 14,
    },
    panelHeader: {
      gap: 4,
    },
    panelTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    panelSubtitle: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    formGroup: {
      gap: 6,
    },
    label: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    hint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
  });
