import { getRandomBytes } from "expo-crypto";

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
import { MAX_SYMPTOM_CATALOG_SIZE, type SymptomRecord } from "../models/symptom";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { MIN_DAY_LOG_DATE } from "./cycle-history-records";
import {
  repointStoredCycleStart,
  savedRowWithdrawsStoredCycleStart,
} from "./cycle-history-service";
import { sanitizeDayLogRecord } from "./day-log-policy";
import { repointLegacyStoredCycleStart } from "./stored-cycle-start-repoint-service";
import {
  areCycleDayRemindersEqual,
  normalizeCycleDayReminders,
} from "./cycle-day-reminder-policy";
import { createCustomSymptomRecord, normalizeSymptomLabelKey } from "./symptom-policy";
import {
  clampCycleLength,
  clampPeriodLength,
  clampReminderLeadDays,
  formatLocalDate,
  normalizeAgeGroup,
  normalizeCrisisContactName,
  normalizeCrisisContactPhone,
  normalizeReminderTime,
  normalizeTemperatureUnit,
  normalizeUsageGoal,
  parseLocalDate,
  sanitizeRestoredLastPeriodStart,
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
//     rather than failing the whole import. An imported day on the stored
//     cycle start's date that would withdraw it (spotting or an uncertain
//     cycle-start mark) repoints profile.lastPeriodStart in the same commit,
//     as saving that day in the editor does; no other profile field moves.
//   - custom symptoms: a symptom whose label already exists is skipped; a new
//     one is created only when at least one day referencing it is written.
//   - profile settings are restored ONLY while the device is still pristine
//     (profile field-for-field equal to createDefaultProfileRecord() and no
//     stored day log, i.e. no user-entered data yet). Any user-entered value —
//     even a language override — or any local day log blocks the profile
//     restore, so a restore can never clobber the user's current configuration
//     or reinterpret existing history.
//   - pregnancy records / kick-count sessions / contraction sessions (written
//     by formatVersion 2 and later exports; the parser reads these
//     collections under any accepted formatVersion and treats a missing one as
//     empty): each record is sanitized (an invalid one is
//     skipped, never fatal) and skipped whenever a record with the same
//     content already exists on-device. Every written record gets a fresh
//     random id: the id in the file is an untrusted string and never becomes
//     a storage key (none of these records reference one another, so there is
//     nothing to rewrite). Pregnancy records additionally honor the
//     one-active-pregnancy invariant: an incoming "active" record is skipped
//     whenever the device (or an earlier record from this same import) already
//     has an active record — never overwriting, ending, or throwing past it. A
//     file without these keys imports exactly as before.
//   - postpartum records / screening responses (written by formatVersion 3
//     exports; read under any accepted formatVersion like the collections above):
//     postpartum records mirror the pregnancy path exactly (sanitize-or-skip,
//     content dedup, fresh ids, ended-before-active ordering + the
//     one-active-postpartum invariant). Screening responses mirror the session
//     path (sanitize-or-skip, content dedup, fresh ids, no active concept); the
//     sanitizer RECOMPUTES score/selfHarmFlag
//     from the validated answer vector, so a drifted or tampered stored score
//     can never be imported as-is. A file without these keys imports exactly
//     as before.
//
// Individual bad records are counted, not fatal; only a structurally invalid
// file fails outright.

// Guardrail mirroring web's MaxImportEntries — bounds a hostile/oversized file.
export const MAX_IMPORT_DAY_LOGS = 20000;
// The symptom collection has no count cap of its own: an existing catalog over
// MAX_SYMPTOM_CATALOG_SIZE exports in full and imports with a warning (new
// symptoms past the limit are counted in symptomsOverLimit), and the byte cap
// on the file bounds its size.
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

export { MAX_IMPORT_FILE_BYTES } from "./import-limits";

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
  // record, a duplicate record, and an active-invariant conflict are all
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
  // collections: a structurally invalid record, a duplicate record, and (for
  // postpartum) an active-invariant conflict are all additive-merge skips.
  postpartumRecordsAdded: number;
  postpartumRecordsSkipped: number;
  screeningResponsesAdded: number;
  screeningResponsesSkipped: number;
  // New custom symptoms left out because the catalog reached
  // MAX_SYMPTOM_CATALOG_SIZE; their marks on imported days are dropped.
  symptomsOverLimit: number;
  // The restorable profile turns on at least one reminder. Reminders are
  // restored only on an explicit opt-in (ImportApplyOptions.restoreReminders).
  reminderSettingsAvailable: boolean;
};

