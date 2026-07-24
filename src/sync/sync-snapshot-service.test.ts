import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord } from "../models/profile";
import {
  createPregnancyRecord,
  type ContractionSession,
  type KickCountSession,
  type PregnancyRecord,
} from "../models/pregnancy";
import type { PostpartumRecord } from "../models/postpartum";
import type { ScreeningResponse } from "../models/screening";
import { createDefaultSyncPreferencesRecord } from "./sync-contract";
import { createDefaultSymptomRecords } from "../models/symptom";
import { createDefaultBootstrapState } from "../storage/local/storage-contract";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createVolatileWebAppStorage } from "../storage/local/volatile-web-app-storage";
import {
  buildSyncSnapshot,
  decodeSyncSnapshot,
  encodeSyncSnapshot,
  restoreSyncSnapshot,
  SYNC_SNAPSHOT_SCHEMA_VERSION,
  type SyncSnapshotV3,
} from "./sync-snapshot-service";

const sampleKickSession: KickCountSession = {
  id: "kick-1",
  date: "2026-05-01",
  durationMinutes: 30,
  kickCount: 10,
};

const sampleContractionSession: ContractionSession = {
  id: "contraction-1",
  date: "2026-05-10",
  startedAt: "2026-05-10T20:00:00.000Z",
  contractions: [
    { startedAt: "2026-05-10T20:00:00.000Z", durationSeconds: 45 },
    { startedAt: "2026-05-10T20:05:00.000Z", durationSeconds: 50 },
  ],
};

const sampleScreeningResponse: ScreeningResponse = {
  id: "screening-1",
  date: "2026-05-05",
  instrument: "epds",
  answers: [1, 0, 2, 1, 0, 1, 0, 2, 1, 0],
  score: 8,
  selfHarmFlag: false,
};

function sampleActivePostpartum(): PostpartumRecord {
  return {
    id: "postpartum-active-1",
    status: "active",
    startedAt: "2026-05-01",
    modeOfDelivery: "vaginal",
    endedAt: null,
    endReason: null,
  };
}

function sampleEndedPostpartum(id: string): PostpartumRecord {
  return {
    id,
    status: "ended",
    startedAt: "2025-01-10",
    modeOfDelivery: "cesarean",
    endedAt: "2025-03-01",
    endReason: "cycle_returned",
  };
}

function sampleActivePregnancy(): PregnancyRecord {
  return {
    ...createPregnancyRecord({
      edd: "2026-12-01",
      eddBasis: "lmp",
      startedAt: "2026-03-01",
      lmpDate: "2026-02-24",
    }),
    id: "pregnancy-active-1",
  };
}

function sampleEndedPregnancy(id: string): PregnancyRecord {
  return {
    id,
    status: "ended",
    edd: "2025-06-01",
    eddBasis: "ultrasound",
    lmpDate: "2024-08-25",
    schedulePreset: "who2016",
    startedAt: "2024-09-01",
    endedAt: "2025-05-20",
    endReason: "birth",
    modeOfDelivery: "vaginal",
  };
}

function baseSnapshot(overrides: Partial<SyncSnapshotV3> = {}): SyncSnapshotV3 {
  return {
    schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
    createdAt: "2026-05-20T08:00:00.000Z",
    bootstrapState: createDefaultBootstrapState(),
    profile: createDefaultProfileRecord(),
    symptomRecords: [],
    dayLogs: [],
    pregnancies: [],
    kickSessions: [],
    contractionSessions: [],
    postpartumRecords: [],
    screeningResponses: [],
    ...overrides,
  };
}

