import { StyleSheet, Text, View } from "react-native";

import type { DayLogRecord } from "../../models/day-log";
import type { DayLogEditorViewData } from "../../services/day-log-editor-service";
import type { CalendarViewData } from "../../services/calendar-view-service";
import { AppButton } from "../components/AppButton";
import { CalendarMonthGrid } from "../components/CalendarMonthGrid";
import { DayLogEditorCard } from "../components/DayLogEditorCard";
import { FeatureCard } from "../components/FeatureCard";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { spacing } from "../theme/tokens";

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
  viewData,
}: CalendarOverviewScreenProps) {
  return (
    <ScreenScaffold
      eyebrow={viewData.eyebrow}
      title={viewData.title}
      description={viewData.description}
    >
      <FeatureCard title={viewData.monthLabel} description="Browse local history month by month.">
        <View style={styles.actions}>
          <AppButton
            label={viewData.actions.prevLabel}
            onPress={onPrevMonth}
            testID="calendar-prev-button"
            variant="secondary"
          />
          <AppButton
            label={viewData.actions.todayLabel}
            onPress={onToday}
            testID="calendar-today-button"
            variant="secondary"
          />
          <AppButton
            label={viewData.actions.nextLabel}
            onPress={onNextMonth}
            testID="calendar-next-button"
            variant="secondary"
          />
        </View>

        <CalendarMonthGrid days={viewData.days} onSelectDay={onSelectDay} />

        <View style={styles.legend}>
          <Text>{viewData.legend.recordedPeriod}</Text>
          <Text>{viewData.legend.loggedEntry}</Text>
          <Text>{viewData.legend.sexLogged}</Text>
          <Text>{viewData.legend.today}</Text>
        </View>
      </FeatureCard>

      <DayLogEditorCard
        entryExists={entryExists}
        isSaving={isSaving}
        onDelete={onDelete}
        onPatch={onPatch}
        onSave={onSave}
        record={record}
        statusMessage={statusMessage}
        viewData={{
          ...editorViewData,
          title: viewData.editor.title,
          subtitle: viewData.editor.description,
        }}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
