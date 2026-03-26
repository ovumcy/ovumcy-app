import { getCalendarCopy } from "../i18n/calendar-copy";
import {
  createEmptyDayLogRecord,
  hasDayLogData,
  hasDayLogSex,
  type DayLogRecord,
} from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  buildCycleHistorySummary,
  buildCurrentCycleProjection,
} from "./cycle-history-service";
import { predictCycleWindow } from "./cycle-prediction-policy";
import {
  buildDayLogEditorViewData,
  type DayLogEditorViewData,
} from "./day-log-editor-service";
import {
  addDays,
  formatLocalDate,
  parseLocalDate,
} from "./profile-settings-policy";
import { filterKnownSymptomIDs } from "./symptom-policy";
import {
  buildCalendarPredictionNotice,
  type CalendarPredictionNoticeViewData,
} from "./calendar-notice-service";

export type CalendarDayStateKey =
  | "neutral"
  | "period"
  | "predicted"
  | "pre_fertile"
  | "fertility_edge"
  | "fertility_peak"
  | "ovulation"
  | "ovulation_tentative";

export type CalendarDayCellViewData = {
  accessibilityLabel: string;
  date: string;
  label: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isPeriod: boolean;
  openEditDirectly: boolean;
  stateKey: CalendarDayStateKey;
  hasData: boolean;
  hasSex: boolean;
  hasOvulationMarker: boolean;
  hasTentativeOvulationMarker: boolean;
};

export type CalendarDaySummaryViewData = {
  dateLabel: string;
  subtitle: string;
  markerSummary: {
    label: string;
    value: string;
  } | null;
  stateSummary: {
    hint: string;
    label: string;
    value: string;
  };
  noEntryLabel: string;
  symptomsLabel: string;
  symptomsValue: string;
  summaryRows: {
    key: "period" | "mood" | "flow";
    label: string;
    value: string;
  }[];
  actions: {
    addEntryLabel: string;
    editEntryLabel: string;
    cancelLabel: string;
  };
};

export type CalendarViewData = {
  title: string;
  monthLabel: string;
  monthValue: string;
  selectedDate: string;
  prevMonthValue: string;
  nextMonthValue: string;
  weekdayLabels: string[];
  usageGoal: ProfileRecord["usageGoal"];
  isPredictionDisabled: boolean;
  predictionNotice: CalendarPredictionNoticeViewData | null;
  days: CalendarDayCellViewData[];
  actions: {
    prevLabel: string;
    nextLabel: string;
    todayLabel: string;
  };
  editor: {
    title: string;
    description: string;
  };
  legend: {
    guide: string;
    meaningTitle: string;
    markersTitle: string;
    showLegend: string;
    hideLegend: string;
    recordedPeriod: string;
    predictedPeriod: string;
    lowProbability: string;
    fertilityEdge: string;
    fertilityPeak: string;
    ovulation: string;
    ovulationTentative: string;
    loggedEntry: string;
    sexLogged: string;
    today: string;
  };
};

export type LoadedCalendarState = {
  records: DayLogRecord[];
  profile: ProfileRecord;
  selectedRecord: DayLogRecord;
  selectedDaySummary: CalendarDaySummaryViewData;
  editorViewData: DayLogEditorViewData;
  viewData: CalendarViewData;
};

export async function loadCalendarScreenState(
  storage: LocalAppStorage,
  now: Date,
  monthValue?: string,
  selectedDate?: string,
  locale = "en",
): Promise<LoadedCalendarState> {
  const today = atLocalDay(now);
  const monthStart = parseMonthValue(monthValue) ?? startOfMonth(today);
  const activeDate = selectedDate ?? formatLocalDate(today);
  const gridStart = startOfWeek(startOfMonth(monthStart));
  const gridEnd = endOfWeek(endOfMonth(monthStart));
  const rangeStart = formatLocalDate(addCalendarDays(gridStart, -70));
  const rangeEnd = formatLocalDate(addCalendarDays(gridEnd, 70));

  const [profile, logs, selectedRecord, symptomRecords] = await Promise.all([
    storage.readProfileRecord(),
    storage.listDayLogRecordsInRange(rangeStart, rangeEnd),
    storage.readDayLogRecord(activeDate),
    storage.listSymptomRecords(),
  ]);
  const filteredSelectedRecord: DayLogRecord = {
    ...selectedRecord,
    symptomIDs: filterKnownSymptomIDs(symptomRecords, selectedRecord.symptomIDs),
  };
  const effectiveSelectedRecord = resolveCalendarVisibleRecord(
    profile,
    filteredSelectedRecord,
    activeDate,
  );
  const editorViewData = buildDayLogEditorViewData(
    profile,
    activeDate,
    symptomRecords,
    effectiveSelectedRecord.symptomIDs,
    locale,
  );
  const viewData = buildCalendarViewData(
    profile,
    logs,
    today,
    monthStart,
    activeDate,
    locale,
  );
  const selectedDay =
    viewData.days.find((day) => day.date === activeDate) ?? null;

  return {
    records: logs,
    profile,
    selectedRecord: effectiveSelectedRecord,
    selectedDaySummary: buildCalendarDaySummaryViewData(
      effectiveSelectedRecord,
      editorViewData,
      selectedDay,
      locale,
    ),
    editorViewData,
    viewData,
  };
}

