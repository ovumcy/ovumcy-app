import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { DayLogChangeSet } from "../storage/local/storage-contract";
import { resolveLatestCycleStartAnchorBeforeOrOn } from "./cycle-history-service";
import { sanitizeDayLogRecord } from "./day-log-policy";
import { resolvePeriodClusterBounds } from "./manual-cycle-start-service";
import {
  appendAutoFilledPeriodDays,
  isAutoFilledPeriodCandidate,
} from "./period-auto-fill-service";
import {
  addDays,
  diffCalendarDays,
  formatLocalDate,
  parseLocalDate,
} from "./profile-settings-policy";

// A start moved a full shortest cycle later (or more) is a new period, not a
// correction: the old start stays recorded.
const MIN_CORRECTION_CYCLE_GAP_DAYS = 15;

// Settings only moves a start that is a plain date: clearing it moves nothing,
// and an unchanged date has nothing to move.
export function isPeriodStartMove(
  profile: ProfileRecord,
  nextProfile: ProfileRecord,
): boolean {
  return (
    nextProfile.lastPeriodStart !== null &&
    nextProfile.lastPeriodStart !== profile.lastPeriodStart
  );
}

// A row that carries nothing beyond the start itself once its mark is off: the
// period day, with no flow, symptom, note, mood, BBT, mucus, test, sex activity
// or cycle factor. Only such a row is ever removed by a move.
function isBareStartRow(record: DayLogRecord): boolean {
  return isAutoFilledPeriodCandidate({
    ...record,
    cycleStart: false,
    isUncertain: false,
  });
}

// The old start's days may be removed only while it is still the date being
// corrected: it opens the newest cycle, and the new date is earlier or less
// than a shortest cycle later.
function oldStartIsCorrected(
  profile: ProfileRecord,
  records: readonly DayLogRecord[],
  oldStart: string,
  newStart: string,
  todayValue: string,
): boolean {
  const oldDate = parseLocalDate(oldStart);
  const newDate = parseLocalDate(newStart);
  if (!oldDate || !newDate) {
    return false;
  }
  if (
    newStart >= oldStart &&
    diffCalendarDays(oldDate, newDate) >= MIN_CORRECTION_CYCLE_GAP_DAYS
  ) {
    return false;
  }
  if (records.some((record) => record.cycleStart && record.date > oldStart)) {
    return false;
  }
  return (
    resolveLatestCycleStartAnchorBeforeOrOn(profile, [...records], todayValue) ===
    oldStart
  );
}

// What the day logs need when the stored cycle start moves in Settings, in one
// change set with the profile:
//   - the new start is marked as the cycle start (an existing row keeps all its
//     data) and, under the new auto-fill setting and period length, its period
//     days up to today are filled;
//   - when the old start is being corrected, its mark is released (the row is
//     removed only when it holds nothing else) and, under the stored auto-fill
//     setting, the run of bare period days that follows it is removed, so the
//     old run does not stay behind as a cycle of its own.
// A row holding any user data is never removed or rewritten beyond its marks.
export function planPeriodStartMove(
  profile: ProfileRecord,
  nextProfile: ProfileRecord,
  records: readonly DayLogRecord[],
  now: Date,
): DayLogChangeSet {
  const newStart = nextProfile.lastPeriodStart;
  if (newStart === null) {
    return { writes: [], deletes: [], profile: nextProfile };
  }

  const todayValue = formatLocalDate(now);
  const byDate = new Map(records.map((record) => [record.date, record]));
  const writes = new Map<string, DayLogRecord>();
  const deletes = new Set<string>();

  const startRecord = sanitizeDayLogRecord({
    ...(byDate.get(newStart) ?? createEmptyDayLogRecord(newStart)),
    date: newStart,
    isPeriod: true,
    cycleStart: true,
    isUncertain: false,
  });
  writes.set(newStart, startRecord);
  if (nextProfile.autoPeriodFill) {
    appendAutoFilledPeriodDays(writes, records, startRecord, nextProfile, now);
  }

  const oldStart = profile.lastPeriodStart;
  const oldRecord = oldStart ? byDate.get(oldStart) : undefined;
  if (
    oldStart &&
    oldRecord &&
    oldStartIsCorrected(profile, records, oldStart, newStart, todayValue)
  ) {
    if (!writes.has(oldStart) && (oldRecord.cycleStart || oldRecord.isUncertain)) {
      const released = sanitizeDayLogRecord({
        ...oldRecord,
        cycleStart: false,
        isUncertain: false,
      });
      if (isBareStartRow(released)) {
        deletes.add(oldStart);
      } else {
        writes.set(oldStart, released);
      }
    }
    if (profile.autoPeriodFill && isBareStartRow(oldRecord)) {
      collectOldFilledRun(byDate, oldStart, profile.periodLength)
        .filter((date) => !writes.has(date))
        .forEach((date) => deletes.add(date));
    }
  }

  releaseCompetingStarts(records, writes, deletes, newStart);

  return {
    writes: [...writes.values()],
    deletes: [...deletes],
    profile: nextProfile,
  };
}

function collectOldFilledRun(
  byDate: ReadonlyMap<string, DayLogRecord>,
  oldStart: string,
  periodLength: number,
): string[] {
  const start = parseLocalDate(oldStart);
  if (!start) {
    return [];
  }
  const run: string[] = [];
  for (let offset = 1; offset < periodLength; offset += 1) {
    const date = formatLocalDate(addDays(start, offset));
    const record = byDate.get(date);
    if (!record || !isAutoFilledPeriodCandidate(record)) {
      break;
    }
    run.push(date);
  }
  return run;
}

// One period holds one start: any other mark inside the new start's period is
// released, as a manual start does.
function releaseCompetingStarts(
  records: readonly DayLogRecord[],
  writes: Map<string, DayLogRecord>,
  deletes: ReadonlySet<string>,
  newStart: string,
): void {
  const merged = [
    ...records.filter((record) => !writes.has(record.date) && !deletes.has(record.date)),
    ...writes.values(),
  ];
  const [clusterStart, clusterEnd] = resolvePeriodClusterBounds(merged, newStart);
  for (const record of merged) {
    if (
      record.date === newStart ||
      !record.cycleStart ||
      record.date < clusterStart ||
      record.date > clusterEnd
    ) {
      continue;
    }
    writes.set(
      record.date,
      sanitizeDayLogRecord({ ...record, cycleStart: false, isUncertain: false }),
    );
  }
}
