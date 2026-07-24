import type { ExportBackupEnvelope } from "../models/export";
import { hasDayLogData, type DayLogRecord } from "../models/day-log";
import {
  sanitizeContractionSession,
  sanitizeKickCountSession,
  sanitizePregnancyRecord,
  type ContractionSession,
  type KickCountSession,
  type PregnancyRecord,
  type PregnancyStatus,
} from "../models/pregnancy";
import {
  sanitizePostpartumRecord,
  type PostpartumRecord,
  type PostpartumStatus,
} from "../models/postpartum";
import {
  sanitizeScreeningResponse,
  type ScreeningResponse,
} from "../models/screening";
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
  normalizeCrisisContactName,
  normalizeCrisisContactPhone,
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
//   - pregnancy records / kick-count sessions / contraction sessions (
//     formatVersion 2 only): each record is sanitized (an invalid one is
//     skipped, never fatal) and skipped whenever its id already exists
//     on-device. Pregnancy records additionally honor the one-active-pregnancy
//     invariant: an incoming "active" record is skipped whenever the device
//     (or an earlier record from this same import) already has a DIFFERENT
//     active record — never overwriting, ending, or throwing past it. A
//     formatVersion 1 file never carries these keys, so it imports exactly as
//     before.
//   - postpartum records / screening responses (formatVersion 3 only):
//     postpartum records mirror the pregnancy path exactly (sanitize-or-skip,
//     id-dedup, ended-before-active ordering + the one-active-postpartum
//     invariant). Screening responses mirror the session path (sanitize-or-skip,
//     id-dedup, no active concept); the sanitizer RECOMPUTES score/selfHarmFlag
//     from the validated answer vector, so a drifted or tampered stored score
//     can never be imported as-is. A formatVersion 1/2 file never carries these
//     keys, so it imports exactly as before.
//
// Individual bad records are counted, not fatal; only a structurally invalid
// file fails outright.

