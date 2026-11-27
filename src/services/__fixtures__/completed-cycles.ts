import { createEmptyDayLogRecord, type DayLogRecord } from "../../models/day-log";
import { addDays, formatLocalDate, parseLocalDate } from "../profile-settings-policy";

// The completed-cycle floor (FERTILITY_MINIMUM_CYCLES = 3, web
// fertilityMinimumCycles) withholds the fertility half of every projection
// until three cycles have closed. A fixture that wants a published window needs
// that history behind its running cycle: this returns the period records of
// `completed` cycles that all close on `currentStart`, oldest first, each
// opened by an explicit cycle-start mark. The running cycle's own record is the
// caller's, so a fixture keeps full control of its anchor.
export function completedCycleHistory(options: {
  currentStart: string;
  completed?: number;
  cycleLength?: number;
  periodLength?: number;
}): DayLogRecord[] {
  const completed = options.completed ?? 3;
  const cycleLength = options.cycleLength ?? 28;
  const periodLength = options.periodLength ?? 5;
  const current = parseLocalDate(options.currentStart)!;

  const records: DayLogRecord[] = [];
  for (let cycle = completed; cycle >= 1; cycle -= 1) {
    const start = addDays(current, -cycle * cycleLength);
    for (let offset = 0; offset < periodLength; offset += 1) {
      records.push({
        ...createEmptyDayLogRecord(formatLocalDate(addDays(start, offset))),
        isPeriod: true,
        cycleStart: offset === 0,
        flow: "medium",
      });
    }
  }
  return records;
}
