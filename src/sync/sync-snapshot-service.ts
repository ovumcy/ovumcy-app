import type { DayLogRecord } from "../models/day-log";
import {
  sanitizeContractionSession,
  sanitizeKickCountSession,
  sanitizePregnancyRecord,
  type ContractionSession,
  type KickCountSession,
  type PregnancyRecord,
} from "../models/pregnancy";
import {
  sanitizePostpartumRecord,
  type PostpartumRecord,
} from "../models/postpartum";
import {
  sanitizeScreeningResponse,
  type ScreeningResponse,
} from "../models/screening";
import type { ProfileRecord } from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import type {
  LocalAppStorage,
  LocalBootstrapState,
} from "../storage/local/storage-contract";
import { normalizeCycleDayReminders } from "../services/cycle-day-reminder-policy";
import type { LocalReminderScheduler } from "../services/local-reminder-scheduler-contract";
import { rebuildLocalReminderScheduleFromStorage } from "../services/local-reminder-sync-service";
import { createPlatformLocalReminderScheduler } from "../services/platform-local-reminder-scheduler";
import { sanitizeRestoredLastPeriodStart } from "../services/profile-settings-policy";
import {
  repointLegacyStoredCycleStart,
  withoutStoredCycleStartRepointState,
} from "../services/stored-cycle-start-repoint-service";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "./sync-contract";

export const SYNC_SNAPSHOT_SCHEMA_VERSION = 3;

// Legacy schema versions accepted for backward-compatible decode ONLY, never
// produced on encode. A v1 snapshot predates pregnancy-mode (the three
// pregnancy collections default to []); a v2 snapshot predates postpartum +
// screening (those two collections default to []). Decode upgrades either to
// the current v3 shape.
const SYNC_SNAPSHOT_SCHEMA_VERSION_V1 = 1;
const SYNC_SNAPSHOT_SCHEMA_VERSION_V2 = 2;

export type SyncSnapshotV3 = {
  schemaVersion: typeof SYNC_SNAPSHOT_SCHEMA_VERSION;
  createdAt: string;
  bootstrapState: LocalBootstrapState;
  profile: ProfileRecord;
  symptomRecords: SymptomRecord[];
  dayLogs: DayLogRecord[];
  pregnancies: PregnancyRecord[];
  kickSessions: KickCountSession[];
  contractionSessions: ContractionSession[];
  // Postpartum + EPDS mood-screening collections. Always present on encode
  // (possibly empty). A legacy v1/v2 snapshot decodes with these defaulted to
  // []. Screening answers are the most sensitive class in the product; they
  // travel here only inside the already-encrypted sync payload, never in
  // plaintext transport metadata.
  postpartumRecords: PostpartumRecord[];
  screeningResponses: ScreeningResponse[];
};

