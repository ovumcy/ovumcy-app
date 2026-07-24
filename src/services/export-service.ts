import type {
  ExportArtifactContent,
  ExportBackupEnvelope,
  ExportCSVRow,
  ExportDataSummary,
  ExportFormat,
  ExportSymptomFlags,
  ExportRangeValues,
  LoadedExportState,
} from "../models/export";
import type { DayLogRecord } from "../models/day-log";
import type {
  ContractionSession,
  KickCountSession,
  PregnancyRecord,
} from "../models/pregnancy";
import type { PostpartumRecord } from "../models/postpartum";
import type { ScreeningResponse } from "../models/screening";
import type { ProfileRecord } from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import type { ExportPDFBuildInput } from "./export-pdf-service";
import {
  applyExportPreset,
  createDefaultExportRangeValues,
  createEmptyExportSummary,
  resolveExportBounds,
  resolveExportPresetSelection,
  type ExportValidationErrorCode,
  validateExportRangeValues,
} from "./export-policy";
import { formatLocalDate } from "./profile-settings-policy";
import { normalizeSymptomLabelKey } from "./symptom-policy";
import { celsiusToUnit, roundTemperature } from "./temperature-policy";

export type ExportArtifact = {
  filename: string;
  mimeType: string;
  content: ExportArtifactContent;
};

export type ExportServiceDependencies = {
  buildPDFContent?: (input: ExportPDFBuildInput) => Promise<Uint8Array>;
};

export type LoadExportStateResult = {
  state: LoadedExportState;
  errorCode: ExportValidationErrorCode | null;
};

export type BuildExportArtifactResult =
  | {
      ok: true;
      artifact: ExportArtifact;
      state: LoadedExportState;
    }
  | {
      ok: false;
      errorCode: ExportValidationErrorCode | "generic";
      state: LoadedExportState;
    };

export const EXPORT_CSV_HEADERS = [
  "Date",
  "Period",
  "Flow",
  "Mood rating",
  "Sex activity",
  "BBT",
  "Cervical mucus",
  "LH test",
  "Cramps",
  "Headache",
  "Acne",
  "Mood",
  "Bloating",
  "Fatigue",
  "Breast tenderness",
  "Back pain",
  "Nausea",
  "Spotting",
  "Irritability",
  "Insomnia",
  "Food cravings",
  "Diarrhea",
  "Constipation",
  "Cycle factors",
  "Other",
  "Notes",
  // These three mirror the ovumcy-web Free-tier CSV contract, in the same
  // order, so an export from either owner surface parses the same way.
  "Pregnancy test",
  "Cycle start",
  "Uncertain",
  // Pregnancy-mode metrics, appended AFTER the shared web-contract columns so
  // existing positional CSV consumers of everything above are unaffected. See
  // ExportCSVRow in models/export.ts for why contraction sessions have no CSV
  // column.
  "Weight (kg)",
  "BP systolic (mmHg)",
  "BP diastolic (mmHg)",
  "Kick count",
] as const;

const EXPORT_SYMPTOM_COLUMNS_BY_LABEL: Record<string, keyof ExportSymptomFlags> = {
  cramps: "cramps",
  headache: "headache",
  acne: "acne",
  mood: "mood",
  "mood swings": "mood",
  bloating: "bloating",
  fatigue: "fatigue",
  "breast tenderness": "breastTenderness",
  "back pain": "backPain",
  nausea: "nausea",
  spotting: "spotting",
  irritability: "irritability",
  insomnia: "insomnia",
  "food cravings": "foodCravings",
  diarrhea: "diarrhea",
  constipation: "constipation",
};

export async function loadLocalExportState(
  storage: LocalAppStorage,
  now: Date,
  values?: ExportRangeValues,
): Promise<LoadExportStateResult> {
  const availableSummary = await storage.readDayLogSummary();
  const normalizedAvailable = normalizeExportSummary(availableSummary);
  const bounds = resolveExportBounds(normalizedAvailable, now);
  const draftValues = values
    ? normalizeExportRangeValues(values, bounds, now)
    : createDefaultExportRangeValues(normalizedAvailable, now);

  const validation = validateExportRangeValues(draftValues, bounds);
  if (!validation.ok) {
    return {
      errorCode: validation.errorCode,
      state: {
        values: {
          ...draftValues,
          preset: resolveExportPresetSelection(draftValues, bounds, now),
        },
        availableSummary: normalizedAvailable,
        summary: createEmptyExportSummary(),
        bounds,
      },
    };
  }

  const summary = normalizeExportSummary(
    await storage.readDayLogSummary(validation.fromDate, validation.toDate),
  );

  return {
    errorCode: null,
    state: {
      values: {
        ...draftValues,
        fromDate: validation.fromDate,
        toDate: validation.toDate,
        preset: resolveExportPresetSelection(
          {
            ...draftValues,
            fromDate: validation.fromDate,
            toDate: validation.toDate,
          },
          bounds,
          now,
        ),
      },
      availableSummary: normalizedAvailable,
      summary,
      bounds,
    },
  };
}

