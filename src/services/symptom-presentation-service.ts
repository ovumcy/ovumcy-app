import { getBuiltinSymptomLabel } from "../i18n/symptom-copy";
import type { DayLogRecord } from "../models/day-log";
import {
  getBuiltinSymptomDefinition,
  type SymptomID,
  type SymptomRecord,
} from "../models/symptom";
import { addDays, formatLocalDate } from "./profile-settings-policy";
import { buildEntryPickerSymptoms } from "./symptom-policy";

const PERSONALIZED_SYMPTOM_WINDOW_DAYS = 60;
const PERSONALIZED_SYMPTOM_MIN_SELECTIONS = 10;

export type PersonalizedSymptomOrderOptions = {
  now?: Date;
  windowDays?: number;
  minSelections?: number;
};

export function getSymptomDisplayLabel(
  record: SymptomRecord,
  locale = "en",
): string {
  if (!record.isDefault) {
    return record.label;
  }

  const builtinDefinition = getBuiltinSymptomDefinition(record.id);
  if (!builtinDefinition) {
    return record.label;
  }

  return getBuiltinSymptomLabel(locale, builtinDefinition.id);
}

export function localizeSymptomRecords(
  records: readonly SymptomRecord[],
  locale = "en",
): SymptomRecord[] {
  return records.map((record) => ({
    ...record,
    label: getSymptomDisplayLabel(record, locale),
  }));
}

export function buildPersonalizedSymptomOrder<T extends { value: SymptomID }>(
  defaultOrdered: readonly T[],
  historyRecords: readonly DayLogRecord[],
  options: PersonalizedSymptomOrderOptions = {},
): T[] {
  const windowDays = options.windowDays ?? PERSONALIZED_SYMPTOM_WINDOW_DAYS;
  const minSelections = options.minSelections ?? PERSONALIZED_SYMPTOM_MIN_SELECTIONS;
  const now = options.now ?? new Date();
  const cutoffDate = formatLocalDate(addDays(now, -windowDays));
  const todayDate = formatLocalDate(now);

  const knownIDs = new Set(defaultOrdered.map((option) => option.value));
  const frequency = new Map<SymptomID, number>();
  let totalSelections = 0;

  for (const record of historyRecords) {
    if (record.date < cutoffDate || record.date > todayDate) {
      continue;
    }
    for (const symptomID of record.symptomIDs) {
      if (!knownIDs.has(symptomID)) {
        continue;
      }
      frequency.set(symptomID, (frequency.get(symptomID) ?? 0) + 1);
      totalSelections += 1;
    }
  }

  if (totalSelections < minSelections) {
    return [...defaultOrdered];
  }

  const defaultOrderIndex = new Map(
    defaultOrdered.map((option, index) => [option.value, index]),
  );

  return [...defaultOrdered].sort((left, right) => {
    const leftCount = frequency.get(left.value) ?? 0;
    const rightCount = frequency.get(right.value) ?? 0;
    if (leftCount !== rightCount) {
      return rightCount - leftCount;
    }
    return (defaultOrderIndex.get(left.value) ?? 0) -
      (defaultOrderIndex.get(right.value) ?? 0);
  });
}

export function buildLocalizedEntryPickerSymptoms(
  records: readonly SymptomRecord[],
  selectedIDs: readonly SymptomID[],
  locale = "en",
  options: {
    historyRecords?: readonly DayLogRecord[];
    now?: Date;
  } = {},
) {
  const baseOptions = buildEntryPickerSymptoms(records, selectedIDs).map(
    (record) => ({
      value: record.id,
      label: getSymptomDisplayLabel(record, locale),
      icon: record.icon,
    }),
  );

  if (!options.historyRecords) {
    return baseOptions;
  }

  return buildPersonalizedSymptomOrder(
    baseOptions,
    options.historyRecords,
    options.now ? { now: options.now } : {},
  );
}
