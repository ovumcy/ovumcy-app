import { dashboardCopy } from "../i18n/dashboard-copy";
import type { DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  buildCycleHistorySummary,
  resolveLatestCycleStartAnchorBeforeOrOn,
} from "./cycle-history-service";
import { sanitizeDayLogRecord } from "./day-log-policy";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";

const MANUAL_CYCLE_START_FUTURE_DAYS = 2;
const MANUAL_CYCLE_START_SUGGESTION_GAP_DAYS = 15;

export type ManualCycleStartPrompt = {
  acceptLabel: string;
  kind: "replace_existing" | "short_gap";
  message: string;
};

export type ManualCycleStartViewData = {
  buttonLabel: string;
  isActive: boolean;
  prompts: ManualCycleStartPrompt[];
  notices: {
    future?: string;
    implantation?: string;
    suggestion?: string;
  };
};

type ManualCycleStartPolicy = {
  conflictDateLabel: string;
  hasConflict: boolean;
  implantationGapDays: number;
  markUncertainRequired: boolean;
  potentialImplantation: boolean;
  previousDateLabel: string;
  previousStartValue: string | null;
  shortGapDays: number;
  targetDateLabel: string;
};

type ManualCycleStartResult =
  | { ok: true; record: DayLogRecord }
  | { errorMessage: string; ok: false };

export function buildManualCycleStartViewData(
  profile: ProfileRecord,
  records: readonly DayLogRecord[],
  record: DayLogRecord,
  now: Date,
  locale = "en",
): ManualCycleStartViewData | null {
  if (!isAllowedManualCycleStartDate(record.date, now)) {
    return null;
  }

  const mergedRecords = mergeDraftRecord(records, record);
  const policy = resolveManualCycleStartPolicy(profile, mergedRecords, record.date, now, locale);
  const prompts: ManualCycleStartPrompt[] = [];

  if (policy.hasConflict) {
    prompts.push({
      acceptLabel: dashboardCopy.cycleStartReplaceAccept,
      kind: "replace_existing",
      message: formatPromptMessage(dashboardCopy.cycleStartReplaceMessage, [
        policy.conflictDateLabel,
        policy.targetDateLabel,
      ]),
    });
  }

  if (policy.markUncertainRequired) {
    prompts.push({
      acceptLabel: dashboardCopy.cycleStartShortGapAccept,
      kind: "short_gap",
      message: formatPromptMessage(dashboardCopy.cycleStartShortGapMessage, [
        String(policy.shortGapDays),
        policy.previousDateLabel,
      ]),
    });
  }

  return {
    buttonLabel: dashboardCopy.manualCycleStart,
    isActive: record.cycleStart,
    prompts,
    notices: {
      ...(isFutureManualCycleStartDate(record.date, now)
        ? { future: dashboardCopy.futureCycleStartNotice }
        : {}),
      ...(policy.potentialImplantation
        ? { implantation: dashboardCopy.implantationWarning }
        : {}),
      ...(shouldSuggestManualCycleStart(profile, mergedRecords, record, now)
        ? { suggestion: dashboardCopy.cycleStartSuggestion }
        : {}),
    },
  };
}

export async function applyManualCycleStart(
  storage: LocalAppStorage,
  profile: ProfileRecord,
  records: readonly DayLogRecord[],
  record: DayLogRecord,
  now: Date,
  locale = "en",
  options: {
    markUncertain: boolean;
    replaceExisting: boolean;
  },
): Promise<ManualCycleStartResult> {
  if (!isAllowedManualCycleStartDate(record.date, now)) {
    return {
      ok: false,
      errorMessage: dashboardCopy.invalidCycleStartDate,
    };
  }

  const mergedRecords = mergeDraftRecord(records, record);
  const policy = resolveManualCycleStartPolicy(profile, mergedRecords, record.date, now, locale);

  if (policy.hasConflict && !options.replaceExisting) {
    return {
      ok: false,
      errorMessage: dashboardCopy.cycleStartReplaceRequired,
    };
  }

  if (policy.markUncertainRequired && !options.markUncertain) {
    return {
      ok: false,
      errorMessage: dashboardCopy.cycleStartConfirmationRequired,
    };
  }

  const nextSelectedRecord = sanitizeDayLogRecord({
    ...record,
    cycleStart: true,
    date: record.date,
    isPeriod: true,
    isUncertain: options.markUncertain && policy.markUncertainRequired,
  });

  const [clusterStart, clusterEnd] = resolvePeriodClusterBounds(
    mergeDraftRecord(records, nextSelectedRecord),
    record.date,
  );

  const recordsToWrite = new Map<string, DayLogRecord>();
  recordsToWrite.set(nextSelectedRecord.date, nextSelectedRecord);

  for (const currentRecord of records) {
    if (currentRecord.date === nextSelectedRecord.date) {
      continue;
    }

    if (!currentRecord.cycleStart) {
      continue;
    }

    if (currentRecord.date < clusterStart || currentRecord.date > clusterEnd) {
      continue;
    }

    recordsToWrite.set(
      currentRecord.date,
      sanitizeDayLogRecord({
        ...currentRecord,
        cycleStart: false,
        isUncertain: false,
      }),
    );
  }

  try {
    for (const nextRecord of recordsToWrite.values()) {
      await storage.writeDayLogRecord(nextRecord);
    }
  } catch {
    return {
      ok: false,
      errorMessage: dashboardCopy.manualCycleStartFailed,
    };
  }

  return {
    ok: true,
    record: nextSelectedRecord,
  };
}

