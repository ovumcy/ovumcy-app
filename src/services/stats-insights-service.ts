import type { DayLogRecord } from "../models/day-log";
import { DEFAULT_PERIOD_LENGTH } from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import {
  MIN_CURRENT_CYCLE_BBT_POINTS,
  STATS_BBT_POINT_LIMIT,
  STATS_LAST_CYCLE_SYMPTOMS_LIMIT,
  STATS_PHASE_SYMPTOM_LIMIT,
  STATS_SYMPTOM_FREQUENCY_LIMIT,
  STATS_SYMPTOM_PATTERN_LIMIT,
  STATS_TREND_POINT_LIMIT,
  type CompletedCycleSummary,
  type StatsBBTPoint,
  type StatsCycleHistorySummary,
  type StatsCycleProjection,
  type StatsPhase,
  type StatsPhaseMoodInsight,
  type StatsPhaseSymptomInsight,
  type StatsSymptomFrequencyItem,
  type StatsSymptomPattern,
  type StatsTrendPoint,
} from "../models/stats";
import {
  calcOvulationDay,
  DEFAULT_LUTEAL_PHASE_DAYS,
} from "./cycle-prediction-policy";
import {
  addDays,
  formatLocalDate,
  parseLocalDate,
} from "./profile-settings-policy";

type CompletedCycleBucket = {
  summary: CompletedCycleSummary;
  records: DayLogRecord[];
};

const PHASE_ORDER: StatsPhase[] = [
  "menstrual",
  "follicular",
  "ovulation",
  "luteal",
];

export function buildStatsTrendPoints(
  history: StatsCycleHistorySummary,
  locale = "en",
): StatsTrendPoint[] {
  return history.completedCycles.slice(-STATS_TREND_POINT_LIMIT).map((cycle) => ({
    key: cycle.startDate,
    label: formatShortDisplayDate(cycle.startDate, locale),
    value: cycle.cycleLength,
  }));
}

export function buildStatsSymptomFrequency(
  records: readonly DayLogRecord[],
  symptomRecords: readonly SymptomRecord[],
): StatsSymptomFrequencyItem[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const symptomID of record.symptomIDs) {
      counts.set(symptomID, (counts.get(symptomID) ?? 0) + 1);
    }
  }

  return buildSymptomFrequencyItems(counts, symptomRecords).slice(
    0,
    STATS_SYMPTOM_FREQUENCY_LIMIT,
  );
}

export function buildLastCycleSymptomFrequency(
  history: StatsCycleHistorySummary,
  records: readonly DayLogRecord[],
  symptomRecords: readonly SymptomRecord[],
): StatsSymptomFrequencyItem[] {
  const buckets = buildCompletedCycleBuckets(history, records);
  const lastBucket = buckets[buckets.length - 1];
  if (!lastBucket) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const record of lastBucket.records) {
    for (const symptomID of record.symptomIDs) {
      counts.set(symptomID, (counts.get(symptomID) ?? 0) + 1);
    }
  }

  return buildSymptomFrequencyItems(counts, symptomRecords).slice(
    0,
    STATS_LAST_CYCLE_SYMPTOMS_LIMIT,
  );
}