export async function buildLocalExportArtifact(
  storage: LocalAppStorage,
  state: LoadedExportState,
  format: ExportFormat,
  now: Date,
  dependencies: ExportServiceDependencies = {},
): Promise<BuildExportArtifactResult> {
  const refreshed = await loadLocalExportState(storage, now, state.values);
  const validation = validateExportRangeValues(refreshed.state.values, refreshed.state.bounds);
  if (!validation.ok) {
    return {
      ok: false,
      errorCode: validation.errorCode,
      state: refreshed.state,
    };
  }

  try {
    // Pregnancy-mode + postpartum/screening collections, never
    // premium-gated -- fetched alongside the existing profile/symptoms/dayLogs
    // reads, precisely scoped per format so the PDF path (these sections out of
    // v1 scope) never touches these repos: JSON needs all of them; CSV needs
    // only kick sessions (for the per-day kickCount sum -- weightKg/bp already
    // live on dayLogs). Pregnancies and postpartum records are NOT date-ranged
    // (both episodic; see buildJSONArtifact); kick/contraction sessions are
    // ranged at the storage layer the same way dayLogs are, and screening
    // responses are ranged in-service by completion date (their repo exposes no
    // range read -- it is an append-only history).
    const needsPregnancies = format === "json";
    const needsKickSessions = format === "json" || format === "csv";
    const needsContractionSessions = format === "json";
    const needsPostpartum = format === "json";
    const needsScreening = format === "json";
    // Only the PDF path needs to know whether a pregnancy is currently
    // ACTIVE (to suppress phantom current-cycle fertility signals) -- CSV/JSON
    // already export full pregnancy data unconditionally (see the "never
    // reads... exports full pregnancy data regardless" test), so this stays
    // scoped like the other needs* reads above rather than always-fetched.
    const needsActivePregnancy = format === "pdf";

    const [
      profile,
      symptomRecords,
      dayLogs,
      pregnancies,
      kickSessions,
      contractionSessions,
      postpartumRecords,
      allScreeningResponses,
      activePregnancy,
    ] = await Promise.all([
      storage.readProfileRecord(),
      storage.listSymptomRecords(),
      storage.listDayLogRecordsInRange(validation.fromDate, validation.toDate),
      needsPregnancies
        ? storage.listPregnancyRecords()
        : Promise.resolve<PregnancyRecord[]>([]),
      needsKickSessions
        ? storage.listKickSessions(validation.fromDate, validation.toDate)
        : Promise.resolve<KickCountSession[]>([]),
      needsContractionSessions
        ? storage.listContractionSessions(validation.fromDate, validation.toDate)
        : Promise.resolve<ContractionSession[]>([]),
      needsPostpartum
        ? storage.listPostpartumRecords()
        : Promise.resolve<PostpartumRecord[]>([]),
      needsScreening
        ? storage.listScreeningResponses()
        : Promise.resolve<ScreeningResponse[]>([]),
      needsActivePregnancy
        ? storage.readActivePregnancy()
        : Promise.resolve<PregnancyRecord | null>(null),
    ]);

    // Screening responses are ranged by completion date like sessions (the
    // repo has no range read, so filter here). LocalDateISO is YYYY-MM-DD, so
    // lexical comparison is date-correct. Empty for CSV/PDF (never fetched).
    const screeningResponses = allScreeningResponses.filter(
      (response) =>
        response.date >= validation.fromDate &&
        response.date <= validation.toDate,
    );

    const artifact =
      format === "json"
        ? buildJSONArtifact(
            profile,
            symptomRecords,
            dayLogs,
            pregnancies,
            kickSessions,
            contractionSessions,
            postpartumRecords,
            screeningResponses,
            refreshed.state.values,
            refreshed.state.summary,
            now,
          )
        : format === "csv"
          ? buildCSVArtifact(
              profile,
              symptomRecords,
              dayLogs,
              kickSessions,
              refreshed.state.values,
              now,
            )
          : await buildPDFArtifact(
              profile,
              symptomRecords,
              dayLogs,
              now,
              dependencies.buildPDFContent ?? defaultBuildPDFContent,
              activePregnancy !== null,
            );

    return {
      ok: true,
      artifact,
      state: refreshed.state,
    };
  } catch {
    return {
      ok: false,
      errorCode: "generic",
      state: refreshed.state,
    };
  }
}

