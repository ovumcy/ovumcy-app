import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { DayLogRecord } from "../../models/day-log";
import type { ManualCycleStartViewData } from "../../services/manual-cycle-start-service";
import type { DayLogEditorViewData } from "../../services/day-log-editor-service";
import type { DashboardViewData } from "../../services/dashboard-view-service";
import {
  DayLogEditorCard,
  type DayLogEditorSectionKey,
} from "../components/DayLogEditorCard";
import { InsightSummaryCard } from "../components/InsightSummaryCard";
import { ManualCycleStartAction } from "../components/ManualCycleStartAction";
import { PredictionDisclaimer } from "../components/PredictionDisclaimer";
import { AppScreenSurface } from "../components/AppScreenSurface";
import { resolveBottomContentPadding } from "../layout/bottom-content-padding";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";
import { DashboardCycleHero } from "./dashboard/DashboardCycleHero";

type DashboardQuickActionKey = "period" | "mood" | "symptom";

type DashboardOverviewScreenProps = {
  entryExists: boolean;
  editorViewData: DayLogEditorViewData;
  isSaving: boolean;
  onDelete: () => void | Promise<void>;
  onManualCycleStart?: (() => void | Promise<void>) | undefined;
  onPatch: (updates: Partial<DayLogRecord>) => void;
  onSave: () => void | Promise<void>;
  record: DayLogRecord;
  statusMessage: string;
  statusTone?: "error" | "info" | "success" | undefined;
  viewData: DashboardViewData;
  manualCycleStart?: ManualCycleStartViewData | null;
  showsSaveAction?: boolean;
};

