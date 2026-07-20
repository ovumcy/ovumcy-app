import type { ExportBackupEnvelope } from "../models/export";
import { hasDayLogData, type DayLogRecord } from "../models/day-log";
import {
  createDefaultProfileRecord,
  normalizeCalendarPredictionNoticeKey,
  normalizeInterfaceLanguage,
  normalizeOnboardingHelperNoticeKey,
  normalizeThemePreference,
  normalizeWeekStartDay,
  resolveScreenCaptureProtectionEnabled,
  type ProfileRecord,
} from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { sanitizeDayLogRecord } from "./day-log-policy";
import { createCustomSymptomRecord } from "./symptom-policy";
import {
  clampCycleLength,
  clampPeriodLength,
  clampReminderLeadDays,
  normalizeAgeGroup,
  normalizeReminderTime,
  normalizeTemperatureUnit,
  normalizeUsageGoal,
  parseLocalDate,
} from "./profile-settings-policy";

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
//   - profile settings are restored ONLY while the local profile is still
//     pristine (field-for-field equal to createDefaultProfileRecord(), i.e. no
//     user-entered data yet). Any user-entered value — even a language
//     override — blocks the profile restore, so a restore can never clobber the
//     user's current configuration.
//
// Individual bad records are counted, not fatal; only a structurally invalid
// file fails outright.

// Guardrail mirroring web's MaxImportEntries — bounds a hostile/oversized file.
export const MAX_IMPORT_DAY_LOGS = 20000;
export const MAX_IMPORT_SYMPTOMS = 200;

// Byte cap enforced by the platform file pickers BEFORE the file content is
// read into memory. 20k sanitized day logs serialize to well under this bound,
// so any larger file cannot be a legitimate Ovumcy export.
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

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
  profileRestored: boolean;
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

// Dry-run of importBackupEnvelope: computes the exact per-category counts the
// apply would produce, without writing anything. Backs the preview step of the
// settings import flow (pick → preview → confirm → apply).
export async function previewImportBackupEnvelope(
  storage: LocalAppStorage,
  envelope: ExportBackupEnvelope,
): Promise<ImportOutcome> {
  return walkBackupEnvelope(storage, envelope, false);
}

// Apply a parsed envelope to local storage, additively. Existing data is never
// overwritten. Returns per-category counts.
export async function importBackupEnvelope(
  storage: LocalAppStorage,
  envelope: ExportBackupEnvelope,
): Promise<ImportOutcome> {
  return walkBackupEnvelope(storage, envelope, true);
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

// Preview and apply share this single walker so the confirmed counts can never
// drift from the previewed ones: the only difference is whether writes happen.
async function walkBackupEnvelope(
  storage: LocalAppStorage,
  envelope: ExportBackupEnvelope,
  apply: boolean,
): Promise<ImportOutcome> {
  const outcome: ImportOutcome = {
    dayLogsAdded: 0,
    dayLogsSkipped: 0,
    dayLogsRejected: 0,
    symptomsAdded: 0,
    profileRestored: false,
  };

  outcome.profileRestored = await restorePristineProfile(
    storage,
    envelope.profile,
    apply,
  );

  outcome.symptomsAdded = await importCustomSymptoms(
    storage,
    envelope.symptoms,
    apply,
  );

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

    if (apply) {
      await storage.writeDayLogRecord(sanitized);
    }
    outcome.dayLogsAdded += 1;
  }

  return outcome;
}

// Restore the envelope's profile only while the on-device profile is still
// pristine. The pristine signal is a strict field-for-field comparison against
// createDefaultProfileRecord(): an onboarding-completed flag cannot serve here
// because onboarding always records a cycle-start date before the settings
// screen is reachable, so the flag is uniformly true at import time. Strict
// equality fails safe — any doubt reads as "user data present, keep it".
async function restorePristineProfile(
  storage: LocalAppStorage,
  candidate: unknown,
  apply: boolean,
): Promise<boolean> {
  const imported = sanitizeImportedProfileRecord(candidate);
  if (imported === null) {
    return false;
  }

  const defaults = createDefaultProfileRecord();
  if (profileFieldsEqual(imported, defaults)) {
    // The backup carries no non-default settings; writing it would change
    // nothing, so don't report a restore that didn't happen.
    return false;
  }

  const current = await storage.readProfileRecord();
  if (!profileFieldsEqual(current, defaults)) {
    return false;
  }

  if (apply) {
    await storage.writeProfileRecord(imported);
  }
  return true;
}

