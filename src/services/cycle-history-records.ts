import type { DayLogRecord } from "../models/day-log";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { diffLocalDays, formatLocalDate } from "./profile-settings-policy";

const MIN_DAY_LOG_DATE = "0001-01-01";
const CYCLE_HISTORY_YEARS = 2;
// buildObservedPeriodClusters keeps two period days in one cluster while
// fewer than five clear days lie between them.
const CLUSTER_JOIN_MAX_DAYS = 5;

// The day logs every cycle reader on a surface is fed (dashboard, stats,
// calendar, local reminders): the last two years up to today, or from
// `reachBackTo` when that is earlier, widened back to the first day of a
// bleeding episode the lower bound would cut, so every surface reads the same
// cycle starts, anchor and pregnancy pause.
export async function listCycleHistoryRecords(
  storage: LocalAppStorage,
  now: Date,
  reachBackTo?: string,
): Promise<DayLogRecord[]> {
  const historyStart = formatLocalDate(
    new Date(now.getFullYear() - CYCLE_HISTORY_YEARS, now.getMonth(), now.getDate()),
  );
  const from =
    reachBackTo !== undefined && reachBackTo < historyStart ? reachBackTo : historyStart;
  const records = await storage.listDayLogRecordsInRange(MIN_DAY_LOG_DATE, formatLocalDate(now));
  return selectWholeClustersFrom(records, from);
}

// Records dated on or after `from`, plus the earlier ones back to the start of
// a period cluster that `from` cuts. `records` is sorted by date.
export function selectWholeClustersFrom(
  records: readonly DayLogRecord[],
  from: string,
): DayLogRecord[] {
  let lowerBound = from;
  let earliestPeriod = records.find((record) => record.isPeriod && record.date >= from)?.date;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (!record || record.date >= from || !record.isPeriod) {
      continue;
    }
    if (!earliestPeriod || diffLocalDays(record.date, earliestPeriod) > CLUSTER_JOIN_MAX_DAYS) {
      break;
    }
    earliestPeriod = record.date;
    lowerBound = record.date;
  }
  return records.filter((record) => record.date >= lowerBound);
}
