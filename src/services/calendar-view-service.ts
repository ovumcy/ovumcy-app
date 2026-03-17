import { calendarCopy } from "../i18n/calendar-copy";
import {
  hasDayLogData,
  hasDayLogSex,
  type DayLogRecord,
} from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  buildDayLogEditorViewData,
  type DayLogEditorViewData,
} from "./day-log-editor-service";
import { formatLocalDate } from "./profile-settings-policy";
import { filterKnownSymptomIDs } from "./symptom-policy";

export type CalendarDayCellViewData = {
  date: string;
  label: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isPeriod: boolean;
  hasData: boolean;
  hasSex: boolean;
};

export type CalendarViewData = {
  eyebrow: string;
  title: string;
  description: string;
  monthLabel: string;
  monthValue: string;
  selectedDate: string;
  prevMonthValue: string;
  nextMonthValue: string;
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
    loggedEntry: string;
    sexLogged: string;
    today: string;
  };
};

export type LoadedCalendarState = {
  profile: ProfileRecord;
  selectedRecord: DayLogRecord;
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
  const monthRangeStart = formatLocalDate(startOfMonth(monthStart));
  const monthRangeEnd = formatLocalDate(endOfMonth(monthStart));

  const [profile, logs, selectedRecord, symptomRecords] = await Promise.all([
    storage.readProfileRecord(),
    storage.listDayLogRecordsInRange(monthRangeStart, monthRangeEnd),
    storage.readDayLogRecord(activeDate),
    storage.listSymptomRecords(),
  ]);
  const filteredSelectedRecord: DayLogRecord = {
    ...selectedRecord,
    symptomIDs: filterKnownSymptomIDs(symptomRecords, selectedRecord.symptomIDs),
  };

  return {
    profile,
    selectedRecord: filteredSelectedRecord,
    editorViewData: buildDayLogEditorViewData(
      profile,
      activeDate,
      symptomRecords,
      filteredSelectedRecord.symptomIDs,
      locale,
    ),
    viewData: buildCalendarViewData(
      profile,
      logs,
      today,
      monthStart,
      activeDate,
      locale,
    ),
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
  const recordsByDay = new Map(records.map((record) => [record.date, record]));
  const gridStart = startOfWeek(startOfMonth(monthStart));
  const gridEnd = endOfWeek(endOfMonth(monthStart));
  const days: CalendarDayCellViewData[] = [];

  for (let cursor = gridStart; cursor <= gridEnd; cursor = addCalendarDays(cursor, 1)) {
    const date = formatLocalDate(cursor);
    const record = recordsByDay.get(date);

    days.push({
      date,
      label: String(cursor.getDate()),
      isCurrentMonth: cursor.getMonth() === monthStart.getMonth(),
      isToday: date === formatLocalDate(today),
      isSelected: date === selectedDate,
      isPeriod: record?.isPeriod === true,
      hasData: record ? hasDayLogData(record) : false,
      hasSex: record ? hasDayLogSex(record) : false,
    });
  }

  return {
    eyebrow: calendarCopy.eyebrow,
    title: calendarCopy.title,
    description: calendarCopy.subtitle,
    monthLabel: new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
    }).format(monthStart),
    monthValue: formatMonthValue(monthStart),
    selectedDate,
    prevMonthValue: formatMonthValue(addMonth(monthStart, -1)),
    nextMonthValue: formatMonthValue(addMonth(monthStart, 1)),
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
      loggedEntry: calendarCopy.legend.loggedEntry,
      sexLogged: calendarCopy.legend.sexLogged,
      today: calendarCopy.legend.today,
    },
  };
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
