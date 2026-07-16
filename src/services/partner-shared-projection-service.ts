import type { DayLogRecord } from "../models/day-log";
import type {
  PartnerShareAccessLevel,
  PartnerSharedProjectionPayload,
  PartnerSharedReadState,
} from "../models/partner-share";
import { getBuiltinSymptomLabel } from "../i18n/symptom-copy";
import {
  PARTNER_SHARE_SCHEMA_VERSION,
} from "../models/partner-share";
import type { ProfileRecord } from "../models/profile";
import { createDefaultProfileRecord } from "../models/profile";
import type { BuiltinSymptomID, SymptomRecord } from "../models/symptom";
import { buildCycleHistorySummary, buildCurrentCycleProjection } from "./cycle-history-service";
import { buildPredictionExplanation } from "./prediction-explanation-service";
import { buildExportCSVRows } from "./export-service";
import { getSymptomDisplayLabel } from "./symptom-presentation-service";

// Snapshots older than this many days are considered stale. Predictions are
// hidden for stale snapshots because they are computed from potentially old
// data, which could be misleading to the partner.
const PARTNER_SNAPSHOT_STALE_DAYS = 14;

const exportFlagToBuiltinSymptomID = {
  cramps: "cramps",
  headache: "headache",
  acne: "acne",
  mood: "mood_swings",
  bloating: "bloating",
  fatigue: "fatigue",
  breastTenderness: "breast_tenderness",
  backPain: "back_pain",
  nausea: "nausea",
  spotting: "spotting",
  irritability: "irritability",
  insomnia: "insomnia",
  foodCravings: "food_cravings",
  diarrhea: "diarrhea",
  constipation: "constipation",
} as const satisfies Record<string, BuiltinSymptomID>;

export function buildPartnerSharedProjectionPayload(input: {
  accessLevel: PartnerShareAccessLevel;
  dayLogs: DayLogRecord[];
  generatedAt: string;
  generation: number;
  grantID: string;
  ownerAccountID: string;
  profile: ProfileRecord;
  symptomRecords: SymptomRecord[];
}): PartnerSharedProjectionPayload {
  const sharedDayLogs = input.dayLogs
    .map((record) => redactDayLogForPartner(record, input.profile, input.accessLevel))
    .filter((record) => hasPartnerVisibleData(record));
  const sharedSymptomRecords =
    input.accessLevel === "full"
      ? filterReferencedSymptomRecords(sharedDayLogs, input.symptomRecords)
      : [];

  return {
    schemaVersion: PARTNER_SHARE_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    generation: input.generation,
    accessLevel: input.accessLevel,
    ownerAccountID: input.ownerAccountID,
    grantID: input.grantID,
    profile: {
      ageGroup: input.profile.ageGroup,
      cycleLength: input.profile.cycleLength,
      hideNotes: input.profile.hideNotes === true,
      hideSexChip: input.profile.hideSexChip,
      irregularCycle: input.profile.irregularCycle,
      lastPeriodStart: input.profile.lastPeriodStart,
      periodLength: input.profile.periodLength,
      temperatureUnit: input.profile.temperatureUnit,
      trackBBT: input.profile.trackBBT,
      trackCervicalMucus: input.profile.trackCervicalMucus,
      unpredictableCycle: input.profile.unpredictableCycle,
      usageGoal: input.profile.usageGoal,
    },
    dayLogs: sharedDayLogs,
    symptomRecords: sharedSymptomRecords,
  };
}

export function buildPartnerSharedReadState(
  payload: PartnerSharedProjectionPayload,
  now: Date,
  locale = "en",
): PartnerSharedReadState {
  const profile = buildProjectionProfile(payload);
  const history = buildCycleHistorySummary(profile, payload.dayLogs, now);
  const projection = buildCurrentCycleProjection(profile, history, payload.dayLogs, now);

  const generatedAtMs = Date.parse(payload.generatedAt);
  const staleDeltaDays =
    Number.isNaN(generatedAtMs)
      ? Infinity
      : (now.getTime() - generatedAtMs) / (24 * 60 * 60 * 1000);
  const isStale = staleDeltaDays > PARTNER_SNAPSHOT_STALE_DAYS;

  const recentRows =
    payload.accessLevel === "full"
      ? buildExportCSVRows(payload.dayLogs, payload.symptomRecords)
          .slice()
          .sort((left, right) => right.date.localeCompare(left.date))
          .slice(0, 90)
          .map((row) => ({
            date: row.date,
            period: row.period,
            flow: row.flow,
            moodRating: row.moodRating,
            sexActivity: row.sexActivity,
            bbt: row.bbt,
            cervicalMucus: row.cervicalMucus,
            lhTest: row.lhTest,
            cycleFactors: row.cycleFactors,
            symptomSummary: summarizeExportSymptoms(row, locale),
            notes: row.notes,
          }))
      : [];

  return {
    accessLevel: payload.accessLevel,
    generatedAt: payload.generatedAt,
    isStale,
    temperatureUnit: payload.profile.temperatureUnit,
    cycleStatus: {
      currentCycleDay: projection.currentCycleDay,
      nextPeriodDate: projection.nextPeriodDate,
      nextPeriodWindowEndDate: projection.nextPeriodWindowEndDate,
      nextPeriodWindowStartDate: projection.nextPeriodWindowStartDate,
      predictionExplanation: buildPredictionExplanation(profile, projection, locale),
      state: profile.unpredictableCycle
        ? "facts_only"
        : projection.isPredictionStale
          ? "stale"
          : !projection.cycleAnchorDate || projection.currentCycleDay === null
            ? "unknown"
            : profile.irregularCycle
              ? "approximate"
              : "regular",
    },
    summaryMetrics: {
      lastCycleLength: history.lastCycleLength,
      averageCycleLength: history.averageCycleLength,
      averagePeriodLength: averageInts(
        history.completedCycles.map((cycle) => cycle.periodLength),
      ),
      totalLoggedDays: payload.dayLogs.length,
      topSymptoms: buildTopSymptomLabels(payload.dayLogs, payload.symptomRecords, locale),
    },
    recentRows,
  };
}