function resolveManualCycleStartPolicy(
  profile: ProfileRecord,
  records: readonly DayLogRecord[],
  date: string,
  now: Date,
  locale: string,
): ManualCycleStartPolicy {
  const targetDate = parseLocalDate(date);
  if (!targetDate) {
    return {
      conflictDateLabel: "",
      hasConflict: false,
      implantationGapDays: 0,
      markUncertainRequired: false,
      potentialImplantation: false,
      previousDateLabel: "",
      previousStartValue: null,
      shortGapDays: 0,
      targetDateLabel: date,
    };
  }

  const previousAnchorValue = resolveLatestCycleStartAnchorBeforeOrOn(
    profile,
    [...records],
    formatLocalDate(addDays(targetDate, -1)),
  );
  const shortGapDays = previousAnchorValue
    ? diffLocalDays(parseLocalDate(previousAnchorValue), targetDate)
    : 0;
  const [implantationGapDays, potentialImplantation] = resolvePotentialImplantationGapDays(
    profile,
    records,
    targetDate,
    previousAnchorValue,
  );
  const conflictDateValue = findCompetingCycleStartDate(records, date);

  return {
    conflictDateLabel: conflictDateValue
      ? formatDisplayDate(conflictDateValue, locale)
      : "",
    hasConflict: Boolean(conflictDateValue),
    implantationGapDays,
    markUncertainRequired: shortGapDays > 0 && shortGapDays < MANUAL_CYCLE_START_SUGGESTION_GAP_DAYS,
    potentialImplantation,
    previousDateLabel: previousAnchorValue
      ? formatDisplayDate(previousAnchorValue, locale)
      : "",
    previousStartValue: previousAnchorValue,
    shortGapDays,
    targetDateLabel: formatDisplayDate(date, locale),
  };
}

function resolvePotentialImplantationGapDays(
  profile: ProfileRecord,
  records: readonly DayLogRecord[],
  targetDate: Date,
  previousStartValue: string | null,
): [number, boolean] {
  if (!previousStartValue) {
    return [0, false];
  }

  const previousStart = parseLocalDate(previousStartValue);
  if (!previousStart) {
    return [0, false];
  }

  const filteredRecords = records.filter((record) => record.date < formatLocalDate(targetDate));
  const history = buildCycleHistorySummary(
    profile,
    [...filteredRecords],
    addDays(targetDate, -1),
  );
  const predictionCycleLength =
    history.averageCycleLength > 0
      ? Math.round(history.averageCycleLength)
      : history.medianCycleLength > 0
        ? history.medianCycleLength
        : profile.cycleLength;
  const ovulationDate = addDays(previousStart, Math.max(predictionCycleLength - 14, 1));
  const gapDays = diffLocalDays(ovulationDate, targetDate);

  return [gapDays, gapDays >= 6 && gapDays <= 12];
}

