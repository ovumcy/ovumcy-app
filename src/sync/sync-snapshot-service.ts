import type { DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import type {
  LocalAppStorage,
  LocalBootstrapState,
} from "../storage/local/storage-contract";
import type { SyncPreferencesRecord } from "./sync-contract";

export const SYNC_SNAPSHOT_SCHEMA_VERSION = 1;

export type SyncSnapshotV1 = {
  schemaVersion: typeof SYNC_SNAPSHOT_SCHEMA_VERSION;
  createdAt: string;
  bootstrapState: LocalBootstrapState;
  profile: ProfileRecord;
  symptomRecords: SymptomRecord[];
  dayLogs: DayLogRecord[];
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export async function buildSyncSnapshot(
  storage: LocalAppStorage,
  now: Date,
): Promise<SyncSnapshotV1> {
  const [bootstrapState, profile, symptomRecords, dayLogSummary] = await Promise.all([
    storage.readBootstrapState(),
    storage.readProfileRecord(),
    storage.listSymptomRecords(),
    storage.readDayLogSummary(),
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
  };
}

export function encodeSyncSnapshot(snapshot: SyncSnapshotV1): Uint8Array {
  return textEncoder.encode(JSON.stringify(snapshot));
}

export function decodeSyncSnapshot(payload: Uint8Array): SyncSnapshotV1 {
  const parsed = JSON.parse(textDecoder.decode(payload)) as Partial<SyncSnapshotV1>;

  if (
    parsed?.schemaVersion !== SYNC_SNAPSHOT_SCHEMA_VERSION ||
    !parsed.bootstrapState ||
    !parsed.profile ||
    !Array.isArray(parsed.symptomRecords) ||
    !Array.isArray(parsed.dayLogs) ||
    typeof parsed.createdAt !== "string"
  ) {
    throw new Error("invalid_sync_snapshot");
  }

  return parsed as SyncSnapshotV1;
}

export async function restoreSyncSnapshot(
  storage: LocalAppStorage,
  snapshot: SyncSnapshotV1,
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
}
