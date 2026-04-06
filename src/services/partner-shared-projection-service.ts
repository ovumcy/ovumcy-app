import type { DayLogRecord } from "../models/day-log";
import type {
  PartnerShareAccessLevel,
  PartnerSharedProjectionPayload,
  PartnerSharedReadState,
} from "../models/partner-share";
import {
  PARTNER_SHARE_SCHEMA_VERSION,
} from "../models/partner-share";
import type { ProfileRecord } from "../models/profile";
import { createDefaultProfileRecord } from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import { buildCycleHistorySummary, buildCurrentCycleProjection } from "./cycle-history-service";
import { buildPredictionExplanation } from "./prediction-explanation-service";
import { buildExportCSVRows } from "./export-service";

export function buildPartnerSharedProjectionPayload(input: {
  accessLevel: PartnerShareAccessLevel;
  dayLogs: DayLogRecord[];
  generatedAt: string;
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
            symptomSummary: summarizeExportSymptoms(row),
            notes: row.notes,
          }))
      : [];

  return {
    accessLevel: payload.accessLevel,
    generatedAt: payload.generatedAt,
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
      topSymptoms: buildTopSymptomLabels(payload.dayLogs, payload.symptomRecords),
    },
    recentRows,
  };
}

function redactDayLogForPartner(
  record: DayLogRecord,
  profile: ProfileRecord,
  accessLevel: PartnerShareAccessLevel,
): DayLogRecord {
  if (accessLevel === "summary") {
    return {
      ...record,
      mood: 0,
      sexActivity: "none",
      bbt: 0,
      cervicalMucus: "none",
      lhTest: "none",
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    };
  }

  return {
    ...record,
    sexActivity: profile.hideSexChip ? "none" : record.sexActivity,
    bbt: profile.trackBBT ? record.bbt : 0,
    cervicalMucus: profile.trackCervicalMucus ? record.cervicalMucus : "none",
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

  const labelByID = new Map(symptomRecords.map((record) => [record.id, record.label]));
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([symptomID]) => labelByID.get(symptomID) ?? symptomID);
}

function summarizeExportSymptoms(
  row: ReturnType<typeof buildExportCSVRows>[number],
): string {
  const labels: string[] = [];
  if (row.symptoms.cramps) labels.push("cramps");
  if (row.symptoms.headache) labels.push("headache");
  if (row.symptoms.acne) labels.push("acne");
  if (row.symptoms.mood) labels.push("mood");
  if (row.symptoms.bloating) labels.push("bloating");
  if (row.symptoms.fatigue) labels.push("fatigue");
  if (row.symptoms.breastTenderness) labels.push("breast tenderness");
  if (row.symptoms.backPain) labels.push("back pain");
  if (row.symptoms.nausea) labels.push("nausea");
  if (row.symptoms.spotting) labels.push("spotting");
  if (row.symptoms.irritability) labels.push("irritability");
  if (row.symptoms.insomnia) labels.push("insomnia");
  if (row.symptoms.foodCravings) labels.push("food cravings");
  if (row.symptoms.diarrhea) labels.push("diarrhea");
  if (row.symptoms.constipation) labels.push("constipation");
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
