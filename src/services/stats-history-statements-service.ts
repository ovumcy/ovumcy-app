import type { DayLogRecord } from "../models/day-log";
import {
  STATS_MINIMUM_PHASE_INSIGHTS_CYCLES,
  STATS_STATEMENT_RECURRENCE_LIMIT,
  STATS_STATEMENT_RECURRENCE_MIN_HITS,
  STATS_STATEMENT_TREND_MAX_WINDOW,
  type StatsCycleHistorySummary,
  type StatsCycleLengthTrendStatement,
  type StatsHistoryStatement,
  type StatsPhase,
  type StatsSymptomPhaseRecurrenceStatement,
} from "../models/stats";
import type { SymptomRecord } from "../models/symptom";
import {
  buildPhaseCycleBuckets,
  PHASE_ORDER,
  resolveRecordPhase,
} from "./stats-insights-service";

// Port of ovumcy-web stats_history_statements.go. Every number comes from
// completed cycles and logged days; nothing reads a projected date.
export function buildStatsHistoryStatements(
  history: StatsCycleHistorySummary,
  records: readonly DayLogRecord[],
  symptomRecords: readonly SymptomRecord[],
): StatsHistoryStatement[] {
  const statements: StatsHistoryStatement[] = [];
  const trend = buildCycleLengthTrendStatement(
    history.completedCycles.map((cycle) => cycle.cycleLength),
  );
  if (trend) {
    statements.push(trend);
  }
  statements.push(
    ...buildSymptomPhaseRecurrenceStatements(records, symptomRecords),
  );
  return statements;
}

// Recent half of the last six completed cycles against the earlier half; on an
// odd window the middle cycle belongs to neither half.
export function buildCycleLengthTrendStatement(
  cycleLengths: readonly number[],
): StatsCycleLengthTrendStatement | null {
  const window = cycleLengths
    .filter((length) => length > 0)
    .slice(-STATS_STATEMENT_TREND_MAX_WINDOW);
  if (window.length < STATS_MINIMUM_PHASE_INSIGHTS_CYCLES) {
    return null;
  }

  const half = Math.floor(window.length / 2);
  const delta = mean(window.slice(-half)) - mean(window.slice(0, half));
  const days = Math.round(Math.abs(delta));
  let direction: StatsCycleLengthTrendStatement["direction"] = "steady";
  if (days > 0) {
    direction = delta < 0 ? "shorter" : "longer";
  }
  return { kind: "cycle_length_trend", direction, days, windowSize: window.length };
}

// Per symptom and phase: in how many completed phase occurrences (one phase of
// one cycle) the symptom was logged, out of the occurrences holding any logged
// day. Renders only from 3 occurrences, 2 hits and a strict majority.
export function buildSymptomPhaseRecurrenceStatements(
  records: readonly DayLogRecord[],
  symptomRecords: readonly SymptomRecord[],
): StatsSymptomPhaseRecurrenceStatement[] {
  const buckets = buildPhaseCycleBuckets(records);
  if (
    buckets.length < STATS_MINIMUM_PHASE_INSIGHTS_CYCLES ||
    symptomRecords.length === 0
  ) {
    return [];
  }

  const symptomMap = new Map(symptomRecords.map((record) => [record.id, record]));
  // Phase → indexes of the cycles whose phase occurrence carries the mark.
  const observed: PhaseOccurrences = new Map();
  const hits = new Map<string, PhaseOccurrences>();
  buckets.forEach((bucket, cycleIndex) => {
    for (const record of bucket.records) {
      const phase = resolveRecordPhase(bucket.context, record);
      /* istanbul ignore next -- unreachable: bucket records lie inside
         [start, nextStart) of a cycle whose ovulation day was placeable. */
      if (phase === null) {
        continue;
      }
      addOccurrence(observed, phase, cycleIndex);
      for (const symptomID of record.symptomIDs) {
        if (!symptomMap.has(symptomID)) {
          continue;
        }
        const occurrences = hits.get(symptomID) ?? new Map();
        addOccurrence(occurrences, phase, cycleIndex);
        hits.set(symptomID, occurrences);
      }
    }
  });

  const statements: StatsSymptomPhaseRecurrenceStatement[] = [];
  for (const [symptomID, occurrences] of hits) {
    const symptom = symptomMap.get(symptomID)!;
    for (const phase of PHASE_ORDER) {
      const count = occurrences.get(phase)?.size ?? 0;
      const total = observed.get(phase)?.size ?? 0;
      if (
        total < STATS_MINIMUM_PHASE_INSIGHTS_CYCLES ||
        count < STATS_STATEMENT_RECURRENCE_MIN_HITS ||
        count * 2 <= total
      ) {
        continue;
      }
      statements.push({
        kind: "symptom_phase_recurrence",
        id: symptomID,
        label: symptom.label,
        icon: symptom.icon,
        phase,
        count,
        total,
      });
    }
  }

  // Strongest first: more hits, then the tighter denominator, then phase
  // order, then label.
  return statements
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.total - right.total ||
        PHASE_ORDER.indexOf(left.phase) - PHASE_ORDER.indexOf(right.phase) ||
        left.label.localeCompare(right.label),
    )
    .slice(0, STATS_STATEMENT_RECURRENCE_LIMIT);
}

type PhaseOccurrences = Map<StatsPhase, Set<number>>;

function addOccurrence(
  occurrences: PhaseOccurrences,
  phase: StatsPhase,
  cycleIndex: number,
): void {
  const cycles = occurrences.get(phase) ?? new Set<number>();
  cycles.add(cycleIndex);
  occurrences.set(phase, cycles);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
