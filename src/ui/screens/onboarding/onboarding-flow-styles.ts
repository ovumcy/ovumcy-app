import { StyleSheet } from "react-native";

import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";

export const createOnboardingFlowStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: "transparent",
    },
    screenContent: {
      alignItems: "center",
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingVertical: 18,
      width: "100%",
    },
    screenContentCompact: {
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    screenContentPinned: {
      flex: 1,
    },
    heroCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.lineSoft,
      borderRadius: 20,
      borderWidth: 1,
      gap: 8,
      maxWidth: 840,
      overflow: "hidden",
      padding: 16,
      shadowColor: colors.shadowSoft,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.82,
      shadowRadius: 26,
      width: "100%",
    },
    heroCardPinned: {
      flex: 1,
    },
    heroCardCompact: {
      borderRadius: 18,
      gap: 6,
      padding: 14,
    },
    loadingBlock: {
      alignItems: "center",
      paddingVertical: spacing.xl,
    },
    panel: {
      flex: 1,
      gap: 8,
    },
    panelPinned: {
      minHeight: 0,
    },
    panelCompact: {
      gap: 6,
    },
    progressBlock: {
      gap: 6,
    },
    progressBlockCompact: {
      gap: 4,
    },
    kicker: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 1.1,
      textTransform: "uppercase",
    },
    kickerCompact: {
      fontSize: 12,
    },
    progressPanel: {
      backgroundColor: colors.surfaceTint,
      borderRadius: 14,
      padding: 6,
    },
    progressPanelCompact: {
      padding: 5,
    },
    progressTrack: {
      backgroundColor: "rgba(232,196,168,0.35)",
      borderRadius: 999,
      height: 8,
      overflow: "hidden",
    },
    progressFill: {
      backgroundColor: colors.accent,
      borderRadius: 999,
      height: 8,
    },
    heroTitle: {
      color: colors.text,
      fontSize: 26,
      fontWeight: "800",
      lineHeight: 31,
    },
    heroTitleCompact: {
      fontSize: 23,
      lineHeight: 31,
      paddingTop: 2,
    },
    heroMuted: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
    heroMutedCompact: {
      fontSize: 12,
      lineHeight: 18,
    },
    formGroup: {
      gap: spacing.sm,
    },
    formGroupCompact: {
      gap: spacing.xs,
    },
    dateFieldShell: {
      backgroundColor: colors.surfaceTint,
      borderColor: colors.lineSoft,
      borderRadius: 12,
      borderWidth: 1,
      gap: 4,
      justifyContent: "center",
      minHeight: 72,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    dateFieldShellCompact: {
      minHeight: 64,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    selectedDateLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    dateFieldValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    dateFieldValueMuted: {
      color: colors.textMuted,
    },
    dayOptionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    dayOptionGridCompact: {
      gap: 4,
    },
    dayOptionScroll: {
      flex: 1,
      minHeight: 0,
      width: "100%",
    },
    dayOptionScrollCompact: {
      minHeight: 0,
    },
    dayOptionButton: {
      backgroundColor: colors.surfaceTint,
      borderColor: colors.lineSoft,
      borderRadius: 12,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    dayOptionButtonCompact: {
      borderRadius: 10,
      minHeight: 44,
      paddingHorizontal: 6,
      paddingVertical: 5,
    },
    dayOptionButtonThreeColumns: {
      flexBasis: "31.8%",
    },
    dayOptionButtonFourColumns: {
      flexBasis: "23.75%",
    },
    dayOptionButtonSixColumns: {
      flexBasis: "15.8%",
    },
    dayOptionButtonToday: {
      minHeight: 48,
    },
    dayOptionButtonActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentStrong,
    },
    dayOptionLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    dayOptionSecondaryLabel: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
    },
    dayOptionSecondaryLabelCompact: {
      fontSize: 9,
      marginTop: 1,
    },
    dayOptionLabelActive: {
      color: colors.accentStrong,
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    fieldLabelCompact: {
      fontSize: 12,
    },
    messageStack: {
      gap: spacing.xs,
    },
    messageStackCompact: {
      gap: 4,
    },
    infoText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    infoTextCompact: {
      fontSize: 12,
      lineHeight: 17,
    },
    stepOneLayout: {
      flex: 1,
      gap: spacing.sm,
      minHeight: 0,
    },
    stepOneHeaderStack: {
      gap: spacing.sm,
    },
    stepOneScrollRegion: {
      flex: 1,
      minHeight: 0,
    },
    stepOneFooter: {
      gap: spacing.sm,
      paddingTop: spacing.xs,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
    },
    buttonRowCompact: {
      gap: 8,
    },
    buttonGrow: {
      flex: 1,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.accent,
      borderColor: colors.accentStrong,
      borderRadius: 999,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 18,
      paddingVertical: 9,
      shadowColor: colors.accentStrong,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
    },
    primaryButtonCompact: {
      minHeight: 44,
      paddingHorizontal: 16,
      paddingVertical: 0,
    },
    primaryButtonText: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 18,
      paddingVertical: 9,
    },
    secondaryButtonCompact: {
      minHeight: 44,
      paddingHorizontal: 16,
      paddingVertical: 0,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });

export type OnboardingFlowStyles = ReturnType<typeof createOnboardingFlowStyles>;