function redactDayLogForPartner(
  record: DayLogRecord,
  profile: ProfileRecord,
  accessLevel: PartnerShareAccessLevel,
): DayLogRecord {
  // Built by explicit field-picking, never `...record` spread: the return type
  // is the full DayLogRecord, so the TS compiler forces every field to be
  // listed here. A future additive field on DayLogRecord fails typecheck in
  // this function instead of silently reaching a partner projection.
  if (accessLevel === "summary") {
    // Summary projection: share only coarse period/cycle markers.
    // Data minimisation: flow is not rendered in the summary UI, so drop it.
    // pregnancyTest is owner-only per the canonical privacy rule.
    return {
      date: record.date,
      isPeriod: record.isPeriod,
      cycleStart: record.cycleStart,
      isUncertain: record.isUncertain,
      flow: "none",
      mood: 0,
      sexActivity: "none",
      bbt: 0,
      cervicalMucus: "none",
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    };
  }

  // Full projection: respect owner privacy toggles.
  // pregnancyTest is owner-only unconditionally — no opt-in exists.
  return {
    date: record.date,
    isPeriod: record.isPeriod,
    cycleStart: record.cycleStart,
    isUncertain: record.isUncertain,
    flow: record.flow,
    mood: record.mood,
    sexActivity: profile.hideSexChip ? "none" : record.sexActivity,
    bbt: profile.trackBBT ? record.bbt : 0,
    cervicalMucus: profile.trackCervicalMucus ? record.cervicalMucus : "none",
    lhTest: record.lhTest,
    pregnancyTest: "none",
    cycleFactorKeys: record.cycleFactorKeys,
    symptomIDs: record.symptomIDs,
    notes: profile.hideNotes === true ? "" : record.notes,
  };
}

function filterReferencedSymptomRecords(
  dayLogs: readonly DayLogRecord[],
  symptomRecords: readonly SymptomRecord[],
): SymptomRecord[] {
  const usedIDs = new Set(dayLogs.flatMap((record) => record.symptomIDs));
  return symptomRecords.filter((record) => usedIDs.has(record.id));
}

function hasPartnerVisibleData(record: DayLogRecord): boolean {
  return (
    record.isPeriod ||
    record.cycleStart ||
    record.isUncertain ||
    record.flow !== "none" ||
    record.mood > 0 ||
    record.sexActivity !== "none" ||
    record.bbt > 0 ||
    record.cervicalMucus !== "none" ||
    record.lhTest !== "none" ||
    record.cycleFactorKeys.length > 0 ||
    record.symptomIDs.length > 0 ||
    record.notes.trim().length > 0
  );
}

function buildProjectionProfile(
  payload: PartnerSharedProjectionPayload,
): ProfileRecord {
  return {
    ...createDefaultProfileRecord(),
    ...payload.profile,
  };
}

function buildTopSymptomLabels(
  dayLogs: readonly DayLogRecord[],
  symptomRecords: readonly SymptomRecord[],
  locale = "en",
): string[] {
  if (symptomRecords.length === 0) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const record of dayLogs) {
    for (const symptomID of record.symptomIDs) {
      counts.set(symptomID, (counts.get(symptomID) ?? 0) + 1);
    }
  }

  const labelByID = new Map(
    symptomRecords.map((record) => [record.id, getSymptomDisplayLabel(record, locale)]),
  );
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([symptomID]) => labelByID.get(symptomID) ?? symptomID);
}

function summarizeExportSymptoms(
  row: ReturnType<typeof buildExportCSVRows>[number],
  locale = "en",
): string {
  const labels: string[] = [];

  for (const [flagKey, symptomID] of Object.entries(exportFlagToBuiltinSymptomID)) {
    if (row.symptoms[flagKey as keyof typeof row.symptoms]) {
      labels.push(getBuiltinSymptomLabel(locale, symptomID));
    }
  }

  labels.push(...row.otherSymptoms);
  return labels.join(", ");
}

function averageInts(values: readonly number[]): number {
  const validValues = values.filter((value) => Number.isFinite(value) && value > 0);
  if (validValues.length === 0) {
    return 0;
  }

  return Math.round(
    validValues.reduce((sum, value) => sum + value, 0) / validValues.length,
  );
}