// Guardrail mirroring web's MaxImportEntries — bounds a hostile/oversized file.
export const MAX_IMPORT_DAY_LOGS = 20000;
export const MAX_IMPORT_SYMPTOMS = 200;
// Pregnancy records are a handful per lifetime at most; kick/contraction
// sessions are daily-at-most like day logs, so they share that bound.
export const MAX_IMPORT_PREGNANCIES = 200;
export const MAX_IMPORT_KICK_SESSIONS = 20000;
export const MAX_IMPORT_CONTRACTION_SESSIONS = 20000;
// Postpartum records are a handful per lifetime like pregnancies; screening
// responses accumulate slowly (a gentle 14-day cadence floor) but share the
// generous day-log-scale bound as defense against a hostile/oversized file.
export const MAX_IMPORT_POSTPARTUM_RECORDS = 200;
export const MAX_IMPORT_SCREENING_RESPONSES = 20000;

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
  // Pregnancy-mode collections (v2 only; always 0 for a v1 file). Unlike
  // dayLogs there is no separate "rejected" bucket: a structurally invalid
  // record, a duplicate id, and an active-invariant conflict are all
  // additive-merge skips from the user's point of view (nothing changed on
  // device), so they share one "skipped" counter per collection.
  pregnanciesAdded: number;
  pregnanciesSkipped: number;
  kickSessionsAdded: number;
  kickSessionsSkipped: number;
  contractionSessionsAdded: number;
  contractionSessionsSkipped: number;
  // Postpartum records / screening responses (v3 only; always 0 for a
  // v1/v2 file). Same one-"skipped"-bucket convention as the pregnancy
  // collections: a structurally invalid record, a duplicate id, and (for
  // postpartum) an active-invariant conflict are all additive-merge skips.
  postpartumRecordsAdded: number;
  postpartumRecordsSkipped: number;
  screeningResponsesAdded: number;
  screeningResponsesSkipped: number;
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
  if (
    candidate.app !== "ovumcy" ||
    (candidate.formatVersion !== 1 &&
      candidate.formatVersion !== 2 &&
      candidate.formatVersion !== 3)
  ) {
    return { ok: false, errorCode: "unrecognized_format" };
  }

  const dayLogs = Array.isArray(candidate.dayLogs) ? candidate.dayLogs : [];
  const symptoms = Array.isArray(candidate.symptoms) ? candidate.symptoms : [];
  // A v1/v2 file never has the newer keys, so they default to [] the same way
  // dayLogs/symptoms do on a minimal envelope — no version branch needed.
  const pregnancies = Array.isArray(candidate.pregnancies)
    ? candidate.pregnancies
    : [];
  const kickSessions = Array.isArray(candidate.kickSessions)
    ? candidate.kickSessions
    : [];
  const contractionSessions = Array.isArray(candidate.contractionSessions)
    ? candidate.contractionSessions
    : [];
  const postpartumRecords = Array.isArray(candidate.postpartumRecords)
    ? candidate.postpartumRecords
    : [];
  const screeningResponses = Array.isArray(candidate.screeningResponses)
    ? candidate.screeningResponses
    : [];
  if (
    dayLogs.length > MAX_IMPORT_DAY_LOGS ||
    symptoms.length > MAX_IMPORT_SYMPTOMS ||
    pregnancies.length > MAX_IMPORT_PREGNANCIES ||
    kickSessions.length > MAX_IMPORT_KICK_SESSIONS ||
    contractionSessions.length > MAX_IMPORT_CONTRACTION_SESSIONS ||
    postpartumRecords.length > MAX_IMPORT_POSTPARTUM_RECORDS ||
    screeningResponses.length > MAX_IMPORT_SCREENING_RESPONSES
  ) {
    return { ok: false, errorCode: "too_large" };
  }

  // Coerce to the envelope shape; per-record validity is handled additively at
  // apply time, so we only guarantee the collections are arrays here.
  const envelope = {
    ...(candidate as unknown as ExportBackupEnvelope),
    dayLogs: dayLogs as DayLogRecord[],
    symptoms: symptoms as SymptomRecord[],
    pregnancies: pregnancies as PregnancyRecord[],
    kickSessions: kickSessions as KickCountSession[],
    contractionSessions: contractionSessions as ContractionSession[],
    postpartumRecords: postpartumRecords as PostpartumRecord[],
    screeningResponses: screeningResponses as ScreeningResponse[],
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
    pregnanciesAdded: 0,
    pregnanciesSkipped: 0,
    kickSessionsAdded: 0,
    kickSessionsSkipped: 0,
    contractionSessionsAdded: 0,
    contractionSessionsSkipped: 0,
    postpartumRecordsAdded: 0,
    postpartumRecordsSkipped: 0,
    screeningResponsesAdded: 0,
    screeningResponsesSkipped: 0,
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

  const pregnancyResult = await importPregnancyRecords(
    storage,
    envelope.pregnancies,
    apply,
  );
  outcome.pregnanciesAdded = pregnancyResult.added;
  outcome.pregnanciesSkipped = pregnancyResult.skipped;

  const kickSessionResult = await importKickSessions(
    storage,
    envelope.kickSessions,
    apply,
  );
  outcome.kickSessionsAdded = kickSessionResult.added;
  outcome.kickSessionsSkipped = kickSessionResult.skipped;

  const contractionSessionResult = await importContractionSessions(
    storage,
    envelope.contractionSessions,
    apply,
  );
  outcome.contractionSessionsAdded = contractionSessionResult.added;
  outcome.contractionSessionsSkipped = contractionSessionResult.skipped;

  const postpartumResult = await importPostpartumRecords(
    storage,
    envelope.postpartumRecords,
    apply,
  );
  outcome.postpartumRecordsAdded = postpartumResult.added;
  outcome.postpartumRecordsSkipped = postpartumResult.skipped;

  const screeningResult = await importScreeningResponses(
    storage,
    envelope.screeningResponses,
    apply,
  );
  outcome.screeningResponsesAdded = screeningResult.added;
  outcome.screeningResponsesSkipped = screeningResult.skipped;

  return outcome;
}

