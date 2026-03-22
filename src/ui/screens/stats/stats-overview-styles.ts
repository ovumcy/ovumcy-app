import { StyleSheet } from "react-native";

import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";

export const createStatsOverviewStyles = (colors: AppThemeColors) =>
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
    emptyHero: {
      alignItems: "center",
      gap: spacing.md,
    },
    emptyHeroCard: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.lineSoft,
      borderRadius: 22,
      borderWidth: 1,
      overflow: "hidden",
      padding: 20,
      shadowColor: colors.shadowSoft,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.82,
      shadowRadius: 24,
      width: "100%",
    },
    emptyOrb: {
      borderRadius: 999,
      position: "absolute",
    },
    emptyOrbPrimary: {
      backgroundColor: colors.accentSoft,
      height: 72,
      right: -8,
      top: -12,
      width: 72,
    },
    emptyOrbSecondary: {
      backgroundColor: colors.surface,
      height: 56,
      left: -12,
      top: 34,
      width: 56,
    },
    emptyGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      justifyContent: "center",
      maxWidth: 212,
    },
    emptyCell: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      height: 44,
      width: 60,
    },
    emptyCellActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentStrong,
    },
    emptyCellSoft: {
      opacity: 0.72,
    },
    emptyNote: {
      alignItems: "center",
      gap: 6,
    },
    emptyNoteDot: {
      backgroundColor: colors.accentStrong,
      borderRadius: 999,
      height: 8,
      width: 8,
    },
    emptyNoteLine: {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 6,
      width: 112,
    },
    emptyNoteLineShort: {
      width: 72,
    },
    progressBlock: {
      gap: spacing.sm,
    },
    progressTrack: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 999,
      height: 10,
      overflow: "hidden",
    },
    progressFill: {
      backgroundColor: colors.accentStrong,
      borderRadius: 999,
      height: "100%",
    },
    progressLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    noticePanel: {
      backgroundColor: colors.surfaceTint,
      borderColor: colors.lineSoft,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    noticeText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    cardGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    statCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.lineSoft,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.xs,
      padding: 16,
      shadowColor: colors.shadowSoft,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.78,
      shadowRadius: 18,
    },
    cardLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    cardValue: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "800",
      lineHeight: 30,
    },
    cardDescription: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
    overviewGrid: {
      gap: spacing.md,
    },
    panel: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      gap: spacing.sm,
      padding: 14,
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    rowLabel: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600",
    },
    rowValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    factorChip: {
      backgroundColor: colors.surfaceStrong,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 10,
    },
    factorChipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    patternGrid: {
      gap: spacing.md,
    },
    recentCycleList: {
      gap: spacing.md,
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
    },
    sectionGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    listStack: {
      gap: spacing.sm,
    },
    symptomRow: {
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    metaRow: {
      alignItems: "center",
      flexDirection: "row",
      flexShrink: 1,
      gap: spacing.sm,
    },
    metaIcon: {
      fontSize: 16,
    },
    metaLabel: {
      color: colors.text,
      flexShrink: 1,
      fontSize: 14,
      fontWeight: "700",
    },
    emptyState: {
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    emptyStateIcon: {
      fontSize: 22,
    },
    legendRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    legendItem: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    legendDot: {
      borderRadius: 4,
      height: 10,
      width: 10,
    },
    legendDotActual: {
      backgroundColor: colors.accentStrong,
    },
    legendLine: {
      borderColor: colors.textMuted,
      borderStyle: "dashed",
      borderTopWidth: 2,
      opacity: 0.6,
      width: 24,
    },
    meterTrack: {
      backgroundColor: colors.surfaceStrong,
      borderRadius: 999,
      height: 10,
      overflow: "hidden",
    },
    meterFill: {
      backgroundColor: colors.accentStrong,
      borderRadius: 999,
      height: "100%",
    },
  });

export type StatsOverviewStyles = ReturnType<typeof createStatsOverviewStyles>;