export function buildCalendarViewData(
  profile: ProfileRecord,
  records: DayLogRecord[],
  today: Date,
  monthStart: Date,
  selectedDate: string,
  locale = "en",
): CalendarViewData {
  const calendarCopy = getCalendarCopy(locale);
  const history = buildCycleHistorySummary(profile, records, today);
  const projection = buildCurrentCycleProjection(profile, history, records, today);
  const predictionMaps = buildCalendarPredictionMaps(
    profile,
    history,
    projection,
    monthStart,
  );
  const recordsByDay = buildCalendarRecordsByDay(profile, records);
  const gridStart = startOfWeek(startOfMonth(monthStart));
  const gridEnd = endOfWeek(endOfMonth(monthStart));
  const todayValue = formatLocalDate(today);
  const predictionNotice = buildCalendarPredictionNotice(profile, locale);
  const days: CalendarDayCellViewData[] = [];

  for (let cursor = gridStart; cursor <= gridEnd; cursor = addCalendarDays(cursor, 1)) {
    const date = formatLocalDate(cursor);
    const record = recordsByDay.get(date);
    const hasData = record ? hasDayLogData(record) : false;
    const hasSex = record ? hasDayLogSex(record) : false;
    const stateKey = resolveCalendarDayStateKey(date, record, predictionMaps);

    days.push({
      accessibilityLabel: buildCalendarDayAccessibilityLabel(
        date,
        stateKey,
        {
          hasData,
          hasSex,
          isToday: date === todayValue,
          isPeriod: record?.isPeriod === true,
        },
        calendarCopy,
        locale,
      ),
      date,
      label: String(cursor.getDate()),
      isCurrentMonth: cursor.getMonth() === monthStart.getMonth(),
      isToday: date === todayValue,
      isSelected: date === selectedDate,
      isPeriod: record?.isPeriod === true,
      openEditDirectly: false,
      stateKey,
      hasData,
      hasSex,
      hasOvulationMarker:
        predictionMaps.ovulation.has(date) && stateKey !== "ovulation_tentative",
      hasTentativeOvulationMarker: predictionMaps.tentativeOvulation.has(date),
    });
  }

  return {
    title: calendarCopy.title,
    monthLabel: new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(monthStart),
    monthValue: formatMonthValue(monthStart),
    selectedDate,
    prevMonthValue: formatMonthValue(addMonth(monthStart, -1)),
    nextMonthValue: formatMonthValue(addMonth(monthStart, 1)),
    weekdayLabels: buildWeekdayLabels(locale),
    usageGoal: profile.usageGoal,
    isPredictionDisabled: profile.unpredictableCycle,
    predictionNotice,
    days,
    actions: {
      prevLabel: calendarCopy.prev,
      nextLabel: calendarCopy.next,
      todayLabel: calendarCopy.today,
    },
    editor: {
      title: calendarCopy.dayEditorTitle,
      description: calendarCopy.dayEditorSubtitle,
    },
    legend: {
      guide: calendarCopy.legendGuide,
      meaningTitle: calendarCopy.legend.meaningTitle,
      markersTitle: calendarCopy.legend.markersTitle,
      showLegend: calendarCopy.legend.showLegend,
      hideLegend: calendarCopy.legend.hideLegend,
      recordedPeriod: calendarCopy.legend.recordedPeriod,
      predictedPeriod: calendarCopy.legend.predictedPeriod,
      lowProbability: calendarCopy.legend.lowProbability,
      fertilityEdge: calendarCopy.legend.fertilityEdge,
      fertilityPeak: calendarCopy.legend.fertilityPeak,
      ovulation: calendarCopy.legend.ovulation,
      ovulationTentative: calendarCopy.legend.ovulationTentative,
      loggedEntry: calendarCopy.legend.loggedEntry,
      sexLogged: calendarCopy.legend.sexLogged,
      today: calendarCopy.legend.today,
    },
  };
}

