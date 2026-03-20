import { useRef } from "react";
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
import { ManualCycleStartAction } from "../components/ManualCycleStartAction";
import { AppScreenSurface } from "../components/AppScreenSurface";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

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
  statusTone?: "success" | "error" | undefined;
  viewData: DashboardViewData;
  manualCycleStart?: ManualCycleStartViewData | null;
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
}: DashboardOverviewScreenProps) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const editorCardOffsetRef = useRef(0);
  const sectionOffsetsRef = useRef<
    Partial<Record<DayLogEditorSectionKey, number>>
  >({});

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

  function handleQuickAction(action: DashboardQuickActionKey) {
    switch (action) {
      case "period":
        onPatch({ isPeriod: !record.isPeriod });
        if (!record.isPeriod) {
          requestAnimationFrame(() => {
            scrollToSection("flow");
          });
        }
        break;
      case "mood":
        scrollToSection("mood");
        break;
      case "symptom":
        scrollToSection("symptoms");
        break;
    }
  }

  return (
    <AppScreenSurface>
      <ScrollView
        contentContainerStyle={[
          styles.screenContent,
          { paddingBottom: Math.max(insets.bottom + 104, spacing.xl + 48) },
        ]}
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
          <View style={styles.statusStack}>
            <View style={styles.phasePill}>
              <Text style={styles.phasePillIcon}>{viewData.phaseStatus.icon}</Text>
              <Text style={styles.phasePillText}>{viewData.phaseStatus.label}</Text>
            </View>
            <View style={styles.statusBadges}>
              {viewData.statusItems.map((item) => (
                <View key={item} style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>

          {viewData.predictionExplanation ? (
            <Text style={styles.helperText} testID="dashboard-prediction-explanation">
              {viewData.predictionExplanation}
            </Text>
          ) : null}

          <View style={styles.quickActions}>
            <QuickActionButton
              icon="🩸"
              label={viewData.quickActions.period}
              onPress={() => handleQuickAction("period")}
              testID="dashboard-quick-action-period"
            />
            <QuickActionButton
              icon="😊"
              label={viewData.quickActions.mood}
              onPress={() => handleQuickAction("mood")}
              testID="dashboard-quick-action-mood"
            />
            <QuickActionButton
              icon="💊"
              label={viewData.quickActions.symptom}
              onPress={() => handleQuickAction("symptom")}
              testID="dashboard-quick-action-symptom"
            />
          </View>

          <View
            onLayout={(event) => {
              editorCardOffsetRef.current = event.nativeEvent.layout.y;
            }}
          >
            <DayLogEditorCard
              entryExists={entryExists}
              isSaving={isSaving}
              onDelete={onDelete}
              onPatch={onPatch}
              onSave={onSave}
              onSectionLayout={(key, y) => {
                sectionOffsetsRef.current[key] = editorCardOffsetRef.current + y;
              }}
              record={record}
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
  icon,
  label,
  onPress,
  testID,
}: {
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
      onPress={onPress}
      style={styles.quickActionButton}
      testID={testID}
    >
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={styles.quickActionLabel}>{label}</Text>
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
    statusStack: {
      gap: spacing.sm,
    },
    phasePill: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.lineSoft,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    phasePillIcon: {
      color: colors.accentStrong,
      fontSize: 14,
    },
    phasePillText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    statusBadges: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    statusBadge: {
      backgroundColor: colors.surfaceTint,
      borderColor: colors.lineSoft,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    statusBadgeText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "600",
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
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
  });