// Loosely-typed view of a decoded payload: schemaVersion widened to `number`
// so every accepted version (and any rejected one) can be compared without a
// literal-type mismatch, before the shape is validated and narrowed.
type EncodedSnapshotShape = Omit<Partial<SyncSnapshotV3>, "schemaVersion"> & {
  schemaVersion?: number;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export async function buildSyncSnapshot(
  storage: LocalAppStorage,
  now: Date,
): Promise<SyncSnapshotV3> {
  const [
    bootstrapState,
    profile,
    symptomRecords,
    dayLogSummary,
    pregnancies,
    kickSessions,
    contractionSessions,
    postpartumRecords,
    screeningResponses,
  ] = await Promise.all([
    storage.readBootstrapState(),
    storage.readProfileRecord(),
    storage.listSymptomRecords(),
    storage.readDayLogSummary(),
    storage.listPregnancyRecords(),
    storage.listKickSessions(),
    storage.listContractionSessions(),
    storage.listPostpartumRecords(),
    storage.listScreeningResponses(),
  ]);

  const dayLogs =
    dayLogSummary.hasData && dayLogSummary.dateFrom && dayLogSummary.dateTo
      ? await storage.listDayLogRecordsInRange(
          dayLogSummary.dateFrom,
          dayLogSummary.dateTo,
        )
      : [];

  return {
    schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
    createdAt: now.toISOString(),
    bootstrapState,
    profile: withoutStoredCycleStartRepointState(profile),
    symptomRecords,
    dayLogs,
    pregnancies,
    kickSessions,
    contractionSessions,
    postpartumRecords,
    screeningResponses,
  };
}

export function encodeSyncSnapshot(snapshot: SyncSnapshotV3): Uint8Array {
  return textEncoder.encode(JSON.stringify(snapshot));
}

export function decodeSyncSnapshot(payload: Uint8Array): SyncSnapshotV3 {
  const parsed = JSON.parse(textDecoder.decode(payload)) as EncodedSnapshotShape;

  // Shape shared by every accepted version — mirrors the original v1 gate.
  if (
    !parsed?.bootstrapState ||
    !parsed.profile ||
    !Array.isArray(parsed.symptomRecords) ||
    !Array.isArray(parsed.dayLogs) ||
    typeof parsed.createdAt !== "string"
  ) {
    throw new Error("invalid_sync_snapshot");
  }

  // Current version (v3): the three pregnancy collections AND the postpartum + screening
  // collections (postpartum records, screening responses) are required arrays.
  if (parsed.schemaVersion === SYNC_SNAPSHOT_SCHEMA_VERSION) {
    if (
      !Array.isArray(parsed.pregnancies) ||
      !Array.isArray(parsed.kickSessions) ||
      !Array.isArray(parsed.contractionSessions) ||
      !Array.isArray(parsed.postpartumRecords) ||
      !Array.isArray(parsed.screeningResponses)
    ) {
      throw new Error("invalid_sync_snapshot");
    }

    return {
      schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
      createdAt: parsed.createdAt,
      bootstrapState: parsed.bootstrapState,
      profile: parsed.profile,
      symptomRecords: parsed.symptomRecords,
      dayLogs: parsed.dayLogs,
      pregnancies: parsed.pregnancies,
      kickSessions: parsed.kickSessions,
      contractionSessions: parsed.contractionSessions,
      postpartumRecords: parsed.postpartumRecords,
      screeningResponses: parsed.screeningResponses,
    };
  }

  // Legacy v2 snapshot (pregnancy-mode, pre-postpartum/screening): the three
  // pregnancy collections are still required arrays; the postpartum + screening collections
  // default to empty. Everything else is already v3-compatible.
  if (parsed.schemaVersion === SYNC_SNAPSHOT_SCHEMA_VERSION_V2) {
    if (
      !Array.isArray(parsed.pregnancies) ||
      !Array.isArray(parsed.kickSessions) ||
      !Array.isArray(parsed.contractionSessions)
    ) {
      throw new Error("invalid_sync_snapshot");
    }

    return {
      schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
      createdAt: parsed.createdAt,
      bootstrapState: parsed.bootstrapState,
      profile: parsed.profile,
      symptomRecords: parsed.symptomRecords,
      dayLogs: parsed.dayLogs,
      pregnancies: parsed.pregnancies,
      kickSessions: parsed.kickSessions,
      contractionSessions: parsed.contractionSessions,
      postpartumRecords: [],
      screeningResponses: [],
    };
  }

  // Legacy v1 snapshot (pre-pregnancy-mode): accept it and default all five
  // additive collections to empty. Everything else is already v3-compatible.
  if (parsed.schemaVersion === SYNC_SNAPSHOT_SCHEMA_VERSION_V1) {
    return {
      schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
      createdAt: parsed.createdAt,
      bootstrapState: parsed.bootstrapState,
      profile: parsed.profile,
      symptomRecords: parsed.symptomRecords,
      dayLogs: parsed.dayLogs,
      pregnancies: [],
      kickSessions: [],
      contractionSessions: [],
      postpartumRecords: [],
      screeningResponses: [],
    };
  }

  // Any other schemaVersion → fail closed, exactly as the original gate did.
  throw new Error("invalid_sync_snapshot");
}

export async function restoreSyncSnapshot(
  storage: LocalAppStorage,
  snapshot: SyncSnapshotV3,
  syncPreferences: SyncPreferencesRecord,
  reminderScheduler: LocalReminderScheduler = createPlatformLocalReminderScheduler(),
  retainedPreferences: SyncPreferencesRecord | null = null,
): Promise<void> {
  await storage.clearAllLocalData();
  // The wipe resets the sync preferences, and with them the rollback floor.
  // The floor the device held before the restore is put back first, so a
  // write that fails partway leaves the floor where it was; the restored
  // preferences (the raised floor) are written only after the data is in.
  // The same write marks the restore in progress, which blocks uploads until
  // the final write below clears it.
  await storage.writeSyncPreferencesRecord(
    retainedPreferences ?? createDefaultSyncPreferencesRecord(),
    { restoreInProgress: true },
  );
  await storage.writeBootstrapState(snapshot.bootstrapState);
  await storage.writeProfileRecord({
    ...snapshot.profile,
    lastPeriodStart: sanitizeRestoredLastPeriodStart(snapshot.profile.lastPeriodStart),
    cycleDayReminders: normalizeCycleDayReminders(snapshot.profile.cycleDayReminders),
  });

  for (const symptomRecord of snapshot.symptomRecords) {
    await storage.writeSymptomRecord(symptomRecord);
  }

  for (const dayLogRecord of snapshot.dayLogs) {
    await storage.writeDayLogRecord(dayLogRecord);
  }

  // Records the storage layer would reject (failed sanitize, a second active
  // pregnancy/postpartum) are dropped here, before any write, mirroring how
  // legacy day-log rows are tolerated. Every write below is expected to land,
  // so a storage error aborts the restore with the floor still at its old
  // value instead of committing a reduced data set.
  for (const record of selectRestorableWithOneActive(
    snapshot.pregnancies,
    sanitizePregnancyRecord,
  )) {
    await storage.writePregnancyRecord(record);
  }

  for (const session of selectRestorable(
    snapshot.kickSessions,
    sanitizeKickCountSession,
  )) {
    await storage.writeKickSession(session);
  }

  for (const session of selectRestorable(
    snapshot.contractionSessions,
    sanitizeContractionSession,
  )) {
    await storage.writeContractionSession(session);
  }

  for (const record of selectRestorableWithOneActive(
    snapshot.postpartumRecords,
    sanitizePostpartumRecord,
  )) {
    await storage.writePostpartumRecord(record);
  }

  // Screening responses are an append-only history with no active concept;
  // the storage layer recomputes score/selfHarmFlag from the answers.
  for (const response of selectRestorable(
    snapshot.screeningResponses,
    sanitizeScreeningResponse,
  )) {
    await storage.writeScreeningResponse(response);
  }

  // Every data write has landed: only now does the floor rise and the
  // in-progress mark clear.
  await storage.writeSyncPreferencesRecord(syncPreferences, {
    restoreInProgress: false,
  });

  // The snapshot may come from an older client, which reads the stored cycle
  // start under the earlier withdrawal rule; re-read it before anything
  // derives from it. Best effort: the profile stays unversioned on failure, so
  // the next launch retries, and the restore itself has already succeeded.
  try {
    await repointLegacyStoredCycleStart(storage, new Date());
  } catch {
    // Retried at the next launch.
  }

  // The applied snapshot replaced every reminder-plan input (profile toggles,
  // day logs, pregnancy records), so the OS schedule built from the previous
  // data is stale. Best effort: the rebuild never throws, and a failed one
  // must not undo a restore that has already succeeded.
  await rebuildLocalReminderScheduleFromStorage(storage, reminderScheduler);
}

function selectRestorable<T>(
  records: readonly T[],
  sanitize: (value: unknown) => T | null,
): T[] {
  return records.filter((record) => sanitize(record) !== null);
}

// Ended records come before the active one, and only the first active id is
// kept: storage refuses an active record while a different one is active.
function selectRestorableWithOneActive<T extends { id: string; status: string }>(
  records: readonly T[],
  sanitize: (value: unknown) => T | null,
): T[] {
  const ended: T[] = [];
  const active: T[] = [];
  let activeID: string | null = null;
  for (const record of records) {
    const normalized = sanitize(record);
    if (normalized === null) {
      continue;
    }
    if (normalized.status !== "active") {
      ended.push(record);
    } else if (activeID === null || activeID === normalized.id) {
      activeID = normalized.id;
      active.push(record);
    }
  }
  return [...ended, ...active];
}