export function normalizeExportRangeValues(
  values: ExportRangeValues,
  bounds: LoadedExportState["bounds"],
  now: Date,
): ExportRangeValues {
  if (values.preset !== "custom") {
    return applyExportPreset(values.preset, bounds, now);
  }

  return {
    preset: "custom",
    fromDate: String(values.fromDate || "").trim(),
    toDate: String(values.toDate || "").trim(),
  };
}

function buildJSONArtifact(
  profile: ProfileRecord,
  symptomRecords: SymptomRecord[],
  dayLogs: DayLogRecord[],
  pregnancies: PregnancyRecord[],
  kickSessions: KickCountSession[],
  contractionSessions: ContractionSession[],
  postpartumRecords: PostpartumRecord[],
  screeningResponses: ScreeningResponse[],
  values: ExportRangeValues,
  summary: ExportDataSummary,
  now: Date,
): ExportArtifact {
  const payload: ExportBackupEnvelope = {
    app: "ovumcy",
    formatVersion: 3,
    exportedAt: now.toISOString(),
    preset: values.preset,
    range: {
      fromDate: values.fromDate || null,
      toDate: values.toDate || null,
    },
    summary,
    profile,
    symptoms: symptomRecords,
    dayLogs,
    // Pregnancy records are episodic (they can span far beyond the selected
    // day-log range, e.g. an active pregnancy's due date), so unlike dayLogs/
    // kickSessions/contractionSessions they are NOT filtered by the export
    // date range -- every pregnancy record on-device is always included, the
    // same "full snapshot regardless of range" treatment `profile` already
    // gets in this envelope.
    pregnancies,
    kickSessions,
    contractionSessions,
    // Postpartum records are episodic just like pregnancies (a recovery episode
    // spans weeks beyond any single day-log window), so they are NOT ranged --
    // every postpartum record on-device is always included. Screening responses
    // ARE ranged by completion date (already filtered in buildLocalExportArtifact,
    // like kick/contraction sessions), since a screening is a point-in-time
    // check-in that fits a date window.
    postpartumRecords,
    screeningResponses,
  };

  return {
    filename: buildExportFilename("json", now),
    mimeType: "application/json",
    content: `${JSON.stringify(payload, null, 2)}\n`,
  };
}

function buildCSVArtifact(
  profile: ProfileRecord,
  symptomRecords: SymptomRecord[],
  dayLogs: DayLogRecord[],
  kickSessions: KickCountSession[],
  values: ExportRangeValues,
  now: Date,
): ExportArtifact {
  const rows = buildExportCSVRows(
    dayLogs,
    symptomRecords,
    profile.temperatureUnit,
    kickSessions,
  );
  const headerLabels: string[] = [...EXPORT_CSV_HEADERS];
  if (profile.temperatureUnit === "f") {
    headerLabels[5] = "BBT (F)";
  } else if (profile.temperatureUnit === "c") {
    headerLabels[5] = "BBT (C)";
  }

  return {
    filename: buildExportFilename("csv", now),
    mimeType: "text/csv",
    content: serializeExportCSV(headerLabels, rows, values),
  };
}

async function buildPDFArtifact(
  profile: ProfileRecord,
  symptomRecords: SymptomRecord[],
  dayLogs: DayLogRecord[],
  now: Date,
  buildPDFContent: (input: ExportPDFBuildInput) => Promise<Uint8Array>,
  suppressPredictions: boolean,
): Promise<ExportArtifact> {
  const content = await buildPDFContent({
    now,
    dayLogs,
    profile,
    symptomRecords,
    suppressPredictions,
  });

  return {
    filename: buildExportFilename("pdf", now),
    mimeType: "application/pdf",
    content,
  };
}

async function defaultBuildPDFContent(
  input: ExportPDFBuildInput,
): Promise<Uint8Array> {
  const module = await import("./export-pdf-service");
  return module.buildExportPDFContent(input);
}

