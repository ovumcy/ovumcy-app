import type { DayLogRecord } from "../models/day-log";
import type {
  PartnerShareAccessLevel,
  PartnerSharedPredictionHint,
  PartnerSharedProfileRecord,
  PartnerSharedProjectionPayload,
  PartnerSharedReadState,
  PartnerSharedSummarySnapshot,
  PartnerSharedSymptomRecord,
} from "../models/partner-share";
import { getBuiltinSymptomLabel } from "../i18n/symptom-copy";
import {
  PARTNER_SHARE_SCHEMA_VERSION,
} from "../models/partner-share";
import type { ProfileRecord } from "../models/profile";
import { createDefaultProfileRecord } from "../models/profile";
import type { BuiltinSymptomID, SymptomRecord } from "../models/symptom";
import {
  buildCycleHistorySummary,
  buildCurrentCycleProjection,
  resolveDisplayCycleDay,
} from "./cycle-history-service";
import {
  buildPredictionExplanation,
  buildPredictionExplanationText,
  resolvePredictionExplanationKind,
} from "./prediction-explanation-service";
import { buildExportCSVRows } from "./export-service";
import { atLocalDay, diffLocalDays, formatLocalDate } from "./profile-settings-policy";
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

export function buildPartnerSharedProjectionPayload(
  input: {
    accessLevel: PartnerShareAccessLevel;
    dayLogs: DayLogRecord[];
    generatedAt: string;
    generation: number;
    grantID: string;
    ownerAccountID: string;
    profile: ProfileRecord;
    symptomRecords: SymptomRecord[];
  },
  options: {
    // Additive; mirrors the stats/calendar suppressPredictions
    // pattern: true when an active pregnancy record exists for the owner --
    // the record's status alone, with no gestational-age condition, so a
    // record whose GA has left the trackable window suppresses exactly the
    // same. Computed by the storage-aware sync call site
    // (syncManagedPartnerSharedProjections: activePregnancy !== null) and
    // threaded in here, since this pure builder has no storage access of
    // its own. Defaults to false, so every existing caller/test keeps
    // today's behavior unchanged.
    suppressPredictions?: boolean;
  } = {},
): PartnerSharedProjectionPayload {
  const sharedDayLogs = input.dayLogs
    .map((record) => redactDayLogForPartner(record, input.profile, input.accessLevel))
    .filter((record) => hasPartnerVisibleData(record));
  const sharedSymptomRecords =
    input.accessLevel === "full"
      ? filterReferencedSymptomRecords(sharedDayLogs, input.symptomRecords)
      : [];

  // Below, redactDayLogForPartner ALWAYS forces the shared pregnancyTest
  // to "none" (privacy: partners must never infer pregnancy state from day
  // logs). A side effect is that buildPartnerSharedReadState's own later
  // projection -- built from ONLY this payload, on a device with no owner
  // storage access (the partner's device, or the owner's own read-only
  // preview; both round-trip through the encrypted managed-cloud blob) --
  // can never detect a day-log pause on its own: resolvePregnancyPause's only
  // signal is the now-redacted pregnancyTest field. So the owner's CURRENT
  // pause must be recomputed HERE, from the real pre-redaction input, and
  // OR'd with the threaded activePregnancy signal.
  //
  // The redaction alone bounds only half the exposure. Wording cannot cross:
  // resolvePregnancyPause on the redacted payload is always null, so
  // pregnancyPausedHint's copy never reaches a partner. Numbers can:
  // currentCycleDay/nextPeriodDate are computed straight through the owner's
  // real paused state, so without the recomputation below they ship
  // forward-rolled, describing a cycle the owner is not having. Suppressing
  // here is what keeps them out; the "prediction suppression for active
  // pregnancy / pregnancy-paused owners" suite pins both halves.
  const ownerNow = new Date(input.generatedAt);
  const ownerHistory = buildCycleHistorySummary(input.profile, input.dayLogs, ownerNow);
  const ownerProjection = buildCurrentCycleProjection(
    input.profile,
    ownerHistory,
    input.dayLogs,
    ownerNow,
  );
  const suppressPredictions =
    (options.suppressPredictions ?? false) ||
    ownerProjection.isPregnancyPaused ||
    // An irregular cycle with fewer than three completed cycles names no date
    // at all (web PredictionsSuppressed), the next period included.
    ownerProjection.awaitingIrregularHistory;

  // EXPLICIT field-pick (fail-closed), mirroring redactDayLogForPartner: the
  // partner profile is built field-by-field, never `...input.profile`. Any
  // owner-only additive ProfileRecord field is excluded by construction and
  // can never leak into a partner projection. The crisis-support contact
  // (crisisContactName/crisisContactPhone) is deliberately NOT listed here
  // and must NEVER be added — it is owner-only private safety data. The
  // PartnerSharedProfileRecord Pick type is the compile-time twin of this
  // allowlist; the leak pins (crisisContact tokens + phone value, both access
  // levels) prove it structurally and after serialization.
  const sharedProfile: PartnerSharedProfileRecord = {
    ageGroup: input.profile.ageGroup,
    cycleLength: input.profile.cycleLength,
    hideNotes: input.profile.hideNotes === true,
    hideSexChip: input.profile.hideSexChip,
    irregularCycle: input.profile.irregularCycle,
    periodLength: input.profile.periodLength,
    temperatureUnit: input.profile.temperatureUnit,
    trackBBT: input.profile.trackBBT,
    trackCervicalMucus: input.profile.trackCervicalMucus,
    // While suppressPredictions holds (active pregnancy record, or the
    // owner's own day-log pause not yet lifted), force the SHARED profile's
    // unpredictableCycle true regardless of the owner's real setting. This
    // is the lever buildPartnerSharedReadState's payload-only recomputation
    // keys off (full level, or a summary payload from an older owner build)
    // to reach the SAME neutral facts_only shape a real facts_only owner's
    // partner already sees (no current-cycle prediction fields, no
    // pregnancy-adjacent copy). Every OTHER shared field (day-log history,
    // summary metrics) stays fully accurate.
    unpredictableCycle: suppressPredictions ? true : input.profile.unpredictableCycle,
  };

  const payload: PartnerSharedProjectionPayload = {
    schemaVersion: PARTNER_SHARE_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    generation: input.generation,
    accessLevel: input.accessLevel,
    ownerAccountID: input.ownerAccountID,
    grantID: input.grantID,
    profile: sharedProfile,
    dayLogs: [],
    symptomRecords: [],
  };

  if (input.accessLevel === "full") {
    sharedProfile.lastPeriodStart = input.profile.lastPeriodStart;
    payload.dayLogs = sharedDayLogs;
    payload.symptomRecords = sharedSymptomRecords;
    return payload;
  }

  // Summary level: the owner device computes what the partner's summary view
  // renders and ships only that. No per-day date, no date-valued profile
  // field and no symptom record leaves the device; the snapshot is derived
  // from the same redacted logs and shared profile a full-level partner
  // would recompute from.
  payload.summarySnapshot = buildSummarySnapshot(
    {
      ...createDefaultProfileRecord(),
      ...sharedProfile,
      lastPeriodStart: input.profile.lastPeriodStart,
    },
    sharedDayLogs,
    ownerNow,
    suppressPredictions,
  );
  return payload;
}