export function buildStatsSymptomPatterns(
  history: StatsCycleHistorySummary,
  records: readonly DayLogRecord[],
  symptomRecords: readonly SymptomRecord[],
): StatsSymptomPattern[] {
  const symptomMap = createSymptomMap(symptomRecords);
  const buckets = buildCompletedCycleBuckets(history, records);
  const statsBySymptom = new Map<
    string,
    {
      label: string;
      icon: string;
      cycleKeys: Set<string>;
      cycleDays: number[];
    }
  >();

  for (const bucket of buckets) {
    for (const record of bucket.records) {
      if (record.symptomIDs.length === 0) {
        continue;
      }

      const cycleDay = resolveCycleDay(bucket.summary.startDate, record.date);
      if (cycleDay <= 0) {
        continue;
      }

      for (const symptomID of record.symptomIDs) {
        const symptom = symptomMap.get(symptomID);
        if (!symptom) {
          continue;
        }
        const current =
          statsBySymptom.get(symptomID) ?? {
            label: symptom.label,
            icon: symptom.icon,
            cycleKeys: new Set<string>(),
            cycleDays: [],
          };
        current.cycleKeys.add(bucket.summary.startDate);
        current.cycleDays.push(cycleDay);
        statsBySymptom.set(symptomID, current);
      }
    }
  }

  return [...statsBySymptom.entries()]
    .filter(([, value]) => value.cycleKeys.size >= 2 && value.cycleDays.length >= 2)
    .map(([id, value]) => ({
      id,
      label: value.label,
      icon: value.icon,
      dayStart: Math.min(...value.cycleDays),
      dayEnd: Math.max(...value.cycleDays),
      occurrenceCount: value.cycleDays.length,
    }))
    .sort((left, right) => {
      if (left.occurrenceCount === right.occurrenceCount) {
        return left.label.localeCompare(right.label);
      }
      return right.occurrenceCount - left.occurrenceCount;
    })
    .slice(0, STATS_SYMPTOM_PATTERN_LIMIT);
}

export function buildStatsPhaseMoodInsights(
  records: readonly DayLogRecord[],
): StatsPhaseMoodInsight[] {
  const buckets = buildPhaseCycleBuckets(records);
  const phaseStats = new Map<
    StatsPhase,
    {
      totalMood: number;
      entryCount: number;
    }
  >();

  for (const bucket of buckets) {
    for (const record of bucket.records) {
      if (record.mood <= 0) {
        continue;
      }
      const phase = resolveRecordPhase(bucket.context, record);
      if (phase === null) {
        continue;
      }
      const current = phaseStats.get(phase) ?? { totalMood: 0, entryCount: 0 };
      current.totalMood += record.mood;
      current.entryCount += 1;
      phaseStats.set(phase, current);
    }
  }

  return PHASE_ORDER.map((phase) => {
    const current = phaseStats.get(phase);
    if (!current || current.entryCount === 0) {
      return {
        phase,
        hasData: false,
        averageMood: 0,
        percentage: 0,
        entryCount: 0,
      };
    }

    const averageMood = current.totalMood / current.entryCount;
    return {
      phase,
      hasData: true,
      averageMood,
      percentage: Math.min((averageMood / 5) * 100, 100),
      entryCount: current.entryCount,
    };
  });
}