// Additive merge for pregnancy records, honoring the one-active-pregnancy
// invariant WITHOUT ever calling storage.writePregnancyRecord for a record
// that would trip it (the storage layer itself throws on that write — see
// pregnancy-mode-service.ts's startPregnancy/endPregnancy — but relying on a
// thrown exception here would abort the whole import instead of skipping
// just that one item, which the task explicitly rules out: "never throw past
// the item"). Records are sanitized once, then processed ended-before-active
// so the resolution is deterministic regardless of the incoming array order:
// ended records can never conflict with the invariant, so they always apply
// first; only then are incoming active records tested against whichever
// record is active at that point (the pre-existing device record, or one
// just added earlier in this same import).
async function importPregnancyRecords(
  storage: LocalAppStorage,
  rawRecords: readonly unknown[] | undefined,
  apply: boolean,
): Promise<{ added: number; skipped: number }> {
  if (!rawRecords || rawRecords.length === 0) {
    return { added: 0, skipped: 0 };
  }

  let skipped = 0;
  const sanitized: PregnancyRecord[] = [];
  for (const raw of rawRecords) {
    const record = sanitizePregnancyRecord(raw);
    if (!record) {
      skipped += 1;
      continue;
    }
    sanitized.push(record);
  }

  // Array.prototype.sort is stable (ES2019+), so within each status group
  // the original relative order is preserved.
  sanitized.sort(
    (left, right) => pregnancyStatusOrder(left.status) - pregnancyStatusOrder(right.status),
  );

  const existing = await storage.listPregnancyRecords();
  const seenIDs = new Set(existing.map((record) => record.id));
  let activeID =
    existing.find((record) => record.status === "active")?.id ?? null;

  let added = 0;
  for (const record of sanitized) {
    if (seenIDs.has(record.id)) {
      // Additive merge: never overwrite a record already on this device (also
      // catches a duplicate id repeated within the same import file).
      skipped += 1;
      continue;
    }

    if (record.status === "active" && activeID !== null && activeID !== record.id) {
      // One-active-pregnancy invariant: skip rather than overwrite, end, or
      // let the storage layer's own guard throw past this item.
      skipped += 1;
      continue;
    }

    if (apply) {
      await storage.writePregnancyRecord(record);
    }
    seenIDs.add(record.id);
    if (record.status === "active") {
      activeID = record.id;
    }
    added += 1;
  }

  return { added, skipped };
}

function pregnancyStatusOrder(status: PregnancyStatus): number {
  return status === "ended" ? 0 : 1;
}

// Additive merge for kick-count sessions: sanitize (invalid → skipped), then
// skip an id that already exists on-device (also catches a duplicate id
// repeated within the same import file). No active-invariant concern here,
// unlike importPregnancyRecords above. storage.listKickSessions() is called
// with no from/to arguments, which every adapter treats as "unranged" (see
// isDayInRange), so id-existence is checked against the device's full
// history, not just the selected export's date window.
async function importKickSessions(
  storage: LocalAppStorage,
  rawSessions: readonly unknown[] | undefined,
  apply: boolean,
): Promise<{ added: number; skipped: number }> {
  if (!rawSessions || rawSessions.length === 0) {
    return { added: 0, skipped: 0 };
  }

  const existing = await storage.listKickSessions();
  const seenIDs = new Set(existing.map((session) => session.id));

  let added = 0;
  let skipped = 0;
  for (const raw of rawSessions) {
    const session = sanitizeKickCountSession(raw);
    if (!session || seenIDs.has(session.id)) {
      skipped += 1;
      continue;
    }

    if (apply) {
      await storage.writeKickSession(session);
    }
    seenIDs.add(session.id);
    added += 1;
  }

  return { added, skipped };
}

// Additive merge for contraction sessions — identical shape to
// importKickSessions above (id-keyed, no active-invariant concern), kept as
// its own function rather than a generic helper so each stays a plain,
// directly-readable walk over its own storage methods.
async function importContractionSessions(
  storage: LocalAppStorage,
  rawSessions: readonly unknown[] | undefined,
  apply: boolean,
): Promise<{ added: number; skipped: number }> {
  if (!rawSessions || rawSessions.length === 0) {
    return { added: 0, skipped: 0 };
  }

  const existing = await storage.listContractionSessions();
  const seenIDs = new Set(existing.map((session) => session.id));

  let added = 0;
  let skipped = 0;
  for (const raw of rawSessions) {
    const session = sanitizeContractionSession(raw);
    if (!session || seenIDs.has(session.id)) {
      skipped += 1;
      continue;
    }

    if (apply) {
      await storage.writeContractionSession(session);
    }
    seenIDs.add(session.id);
    added += 1;
  }

  return { added, skipped };
}