export function buildExportCSVRows(
  dayLogs: readonly DayLogRecord[],
  symptomRecords: readonly SymptomRecord[],
  temperatureUnit: ProfileRecord["temperatureUnit"] = "c",
  kickSessions: readonly KickCountSession[] = [],
): ExportCSVRow[] {
  const symptomLookup = new Map(symptomRecords.map((record) => [record.id, record]));
  const kickCountByDate = buildExportKickCountByDate(kickSessions);

  return dayLogs.map((record) => {
    const { flags, otherSymptoms } = buildExportSymptomProjection(
      record.symptomIDs,
      symptomLookup,
    );

    return {
      date: record.date,
      period: record.isPeriod,
      flow: normalizeExportFlow(record.flow),
      moodRating: normalizeExportMood(record.mood),
      sexActivity: normalizeExportSexActivity(record.sexActivity),
      bbt: normalizeExportBBT(record.bbt, temperatureUnit),
      cervicalMucus: normalizeExportCervicalMucus(record.cervicalMucus),
      lhTest: normalizeExportLHTest(record.lhTest),
      cycleFactors: [...record.cycleFactorKeys],
      symptoms: flags,
      otherSymptoms,
      notes: record.notes,
      pregnancyTest: normalizeExportPregnancyTest(record.pregnancyTest),
      cycleStart: record.cycleStart,
      isUncertain: record.isUncertain,
      weightKg: normalizeExportWeightKg(record.weightKg),
      bpSystolic: normalizeExportBpSystolic(record.bpSystolic),
      bpDiastolic: normalizeExportBpDiastolic(record.bpDiastolic),
      kickCount: kickCountByDate.get(record.date) ?? 0,
    };
  });
}

