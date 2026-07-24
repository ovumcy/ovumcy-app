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
import type {
  LocalAppStorage,
  LocalBootstrapState,
} from "../storage/local/storage-contract";
import type { SyncPreferencesRecord } from "./sync-contract";

export const SYNC_SNAPSHOT_SCHEMA_VERSION = 3;

// Legacy schema versions accepted for backward-compatible decode ONLY, never
// produced on encode. A v1 snapshot predates pregnancy-mode (the three
// pregnancy collections default to []); a v2 snapshot predates postpartum +
// screening (those two collections default to []). Decode upgrades either to
// the current v3 shape.
const SYNC_SNAPSHOT_SCHEMA_VERSION_V1 = 1;
const SYNC_SNAPSHOT_SCHEMA_VERSION_V2 = 2;

// Retained explicitly for the decode path: the shape of a snapshot written by
// a pre-pregnancy-mode client. Never produced on encode (buildSyncSnapshot
// always emits the current version).
export type SyncSnapshotV1 = {
  schemaVersion: typeof SYNC_SNAPSHOT_SCHEMA_VERSION_V1;
  createdAt: string;
  bootstrapState: LocalBootstrapState;
  profile: ProfileRecord;
  symptomRecords: SymptomRecord[];
  dayLogs: DayLogRecord[];
};

// Retained explicitly for the decode path: the shape of a snapshot written by
// a pregnancy-mode client that predates postpartum + screening (postpartum + screening). Never
// produced on encode.
export type SyncSnapshotV2 = {
  schemaVersion: typeof SYNC_SNAPSHOT_SCHEMA_VERSION_V2;
  createdAt: string;
  bootstrapState: LocalBootstrapState;
  profile: ProfileRecord;
  symptomRecords: SymptomRecord[];
  dayLogs: DayLogRecord[];
  // Pregnancy-mode collections. Always present on a v2 encode (possibly
  // empty). A legacy v1 snapshot decodes with these defaulted to [].
  pregnancies: PregnancyRecord[];
  kickSessions: KickCountSession[];
  contractionSessions: ContractionSession[];
};

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
    profile,
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
): Promise<void> {
  await storage.clearAllLocalData();
  await storage.writeBootstrapState(snapshot.bootstrapState);
  await storage.writeProfileRecord(snapshot.profile);
  await storage.writeSyncPreferencesRecord(syncPreferences);

  for (const symptomRecord of snapshot.symptomRecords) {
    await storage.writeSymptomRecord(symptomRecord);
  }

  for (const dayLogRecord of snapshot.dayLogs) {
    await storage.writeDayLogRecord(dayLogRecord);
  }

  // Pregnancy records: write ended records BEFORE the active one so the
  // at-most-one-active storage invariant can never trip on restore ordering.
  // A record that fails sanitize / the one-active guard is skipped, never
  // aborting the restore — mirroring how legacy day-log rows are tolerated.
  const endedPregnancies = snapshot.pregnancies.filter(
    (record) => record.status !== "active",
  );
  const activePregnancies = snapshot.pregnancies.filter(
    (record) => record.status === "active",
  );
  for (const record of [...endedPregnancies, ...activePregnancies]) {
    try {
      await storage.writePregnancyRecord(record);
    } catch {
      // Skip an invalid / duplicate-active pregnancy record; keep restoring.
    }
  }

  for (const session of snapshot.kickSessions) {
    try {
      await storage.writeKickSession(session);
    } catch {
      // Skip an invalid kick session; keep restoring.
    }
  }

  for (const session of snapshot.contractionSessions) {
    try {
      await storage.writeContractionSession(session);
    } catch {
      // Skip an invalid contraction session; keep restoring.
    }
  }

  // Postpartum records: write ended records BEFORE the active one so the
  // at-most-one-active storage invariant can never trip on restore ordering,
  // mirroring the pregnancy block above exactly. A record that fails sanitize /
  // the one-active guard is skipped, never aborting the restore.
  const endedPostpartum = snapshot.postpartumRecords.filter(
    (record) => record.status !== "active",
  );
  const activePostpartum = snapshot.postpartumRecords.filter(
    (record) => record.status === "active",
  );
  for (const record of [...endedPostpartum, ...activePostpartum]) {
    try {
      await storage.writePostpartumRecord(record);
    } catch {
      // Skip an invalid / duplicate-active postpartum record; keep restoring.
    }
  }

  // Screening responses: an append-only history with no active concept, so
  // there is no ordering constraint — each is written independently. The
  // storage layer re-sanitizes (recomputing score/selfHarmFlag from answers);
  // an invalid response is skipped, never aborting the restore.
  for (const response of snapshot.screeningResponses) {
    try {
      await storage.writeScreeningResponse(response);
    } catch {
      // Skip an invalid screening response; keep restoring.
    }
  }
}