function buildSummarySnapshot(
  profile: ProfileRecord,
  sharedDayLogs: readonly DayLogRecord[],
  ownerNow: Date,
  suppressPredictions: boolean,
): PartnerSharedSummarySnapshot {
  const { history, projection, state, explanationKind } = resolvePartnerCycleStatus(
    profile,
    [...sharedDayLogs],
    ownerNow,
  );
  const metrics = {
    averageCycleLength: history.averageCycleLength,
    averagePeriodLength: averageInts(
      history.completedCycles.map((cycle) => cycle.periodLength),
    ),
    lastCycleLength: history.lastCycleLength,
    totalLoggedDays: sharedDayLogs.length,
  };
  const asOfDate = formatLocalDate(atLocalDay(ownerNow));

  // Medical safety: every prediction value is dropped, explicitly rather than
  // by trusting the recomputation, while an active pregnancy record or the
  // owner's own pause holds. The hint is the neutral facts-only one, never
  // pregnancy-specific wording.
  if (suppressPredictions) {
    return {
      asOfDate,
      cycleStatus: {
        currentCycleDay: null,
        nextPeriodDate: null,
        nextPeriodWindowEndDate: null,
        nextPeriodWindowStartDate: null,
        predictionHint: "facts_only",
        state: "facts_only",
      },
      metrics,
    };
  }

  const predictionHint: PartnerSharedPredictionHint =
    explanationKind === null
      ? "none"
      : explanationKind === "pregnancy_paused"
        ? "facts_only"
        : explanationKind;
  return {
    asOfDate,
    cycleStatus: {
      currentCycleDay: resolveDisplayCycleDay(projection),
      nextPeriodDate: projection.nextPeriodDate,
      nextPeriodWindowEndDate: projection.nextPeriodWindowEndDate,
      nextPeriodWindowStartDate: projection.nextPeriodWindowStartDate,
      predictionHint,
      state,
    },
    metrics,
  };
}

