import type { ExportBackupEnvelope } from "../models/export";
import { hasDayLogData, type DayLogRecord } from "../models/day-log";
import type { SymptomRecord } from "../models/symptom";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { sanitizeDayLogRecord } from "./day-log-policy";
import { createCustomSymptomRecord } from "./symptom-policy";
import { parseLocalDate } from "./profile-settings-policy";

// Free, offline, local-only JSON restore. Mirrors ovumcy-web's
// POST /api/v1/imports/json settings-import capability: it parses a backup
// produced by the app's own export (an ExportBackupEnvelope, export-service.ts)
// and restores it into local storage with NO cloud/paid dependency.
//
// Semantics match the web import and are strictly ADDITIVE — nothing already on
// the device is overwritten or deleted:
//   - day logs: a date that already carries data is left untouched (skipped);
//     only empty dates receive the imported entry. Records are run through
//     sanitizeDayLogRecord, so unknown enum values collapse to neutral defaults
//     rather than failing the whole import.
//   - custom symptoms: a symptom whose label already exists is skipped; new
//     ones are created.
//   - profile settings are never overwritten, so a restore can't clobber the
//     user's current configuration. (Web behaves the same: it only recomputes
//     derived cycle stats, it does not replace user preferences.)
//
// Individual bad records are counted, not fatal; only a structurally invalid
// file fails outright.

// Guardrail mirroring web's MaxImportEntries — bounds a hostile/oversized file.
export const MAX_IMPORT_DAY_LOGS = 20000;
export const MAX_IMPORT_SYMPTOMS = 200;

export type ImportParseErrorCode =
  | "malformed"
  | "unrecognized_format"
  | "too_large";

export type ImportParseResult =
  | { ok: true; envelope: ExportBackupEnvelope }
  | { ok: false; errorCode: ImportParseErrorCode };

export type ImportOutcome = {
  dayLogsAdded: number;
  dayLogsSkipped: number;
  dayLogsRejected: number;
  symptomsAdded: number;
};

export type RestoreFromJSONResult =
  | { ok: true; outcome: ImportOutcome }
  | { ok: false; errorCode: ImportParseErrorCode };

// Parse and shape-validate a JSON string as an ExportBackupEnvelope. Rejects
// anything that is not this app's own export format so a wrong file (or a
// hand-corrupted one) can't be partially applied.
export function parseImportEnvelope(rawJson: string): ImportParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, errorCode: "malformed" };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, errorCode: "malformed" };
  }

  const candidate = parsed as Record<string, unknown>;
  if (candidate.app !== "ovumcy" || candidate.formatVersion !== 1) {
    return { ok: false, errorCode: "unrecognized_format" };
  }

  const dayLogs = Array.isArray(candidate.dayLogs) ? candidate.dayLogs : [];
  const symptoms = Array.isArray(candidate.symptoms) ? candidate.symptoms : [];
  if (
    dayLogs.length > MAX_IMPORT_DAY_LOGS ||
    symptoms.length > MAX_IMPORT_SYMPTOMS
  ) {
    return { ok: false, errorCode: "too_large" };
  }

  // Coerce to the envelope shape; per-record validity is handled additively at
  // apply time, so we only guarantee the collections are arrays here.
  const envelope = {
    ...(candidate as unknown as ExportBackupEnvelope),
    dayLogs: dayLogs as DayLogRecord[],
    symptoms: symptoms as SymptomRecord[],
  };
  return { ok: true, envelope };
}

// Apply a parsed envelope to local storage, additively. Existing data is never
// overwritten. Returns per-category counts.
export async function importBackupEnvelope(
  storage: LocalAppStorage,
  envelope: ExportBackupEnvelope,
): Promise<ImportOutcome> {
  const outcome: ImportOutcome = {
    dayLogsAdded: 0,
    dayLogsSkipped: 0,
    dayLogsRejected: 0,
    symptomsAdded: 0,
  };

  outcome.symptomsAdded = await importCustomSymptoms(storage, envelope.symptoms);

  for (const rawRecord of envelope.dayLogs ?? []) {
    const record = rawRecord as Partial<DayLogRecord> | null;
    const date = typeof record?.date === "string" ? record.date : "";
    if (!parseLocalDate(date)) {
      // Unparseable / missing date: can't place it, so it's rejected.
      outcome.dayLogsRejected += 1;
      continue;
    }

    const existing = await storage.readDayLogRecord(date);
    if (hasDayLogData(existing)) {
      // Additive merge: never overwrite a day the user already has.
      outcome.dayLogsSkipped += 1;
      continue;
    }

    const sanitized = sanitizeDayLogRecord({
      ...existing,
      ...(record as DayLogRecord),
      date,
    });
    if (!hasDayLogData(sanitized)) {
      // Nothing meaningful to restore for this date after sanitizing.
      outcome.dayLogsSkipped += 1;
      continue;
    }

    await storage.writeDayLogRecord(sanitized);
    outcome.dayLogsAdded += 1;
  }

  return outcome;
}

// One-call orchestrator for the settings import UI: parse then apply.
export async function restoreFromJSONBackup(
  storage: LocalAppStorage,
  rawJson: string,
): Promise<RestoreFromJSONResult> {
  const parsed = parseImportEnvelope(rawJson);
  if (!parsed.ok) {
    return parsed;
  }

  const outcome = await importBackupEnvelope(storage, parsed.envelope);
  return { ok: true, outcome };
}

async function importCustomSymptoms(
  storage: LocalAppStorage,
  symptoms: readonly SymptomRecord[] | undefined,
): Promise<number> {
  if (!symptoms || symptoms.length === 0) {
    return 0;
  }

  let existing = await storage.listSymptomRecords();
  let added = 0;

  for (const rawSymptom of symptoms) {
    const record = rawSymptom as Partial<SymptomRecord> | null;
    // Only user-created symptoms are portable; the built-in catalog is seeded
    // locally and must not be duplicated.
    if (record?.isDefault === true) {
      continue;
    }
    const label = typeof record?.label === "string" ? record.label : "";

    // createCustomSymptomRecord validates label/icon/color and rejects
    // duplicates against `existing`, so an invalid or already-present symptom
    // is simply skipped (additive). Feed it the running list so within-batch
    // duplicates are caught too.
    const result = createCustomSymptomRecord(existing, {
      label,
      icon: typeof record?.icon === "string" ? record.icon : "",
      color: typeof record?.color === "string" ? record.color : "",
    });
    if (!result.ok) {
      continue;
    }

    await storage.writeSymptomRecord(result.record);
    existing = [...existing, result.record];
    added += 1;
  }

  return added;
}
