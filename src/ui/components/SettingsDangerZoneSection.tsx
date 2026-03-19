import { StyleSheet, Text, TextInput, View } from "react-native";

import type { SettingsViewData } from "../../services/settings-view-service";
import { AppButton } from "./AppButton";
import { StatusBanner } from "./StatusBanner";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useAppTheme, useThemedStyles } from "../theme/useThemedStyles";

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
  const { colors } = useAppTheme();
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
          <TextInput
            autoCapitalize="characters"
            autoCorrect={false}
            onChangeText={onChangeConfirmationValue}
            placeholder={viewData.confirmationPlaceholder}
            placeholderTextColor={colors.textMuted}
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
      backgroundColor:
        colors.background === "#fff9f0" ? "#fff7f7" : "rgba(72, 27, 35, 0.9)",
      borderColor:
        colors.background === "#fff9f0"
          ? "rgba(220, 38, 38, 0.22)"
          : "rgba(248, 113, 113, 0.28)",
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.md,
      padding: 18,
    },
    header: {
      gap: 4,
    },
    title: {
      color: colors.background === "#fff9f0" ? "#b91c1c" : "#fca5a5",
      fontSize: 17,
      fontWeight: "700",
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    panel: {
      backgroundColor:
        colors.background === "#fff9f0"
          ? "rgba(255, 244, 244, 0.92)"
          : "rgba(49, 23, 31, 0.92)",
      borderColor:
        colors.background === "#fff9f0"
          ? "rgba(185, 28, 28, 0.12)"
          : "rgba(248, 113, 113, 0.18)",
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