function buildCalendarDaySummaryViewData(
  record: DayLogRecord,
  editorViewData: DayLogEditorViewData,
  selectedDay: CalendarDayCellViewData | null,
  locale: string,
): CalendarDaySummaryViewData {
  const calendarCopy = getCalendarCopy(locale);
  const selectedSymptoms = editorViewData.options.symptoms
    .filter((option) => record.symptomIDs.includes(option.value))
    .map((option) => option.label);
  const moodLabel =
    editorViewData.options.mood.find((option) => option.value === record.mood)?.label ??
    calendarCopy.noData;
  const flowLabel =
    editorViewData.options.flow.find((option) => option.value === record.flow)?.label ??
    calendarCopy.noData;

  return {
    dateLabel: formatCalendarSummaryDate(record.date, locale),
    subtitle: calendarCopy.dayEditorSubtitle,
    markerSummary: buildCalendarMarkerSummary(selectedDay, calendarCopy),
    stateSummary: buildCalendarStateSummary(selectedDay, calendarCopy),
    noEntryLabel: calendarCopy.noEntry,
    symptomsLabel: editorViewData.labels.symptoms,
    symptomsValue:
      selectedSymptoms.length > 0
        ? selectedSymptoms.join(", ")
        : calendarCopy.noData,
    summaryRows: [
      {
        key: "period",
        label: editorViewData.labels.periodDay,
        value: record.isPeriod ? calendarCopy.periodDayYes : calendarCopy.periodDayNo,
      },
      {
        key: "mood",
        label: editorViewData.labels.mood,
        value: moodLabel,
      },
      {
        key: "flow",
        label: editorViewData.labels.flow,
        value: record.isPeriod ? flowLabel : editorViewData.options.flow[0]?.label ?? calendarCopy.noData,
      },
    ],
    actions: {
      addEntryLabel: calendarCopy.addEntry,
      editEntryLabel: calendarCopy.editEntry,
      cancelLabel: calendarCopy.cancelEdit,
    },
  };
}

function buildCalendarMarkerSummary(
  day: CalendarDayCellViewData | null,
  calendarCopy: ReturnType<typeof getCalendarCopy>,
): {
  label: string;
  value: string;
} | null {
  if (!day) {
    return null;
  }

  const markers: string[] = [];
  if (day.hasData) {
    markers.push(calendarCopy.legend.loggedEntry);
  }
  if (day.hasSex) {
    markers.push(calendarCopy.legend.sexLogged);
  }
  if (day.isToday) {
    markers.push(calendarCopy.legend.today);
  }

  if (markers.length === 0) {
    return null;
  }

  return {
    label: calendarCopy.calendarMarkers,
    value: markers.join(" · "),
  };
}

function buildCalendarDayAccessibilityLabel(
  date: string,
  stateKey: CalendarDayStateKey,
  flags: {
    hasData: boolean;
    hasSex: boolean;
    isToday: boolean;
    isPeriod: boolean;
  },
  calendarCopy: ReturnType<typeof getCalendarCopy>,
  locale: string,
): string {
  const parts = [formatCalendarAccessibilityDate(date, locale)];
  const stateValue = resolveCalendarStateValue(
    stateKey,
    flags.isPeriod,
    flags.hasData,
    calendarCopy,
  );

  if (stateValue) {
    parts.push(stateValue);
  }
  if (flags.hasSex) {
    parts.push(calendarCopy.legend.sexLogged);
  }
  if (flags.isToday) {
    parts.push(calendarCopy.legend.today);
  }

  return parts.join(". ");
}