export type ImportApplyOptions = {
  restoreReminders?: boolean;
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
  options: ImportApplyOptions = {},
): Promise<ImportOutcome> {
  return walkBackupEnvelope(storage, envelope, false, options);
}

// Apply a parsed envelope to local storage, additively. Existing data is never
// overwritten. Returns per-category counts.
export async function importBackupEnvelope(
  storage: LocalAppStorage,
  envelope: ExportBackupEnvelope,
  options: ImportApplyOptions = {},
): Promise<ImportOutcome> {
  const outcome = await walkBackupEnvelope(storage, envelope, true, options);
  if (outcome.profileRestored) {
    // A restored profile may come from an older client, which reads the stored
    // cycle start under the earlier withdrawal rule. A configured device keeps
    // its own profile; only an imported day on its stored start repoints it.
    // Best effort: an unversioned profile is retried at the next launch.
    try {
      await repointLegacyStoredCycleStart(storage, new Date());
    } catch {
      // Retried at the next launch.
    }
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

// Preview and apply share this single walker so the confirmed counts can never
// drift from the previewed ones: the only difference is whether writes happen.
async function walkBackupEnvelope(
  storage: LocalAppStorage,
  envelope: ExportBackupEnvelope,
  apply: boolean,
  options: ImportApplyOptions,
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
    symptomsOverLimit: 0,
    reminderSettingsAvailable: false,
  };

  const profileResult = await restorePristineProfile(
    storage,
    envelope.profile,
    apply,
    options.restoreReminders === true,
  );
  outcome.profileRestored = profileResult.restored;
  outcome.reminderSettingsAvailable = profileResult.reminderSettingsAvailable;

  const symptomImportResult = await importCustomSymptoms(
    storage,
    envelope.symptoms,
    apply,
  );
  const symptomIDMap = symptomImportResult.idMap;
  // A custom symptom is created only when a day that references it is
  // written, so a file whose referencing days are all skipped adds none.
  const pendingSymptoms = symptomImportResult.pending;
  // A pending symptom is written only while the catalog has room; one that
  // does not fit is dropped from every imported day that references it.
  let catalogSize = symptomImportResult.catalogSize;
  const symptomsOverLimit = new Set<string>();

  // The first record for a calendar date decides it; a later record repeating
  // that date is rejected (the web restore does the same). Tracking this in
  // the walker, not via storage reads, keeps the preview (which writes
  // nothing) and the apply (whose earlier writes are visible to later reads)
  // on the same decision.
  const seenDayLogDates = new Set<string>();
  const profileBeforeDayLogs = apply ? await storage.readProfileRecord() : null;
  let rowWithdrawingStoredStart: DayLogRecord | null = null;
  for (const rawRecord of envelope.dayLogs ?? []) {
    const record = rawRecord as Partial<DayLogRecord> | null;
    // Trimmed once, before the seen-set, the duplicate read and the write, so
    // a padded date addresses the same day as its canonical form.
    const date = typeof record?.date === "string" ? record.date.trim() : "";
    if (!parseLocalDate(date)) {
      // Unparseable / missing date: can't place it, so it's rejected.
      outcome.dayLogsRejected += 1;
      continue;
    }
    if (seenDayLogDates.has(date)) {
      outcome.dayLogsRejected += 1;
      continue;
    }
    seenDayLogDates.add(date);

    const existing = await storage.readDayLogRecord(date);
    if (hasDayLogData(existing)) {
      // Additive merge: never overwrite a day the user already has.
      outcome.dayLogsSkipped += 1;
      continue;
    }

    // Custom-symptom ids are re-minted on import (see importCustomSymptoms
    // above), so a day log's references to the file's ids must be remapped
    // to the new (or existing, on a label collision) local ids -- otherwise
    // every custom-symptom mark on this day silently vanishes the moment
    // filterKnownSymptomIDs runs against the real on-device records.
    const remappedSymptomIDs = remapImportedSymptomIDs(
      record?.symptomIDs,
      symptomIDMap,
    );
    const sanitizedWithAllSymptoms = sanitizeDayLogRecord({
      ...existing,
      ...(record as DayLogRecord),
      date,
      ...(remappedSymptomIDs !== undefined
        ? { symptomIDs: remappedSymptomIDs }
        : {}),
    });
    for (const symptomID of sanitizedWithAllSymptoms.symptomIDs) {
      if (pendingSymptoms.has(symptomID) && catalogSize >= MAX_SYMPTOM_CATALOG_SIZE) {
        pendingSymptoms.delete(symptomID);
        symptomsOverLimit.add(symptomID);
      }
    }
    const sanitized = {
      ...sanitizedWithAllSymptoms,
      symptomIDs: sanitizedWithAllSymptoms.symptomIDs.filter(
        (symptomID) => !symptomsOverLimit.has(symptomID),
      ),
    };
    if (!hasDayLogData(sanitized)) {
      // Nothing meaningful to restore for this date after sanitizing.
      outcome.dayLogsSkipped += 1;
      continue;
    }

    for (const symptomID of sanitized.symptomIDs) {
      const pendingSymptom = pendingSymptoms.get(symptomID);
      if (!pendingSymptom) {
        continue;
      }
      pendingSymptoms.delete(symptomID);
      if (apply) {
        await storage.writeSymptomRecord(pendingSymptom);
      }
      catalogSize += 1;
      outcome.symptomsAdded += 1;
    }

    if (
      profileBeforeDayLogs?.lastPeriodStart === date &&
      savedRowWithdrawsStoredCycleStart(sanitized, null)
    ) {
      rowWithdrawingStoredStart = sanitized;
    } else if (apply) {
      await storage.writeDayLogRecord(sanitized);
    }
    outcome.dayLogsAdded += 1;
  }
  outcome.symptomsOverLimit = symptomsOverLimit.size;
  if (profileBeforeDayLogs && rowWithdrawingStoredStart) {
    await commitRowWithdrawingStoredStart(
      storage,
      profileBeforeDayLogs,
      rowWithdrawingStoredStart,
    );
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
  const seen = new Set(existing.map(contentFingerprint));
  let hasActive = existing.some((record) => record.status === "active");

  let added = 0;
  for (const sanitizedRecord of sanitized) {
    const fingerprint = contentFingerprint(sanitizedRecord);
    if (seen.has(fingerprint)) {
      // Additive merge: never duplicate a record already on this device (also
      // catches a record repeated within the same import file).
      skipped += 1;
      continue;
    }

    if (sanitizedRecord.status === "active" && hasActive) {
      // One-active-pregnancy invariant: skip rather than overwrite, end, or
      // let the storage layer's own guard throw past this item.
      skipped += 1;
      continue;
    }

    if (apply) {
      await storage.writePregnancyRecord({
        ...sanitizedRecord,
        id: mintImportedRecordID("pregnancy"),
      });
    }
    seen.add(fingerprint);
    if (sanitizedRecord.status === "active") {
      hasActive = true;
    }
    added += 1;
  }

  return { added, skipped };
}

function pregnancyStatusOrder(status: PregnancyStatus): number {
  return status === "ended" ? 0 : 1;
}

// Additive merge for kick-count sessions: sanitize (invalid → skipped), then
// skip a session whose content already exists on-device (also catches one
// repeated within the same import file). No active-invariant concern here,
// unlike importPregnancyRecords above. storage.listKickSessions() is called
// with no from/to arguments, which every adapter treats as "unranged" (see
// isDayInRange), so the duplicate check covers the device's full history, not
// just the selected export's date window.
async function importKickSessions(
  storage: LocalAppStorage,
  rawSessions: readonly unknown[] | undefined,
  apply: boolean,
): Promise<{ added: number; skipped: number }> {
  if (!rawSessions || rawSessions.length === 0) {
    return { added: 0, skipped: 0 };
  }

  const existing = await storage.listKickSessions();
  const seen = new Set(existing.map(contentFingerprint));

  let added = 0;
  let skipped = 0;
  for (const raw of rawSessions) {
    const session = sanitizeKickCountSession(raw);
    const fingerprint = session ? contentFingerprint(session) : null;
    if (!session || fingerprint === null || seen.has(fingerprint)) {
      skipped += 1;
      continue;
    }

    if (apply) {
      await storage.writeKickSession({ ...session, id: mintImportedRecordID("kick") });
    }
    seen.add(fingerprint);
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
  const seen = new Set(existing.map(contentFingerprint));

  let added = 0;
  let skipped = 0;
  for (const raw of rawSessions) {
    const session = sanitizeContractionSession(raw);
    const fingerprint = session ? contentFingerprint(session) : null;
    if (!session || fingerprint === null || seen.has(fingerprint)) {
      skipped += 1;
      continue;
    }

    if (apply) {
      await storage.writeContractionSession({
        ...session,
        id: mintImportedRecordID("contraction"),
      });
    }
    seen.add(fingerprint);
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
// one just added earlier in this same import). A record whose content already
// exists is skipped; a second concurrent active record is skipped rather than
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
  const seen = new Set(existing.map(contentFingerprint));
  let hasActive = existing.some((record) => record.status === "active");

  let added = 0;
  for (const sanitizedRecord of sanitized) {
    const fingerprint = contentFingerprint(sanitizedRecord);
    if (seen.has(fingerprint)) {
      // Additive merge: never duplicate a record already on this device (also
      // catches a record repeated within the same import file).
      skipped += 1;
      continue;
    }

    if (sanitizedRecord.status === "active" && hasActive) {
      // One-active-postpartum invariant: skip rather than overwrite, end, or
      // let the storage layer's own guard throw past this item.
      skipped += 1;
      continue;
    }

    if (apply) {
      await storage.writePostpartumRecord({
        ...sanitizedRecord,
        id: mintImportedRecordID("postpartum"),
      });
    }
    seen.add(fingerprint);
    if (sanitizedRecord.status === "active") {
      hasActive = true;
    }
    added += 1;
  }

  return { added, skipped };
}

function postpartumStatusOrder(status: PostpartumStatus): number {
  return status === "ended" ? 0 : 1;
}

// Additive merge for screening responses: sanitize (invalid → skipped), then
// skip a response whose content already exists on-device (also catches one
// repeated within the same file). No active-invariant concern — a screening history is
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
  const seen = new Set(existing.map(contentFingerprint));

  let added = 0;
  let skipped = 0;
  for (const raw of rawResponses) {
    const response = sanitizeScreeningResponse(raw);
    const fingerprint = response ? contentFingerprint(response) : null;
    if (!response || fingerprint === null || seen.has(fingerprint)) {
      skipped += 1;
      continue;
    }

    if (apply) {
      await storage.writeScreeningResponse({
        ...response,
        id: mintImportedRecordID("screening"),
      });
    }
    seen.add(fingerprint);
    added += 1;
  }

  return { added, skipped };
}

// Restore the envelope's profile only while the device is still pristine: the
// on-device profile is field-for-field equal to createDefaultProfileRecord()
// AND no day log is stored. An onboarding-completed flag cannot serve here
// because onboarding always records a cycle-start date before the settings
// screen is reachable, so the flag is uniformly true at import time. Strict
// equality fails safe — any doubt reads as "user data present, keep it".
// Day logs are the only other data counted: the profile holds the cycle
// configuration that history is read against, whereas custom symptoms are
// vocabulary and pregnancy, session and screening records carry their own
// dates and ids and never read the restored cycle fields.
// Written after every other imported day, so the repoint reads them all; the
// row and the repointed start land as one unit, as an editor save does.
async function commitRowWithdrawingStoredStart(
  storage: LocalAppStorage,
  profile: ProfileRecord,
  row: DayLogRecord,
): Promise<void> {
  const todayValue = formatLocalDate(new Date());
  const storedRecords = await storage.listDayLogRecordsInRange(MIN_DAY_LOG_DATE, todayValue);
  const mergedRecords = [...storedRecords.filter((record) => record.date !== row.date), row];
  await storage.commitDayLogChanges({
    writes: [row],
    deletes: [],
    profile: {
      ...profile,
      lastPeriodStart: repointStoredCycleStart(profile, mergedRecords, todayValue),
    },
  });
}

async function restorePristineProfile(
  storage: LocalAppStorage,
  candidate: unknown,
  apply: boolean,
  restoreReminders: boolean,
): Promise<{ restored: boolean; reminderSettingsAvailable: boolean }> {
  const notRestored = { restored: false, reminderSettingsAvailable: false };
  const sanitized = sanitizeImportedProfileRecord(candidate);
  if (sanitized === null) {
    return notRestored;
  }

  const defaults = createDefaultProfileRecord();
  const withReminders = applyImportedDeviceSettingRules(sanitized, defaults, true);
  if (profileFieldsEqual(withReminders, defaults)) {
    // The backup carries no non-default settings; writing it would change
    // nothing, so don't report a restore that didn't happen.
    return notRestored;
  }

  const current = await storage.readProfileRecord();
  if (!profileFieldsEqual(current, defaults)) {
    return notRestored;
  }

  // A default profile under existing day logs is not an empty device: the
  // restored cycle start and lengths would reinterpret that history. The
  // check precedes any write of the walk, so preview and apply read the same
  // answer.
  const localLogs = await storage.readDayLogSummary();
  if (localLogs.totalEntries > 0) {
    return notRestored;
  }

  const withoutReminders = applyImportedDeviceSettingRules(sanitized, defaults, false);
  const reminderSettingsAvailable = !profileFieldsEqual(withReminders, withoutReminders);
  const imported = restoreReminders ? withReminders : withoutReminders;
  if (profileFieldsEqual(imported, defaults)) {
    return { restored: false, reminderSettingsAvailable };
  }

  if (apply) {
    await storage.writeProfileRecord(imported);
  }
  return { restored: true, reminderSettingsAvailable };
}

// Device settings a backup must not change silently: screen-capture
// protection can only be turned on by an import, never off, and the reminder
// switches and rules are restored only on the preview's explicit opt-in. The
// restore runs on a pristine device only, so the defaults stand in for its
// current values.
function applyImportedDeviceSettingRules(
  imported: ProfileRecord,
  defaults: ProfileRecord,
  restoreReminders: boolean,
): ProfileRecord {
  const screenCaptureProtectionEnabled =
    imported.screenCaptureProtectionEnabled === true ||
    defaults.screenCaptureProtectionEnabled === true;
  if (restoreReminders) {
    return { ...imported, screenCaptureProtectionEnabled };
  }
  return {
    ...imported,
    screenCaptureProtectionEnabled,
    dailyLogReminderEnabled: defaults.dailyLogReminderEnabled === true,
    upcomingPeriodReminderEnabled: defaults.upcomingPeriodReminderEnabled === true,
    fertileWindowReminderEnabled: defaults.fertileWindowReminderEnabled === true,
    kickCountReminderEnabled: defaults.kickCountReminderEnabled === true,
    cycleDayReminders: defaults.cycleDayReminders ?? [],
  };
}

function profileFieldsEqual(left: ProfileRecord, right: ProfileRecord): boolean {
  // createDefaultProfileRecord() materializes every field, including the
  // optional ones, so its keys enumerate the full profile shape.
  const fields = Object.keys(
    createDefaultProfileRecord(),
  ) as (keyof ProfileRecord)[];
  return fields.every((field) => {
    // The rule list is a fresh array on every read, so it is compared by
    // content; every other field is a primitive.
    if (field === "cycleDayReminders") {
      return areCycleDayRemindersEqual(
        normalizeCycleDayReminders(left.cycleDayReminders),
        normalizeCycleDayReminders(right.cycleDayReminders),
      );
    }
    return Object.is(left[field], right[field]);
  });
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
  const lastPeriodStart = sanitizeRestoredLastPeriodStart(record.lastPeriodStart);

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
    // Untrusted rule list: bounded, invalid rules dropped, ids and labels
    // re-validated, never copied through as received. A file cannot opt a label
    // onto this device's lock screen: showLabel is re-chosen in Settings.
    cycleDayReminders: normalizeCycleDayReminders(record.cycleDayReminders).map(
      (rule) => ({ ...rule, showLabel: false }),
    ),
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
): Promise<{
  pending: Map<string, SymptomRecord>;
  idMap: Map<string, string>;
  catalogSize: number;
}> {
  // Valid new custom symptoms keyed by their freshly minted id, not yet
  // written; see the walker for when one is committed.
  const pending = new Map<string, SymptomRecord>();
  // Maps each portable symptom's id AS WRITTEN IN THE FILE to the id it
  // resolves to on this device: the freshly minted id for a new record, or
  // the EXISTING local record's id when the label already exists (see
  // below). Built-in ids never need an entry -- they are stable constants
  // shared by every install, so a day log referencing one already resolves.
  const idMap = new Map<string, string>();
  if (!symptoms || symptoms.length === 0) {
    return { pending, idMap, catalogSize: 0 };
  }

  let existing = await storage.listSymptomRecords();
  const catalogSize = existing.length;

  for (const rawSymptom of symptoms) {
    const record = rawSymptom as Partial<SymptomRecord> | null;
    // Only user-created symptoms are portable; the built-in catalog is seeded
    // locally and must not be duplicated.
    if (record?.isDefault === true) {
      continue;
    }
    const label = typeof record?.label === "string" ? record.label : "";
    const originalID = typeof record?.id === "string" ? record.id.trim() : "";

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
      // A label collision means this symptom already lives on-device under a
      // different id: a day log elsewhere in the same backup that references
      // the file's id must resolve to that EXISTING record, not a dropped one.
      if (result.errorCode === "duplicate_label" && originalID) {
        const existingMatch = existing.find(
          (candidate) =>
            normalizeSymptomLabelKey(candidate.label) ===
            normalizeSymptomLabelKey(label),
        );
        if (existingMatch) {
          idMap.set(originalID, existingMatch.id);
        }
      }
      continue;
    }

    if (originalID) {
      idMap.set(originalID, result.record.id);
    }

    // Held back, not written: the walker commits a symptom only once a day
    // that references it is actually written.
    pending.set(result.record.id, result.record);
    existing = [...existing, result.record];
  }

  return { pending, idMap, catalogSize };
}

// Applies the old-id -> new-id map built by importCustomSymptoms to one day
// log's imported symptomIDs. Returns undefined ("no override") for anything
// that isn't an array, so a missing/malformed field falls through to its
// existing pass-through behavior unchanged. An id with no map entry
// (built-in, or a symptom that failed to import and was dropped) is left as
// written -- it is then caught the same way it always was, by
// filterKnownSymptomIDs at read time.
function remapImportedSymptomIDs(
  rawValue: DayLogRecord["symptomIDs"] | undefined,
  idMap: ReadonlyMap<string, string>,
): DayLogRecord["symptomIDs"] | undefined {
  if (!Array.isArray(rawValue)) {
    return undefined;
  }

  // The file is untrusted: a non-string element (number, null, object) is
  // dropped on its own, the day's other ids and fields still import. Strings
  // are passed through as-is when the map has nothing for them.
  return rawValue
    .filter((value): value is string => typeof value === "string")
    .map((value) => idMap.get(value.trim()) ?? value);
}

type ImportedRecordKind =
  | "pregnancy"
  | "kick"
  | "contraction"
  | "postpartum"
  | "screening";

function mintImportedRecordID(kind: ImportedRecordKind): string {
  return `${kind}_${createRandomUUIDv4()}`;
}

function createRandomUUIDv4(): string {
  const bytes = getRandomBytes(16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Identity of an imported record for the additive merge: every field except
// the id, which is re-minted on write and so cannot recognize a repeat import.
function contentFingerprint(record: { id: string }): string {
  const fields: Record<string, unknown> = { ...record };
  delete fields.id;
  return stableStringify(fields);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