function shouldSuggestManualCycleStart(
  profile: ProfileRecord,
  records: readonly DayLogRecord[],
  record: DayLogRecord,
  now: Date,
): boolean {
  if (!record.isPeriod || record.cycleStart || !isAllowedManualCycleStartDate(record.date, now)) {
    return false;
  }

  const targetDate = parseLocalDate(record.date);
  if (!targetDate) {
    return false;
  }

  const previousAnchorValue = resolveLatestCycleStartAnchorBeforeOrOn(
    profile,
    [...records],
    formatLocalDate(addDays(targetDate, -1)),
  );
  const previousAnchorDate = previousAnchorValue
    ? parseLocalDate(previousAnchorValue)
    : null;

  if (!previousAnchorDate) {
    return false;
  }

  return (
    diffLocalDays(previousAnchorDate, targetDate) >=
    MANUAL_CYCLE_START_SUGGESTION_GAP_DAYS
  );
}

function findCompetingCycleStartDate(
  records: readonly DayLogRecord[],
  targetDateValue: string,
): string | null {
  const [clusterStart, clusterEnd] = resolvePeriodClusterBounds(records, targetDateValue);

  for (const record of records) {
    if (
      record.cycleStart &&
      record.date !== targetDateValue &&
      record.date >= clusterStart &&
      record.date <= clusterEnd
    ) {
      return record.date;
    }
  }

  return null;
}

function resolvePeriodClusterBounds(
  records: readonly DayLogRecord[],
  targetDateValue: string,
): [string, string] {
  const periodDates = new Set(
    records.filter((record) => record.isPeriod).map((record) => record.date),
  );
  periodDates.add(targetDateValue);
  const sortedDates = [...periodDates].sort((left, right) => left.localeCompare(right));

  let clusterStart = targetDateValue;
  let clusterEnd = targetDateValue;

  for (let index = 0; index < sortedDates.length; index += 1) {
    const currentDate = sortedDates[index];
    if (!currentDate) {
      continue;
    }

    const previousDate = index > 0 ? sortedDates[index - 1] : null;
    const nextDate = index + 1 < sortedDates.length ? sortedDates[index + 1] : null;

    if (currentDate !== targetDateValue) {
      continue;
    }

    clusterStart = currentDate;
    clusterEnd = currentDate;

    let pointer = previousDate;
    while (pointer && isAdjacentDate(pointer, clusterStart, 1)) {
      clusterStart = pointer;
      const currentIndex = sortedDates.indexOf(pointer);
      pointer = currentIndex > 0 ? (sortedDates[currentIndex - 1] ?? null) : null;
    }

    pointer = nextDate;
    while (pointer && isAdjacentDate(clusterEnd, pointer, 1)) {
      clusterEnd = pointer;
      const currentIndex = sortedDates.indexOf(pointer);
      pointer =
        currentIndex + 1 < sortedDates.length
          ? (sortedDates[currentIndex + 1] ?? null)
          : null;
    }
    break;
  }

  return [clusterStart, clusterEnd];
}

function isAllowedManualCycleStartDate(dateValue: string, now: Date): boolean {
  const targetDate = parseLocalDate(dateValue);
  if (!targetDate) {
    return false;
  }

  const maxDate = addDays(atLocalDay(now), MANUAL_CYCLE_START_FUTURE_DAYS);
  return targetDate <= maxDate;
}

function isFutureManualCycleStartDate(dateValue: string, now: Date): boolean {
  const targetDate = parseLocalDate(dateValue);
  if (!targetDate) {
    return false;
  }

  return targetDate > atLocalDay(now);
}

function mergeDraftRecord(
  records: readonly DayLogRecord[],
  draftRecord: DayLogRecord,
): DayLogRecord[] {
  const merged = new Map(records.map((record) => [record.date, record]));
  merged.set(draftRecord.date, draftRecord);
  return [...merged.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function formatPromptMessage(template: string, values: (string | number)[]): string {
  let formatted = template;

  for (const value of values) {
    formatted = formatted.replace("%s", String(value));
  }

  return formatted;
}

function formatDisplayDate(dateValue: string, locale: string): string {
  const parsed = parseLocalDate(dateValue);
  if (!parsed) {
    return dateValue;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function isAdjacentDate(
  leftDateValue: string,
  rightDateValue: string,
  expectedDays: number,
): boolean {
  const leftDate = parseLocalDate(leftDateValue);
  const rightDate = parseLocalDate(rightDateValue);
  if (!leftDate || !rightDate) {
    return false;
  }

  return diffLocalDays(leftDate, rightDate) === expectedDays;
}

function diffLocalDays(left: Date | null, right: Date): number {
  if (!left) {
    return 0;
  }

  return Math.round((atLocalDay(right).getTime() - atLocalDay(left).getTime()) / 86400000);
}

function atLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