function resolvePartnerCycleStatus(
  profile: ProfileRecord,
  dayLogs: DayLogRecord[],
  now: Date,
) {
  const history = buildCycleHistorySummary(profile, dayLogs, now);
  const projection = buildCurrentCycleProjection(profile, history, dayLogs, now);
  const state: PartnerSharedReadState["cycleStatus"]["state"] = profile.unpredictableCycle
    ? "facts_only"
    : projection.isPredictionStale
      ? "stale"
      : !projection.cycleAnchorDate || projection.currentCycleDay === null
        ? "unknown"
        : profile.irregularCycle
          ? "approximate"
          : "regular";
  return {
    history,
    projection,
    state,
    explanationKind: resolvePredictionExplanationKind(profile, projection),
  };
}

export function buildPartnerSharedReadState(
  payload: PartnerSharedProjectionPayload,
  now: Date,
  locale = "en",
): PartnerSharedReadState {
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

  const base = {
    accessLevel: payload.accessLevel,
    generatedAt: payload.generatedAt,
    isStale,
    temperatureUnit: payload.profile.temperatureUnit,
    recentRows,
  };

  // A summary payload carries the owner-computed snapshot; one from an older
  // owner build (no snapshot) falls through to the recomputation below.
  if (payload.accessLevel === "summary" && isSummarySnapshot(payload.summarySnapshot)) {
    const snapshot = payload.summarySnapshot;
    return {
      ...base,
      cycleStatus: {
        currentCycleDay: advanceSnapshotCycleDay(snapshot, now),
        nextPeriodDate: snapshot.cycleStatus.nextPeriodDate,
        nextPeriodWindowEndDate: snapshot.cycleStatus.nextPeriodWindowEndDate,
        nextPeriodWindowStartDate: snapshot.cycleStatus.nextPeriodWindowStartDate,
        predictionExplanation: buildPredictionExplanationText(
          snapshot.cycleStatus.predictionHint === "none"
            ? null
            : snapshot.cycleStatus.predictionHint,
          locale,
        ),
        state: snapshot.cycleStatus.state,
      },
      summaryMetrics: {
        lastCycleLength: snapshot.metrics.lastCycleLength,
        averageCycleLength: snapshot.metrics.averageCycleLength,
        averagePeriodLength: snapshot.metrics.averagePeriodLength,
        totalLoggedDays: snapshot.metrics.totalLoggedDays,
        topSymptoms: [],
      },
    };
  }

  const profile = buildProjectionProfile(payload.profile);
  const { history, projection, state } = resolvePartnerCycleStatus(
    profile,
    payload.dayLogs,
    now,
  );

  return {
    ...base,
    cycleStatus: {
      currentCycleDay: resolveDisplayCycleDay(projection),
      nextPeriodDate: projection.nextPeriodDate,
      nextPeriodWindowEndDate: projection.nextPeriodWindowEndDate,
      nextPeriodWindowStartDate: projection.nextPeriodWindowStartDate,
      predictionExplanation: buildPredictionExplanation(profile, projection, locale),
      state,
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
  };
}

// The cycle day is the owner's as of `asOfDate`. While the predicted window
// has not yet passed it advances by the whole local days elapsed on the
// partner's clock, so a snapshot read days later does not show a frozen day.
// Once the window has passed the day is withheld ("—"): rolling an elapsed
// prediction forward would invent a cycle the owner device never computed.
// An overdue ("stale") day count, and a facts-only one (no predicted window
// to pass), keeps counting from its anchor. A clock behind `asOfDate` shows
// the day as generated.
function advanceSnapshotCycleDay(
  snapshot: PartnerSharedSummarySnapshot,
  now: Date,
): number | null {
  const { currentCycleDay, nextPeriodWindowEndDate, nextPeriodDate, state } =
    snapshot.cycleStatus;
  if (currentCycleDay === null) {
    return null;
  }

  const today = formatLocalDate(atLocalDay(now));
  const elapsedDays = Math.max(0, diffLocalDays(snapshot.asOfDate, today));
  if (state === "stale" || state === "facts_only") {
    return currentCycleDay + elapsedDays;
  }

  const windowEnd = nextPeriodWindowEndDate ?? nextPeriodDate;
  if (windowEnd === null || today > windowEnd) {
    return elapsedDays === 0 ? currentCycleDay : null;
  }
  return currentCycleDay + elapsedDays;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SNAPSHOT_STATES: readonly string[] = [
  "regular",
  "approximate",
  "facts_only",
  "unknown",
  "stale",
];
const SNAPSHOT_HINTS: readonly string[] = [
  "approximate",
  "facts_only",
  "none",
  "variable_ranges",
];

function isSummarySnapshot(value: unknown): value is PartnerSharedSummarySnapshot {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const snapshot = value as Partial<PartnerSharedSummarySnapshot>;
  const status = snapshot.cycleStatus;
  const metrics = snapshot.metrics;
  if (!status || !metrics || typeof snapshot.asOfDate !== "string") {
    return false;
  }
  const isDateOrNull = (field: unknown) =>
    field === null || (typeof field === "string" && DATE_KEY_PATTERN.test(field));
  const isFiniteNumber = (field: unknown) =>
    typeof field === "number" && Number.isFinite(field);
  return (
    DATE_KEY_PATTERN.test(snapshot.asOfDate) &&
    (status.currentCycleDay === null || isFiniteNumber(status.currentCycleDay)) &&
    isDateOrNull(status.nextPeriodDate) &&
    isDateOrNull(status.nextPeriodWindowStartDate) &&
    isDateOrNull(status.nextPeriodWindowEndDate) &&
    SNAPSHOT_HINTS.includes(status.predictionHint) &&
    SNAPSHOT_STATES.includes(status.state) &&
    isFiniteNumber(metrics.averageCycleLength) &&
    isFiniteNumber(metrics.averagePeriodLength) &&
    isFiniteNumber(metrics.lastCycleLength) &&
    isFiniteNumber(metrics.totalLoggedDays)
  );
}

function redactDayLogForPartner(
  record: DayLogRecord,
  profile: ProfileRecord,
  accessLevel: PartnerShareAccessLevel,
): DayLogRecord {
  // Both branches build the redacted record by EXPLICIT field-picking, never a
  // `...record` spread. This is fail-closed twice over: the return type is the
  // full DayLogRecord, so the compiler forces every field to be listed here (a
  // future additive field fails typecheck in this function instead of silently
  // reaching a partner projection), and owner-only values — pregnancy-mode
  // metrics (weightKg / bpSystolic / bpDiastolic) among them — are excluded by
  // construction. pregnancyTest is owner-only unconditionally (no opt-in
  // exists) and is forced to "none".
  if (accessLevel === "summary") {
    // Summary projection: share only coarse period/cycle markers.
    // Data minimisation: flow is not rendered in the summary UI, so drop it.
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

  // Full projection: keep detailed history but respect owner privacy toggles.
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

// Explicit field-pick, never a spread: only the fields the partner read path
// uses leave the device. Slug, icon, colour, archive flag and sort order are
// owner presentation state and stay out by construction.
function filterReferencedSymptomRecords(
  dayLogs: readonly DayLogRecord[],
  symptomRecords: readonly SymptomRecord[],
): PartnerSharedSymptomRecord[] {
  const usedIDs = new Set(dayLogs.flatMap((record) => record.symptomIDs));
  return symptomRecords
    .filter((record) => usedIDs.has(record.id))
    .map((record) => ({
      id: record.id,
      isDefault: record.isDefault,
      label: record.label,
    }));
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

function buildProjectionProfile(profile: PartnerSharedProfileRecord): ProfileRecord {
  return {
    ...createDefaultProfileRecord(),
    ...profile,
  };
}

function buildTopSymptomLabels(
  dayLogs: readonly DayLogRecord[],
  symptomRecords: readonly PartnerSharedSymptomRecord[],
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
