import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import { sanitizeDayLogRecord } from "./day-log-policy";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";

export function isAutoFilledPeriodCandidate(record: DayLogRecord): boolean {
  return (
    record.isPeriod &&
    !record.cycleStart &&
    !record.isUncertain &&
    record.flow === "none" &&
    record.mood === 0 &&
    record.sexActivity === "none" &&
    record.bbt === 0 &&
    record.cervicalMucus === "none" &&
    record.lhTest === "none" &&
    record.cycleFactorKeys.length === 0 &&
    record.symptomIDs.length === 0 &&
    record.notes.trim().length === 0
  );
}

export function collectAutoFilledPeriodDaysToClear(
  records: readonly DayLogRecord[],
  anchorDate: DayLogRecord["date"],
  periodLength: number,
): DayLogRecord[] {
  const anchor = parseLocalDate(anchorDate);
  if (!anchor) {
    return [];
  }

  const recordsByDate = new Map(records.map((record) => [record.date, record]));
  const cleared: DayLogRecord[] = [];

  for (let offset = 1; offset < periodLength; offset += 1) {
    const date = formatLocalDate(addDays(anchor, offset));
    const record = recordsByDate.get(date);
    if (!record || !isAutoFilledPeriodCandidate(record)) {
      break;
    }
    cleared.push(record);
  }

  return cleared;
}

export function appendAutoFilledPeriodDays(
  recordsToWrite: Map<string, DayLogRecord>,
  records: readonly DayLogRecord[],
  periodStartRecord: DayLogRecord,
  profile: ProfileRecord,
) {
  const periodStartDate = parseLocalDate(periodStartRecord.date);
  if (!periodStartDate) {
    return;
  }

  const recordsByDate = new Map(records.map((record) => [record.date, record]));

  for (let offset = 1; offset < profile.periodLength; offset += 1) {
    const currentDate = formatLocalDate(addDays(periodStartDate, offset));
    const existingRecord =
      recordsToWrite.get(currentDate) ??
      recordsByDate.get(currentDate) ??
      createEmptyDayLogRecord(currentDate);

    recordsToWrite.set(
      currentDate,
      sanitizeDayLogRecord({
        ...existingRecord,
        date: currentDate,
        cycleStart: false,
        isPeriod: true,
        isUncertain: false,
      }),
    );
  }
}

export function shouldAutoFillPeriodWindowFromSave(
  profile: ProfileRecord,
  existingRecords: readonly DayLogRecord[],
  nextRecord: DayLogRecord,
) {
  if (!profile.autoPeriodFill || !nextRecord.isPeriod || nextRecord.isUncertain) {
    return false;
  }

  const existingCurrentRecord = existingRecords.find(
    (record) => record.date === nextRecord.date,
  );
  if (existingCurrentRecord?.isPeriod) {
    return false;
  }

  const currentDate = parseLocalDate(nextRecord.date);
  if (!currentDate) {
    return false;
  }

  const previousDate = formatLocalDate(addDays(currentDate, -1));
  return !existingRecords.some(
    (record) => record.date === previousDate && record.isPeriod,
  );
}
