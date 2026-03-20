import { getCalendarCopy } from "../i18n/calendar-copy";
import {
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
  usageGoal: ProfileRecord["usageGoal"];
  isPredictionDisabled: boolean;
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
  const editorViewData = buildDayLogEditorViewData(
    profile,
    activeDate,
    symptomRecords,
    filteredSelectedRecord.symptomIDs,
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
    selectedRecord: filteredSelectedRecord,
    selectedDaySummary: buildCalendarDaySummaryViewData(
      filteredSelectedRecord,
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
  const recordsByDay = new Map(records.map((record) => [record.date, record]));
  const gridStart = startOfWeek(startOfMonth(monthStart));
  const gridEnd = endOfWeek(endOfMonth(monthStart));
  const todayValue = formatLocalDate(today);
  const days: CalendarDayCellViewData[] = [];

  for (let cursor = gridStart; cursor <= gridEnd; cursor = addCalendarDays(cursor, 1)) {
    const date = formatLocalDate(cursor);
    const record = recordsByDay.get(date);
    const hasData = record ? hasDayLogData(record) : false;
    const hasSex = record ? hasDayLogSex(record) : false;
    const stateKey = resolveCalendarDayStateKey(date, record, predictionMaps);

    days.push({
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
    usageGoal: profile.usageGoal,
    isPredictionDisabled: profile.unpredictableCycle,
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

  if (day.isPeriod) {
    return {
      hint: calendarCopy.stateHints.recordedPeriod,
      label: calendarCopy.calendarMeaning,
      value: calendarCopy.legend.recordedPeriod,
    };
  }

  if (day.stateKey === "predicted") {
    return {
      hint: calendarCopy.stateHints.predictedPeriod,
      label: calendarCopy.calendarMeaning,
      value: calendarCopy.legend.predictedPeriod,
    };
  }

  if (day.stateKey === "pre_fertile") {
    return {
      hint: calendarCopy.stateHints.lowProbability,
      label: calendarCopy.calendarMeaning,
      value: calendarCopy.legend.lowProbability,
    };
  }

  if (day.stateKey === "fertility_edge") {
    return {
      hint: calendarCopy.stateHints.fertilityEdge,
      label: calendarCopy.calendarMeaning,
      value: calendarCopy.legend.fertilityEdge,
    };
  }

  if (day.stateKey === "fertility_peak") {
    return {
      hint: calendarCopy.stateHints.fertilityPeak,
      label: calendarCopy.calendarMeaning,
      value: calendarCopy.legend.fertilityPeak,
    };
  }

  if (day.stateKey === "ovulation") {
    return {
      hint: calendarCopy.stateHints.ovulation,
      label: calendarCopy.calendarMeaning,
      value: calendarCopy.legend.ovulation,
    };
  }

  if (day.stateKey === "ovulation_tentative") {
    return {
      hint: calendarCopy.stateHints.ovulationTentative,
      label: calendarCopy.calendarMeaning,
      value: calendarCopy.legend.ovulationTentative,
    };
  }

  if (day.hasData) {
    return {
      hint: calendarCopy.stateHints.loggedEntry,
      label: calendarCopy.calendarMeaning,
      value: calendarCopy.legend.loggedEntry,
    };
  }

  return {
    hint: calendarCopy.stateHints.neutral,
    label: calendarCopy.calendarMeaning,
    value: calendarCopy.noData,
  };
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
  }

  if (projection.ovulationDate && projection.cycleAnchorDate) {
    appendPreFertile(
      preFertile,
      projection.cycleAnchorDate,
      predictedPeriodLength,
      projection.ovulationDate,
    );
    appendFertilityWindow(
      fertilityEdge,
      fertilityPeak,
      ovulation,
      projection.ovulationDate,
    );
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

    const ovulationDate = formatLocalDate(
      addDays(currentCycleStart, Math.max(predictionCycleLength - 14, 1)),
    );
    appendPreFertile(
      preFertile,
      currentCycleStartValue,
      predictedPeriodLength,
      ovulationDate,
    );
    appendFertilityWindow(fertilityEdge, fertilityPeak, ovulation, ovulationDate);
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

function appendPreFertile(
  target: Set<string>,
  cycleStartDate: string,
  periodLength: number,
  ovulationDate: string,
) {
  const cycleStart = parseLocalDate(cycleStartDate);
  const ovulation = parseLocalDate(ovulationDate);
  if (!cycleStart || !ovulation) {
    return;
  }

  const start = addDays(cycleStart, periodLength);
  const end = addDays(ovulation, -6);
  if (end < start) {
    return;
  }

  for (let day = start; day <= end; day = addDays(day, 1)) {
    target.add(formatLocalDate(day));
  }
}

function appendFertilityWindow(
  fertilityEdge: Set<string>,
  fertilityPeak: Set<string>,
  ovulationTarget: Set<string>,
  ovulationDate: string,
) {
  const ovulation = parseLocalDate(ovulationDate);
  if (!ovulation) {
    return;
  }

  const fertilityStart = addDays(ovulation, -5);
  const ovulationValue = formatLocalDate(ovulation);
  ovulationTarget.add(ovulationValue);

  for (let day = fertilityStart; day <= ovulation; day = addDays(day, 1)) {
    const value = formatLocalDate(day);
    const offset = Math.round((ovulation.getTime() - day.getTime()) / 86400000);
    if (offset >= 0 && offset <= 2) {
      fertilityPeak.add(value);
      continue;
    }
    fertilityEdge.add(value);
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
