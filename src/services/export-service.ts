import type {
  ExportBackupEnvelope,
  ExportCSVRow,
  ExportDataSummary,
  ExportFormat,
  ExportSymptomFlags,
  ExportRangeValues,
  LoadedExportState,
} from "../models/export";
import type { DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import type { LocalAppStorage } from "../storage/local/storage-contract";
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

export type ExportArtifact = {
  filename: string;
  mimeType: string;
  content: string;
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
    const [profile, symptomRecords, dayLogs] = await Promise.all([
      storage.readProfileRecord(),
      storage.listSymptomRecords(),
      storage.listDayLogRecordsInRange(validation.fromDate, validation.toDate),
    ]);

    const artifact =
      format === "json"
        ? buildJSONArtifact(
            profile,
            symptomRecords,
            dayLogs,
            refreshed.state.values,
            refreshed.state.summary,
            now,
          )
        : buildCSVArtifact(
            profile,
            symptomRecords,
            dayLogs,
            refreshed.state.values,
            now,
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
  values: ExportRangeValues,
  summary: ExportDataSummary,
  now: Date,
): ExportArtifact {
  const payload: ExportBackupEnvelope = {
    app: "ovumcy",
    formatVersion: 1,
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
  values: ExportRangeValues,
  now: Date,
): ExportArtifact {
  const rows = buildExportCSVRows(dayLogs, symptomRecords);
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

export function buildExportCSVRows(
  dayLogs: readonly DayLogRecord[],
  symptomRecords: readonly SymptomRecord[],
): ExportCSVRow[] {
  const symptomLookup = new Map(symptomRecords.map((record) => [record.id, record]));

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
      bbt: normalizeExportBBT(record.bbt),
      cervicalMucus: normalizeExportCervicalMucus(record.cervicalMucus),
      cycleFactors: [...record.cycleFactorKeys],
      symptoms: flags,
      otherSymptoms,
      notes: record.notes,
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
        row.cycleFactors.join("; "),
        row.otherSymptoms.join("; "),
        row.notes,
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

function normalizeExportMood(value: DayLogRecord["mood"]): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeExportSexActivity(value: DayLogRecord["sexActivity"]): string {
  return value === "none" ? "" : value;
}

function normalizeExportBBT(value: DayLogRecord["bbt"]): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeExportCervicalMucus(
  value: DayLogRecord["cervicalMucus"],
): string {
  return value === "none" ? "" : value;
}

function booleanToCSV(value: boolean): string {
  return value ? "Yes" : "";
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
