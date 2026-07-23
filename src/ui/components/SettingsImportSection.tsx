import { StyleSheet, Text, View } from "react-native";

import type {
  SettingsImportPreviewViewData,
  SettingsViewData,
} from "../../services/settings-view-service";
import { AppButton } from "./AppButton";
import { FeatureCard } from "./FeatureCard";
import { StatusBanner } from "./StatusBanner";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type SettingsImportSectionProps = {
  errorMessage: string;
  isImporting: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  onPickFile: () => void | Promise<void>;
  preview: SettingsImportPreviewViewData | null;
  statusMessage: string;
  viewData: SettingsViewData["import"];
};

export function SettingsImportSection({
  errorMessage,
  isImporting,
  onCancel,
  onConfirm,
  onPickFile,
  preview,
  statusMessage,
  viewData,
}: SettingsImportSectionProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <FeatureCard
      description={viewData.subtitle}
      testID="settings-import-section"
      title={viewData.title}
    >
      {errorMessage ? (
        <StatusBanner
          message={errorMessage}
          tone="error"
          testID="settings-import-error-banner"
        />
      ) : null}
      {statusMessage ? (
        <StatusBanner
          message={statusMessage}
          tone="success"
          testID="settings-import-status-banner"
        />
      ) : null}

      {preview ? (
        <View style={styles.previewCard} testID="settings-import-preview">
          {/* What the confirm button is about to apply. Announced as one
              element so the summary is heard whole before the irreversible
              action, not as loose lines the user can swipe past. */}
          <View
            accessibilityLabel={[
              viewData.previewTitle,
              ...preview.detailLines,
              preview.profileLine,
              preview.nothingNewLine,
            ]
              .filter((line): line is string => Boolean(line && line.trim()))
              .join(". ")}
            accessible
            style={styles.previewSummary}
          >
            <Text style={styles.previewTitle}>{viewData.previewTitle}</Text>
            {preview.detailLines.map((line) => (
              <Text key={line} style={styles.previewText}>
                {line}
              </Text>
            ))}
            <Text style={styles.previewText}>{preview.profileLine}</Text>
            {preview.nothingNewLine ? (
              <Text style={styles.previewText}>{preview.nothingNewLine}</Text>
            ) : null}
          </View>

          <View style={styles.actionsRow}>
            <AppButton
              disabled={isImporting || !preview.canConfirm}
              label={isImporting ? viewData.applyingLabel : viewData.confirmAction}
              onPress={onConfirm}
              testID="settings-import-confirm-button"
            />
            <AppButton
              disabled={isImporting}
              label={viewData.cancelAction}
              onPress={onCancel}
              testID="settings-import-cancel-button"
              variant="secondary"
            />
          </View>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <AppButton
            disabled={isImporting}
            label={viewData.pickAction}
            onPress={onPickFile}
            testID="settings-import-pick-button"
            variant="secondary"
          />
        </View>
      )}
    </FeatureCard>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    previewCard: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    previewSummary: {
      gap: spacing.xs,
    },
    previewTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    previewText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    actionsRow: {
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
  });