// Additive merge for postpartum records — mirrors importPregnancyRecords
// EXACTLY, because postpartum carries the same one-active invariant (see
// postpartum.ts hasActivePostpartum / the storage writePostpartumRecord guard):
// sanitize once, process ended-before-active so resolution is deterministic
// regardless of incoming array order (ended records can never conflict, so they
// always apply first; only then are incoming active records tested against
// whichever record is active at that point — the pre-existing device record or
// one just added earlier in this same import). A record whose id already exists
// is skipped; a second concurrent active record is skipped rather than
// overwriting, ending, or letting the storage guard throw past the item.
async function importPostpartumRecords(
  storage: LocalAppStorage,
  rawRecords: readonly unknown[] | undefined,
  apply: boolean,
): Promise<{ added: number; skipped: number }> {
  if (!rawRecords || rawRecords.length === 0) {
    return { added: 0, skipped: 0 };
  }

  let skipped = 0;
  const sanitized: PostpartumRecord[] = [];
  for (const raw of rawRecords) {
    const record = sanitizePostpartumRecord(raw);
    if (!record) {
      skipped += 1;
      continue;
    }
    sanitized.push(record);
  }

  // Array.prototype.sort is stable (ES2019+), so within each status group
  // the original relative order is preserved.
  sanitized.sort(
    (left, right) =>
      postpartumStatusOrder(left.status) - postpartumStatusOrder(right.status),
  );

  const existing = await storage.listPostpartumRecords();
  const seenIDs = new Set(existing.map((record) => record.id));
  let activeID =
    existing.find((record) => record.status === "active")?.id ?? null;

  let added = 0;
  for (const record of sanitized) {
    if (seenIDs.has(record.id)) {
      // Additive merge: never overwrite a record already on this device (also
      // catches a duplicate id repeated within the same import file).
      skipped += 1;
      continue;
    }

    if (record.status === "active" && activeID !== null && activeID !== record.id) {
      // One-active-postpartum invariant: skip rather than overwrite, end, or
      // let the storage layer's own guard throw past this item.
      skipped += 1;
      continue;
    }

    if (apply) {
      await storage.writePostpartumRecord(record);
    }
    seenIDs.add(record.id);
    if (record.status === "active") {
      activeID = record.id;
    }
    added += 1;
  }

  return { added, skipped };
}

function postpartumStatusOrder(status: PostpartumStatus): number {
  return status === "ended" ? 0 : 1;
}

// Additive merge for screening responses: sanitize (invalid → skipped), then
// skip an id that already exists on-device (also catches a duplicate id within
// the same file). No active-invariant concern — a screening history is
// append-only. sanitizeScreeningResponse RECOMPUTES score/selfHarmFlag from the
// validated answer vector, so an imported response can never carry a stored
// score that disagrees with its answers (a falsely-reassuring number is exactly
// what this most-sensitive class must never surface). Kept as its own function,
// mirroring importKickSessions, rather than a generic helper.
async function importScreeningResponses(
  storage: LocalAppStorage,
  rawResponses: readonly unknown[] | undefined,
  apply: boolean,
): Promise<{ added: number; skipped: number }> {
  if (!rawResponses || rawResponses.length === 0) {
    return { added: 0, skipped: 0 };
  }

  const existing = await storage.listScreeningResponses();
  const seenIDs = new Set(existing.map((response) => response.id));

  let added = 0;
  let skipped = 0;
  for (const raw of rawResponses) {
    const response = sanitizeScreeningResponse(raw);
    if (!response || seenIDs.has(response.id)) {
      skipped += 1;
      continue;
    }

    if (apply) {
      await storage.writeScreeningResponse(response);
    }
    seenIDs.add(response.id);
    added += 1;
  }

  return { added, skipped };
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
    kickCountReminderEnabled: record.kickCountReminderEnabled === true,
    // Personal crisis-support contact — additive optional strings,
    // absent-tolerant (a backup predating the fields lands on "" via the
    // normalizer's non-string guard), trimmed + length-capped like every other
    // imported profile value so an oversized/hostile field can't smuggle in.
    crisisContactName: normalizeCrisisContactName(record.crisisContactName),
    crisisContactPhone: normalizeCrisisContactPhone(record.crisisContactPhone),
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