export function buildStatsPhaseSymptomInsights(
  records: readonly DayLogRecord[],
  symptomRecords: readonly SymptomRecord[],
): StatsPhaseSymptomInsight[] {
  const buckets = buildPhaseCycleBuckets(records);
  const symptomMap = createSymptomMap(symptomRecords);
  const totals = new Map<StatsPhase, number>();
  const counts = new Map<StatsPhase, Map<string, number>>();

  for (const bucket of buckets) {
    for (const record of bucket.records) {
      const phase = resolveRecordPhase(bucket.context, record);
      if (phase === null) {
        continue;
      }
      totals.set(phase, (totals.get(phase) ?? 0) + 1);

      if (record.symptomIDs.length === 0) {
        continue;
      }

      const phaseCounts = counts.get(phase) ?? new Map<string, number>();
      for (const symptomID of record.symptomIDs) {
        if (!symptomMap.has(symptomID)) {
          continue;
        }
        phaseCounts.set(symptomID, (phaseCounts.get(symptomID) ?? 0) + 1);
      }
      counts.set(phase, phaseCounts);
    }
  }

  return PHASE_ORDER.map((phase) => {
    const totalDays = totals.get(phase) ?? 0;
    const phaseCounts = counts.get(phase) ?? new Map<string, number>();
    const items = [...phaseCounts.entries()]
      .map(([id, count]) => {
        const symptom = symptomMap.get(id);
        if (!symptom || totalDays === 0) {
          return null;
        }
        return {
          id,
          label: symptom.label,
          icon: symptom.icon,
          percentage: (count / totalDays) * 100,
          count,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((left, right) => {
        if (left.percentage === right.percentage) {
          return left.label.localeCompare(right.label);
        }
        return right.percentage - left.percentage;
      })
      .slice(0, STATS_PHASE_SYMPTOM_LIMIT);

    return {
      phase,
      hasData: totalDays > 0 && items.length > 0,
      totalDays,
      items,
    };
  });
}

export function buildStatsBBTSeries(
  projection: StatsCycleProjection,
  records: readonly DayLogRecord[],
  now: Date,
  locale = "en",
): StatsBBTPoint[] {
  if (!projection.cycleAnchorDate) {
    return [];
  }

  const todayValue = formatLocalDate(now);
  const cycleRecords = records
    .filter(
      (record) =>
        record.date >= projection.cycleAnchorDate! &&
        record.date <= todayValue &&
        record.bbt > 0,
    )
    .sort((left, right) => left.date.localeCompare(right.date))
    .slice(-STATS_BBT_POINT_LIMIT);

  if (cycleRecords.length < MIN_CURRENT_CYCLE_BBT_POINTS) {
    return [];
  }

  return cycleRecords.map((record) => ({
    key: record.date,
    label: formatShortDisplayDate(record.date, locale),
    cycleDay: resolveCycleDay(projection.cycleAnchorDate!, record.date),
    value: record.bbt,
  }));
}

function buildCompletedCycleBuckets(
  history: StatsCycleHistorySummary,
  records: readonly DayLogRecord[],
): CompletedCycleBucket[] {
  return history.completedCycles.map((summary) => ({
    summary,
    records: records
      .filter(
        (record) =>
          record.date >= summary.startDate && record.date < summary.nextStartDate,
      )
      .sort((left, right) => left.date.localeCompare(right.date)),
  }));
}

type PhaseCycleContext = {
  startDate: string;
  cycleLength: number;
  periodLength: number;
};

type PhaseCycleBucket = {
  context: PhaseCycleContext;
  records: DayLogRecord[];
};

const GAP_BASED_CYCLE_START_MIN_GAP_DAYS = 5;
const PHASE_PERIOD_LENGTH_SCAN_DAYS = 10;

function calendarDaysBetween(fromDate: string, toDate: string): number {
  const from = parseLocalDate(fromDate);
  const to = parseLocalDate(toDate);
  if (!from || !to) {
    return 0;
  }
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

// Gap-based cycle-start detection, mirroring web DetectCycleStarts
// (ovumcy-web cycles.go:148-177): a logged period day begins a new cycle when
// 5+ days separate it from the previous period day, INDEPENDENT of explicit
// cycleStart flags. Phase insights use this; trend/spans keep the explicit-flag
// completed-cycle set — exactly as web pairs DetectCycleStarts (phase insights)
// with ObservedCycleStarts (trend).
export function detectGapBasedCycleStarts(
  records: readonly DayLogRecord[],
): string[] {
  const periodDays = records
    .filter((record) => record.isPeriod)
    .map((record) => record.date)
    .sort((left, right) => left.localeCompare(right));

  const starts: string[] = [];
  let previousPeriodDay: string | null = null;
  for (const day of periodDays) {
    if (previousPeriodDay === null) {
      starts.push(day);
      previousPeriodDay = day;
      continue;
    }
    const gapDays = calendarDaysBetween(previousPeriodDay, day) - 1;
    if (gapDays >= GAP_BASED_CYCLE_START_MIN_GAP_DAYS) {
      starts.push(day);
    }
    previousPeriodDay = day;
  }
  return starts;
}

// Port of web buildCompletedCyclePhaseContexts (stats_phase_insights.go:51-88)
// + the buildCycles period-length scan (cycles.go:431-437). Cycle length is the
// span between consecutive gap-based starts; period length is the leading run of
// logged period days from the start (capped, defaulted); a context is dropped
// when calcOvulationDay cannot place ovulation. Each bucket's records are the
// logs in [start, nextStart).
function buildPhaseCycleBuckets(
  records: readonly DayLogRecord[],
): PhaseCycleBucket[] {
  const starts = detectGapBasedCycleStarts(records);
  if (starts.length < 2) {
    return [];
  }

  const periodDates = new Set(
    records.filter((record) => record.isPeriod).map((record) => record.date),
  );
  const sorted = [...records].sort((left, right) =>
    left.date.localeCompare(right.date),
  );

  const buckets: PhaseCycleBucket[] = [];
  for (let index = 0; index + 1 < starts.length; index += 1) {
    const startDate = starts[index]!;
    const nextStartDate = starts[index + 1]!;
    const cycleLength = calendarDaysBetween(startDate, nextStartDate);
    if (cycleLength <= 0) {
      continue;
    }
    if (calcOvulationDay(cycleLength, DEFAULT_LUTEAL_PHASE_DAYS).day === null) {
      continue;
    }

    let periodLength = 0;
    const start = parseLocalDate(startDate);
    if (start) {
      for (
        let offset = 0;
        offset <= PHASE_PERIOD_LENGTH_SCAN_DAYS;
        offset += 1
      ) {
        if (!periodDates.has(formatLocalDate(addDays(start, offset)))) {
          break;
        }
        periodLength += 1;
      }
    }
    if (periodLength <= 0) {
      periodLength = DEFAULT_PERIOD_LENGTH;
    }

    buckets.push({
      context: { startDate, cycleLength, periodLength },
      records: sorted.filter(
        (record) =>
          record.date >= startDate && record.date < nextStartDate,
      ),
    });
  }
  return buckets;
}

function buildSymptomFrequencyItems(
  counts: Map<string, number>,
  symptomRecords: readonly SymptomRecord[],
): StatsSymptomFrequencyItem[] {
  const symptomMap = createSymptomMap(symptomRecords);

  return [...counts.entries()]
    .map(([id, count]) => {
      const symptom = symptomMap.get(id);
      if (!symptom) {
        return null;
      }

      return {
        id,
        label: symptom.label,
        icon: symptom.icon,
        count,
        frequencySummary: formatLoggedDays(count),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => {
      if (left.count === right.count) {
        return left.label.localeCompare(right.label);
      }
      return right.count - left.count;
    });
}

/**
 * Classifies a record's cycle day into a phase, mirroring web's
 * phaseForCompletedCycleDay (stats_phase_insights.go:90-107). Returns null to
 * signal the day must be EXCLUDED from phase aggregation — either the day falls
 * outside the cycle (web's "" via Start/NextStart bound) or CalcOvulationDay
 * cannot place ovulation for this cycle length (web's `continue` at
 * stats_phase_insights.go:74). The ovulation day uses the per-cycle DEFAULT
 * luteal phase (14), matching web's `CalcOvulationDay(cycleLength,
 * defaultLutealPhaseDays)` — not the per-owner inferred luteal.
 */
function resolveRecordPhase(
  cycle: { startDate: string; cycleLength: number; periodLength: number },
  record: DayLogRecord,
): StatsPhase | null {
  const cycleDay = resolveCycleDay(cycle.startDate, record.date);
  if (cycleDay <= 0) {
    return null;
  }

  const ovulationDay = calcOvulationDay(
    cycle.cycleLength,
    DEFAULT_LUTEAL_PHASE_DAYS,
  ).day;
  if (ovulationDay === null) {
    return null;
  }

  if (cycleDay <= cycle.periodLength) {
    return "menstrual";
  }
  if (cycleDay === ovulationDay) {
    return "ovulation";
  }
  if (cycleDay < ovulationDay) {
    return "follicular";
  }
  return "luteal";
}

function resolveCycleDay(startDate: string, currentDate: string): number {
  const start = parseLocalDate(startDate);
  const current = parseLocalDate(currentDate);
  if (!start || !current) {
    return 0;
  }

  return Math.round(
    (current.getTime() - start.getTime()) / 86400000,
  ) + 1;
}

function createSymptomMap(
  symptomRecords: readonly SymptomRecord[],
): Map<string, SymptomRecord> {
  return new Map(symptomRecords.map((record) => [record.id, record]));
}

function formatShortDisplayDate(value: string, locale: string): string {
  const parsed = parseLocalDate(value);
  if (!parsed) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(parsed);
}

function formatLoggedDays(count: number): string {
  return count === 1 ? "1 day" : `${count} days`;
}