describe("sync-snapshot-service", () => {
  it("builds a canonical snapshot including the pregnancy collections", async () => {
    const dayLog = {
      ...createEmptyDayLogRecord("2026-03-10"),
      isPeriod: true,
      notes: "Cycle start",
    };
    const symptomRecords = createDefaultSymptomRecords();
    const pregnancy = sampleActivePregnancy();
    const postpartum = sampleActivePostpartum();
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
      listPregnancyRecords: jest.fn().mockResolvedValue([pregnancy]),
      listKickSessions: jest.fn().mockResolvedValue([sampleKickSession]),
      listContractionSessions: jest
        .fn()
        .mockResolvedValue([sampleContractionSession]),
      listPostpartumRecords: jest.fn().mockResolvedValue([postpartum]),
      listScreeningResponses: jest
        .fn()
        .mockResolvedValue([sampleScreeningResponse]),
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
      pregnancies: [pregnancy],
      kickSessions: [sampleKickSession],
      contractionSessions: [sampleContractionSession],
      postpartumRecords: [postpartum],
      screeningResponses: [sampleScreeningResponse],
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
      baseSnapshot({
        createdAt: "2026-03-20T08:00:00.000Z",
        bootstrapState,
        profile: await storage.readProfileRecord(),
        symptomRecords,
        dayLogs: [dayLog],
      }),
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

  it("preserves the pregnancyTest field through an encode/decode roundtrip", () => {
    const dayLog = {
      ...createEmptyDayLogRecord("2026-04-05"),
      pregnancyTest: "positive" as const,
    };
    const snapshot = baseSnapshot({
      createdAt: "2026-04-05T08:00:00.000Z",
      symptomRecords: createDefaultSymptomRecords(),
      dayLogs: [dayLog],
    });
    const decoded = decodeSyncSnapshot(encodeSyncSnapshot(snapshot));
    expect(decoded.dayLogs[0]?.pregnancyTest).toBe("positive");
  });

  it("round-trips the pregnancy, postpartum, and screening collections through encode -> decode -> restore onto fresh storage", async () => {
    const source = createVolatileWebAppStorage();
    const active = sampleActivePregnancy();
    const ended = sampleEndedPregnancy("pregnancy-ended-1");
    const activePostpartum = sampleActivePostpartum();
    const endedPostpartum = sampleEndedPostpartum("postpartum-ended-1");
    await source.writePregnancyRecord(ended);
    await source.writePregnancyRecord(active);
    await source.writeKickSession(sampleKickSession);
    await source.writeContractionSession(sampleContractionSession);
    await source.writePostpartumRecord(endedPostpartum);
    await source.writePostpartumRecord(activePostpartum);
    await source.writeScreeningResponse(sampleScreeningResponse);

    const snapshot = await buildSyncSnapshot(source, new Date("2026-05-20T08:00:00.000Z"));
    expect(snapshot.schemaVersion).toBe(SYNC_SNAPSHOT_SCHEMA_VERSION);
    const decoded = decodeSyncSnapshot(encodeSyncSnapshot(snapshot));

    const target = createVolatileWebAppStorage();
    await restoreSyncSnapshot(target, decoded, createDefaultSyncPreferencesRecord());

    const restoredPregnancies = await target.listPregnancyRecords();
    expect(restoredPregnancies.map((record) => record.id).sort()).toEqual(
      [active.id, ended.id].sort(),
    );
    await expect(target.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({ id: active.id, status: "active" }),
    );
    await expect(target.listKickSessions()).resolves.toEqual([sampleKickSession]);
    const restoredContractions = await target.listContractionSessions();
    expect(restoredContractions).toHaveLength(1);
    expect(restoredContractions[0]?.contractions).toHaveLength(2);

    const restoredPostpartum = await target.listPostpartumRecords();
    expect(restoredPostpartum.map((record) => record.id).sort()).toEqual(
      [activePostpartum.id, endedPostpartum.id].sort(),
    );
    await expect(target.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({ id: activePostpartum.id, status: "active" }),
    );
    await expect(target.listScreeningResponses()).resolves.toEqual([
      expect.objectContaining({ id: sampleScreeningResponse.id, score: 8 }),
    ]);
  });

  it("decodes a legacy v1 snapshot and defaults the pregnancy collections to empty", async () => {
    const legacyPayload = JSON.stringify({
      schemaVersion: 1,
      createdAt: "2026-04-05T08:00:00.000Z",
      bootstrapState: createDefaultBootstrapState(),
      profile: createDefaultProfileRecord(),
      symptomRecords: createDefaultSymptomRecords(),
      dayLogs: [
        {
          date: "2026-03-15",
          isPeriod: true,
          cycleStart: true,
          isUncertain: false,
          flow: "medium",
          mood: 3,
          sexActivity: "none",
          bbt: 0,
          cervicalMucus: "none",
          lhTest: "none",
          // pregnancyTest intentionally omitted (pre-v12 client snapshot)
          cycleFactorKeys: [],
          symptomIDs: [],
          notes: "legacy roundtrip",
        },
      ],
      // pregnancies / kickSessions / contractionSessions intentionally absent
    });
    const decoded = decodeSyncSnapshot(new TextEncoder().encode(legacyPayload));

    expect(decoded.schemaVersion).toBe(SYNC_SNAPSHOT_SCHEMA_VERSION);
    expect(decoded.dayLogs[0]?.date).toBe("2026-03-15");
    expect(decoded.pregnancies).toEqual([]);
    expect(decoded.kickSessions).toEqual([]);
    expect(decoded.contractionSessions).toEqual([]);
    // The postpartum + screening collections also default to empty for a v1 payload.
    expect(decoded.postpartumRecords).toEqual([]);
    expect(decoded.screeningResponses).toEqual([]);
    // The decoder does not transform day-log records — sanitize happens at the
    // storage boundary when restore calls writeDayLogRecord.
    expect(
      (decoded.dayLogs[0] as { pregnancyTest?: string }).pregnancyTest,
    ).toBeUndefined();
  });

  it("decodes a legacy v2 snapshot (pregnancy-mode) and defaults the postpartum + screening collections to empty", () => {
    const legacyV2Payload = JSON.stringify({
      schemaVersion: 2,
      createdAt: "2026-05-01T08:00:00.000Z",
      bootstrapState: createDefaultBootstrapState(),
      profile: createDefaultProfileRecord(),
      symptomRecords: createDefaultSymptomRecords(),
      dayLogs: [],
      pregnancies: [sampleActivePregnancy()],
      kickSessions: [sampleKickSession],
      contractionSessions: [sampleContractionSession],
      // postpartumRecords / screeningResponses intentionally absent (pre-v3).
    });
    const decoded = decodeSyncSnapshot(new TextEncoder().encode(legacyV2Payload));

    expect(decoded.schemaVersion).toBe(SYNC_SNAPSHOT_SCHEMA_VERSION);
    // The pregnancy collections survive the v2 → v3 upgrade untouched...
    expect(decoded.pregnancies).toHaveLength(1);
    expect(decoded.kickSessions).toEqual([sampleKickSession]);
    expect(decoded.contractionSessions).toEqual([sampleContractionSession]);
    // ...while the postpartum + screening collections default to empty.
    expect(decoded.postpartumRecords).toEqual([]);
    expect(decoded.screeningResponses).toEqual([]);
  });

  it("rejects a legacy v2 snapshot missing the pregnancy collections (fail-closed)", () => {
    const missingV2Collections = JSON.stringify({
      schemaVersion: 2,
      createdAt: "2026-05-20T08:00:00.000Z",
      bootstrapState: createDefaultBootstrapState(),
      profile: createDefaultProfileRecord(),
      symptomRecords: [],
      dayLogs: [],
      // pregnancies / kickSessions / contractionSessions omitted → invalid for v2
    });
    expect(() =>
      decodeSyncSnapshot(new TextEncoder().encode(missingV2Collections)),
    ).toThrow("invalid_sync_snapshot");
  });

  it("rejects an unknown schema version (fail-closed)", () => {
    const unknownVersionPayload = JSON.stringify({
      ...baseSnapshot(),
      schemaVersion: 999,
    });
    expect(() =>
      decodeSyncSnapshot(new TextEncoder().encode(unknownVersionPayload)),
    ).toThrow("invalid_sync_snapshot");
  });

  it("rejects a v3 snapshot missing the pregnancy collections (fail-closed)", () => {
    const missingCollections = JSON.stringify({
      schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
      createdAt: "2026-05-20T08:00:00.000Z",
      bootstrapState: createDefaultBootstrapState(),
      profile: createDefaultProfileRecord(),
      symptomRecords: [],
      dayLogs: [],
      postpartumRecords: [],
      screeningResponses: [],
      // pregnancies / kickSessions / contractionSessions omitted → invalid for v3
    });
    expect(() =>
      decodeSyncSnapshot(new TextEncoder().encode(missingCollections)),
    ).toThrow("invalid_sync_snapshot");
  });

  it("rejects a v3 snapshot missing the postpartum + screening collections (fail-closed)", () => {
    const missingNewCollections = JSON.stringify({
      schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
      createdAt: "2026-05-20T08:00:00.000Z",
      bootstrapState: createDefaultBootstrapState(),
      profile: createDefaultProfileRecord(),
      symptomRecords: [],
      dayLogs: [],
      pregnancies: [],
      kickSessions: [],
      contractionSessions: [],
      // postpartumRecords / screeningResponses omitted → invalid for v3, the
      // full-shape validation mirroring the pregnancy checks.
    });
    expect(() =>
      decodeSyncSnapshot(new TextEncoder().encode(missingNewCollections)),
    ).toThrow("invalid_sync_snapshot");
  });

  it("skips a malformed pregnancy record inside a v2 snapshot while restoring the rest", async () => {
    const valid = sampleActivePregnancy();
    const malformed: PregnancyRecord = {
      id: "pregnancy-malformed",
      status: "ended",
      edd: "2026-13-40", // invalid calendar date → fails storage sanitize
      eddBasis: "lmp",
      lmpDate: null,
      schedulePreset: "who2016",
      startedAt: "2026-03-01",
      endedAt: "2026-05-01",
      endReason: "loss",
      modeOfDelivery: null,
    };
    const target = createVolatileWebAppStorage();

    await restoreSyncSnapshot(
      target,
      baseSnapshot({
        pregnancies: [malformed, valid],
        kickSessions: [sampleKickSession],
        contractionSessions: [sampleContractionSession],
      }),
      createDefaultSyncPreferencesRecord(),
    );

    const restored = await target.listPregnancyRecords();
    expect(restored.map((record) => record.id)).toEqual([valid.id]);
    await expect(target.listKickSessions()).resolves.toHaveLength(1);
    await expect(target.listContractionSessions()).resolves.toHaveLength(1);
  });

  it("restores ended pregnancy records before the active one (ordering)", async () => {
    const active = sampleActivePregnancy();
    const endedA = sampleEndedPregnancy("pregnancy-ended-a");
    const endedB = sampleEndedPregnancy("pregnancy-ended-b");
    const storage = createLocalAppStorageMock();

    await restoreSyncSnapshot(
      storage,
      // Active listed FIRST in the snapshot to prove restore reorders it last.
      baseSnapshot({ pregnancies: [active, endedA, endedB] }),
      createDefaultSyncPreferencesRecord(),
    );

    const writtenIDs = (storage.writePregnancyRecord as jest.Mock).mock.calls.map(
      (call) => (call[0] as PregnancyRecord).id,
    );
    expect(writtenIDs).toEqual([endedA.id, endedB.id, active.id]);
  });

  it("restores ended postpartum records before the active one (ordering)", async () => {
    const active = sampleActivePostpartum();
    const endedA = sampleEndedPostpartum("postpartum-ended-a");
    const endedB = sampleEndedPostpartum("postpartum-ended-b");
    const storage = createLocalAppStorageMock();

    await restoreSyncSnapshot(
      storage,
      // Active listed FIRST in the snapshot to prove restore reorders it last,
      // mirroring the pregnancy ordering guarantee.
      baseSnapshot({ postpartumRecords: [active, endedA, endedB] }),
      createDefaultSyncPreferencesRecord(),
    );

    const writtenIDs = (storage.writePostpartumRecord as jest.Mock).mock.calls.map(
      (call) => (call[0] as PostpartumRecord).id,
    );
    expect(writtenIDs).toEqual([endedA.id, endedB.id, active.id]);
  });

  it("skips a malformed postpartum record inside a v3 snapshot while restoring the rest", async () => {
    const valid = sampleActivePostpartum();
    const malformed: PostpartumRecord = {
      id: "postpartum-malformed",
      status: "ended",
      startedAt: "2026-13-40", // invalid calendar date → fails storage sanitize
      modeOfDelivery: null,
      endedAt: null,
      endReason: null,
    };
    const target = createVolatileWebAppStorage();

    await restoreSyncSnapshot(
      target,
      baseSnapshot({
        postpartumRecords: [malformed, valid],
        screeningResponses: [sampleScreeningResponse],
      }),
      createDefaultSyncPreferencesRecord(),
    );

    const restored = await target.listPostpartumRecords();
    expect(restored.map((record) => record.id)).toEqual([valid.id]);
    await expect(target.listScreeningResponses()).resolves.toHaveLength(1);
  });

  it("skips a malformed screening response while restoring the valid ones (never aborts)", async () => {
    const valid = sampleScreeningResponse;
    const malformed: ScreeningResponse = {
      id: "screening-malformed",
      date: "2026-05-06",
      instrument: "epds",
      answers: [1, 2, 3], // wrong length → fails storage sanitize
      score: 6,
      selfHarmFlag: false,
    };
    const target = createVolatileWebAppStorage();

    await restoreSyncSnapshot(
      target,
      baseSnapshot({ screeningResponses: [malformed, valid] }),
      createDefaultSyncPreferencesRecord(),
    );

    const restored = await target.listScreeningResponses();
    expect(restored.map((response) => response.id)).toEqual([valid.id]);
  });
});