function buildCalendarStateSummary(
  day: CalendarDayCellViewData | null,
  calendarCopy: ReturnType<typeof getCalendarCopy>,
) {
  if (!day) {
    return {
      hint: calendarCopy.stateHints.neutral,
      label: calendarCopy.calendarMeaning,
      value: calendarCopy.noData,
    };
  }

  const stateValue = resolveCalendarStateValue(
    day.stateKey,
    day.isPeriod,
    day.hasData,
    calendarCopy,
  );
  if (stateValue) {
    return {
      hint: resolveCalendarStateHint(day.stateKey, day.isPeriod, day.hasData, calendarCopy),
      label: calendarCopy.calendarMeaning,
      value: stateValue,
    };
  }

  return {
    hint: calendarCopy.stateHints.neutral,
    label: calendarCopy.calendarMeaning,
    value: calendarCopy.noData,
  };
}

function resolveCalendarStateValue(
  stateKey: CalendarDayStateKey,
  isPeriod: boolean,
  hasData: boolean,
  calendarCopy: ReturnType<typeof getCalendarCopy>,
): string | null {
  if (isPeriod) {
    return calendarCopy.legend.recordedPeriod;
  }

  if (stateKey === "predicted") {
    return calendarCopy.legend.predictedPeriod;
  }

  if (stateKey === "pre_fertile") {
    return calendarCopy.legend.lowProbability;
  }

  if (stateKey === "fertility_edge") {
    return calendarCopy.legend.fertilityEdge;
  }

  if (stateKey === "fertility_peak") {
    return calendarCopy.legend.fertilityPeak;
  }

  if (stateKey === "ovulation") {
    return calendarCopy.legend.ovulation;
  }

  if (stateKey === "ovulation_tentative") {
    return calendarCopy.legend.ovulationTentative;
  }

  if (hasData) {
    return calendarCopy.legend.loggedEntry;
  }

  return null;
}

function resolveCalendarStateHint(
  stateKey: CalendarDayStateKey,
  isPeriod: boolean,
  hasData: boolean,
  calendarCopy: ReturnType<typeof getCalendarCopy>,
): string {
  if (isPeriod) {
    return calendarCopy.stateHints.recordedPeriod;
  }

  if (stateKey === "predicted") {
    return calendarCopy.stateHints.predictedPeriod;
  }

  if (stateKey === "pre_fertile") {
    return calendarCopy.stateHints.lowProbability;
  }

  if (stateKey === "fertility_edge") {
    return calendarCopy.stateHints.fertilityEdge;
  }

  if (stateKey === "fertility_peak") {
    return calendarCopy.stateHints.fertilityPeak;
  }

  if (stateKey === "ovulation") {
    return calendarCopy.stateHints.ovulation;
  }

  if (stateKey === "ovulation_tentative") {
    return calendarCopy.stateHints.ovulationTentative;
  }

  if (hasData) {
    return calendarCopy.stateHints.loggedEntry;
  }

  return calendarCopy.stateHints.neutral;
}

function formatCalendarAccessibilityDate(value: string, locale: string): string {
  const parsed = parseLocalDate(value);
  if (!parsed) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(parsed);
}

function resolveCalendarDayStateKey(
  date: string,
  record: DayLogRecord | undefined,
  predictionMaps: ReturnType<typeof buildCalendarPredictionMaps>,
): CalendarDayStateKey {
  if (record?.isPeriod) {
    return "period";
  }
  if (predictionMaps.tentativeOvulation.has(date)) {
    return "ovulation_tentative";
  }
  if (predictionMaps.ovulation.has(date)) {
    return "ovulation";
  }
  if (predictionMaps.fertilityPeak.has(date)) {
    return "fertility_peak";
  }
  if (predictionMaps.fertilityEdge.has(date)) {
    return "fertility_edge";
  }
  if (predictionMaps.preFertile.has(date)) {
    return "pre_fertile";
  }
  if (predictionMaps.predictedPeriod.has(date)) {
    return "predicted";
  }
  return "neutral";
}

