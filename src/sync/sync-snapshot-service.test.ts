import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultSyncPreferencesRecord } from "./sync-contract";
import { createDefaultSymptomRecords } from "../models/symptom";
import { createDefaultBootstrapState } from "../storage/local/storage-contract";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import {
  buildSyncSnapshot,
  decodeSyncSnapshot,
  encodeSyncSnapshot,
  restoreSyncSnapshot,
  SYNC_SNAPSHOT_SCHEMA_VERSION,
} from "./sync-snapshot-service";

describe("sync-snapshot-service", () => {
  it("builds a canonical snapshot from persisted local repositories", async () => {
    const dayLog = {
      ...createEmptyDayLogRecord("2026-03-10"),
      isPeriod: true,
      notes: "Cycle start",
    };
    const symptomRecords = createDefaultSymptomRecords();
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        ...createDefaultBootstrapState(),
        hasCompletedOnboarding: true,
        profileVersion: 2,
        incompleteOnboardingStep: null,
      }),
      readDayLogSummary: jest.fn().mockResolvedValue({
        totalEntries: 1,
        hasData: true,
        dateFrom: "2026-03-10",
        dateTo: "2026-03-10",
      }),
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([dayLog]),
      listSymptomRecords: jest.fn().mockResolvedValue(symptomRecords),
    });

    const snapshot = await buildSyncSnapshot(storage, new Date("2026-03-20T08:00:00.000Z"));
    const decodedSnapshot = decodeSyncSnapshot(encodeSyncSnapshot(snapshot));

    expect(snapshot).toEqual({
      schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
      createdAt: "2026-03-20T08:00:00.000Z",
      bootstrapState: expect.objectContaining({
        hasCompletedOnboarding: true,
        profileVersion: 2,
        incompleteOnboardingStep: null,
      }),
      profile: expect.objectContaining({
        cycleLength: 28,
      }),
      symptomRecords,
      dayLogs: [dayLog],
    });
    expect(decodedSnapshot).toEqual(snapshot);
  });

  it("restores a snapshot by clearing local data and rewriting canonical records", async () => {
    const dayLog = {
      ...createEmptyDayLogRecord("2026-03-12"),
      mood: 4,
    };
    const symptomRecords = createDefaultSymptomRecords();
    const bootstrapState = {
      ...createDefaultBootstrapState(),
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    };
    const storage = createLocalAppStorageMock();
    const syncPreferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
      normalizedEndpoint: "http://192.168.1.20:8080",
      deviceLabel: "Pixel 7",
      setupStatus: "connected" as const,
      preparedAt: "2026-03-20T08:00:00.000Z",
      lastRemoteGeneration: 123,
      lastSyncedAt: "2026-03-20T08:00:00.000Z",
    };

    await restoreSyncSnapshot(
      storage,
      {
        schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
        createdAt: "2026-03-20T08:00:00.000Z",
        bootstrapState,
        profile: await storage.readProfileRecord(),
        symptomRecords,
        dayLogs: [dayLog],
      },
      syncPreferences,
    );

    expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1);
    expect(storage.writeBootstrapState).toHaveBeenCalledWith(bootstrapState);
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({ cycleLength: 28 }),
    );
    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(syncPreferences);
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(dayLog);
    expect(storage.writeSymptomRecord).toHaveBeenCalledTimes(symptomRecords.length);
  });
});
