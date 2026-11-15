import type { DayLogRecord } from "../models/day-log";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { diffLocalDays, formatLocalDate } from "./profile-settings-policy";

export const MIN_DAY_LOG_DATE = "0001-01-01";
const CYCLE_HISTORY_YEARS = 2;
// buildObservedPeriodClusters keeps two period days in one cluster while
// fewer than five clear days lie between them.
const CLUSTER_JOIN_MAX_DAYS = 5;

export function cycleHistoryStart(now: Date): string {
  return formatLocalDate(
    new Date(now.getFullYear() - CYCLE_HISTORY_YEARS, now.getMonth(), now.getDate()),
  );
}

// The day logs every cycle reader on a surface is fed (dashboard, stats,
// calendar, local reminders): the last two years up to today, widened back to
// the first day of a bleeding episode the lower bound would cut, so every
// surface reads the same cycle starts, anchor and pregnancy pause.
export async function listCycleHistoryRecords(
  storage: LocalAppStorage,
  now: Date,
): Promise<DayLogRecord[]> {
  const records = await storage.listDayLogRecordsInRange(MIN_DAY_LOG_DATE, formatLocalDate(now));
  return selectWholeClustersFrom(records, cycleHistoryStart(now));
}

// Records dated on or after `from`, plus the earlier ones back to the start of
// a period cluster that `from` cuts. `records` is sorted by date.
export function selectWholeClustersFrom(
  records: readonly DayLogRecord[],
  from: string,
): DayLogRecord[] {
  const firstInWindow = records.findIndex((record) => record.date >= from);
  if (firstInWindow < 0) {
    return [];
  }
  let earliestPeriod = records.find((record) => record.isPeriod && record.date >= from)?.date;
  let lowerBound = firstInWindow;
  for (let index = firstInWindow - 1; index >= 0 && earliestPeriod; index -= 1) {
    const record = records[index];
    if (!record?.isPeriod) {
      continue;
    }
    if (diffLocalDays(record.date, earliestPeriod) > CLUSTER_JOIN_MAX_DAYS) {
      break;
    }
    earliestPeriod = record.date;
    lowerBound = index;
  }
  return records.slice(lowerBound);
}