function buildCalendarPredictionMaps(
  profile: ProfileRecord,
  history: ReturnType<typeof buildCycleHistorySummary>,
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  monthStart: Date,
): {
  predictedPeriod: Set<string>;
  preFertile: Set<string>;
  fertilityEdge: Set<string>;
  fertilityPeak: Set<string>;
  ovulation: Set<string>;
  tentativeOvulation: Set<string>;
} {
  const predictedPeriod = new Set<string>();
  const preFertile = new Set<string>();
  const fertilityEdge = new Set<string>();
  const fertilityPeak = new Set<string>();
  const ovulation = new Set<string>();
  const tentativeOvulation = new Set<string>();

  if (profile.unpredictableCycle) {
    return {
      predictedPeriod,
      preFertile,
      fertilityEdge,
      fertilityPeak,
      ovulation,
      tentativeOvulation,
    };
  }

  const gridEnd = endOfWeek(endOfMonth(monthStart));
  const predictedPeriodLength = resolvePredictedPeriodLength(profile, history);

  if (projection.cycleAnchorDate) {
    appendPredictedPeriod(predictedPeriod, projection.cycleAnchorDate, predictedPeriodLength);
    appendPredictedWindow(
      preFertile,
      fertilityEdge,
      fertilityPeak,
      ovulation,
      projection.cycleAnchorDate,
      projection.predictionCycleLength,
      predictedPeriodLength,
    );
  }

  if (projection.isPredictionStale) {
    appendImmediateStalePeriod(
      predictedPeriod,
      projection.cycleAnchorDate,
      projection.predictionCycleLength,
      predictedPeriodLength,
    );

    return {
      predictedPeriod,
      preFertile,
      fertilityEdge,
      fertilityPeak,
      ovulation,
      tentativeOvulation,
    };
  }

  if (projection.nextPeriodDate) {
    appendPredictedCycles(
      predictedPeriod,
      preFertile,
      fertilityEdge,
      fertilityPeak,
      ovulation,
      projection.nextPeriodDate,
      projection.predictionCycleLength,
      predictedPeriodLength,
      gridEnd,
    );
  }

  return {
    predictedPeriod,
    preFertile,
    fertilityEdge,
    fertilityPeak,
    ovulation,
    tentativeOvulation,
  };
}

function appendImmediateStalePeriod(
  predictedPeriod: Set<string>,
  cycleAnchorDate: string | null,
  predictionCycleLength: number,
  predictedPeriodLength: number,
) {
  if (!cycleAnchorDate) {
    return;
  }

  const cycleAnchor = parseLocalDate(cycleAnchorDate);
  if (!cycleAnchor) {
    return;
  }

  appendPredictedPeriod(
    predictedPeriod,
    formatLocalDate(addDays(cycleAnchor, predictionCycleLength)),
    predictedPeriodLength,
  );
}

function appendPredictedCycles(
  predictedPeriod: Set<string>,
  preFertile: Set<string>,
  fertilityEdge: Set<string>,
  fertilityPeak: Set<string>,
  ovulation: Set<string>,
  nextPeriodDate: string,
  predictionCycleLength: number,
  predictedPeriodLength: number,
  gridEnd: Date,
) {
  const cycleStart = parseLocalDate(nextPeriodDate);
  if (!cycleStart) {
    return;
  }

  for (
    let currentCycleStart = cycleStart;
    currentCycleStart <= gridEnd;
    currentCycleStart = addDays(currentCycleStart, predictionCycleLength)
  ) {
    const currentCycleStartValue = formatLocalDate(currentCycleStart);
    appendPredictedPeriod(
      predictedPeriod,
      currentCycleStartValue,
      predictedPeriodLength,
    );
    appendPredictedWindow(
      preFertile,
      fertilityEdge,
      fertilityPeak,
      ovulation,
      currentCycleStartValue,
      predictionCycleLength,
      predictedPeriodLength,
    );
  }
}

function appendPredictedPeriod(
  target: Set<string>,
  cycleStartDate: string,
  periodLength: number,
) {
  const cycleStart = parseLocalDate(cycleStartDate);
  if (!cycleStart) {
    return;
  }

  for (let offset = 0; offset < periodLength; offset += 1) {
    target.add(formatLocalDate(addDays(cycleStart, offset)));
  }
}