export function serializeExportCSV(
  headers: readonly string[],
  rows: readonly ExportCSVRow[],
  _values: ExportRangeValues,
): string {
  const lines = [headers.map(escapeCSVField).join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.date,
        booleanToCSV(row.period),
        row.flow,
        row.moodRating > 0 ? String(row.moodRating) : "",
        row.sexActivity,
        row.bbt > 0 ? String(row.bbt) : "",
        row.cervicalMucus,
        row.lhTest,
        booleanToCSV(row.symptoms.cramps),
        booleanToCSV(row.symptoms.headache),
        booleanToCSV(row.symptoms.acne),
        booleanToCSV(row.symptoms.mood),
        booleanToCSV(row.symptoms.bloating),
        booleanToCSV(row.symptoms.fatigue),
        booleanToCSV(row.symptoms.breastTenderness),
        booleanToCSV(row.symptoms.backPain),
        booleanToCSV(row.symptoms.nausea),
        booleanToCSV(row.symptoms.spotting),
        booleanToCSV(row.symptoms.irritability),
        booleanToCSV(row.symptoms.insomnia),
        booleanToCSV(row.symptoms.foodCravings),
        booleanToCSV(row.symptoms.diarrhea),
        booleanToCSV(row.symptoms.constipation),
        row.cycleFactors.map(sanitizeCSVTextCell).join("; "),
        row.otherSymptoms.map(sanitizeCSVTextCell).join("; "),
        sanitizeCSVTextCell(row.notes),
        row.pregnancyTest,
        booleanToCSV(row.cycleStart),
        booleanToCSV(row.isUncertain),
        // Bounded non-negative numbers (same reasoning as moodRating/bbt
        // above): they can never start with =+-@, so no sanitizeCSVTextCell
        // pass is needed here, only the same escapeCSVField() every field gets.
        row.weightKg > 0 ? String(row.weightKg) : "",
        row.bpSystolic > 0 ? String(row.bpSystolic) : "",
        row.bpDiastolic > 0 ? String(row.bpDiastolic) : "",
        row.kickCount > 0 ? String(row.kickCount) : "",
      ]
        .map(escapeCSVField)
        .join(","),
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildExportSymptomProjection(
  symptomIDs: readonly string[],
  symptomLookup: Map<string, SymptomRecord>,
): { flags: ExportSymptomFlags; otherSymptoms: string[] } {
  const flags = createEmptyExportSymptomFlags();
  const otherSymptoms: string[] = [];

  for (const symptomID of symptomIDs) {
    const resolved = symptomLookup.get(symptomID);
    const label = resolved?.label?.trim() || symptomID;
    const normalized = normalizeSymptomLabelKey(label);
    const mappedColumn = EXPORT_SYMPTOM_COLUMNS_BY_LABEL[normalized];
    if (mappedColumn) {
      flags[mappedColumn] = true;
      continue;
    }

    if (label && !otherSymptoms.includes(label)) {
      otherSymptoms.push(label);
    }
  }

  otherSymptoms.sort((left, right) => left.localeCompare(right));

  return {
    flags,
    otherSymptoms,
  };
}

function createEmptyExportSymptomFlags(): ExportSymptomFlags {
  return {
    cramps: false,
    headache: false,
    acne: false,
    mood: false,
    bloating: false,
    fatigue: false,
    breastTenderness: false,
    backPain: false,
    nausea: false,
    spotting: false,
    irritability: false,
    insomnia: false,
    foodCravings: false,
    diarrhea: false,
    constipation: false,
  };
}

function normalizeExportSummary(
  summary: Awaited<ReturnType<LocalAppStorage["readDayLogSummary"]>>,
): ExportDataSummary {
  return {
    totalEntries: summary.totalEntries,
    hasData: summary.hasData,
    dateFrom: summary.dateFrom,
    dateTo: summary.dateTo,
  };
}

function buildExportFilename(format: ExportFormat, now: Date): string {
  const stamp = formatLocalDate(now);
  return `ovumcy-export-${stamp}.${format}`;
}

function normalizeExportFlow(value: DayLogRecord["flow"]): string {
  return value === "none" ? "" : value;
}

function normalizeExportPregnancyTest(
  value: DayLogRecord["pregnancyTest"],
): string {
  return value === "none" ? "" : value;
}

function normalizeExportMood(value: DayLogRecord["mood"]): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeExportSexActivity(value: DayLogRecord["sexActivity"]): string {
  return value === "none" ? "" : value;
}

function normalizeExportBBT(
  value: DayLogRecord["bbt"],
  temperatureUnit: ProfileRecord["temperatureUnit"],
): number {
  return Number.isFinite(value) && value > 0
    ? roundTemperature(celsiusToUnit(value, temperatureUnit))
    : 0;
}

function normalizeExportCervicalMucus(
  value: DayLogRecord["cervicalMucus"],
): string {
  return value === "none" ? "" : value;
}

function normalizeExportLHTest(value: DayLogRecord["lhTest"]): string {
  return value === "none" ? "" : value;
}

// weightKg/bpSystolic/bpDiastolic are genuinely optional on DayLogRecord
// (undefined = "not logged today", never a stored 0 -- see the model
// comment in models/day-log.ts). Collapsing to the same 0-renders-blank
// convention normalizeExportMood/normalizeExportBBT already use keeps every
// ExportCSVRow numeric field consistent, and is safe: day-log-policy's
// normalizers only ever persist positive values or omit the key entirely.
function normalizeExportWeightKg(value: DayLogRecord["weightKg"]): number {
  return typeof value === "number" && value > 0 ? value : 0;
}

function normalizeExportBpSystolic(value: DayLogRecord["bpSystolic"]): number {
  return typeof value === "number" && value > 0 ? value : 0;
}

function normalizeExportBpDiastolic(value: DayLogRecord["bpDiastolic"]): number {
  return typeof value === "number" && value > 0 ? value : 0;
}

// Per-day total kick count across that date's kick-count sessions (usually
// zero or one session per day, but summed in case of more). A date with no
// sessions is absent from the map, so `.get(date) ?? 0` renders blank the
// same way an unlogged weight/BBT does.
function buildExportKickCountByDate(
  kickSessions: readonly KickCountSession[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const session of kickSessions) {
    totals.set(session.date, (totals.get(session.date) ?? 0) + session.kickCount);
  }
  return totals;
}

function booleanToCSV(value: boolean): string {
  return value ? "Yes" : "";
}

function sanitizeCSVTextCell(value: string): string {
  if (value === "") {
    return "";
  }

  const trimmed = value.replace(/^ +/, "");
  if (trimmed.length > 0) {
    const first = trimmed[0];
    if (
      first === "=" ||
      first === "+" ||
      first === "-" ||
      first === "@" ||
      first === "\t" ||
      first === "\r" ||
      first === "\n"
    ) {
      return "'" + value;
    }
  }

  return value;
}

function escapeCSVField(raw: string): string {
  const normalized = String(raw ?? "");
  if (
    normalized.includes(",") ||
    normalized.includes('"') ||
    normalized.includes("\n")
  ) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}