export function DashboardOverviewScreen({
  entryExists,
  editorViewData,
  isSaving,
  onDelete,
  onManualCycleStart,
  onPatch,
  onSave,
  record,
  statusMessage,
  statusTone,
  viewData,
  manualCycleStart,
  showsSaveAction = true,
}: DashboardOverviewScreenProps) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const editorCardOffsetRef = useRef(0);
  const quickActionFrameRef = useRef<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionOffsetsRef = useRef<
    Partial<Record<DayLogEditorSectionKey, number>>
  >({});
  const [activeQuickAction, setActiveQuickAction] = useState<DashboardQuickActionKey | null>(
    null,
  );
  const [highlightedSection, setHighlightedSection] = useState<DayLogEditorSectionKey | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (quickActionFrameRef.current !== null) {
        cancelAnimationFrame(quickActionFrameRef.current);
        quickActionFrameRef.current = null;
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };
  }, []);

  function scrollToSection(key: DayLogEditorSectionKey) {
    const offset = sectionOffsetsRef.current[key];
    if (offset === undefined) {
      return;
    }

    scrollViewRef.current?.scrollTo({
      animated: true,
      y: Math.max(offset - 156, 0),
    });
  }

  function highlightSection(
    key: DayLogEditorSectionKey,
    action: DashboardQuickActionKey,
  ) {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    setActiveQuickAction(action);
    setHighlightedSection(key);
    highlightTimeoutRef.current = setTimeout(() => {
      setActiveQuickAction((current) => (current === action ? null : current));
      setHighlightedSection((current) => (current === key ? null : current));
      highlightTimeoutRef.current = null;
    }, 1500);
  }

  function handleQuickAction(action: DashboardQuickActionKey) {
    switch (action) {
      case "period":
        onPatch({ isPeriod: !record.isPeriod });
        highlightSection("period", action);
        if (quickActionFrameRef.current !== null) {
          cancelAnimationFrame(quickActionFrameRef.current);
        }
        quickActionFrameRef.current = requestAnimationFrame(() => {
          scrollToSection("period");
          quickActionFrameRef.current = null;
        });
        break;
      case "mood":
        highlightSection("mood", action);
        scrollToSection("mood");
        break;
      case "symptom":
        highlightSection("symptoms", action);
        scrollToSection("symptoms");
        break;
    }
  }

  return (
    <AppScreenSurface>
      <ScrollView
        contentContainerStyle={[
          styles.screenContent,
          { paddingBottom: resolveBottomContentPadding(insets.bottom) },
        ]}
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
          <DashboardCycleHero viewData={viewData.cycleHero} />

          {viewData.predictionExplanation ? (
            <Text style={styles.helperText} testID="dashboard-prediction-explanation">
              {viewData.predictionExplanation}
            </Text>
          ) : null}

          <PredictionDisclaimer
            testID="dashboard-prediction-disclaimer"
            text={viewData.predictionDisclaimer}
          />

          {viewData.advancedFertilitySummary ? (
            <InsightSummaryCard
              testID="dashboard-advanced-fertility-summary"
              viewData={viewData.advancedFertilitySummary}
            />
          ) : null}

          <View style={styles.quickActionsBlock}>
            <Text
              style={styles.quickActionsTitle}
              testID="dashboard-quick-actions-title"
            >
              {viewData.quickActionsTitle}
            </Text>
            <View style={styles.quickActions}>
              <QuickActionButton
                active={record.isPeriod}
                icon="🩸"
                label={viewData.quickActions.period}
                onPress={() => handleQuickAction("period")}
                testID="dashboard-quick-action-period"
              />
              <QuickActionButton
                active={activeQuickAction === "mood"}
                icon="😊"
                label={viewData.quickActions.mood}
                onPress={() => handleQuickAction("mood")}
                testID="dashboard-quick-action-mood"
              />
              <QuickActionButton
                active={activeQuickAction === "symptom"}
                icon="💊"
                label={viewData.quickActions.symptom}
                onPress={() => handleQuickAction("symptom")}
                testID="dashboard-quick-action-symptom"
              />
            </View>
          </View>

          <View
            onLayout={(event) => {
              editorCardOffsetRef.current = event.nativeEvent.layout.y;
            }}
          >
            <DayLogEditorCard
              entryExists={entryExists}
              highlightedSection={highlightedSection}
              isSaving={isSaving}
              onDelete={onDelete}
              onPatch={onPatch}
              onSave={onSave}
              onSectionLayout={(key, y) => {
                sectionOffsetsRef.current[key] = editorCardOffsetRef.current + y;
              }}
              record={record}
              showsSaveAction={showsSaveAction}
              statusMessage={statusMessage}
              statusTone={statusTone}
              viewData={{
                ...editorViewData,
                title: viewData.journal.title,
                subtitle: viewData.journal.dateLabel,
                dateLabel: "",
              }}
            />
          </View>

          {manualCycleStart && onManualCycleStart ? (
            <ManualCycleStartAction
              disabled={isSaving}
              onPress={onManualCycleStart}
              testID="dashboard-manual-cycle-start-button"
              viewData={manualCycleStart}
            />
          ) : null}
        </View>
      </ScrollView>
    </AppScreenSurface>
  );
}

function QuickActionButton({
  active = false,
  icon,
  label,
  onPress,
  testID,
}: {
  active?: boolean;
  icon: string;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.quickActionButton, active ? styles.quickActionButtonActive : null]}
      testID={testID}
    >
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={[styles.quickActionLabel, active ? styles.quickActionLabelActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = (colors: AppThemeColors) =>
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
      maxWidth: 980,
      paddingHorizontal: 16,
      paddingTop: 16,
      width: "100%",
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    quickActionsBlock: {
      gap: spacing.xs,
    },
    quickActionsTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    quickActions: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    quickActionButton: {
      alignItems: "center",
      backgroundColor: colors.surfaceTint,
      borderColor: colors.lineSoft,
      borderRadius: 999,
      borderWidth: 1,
      overflow: "hidden",
      paddingHorizontal: 12,
      paddingVertical: 8,
      shadowColor: colors.shadowSoft,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.72,
      shadowRadius: 14,
    },
    quickActionButtonActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentStrong,
    },
    quickActionIcon: {
      color: colors.text,
      fontSize: 18,
      lineHeight: 18,
    },
    quickActionLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 4,
    },
    quickActionLabelActive: {
      color: colors.accentStrong,
    },
  });
