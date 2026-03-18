import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { DayLogRecord } from "../../models/day-log";
import type { CalendarViewData } from "../../services/calendar-view-service";
import type { DayLogEditorViewData } from "../../services/day-log-editor-service";
import { AppButton } from "../components/AppButton";
import { CalendarMonthGrid } from "../components/CalendarMonthGrid";
import { DayLogEditorCard } from "../components/DayLogEditorCard";
import { colors, spacing } from "../theme/tokens";

type CalendarOverviewScreenProps = {
  entryExists: boolean;
  editorViewData: DayLogEditorViewData;
  isSaving: boolean;
  onDelete: () => void | Promise<void>;
  onNextMonth: () => void;
  onPatch: (updates: Partial<DayLogRecord>) => void;
  onPrevMonth: () => void;
  onSave: () => void | Promise<void>;
  onSelectDay: (date: string) => void;
  onToday: () => void;
  record: DayLogRecord;
  statusMessage: string;
  statusTone?: "success" | "error" | undefined;
  viewData: CalendarViewData;
};

export function CalendarOverviewScreen({
  entryExists,
  editorViewData,
  isSaving,
  onDelete,
  onNextMonth,
  onPatch,
  onPrevMonth,
  onSave,
  onSelectDay,
  onToday,
  record,
  statusMessage,
  statusTone,
  viewData,
}: CalendarOverviewScreenProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWide = width >= 960;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.screenContent,
        { paddingBottom: Math.max(insets.bottom + 16, spacing.xl) },
      ]}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
    >
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerCard}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>{viewData.title}</Text>
            <Text style={styles.headerDescription}>{viewData.monthLabel}</Text>
          </View>
          <View style={styles.actions}>
            <AppButton
              label={viewData.actions.prevLabel}
              onPress={onPrevMonth}
              testID="calendar-prev-button"
              variant="secondary"
            />
            <AppButton
              label={viewData.actions.nextLabel}
              onPress={onNextMonth}
              testID="calendar-next-button"
              variant="secondary"
            />
            <AppButton
              label={viewData.actions.todayLabel}
              onPress={onToday}
              testID="calendar-today-button"
            />
          </View>
        </View>

        <View style={[styles.mainGrid, isWide ? styles.mainGridWide : null]}>
          <View style={styles.monthColumn}>
            <View style={styles.monthCard}>
              <CalendarMonthGrid days={viewData.days} onSelectDay={onSelectDay} />

              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, styles.legendDotPeriod]} />
                  <Text style={styles.legendLabel}>{viewData.legend.recordedPeriod}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.legendDot} />
                  <Text style={styles.legendLabel}>{viewData.legend.loggedEntry}</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.legendHeart}>♥</Text>
                  <Text style={styles.legendLabel}>{viewData.legend.sexLogged}</Text>
                </View>
                <View style={styles.legendItem}>
                  <Text style={styles.legendTodayPill}>{viewData.legend.today}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.editorColumn}>
            <DayLogEditorCard
              entryExists={entryExists}
              isSaving={isSaving}
              onDelete={onDelete}
              onPatch={onPatch}
              onSave={onSave}
              record={record}
              statusMessage={statusMessage}
              statusTone={statusTone}
              viewData={{
                ...editorViewData,
                title: viewData.editor.title,
                subtitle: viewData.editor.description,
              }}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContent: {
    paddingBottom: spacing.xl,
  },
  container: {
    alignSelf: "center",
    gap: spacing.md,
    maxWidth: 1100,
    paddingHorizontal: 16,
    paddingTop: 16,
    width: "100%",
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.sm,
    padding: 16,
  },
  headerCopy: {
    gap: 4,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  headerDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  mainGrid: {
    gap: 20,
  },
  mainGridWide: {
    flexDirection: "row",
  },
  monthColumn: {
    flex: 2,
    minWidth: 0,
  },
  monthCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.md,
    padding: 16,
  },
  editorColumn: {
    flex: 1,
    minWidth: 0,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  legendDot: {
    backgroundColor: colors.accentStrong,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  legendDotPeriod: {
    backgroundColor: "#c7756d",
  },
  legendLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  legendHeart: {
    color: colors.accentStrong,
    fontSize: 12,
    fontWeight: "700",
  },
  legendTodayPill: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
