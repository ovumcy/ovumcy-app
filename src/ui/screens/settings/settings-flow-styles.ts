import { StyleSheet } from "react-native";

import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";

export const createSettingsFlowStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: "transparent",
    },
    screenContent: {
      paddingBottom: spacing.xl,
    },
    container: {
      alignSelf: "center",
      gap: spacing.md,
      maxWidth: 1080,
      paddingHorizontal: 16,
      paddingTop: 16,
      width: "100%",
    },
    header: {
      gap: 6,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 29,
      fontWeight: "800",
      lineHeight: 34,
    },
    headerDescription: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
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
    dateFieldShell: {
      backgroundColor: colors.surfaceTint,
      borderColor: colors.lineSoft,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    dateFieldValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    dateFieldValueMuted: {
      color: colors.textMuted,
    },
    dateActionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    dateInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      minHeight: 52,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    inlineAction: {
      alignSelf: "flex-start",
      paddingTop: spacing.xs,
    },
    inlineActionText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "700",
    },
    messageStack: {
      gap: spacing.xs,
    },
    actionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    infoText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
  });

export type SettingsFlowStyles = ReturnType<typeof createSettingsFlowStyles>;