function appendFertilityWindow(
  fertilityEdge: Set<string>,
  fertilityPeak: Set<string>,
  ovulationTarget: Set<string>,
  fertilityStartDate: string,
  fertilityEndDate: string,
  ovulationDate: string,
) {
  const fertilityStart = parseLocalDate(fertilityStartDate);
  const fertilityEnd = parseLocalDate(fertilityEndDate);
  const ovulation = parseLocalDate(ovulationDate);
  if (!fertilityStart || !fertilityEnd || !ovulation || fertilityEnd < fertilityStart) {
    return;
  }

  const ovulationValue = formatLocalDate(ovulation);
  ovulationTarget.add(ovulationValue);

  for (let day = fertilityStart; day <= fertilityEnd; day = addDays(day, 1)) {
    const value = formatLocalDate(day);
    const offset = Math.round((ovulation.getTime() - day.getTime()) / 86400000);
    if (offset >= 0 && offset <= 2) {
      fertilityPeak.add(value);
      continue;
    }
    fertilityEdge.add(value);
  }
}

function appendPredictedWindow(
  preFertile: Set<string>,
  fertilityEdge: Set<string>,
  fertilityPeak: Set<string>,
  ovulation: Set<string>,
  cycleStartDate: string,
  cycleLength: number,
  periodLength: number,
) {
  const predictedWindow = predictCycleWindow(cycleStartDate, cycleLength);
  if (
    !predictedWindow.calculable ||
    !predictedWindow.ovulationDate ||
    !predictedWindow.fertilityStart ||
    !predictedWindow.fertilityEnd
  ) {
    return;
  }

  appendPreFertile(
    preFertile,
    cycleStartDate,
    periodLength,
    predictedWindow.fertilityStart,
  );
  appendFertilityWindow(
    fertilityEdge,
    fertilityPeak,
    ovulation,
    predictedWindow.fertilityStart,
    predictedWindow.fertilityEnd,
    predictedWindow.ovulationDate,
  );
}

function appendPreFertile(
  target: Set<string>,
  cycleStartDate: string,
  periodLength: number,
  fertilityStartDate: string,
) {
  const cycleStart = parseLocalDate(cycleStartDate);
  const fertilityStart = parseLocalDate(fertilityStartDate);
  if (!cycleStart || !fertilityStart) {
    return;
  }

  const start = addDays(cycleStart, periodLength);
  const end = addDays(fertilityStart, -1);
  if (end < start) {
    return;
  }

  for (let day = start; day <= end; day = addDays(day, 1)) {
    target.add(formatLocalDate(day));
  }
}

function resolvePredictedPeriodLength(
  profile: ProfileRecord,
  history: ReturnType<typeof buildCycleHistorySummary>,
): number {
  if (history.completedCycles.length === 0) {
    return profile.periodLength;
  }

  const average =
    history.completedCycles.reduce((sum, cycle) => sum + cycle.periodLength, 0) /
    history.completedCycles.length;

  return Math.max(1, Math.round(average));
}

function parseMonthValue(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const parsed = new Date(year, month, 1);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month
  ) {
    return null;
  }

  return parsed;
}

function formatMonthValue(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function formatCalendarSummaryDate(value: string, locale: string): string {
  const parsed = parseLocalDate(value);
  if (!parsed) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(parsed);
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

function startOfWeek(value: Date): Date {
  return addCalendarDays(value, -value.getDay());
}

function endOfWeek(value: Date): Date {
  return addCalendarDays(value, 6 - value.getDay());
}

function addCalendarDays(value: Date, days: number): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
}

function addMonth(value: Date, amount: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function atLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function buildWeekdayLabels(locale: string): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const sundayReference = new Date(2026, 0, 4);

  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(addCalendarDays(sundayReference, index)).replace(".", ""),
  );
}

function buildCalendarRecordsByDay(
  profile: ProfileRecord,
  records: readonly DayLogRecord[],
): Map<string, DayLogRecord> {
  const recordsByDay = new Map(records.map((record) => [record.date, record]));

  if (profile.lastPeriodStart) {
    recordsByDay.set(
      profile.lastPeriodStart,
      resolveCalendarVisibleRecord(
        profile,
        recordsByDay.get(profile.lastPeriodStart),
        profile.lastPeriodStart,
      ),
    );
  }

  return recordsByDay;
}

function resolveCalendarVisibleRecord(
  profile: ProfileRecord,
  record: DayLogRecord | undefined,
  date: string,
): DayLogRecord {
  if (profile.lastPeriodStart !== date) {
    return record ?? createEmptyDayLogRecord(date);
  }

  return {
    ...(record ?? createEmptyDayLogRecord(date)),
    date,
    cycleStart: true,
    isPeriod: true,
    isUncertain: false,
  };
}