function profileFieldsEqual(left: ProfileRecord, right: ProfileRecord): boolean {
  // createDefaultProfileRecord() materializes every field, including the
  // optional ones, so its keys enumerate the full profile shape.
  const fields = Object.keys(
    createDefaultProfileRecord(),
  ) as (keyof ProfileRecord)[];
  return fields.every((field) => Object.is(left[field], right[field]));
}

// Collapse an untrusted envelope profile to a valid ProfileRecord, mirroring
// the day-log path: invalid values fall back to neutral defaults instead of
// failing the import. Reuses the same normalizers the settings save path
// applies, so an imported profile can't smuggle in out-of-range values.
function sanitizeImportedProfileRecord(candidate: unknown): ProfileRecord | null {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    return null;
  }

  const record = candidate as Partial<ProfileRecord>;
  const defaults = createDefaultProfileRecord();
  const lastPeriodStart =
    typeof record.lastPeriodStart === "string" &&
    parseLocalDate(record.lastPeriodStart)
      ? record.lastPeriodStart
      : null;

  return {
    lastPeriodStart,
    cycleLength: clampCycleLength(Number(record.cycleLength)),
    periodLength: clampPeriodLength(Number(record.periodLength)),
    autoPeriodFill:
      typeof record.autoPeriodFill === "boolean"
        ? record.autoPeriodFill
        : defaults.autoPeriodFill,
    irregularCycle: record.irregularCycle === true,
    unpredictableCycle: record.unpredictableCycle === true,
    ageGroup: normalizeAgeGroup(String(record.ageGroup ?? "")),
    usageGoal: normalizeUsageGoal(String(record.usageGoal ?? "")),
    trackBBT: record.trackBBT === true,
    temperatureUnit: normalizeTemperatureUnit(String(record.temperatureUnit ?? "")),
    trackCervicalMucus: record.trackCervicalMucus === true,
    hideSexChip: record.hideSexChip === true,
    hideNotes: record.hideNotes === true,
    hideCycleFactors: record.hideCycleFactors === true,
    showHistoricalPhases: record.showHistoricalPhases === true,
    dailyLogReminderEnabled: record.dailyLogReminderEnabled === true,
    upcomingPeriodReminderEnabled: record.upcomingPeriodReminderEnabled === true,
    fertileWindowReminderEnabled: record.fertileWindowReminderEnabled === true,
    managedReminderEmailsEnabled: record.managedReminderEmailsEnabled === true,
    reminderTime: normalizeReminderTime(String(record.reminderTime ?? "")),
    // Number(undefined) is NaN, so a backup predating the field lands on the
    // shared default the same way an out-of-range value does.
    reminderLeadDays: clampReminderLeadDays(Number(record.reminderLeadDays)),
    languageOverride: normalizeInterfaceLanguage(record.languageOverride),
    themeOverride: normalizeThemePreference(record.themeOverride),
    firstDayOfWeek: normalizeWeekStartDay(record.firstDayOfWeek),
    screenCaptureProtectionEnabled: resolveScreenCaptureProtectionEnabled(
      record.screenCaptureProtectionEnabled,
    ),
    dismissedCalendarPredictionNoticeKey: normalizeCalendarPredictionNoticeKey(
      record.dismissedCalendarPredictionNoticeKey,
    ),
    dismissedOnboardingHelperNoticeKey: normalizeOnboardingHelperNoticeKey(
      record.dismissedOnboardingHelperNoticeKey,
    ),
  };
}

async function importCustomSymptoms(
  storage: LocalAppStorage,
  symptoms: readonly SymptomRecord[] | undefined,
  apply: boolean,
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

    if (apply) {
      await storage.writeSymptomRecord(result.record);
    }
    existing = [...existing, result.record];
    added += 1;
  }

  return added;
}
