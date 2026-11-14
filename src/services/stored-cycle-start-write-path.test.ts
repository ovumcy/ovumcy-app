import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord, type ProfileRecord } from "../models/profile";
import { createVolatileWebAppStorage } from "../storage/local/volatile-web-app-storage";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import {
  clearDayLogEditorRecord,
  saveDayLogEditorRecord,
} from "./day-log-editor-service";
import { importBackupEnvelope } from "./import-service";
import { buildPregnancyStartDefaults } from "./pregnancy-mode-service";
import {
  STORED_CYCLE_START_REPOINT_VERSION,
  repointLegacyStoredCycleStart,
} from "./stored-cycle-start-repoint-service";

const NOW = new Date(2026, 5, 20);

async function seed(
  profile: Partial<ProfileRecord>,
  records: DayLogRecord[],
): Promise<LocalAppStorage> {
  const storage = createVolatileWebAppStorage();
  await storage.writeProfileRecord({
    ...createDefaultProfileRecord(),
    autoPeriodFill: false,
    ...profile,
  });
  for (const record of records) {
    await storage.writeDayLogRecord(record);
  }
  return storage;
}

const may = { ...createEmptyDayLogRecord("2026-05-01"), isPeriod: true, cycleStart: true };

async function storedStart(storage: LocalAppStorage): Promise<string | null> {
  return (await storage.readProfileRecord()).lastPeriodStart;
}

describe("stored cycle start write path", () => {
  it("keeps a Settings start when a BBT-only save creates the first row on its date", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-12" }, [may]);

    const result = await saveDayLogEditorRecord(
      storage,
      { ...createEmptyDayLogRecord("2026-06-12"), bbt: 36.6 },
      NOW,
    );

    expect(result.ok).toBe(true);
    expect(await storedStart(storage)).toBe("2026-06-12");
  });

  it("repoints to the previous boundary when the stored date is un-ticked", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-12" }, [
      may,
      { ...createEmptyDayLogRecord("2026-06-12"), isPeriod: true, cycleStart: true },
    ]);

    await saveDayLogEditorRecord(
      storage,
      { ...createEmptyDayLogRecord("2026-06-12"), notes: "not a period" },
      NOW,
    );

    const profile = await storage.readProfileRecord();
    expect(profile.lastPeriodStart).toBe("2026-05-01");
    expect(buildPregnancyStartDefaults(profile).defaultLmp).toBe("2026-05-01");
  });

  it.each([
    ["spotting", { isPeriod: true, flow: "spotting" as const }],
    ["an uncertain mark", { isPeriod: true, cycleStart: true, isUncertain: true }],
  ])("repoints when the stored date is saved as %s", async (_label, fields) => {
    const storage = await seed({ lastPeriodStart: "2026-06-12" }, [may]);

    await saveDayLogEditorRecord(
      storage,
      { ...createEmptyDayLogRecord("2026-06-12"), ...fields },
      NOW,
    );

    expect(await storedStart(storage)).toBe("2026-05-01");
  });

  it("leaves the stored start when the save is on another date", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-12" }, [may]);

    await saveDayLogEditorRecord(
      storage,
      { ...createEmptyDayLogRecord("2026-06-14"), notes: "x" },
      NOW,
    );

    expect(await storedStart(storage)).toBe("2026-06-12");
  });

  it("repoints on clear-day from rows on or before today, never to a future row", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-12" }, [
      may,
      { ...createEmptyDayLogRecord("2026-06-12"), isPeriod: true, cycleStart: true },
      { ...createEmptyDayLogRecord("2026-06-22"), isPeriod: true, cycleStart: true },
    ]);

    const result = await clearDayLogEditorRecord(storage, "2026-06-12", NOW);

    expect(result.ok).toBe(true);
    expect(await storedStart(storage)).toBe("2026-05-01");
    expect((await storage.listDayLogRecordsInRange("2026-06-12", "2026-06-12")).length).toBe(0);
  });

  it("writes rows and profile as one unit: a failed commit writes neither", async () => {
    const commitDayLogChanges = jest.fn().mockRejectedValue(new Error("disk full"));
    const storage = createLocalAppStorageMock({
      commitDayLogChanges,
      readProfileRecord: jest
        .fn()
        .mockResolvedValue({ ...createDefaultProfileRecord(), lastPeriodStart: "2026-06-12" }),
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([
        may,
        { ...createEmptyDayLogRecord("2026-06-12"), isPeriod: true },
      ]),
    });

    const result = await saveDayLogEditorRecord(
      storage,
      { ...createEmptyDayLogRecord("2026-06-12"), notes: "un-ticked" },
      NOW,
    );
    const cleared = await clearDayLogEditorRecord(storage, "2026-06-12", NOW);

    expect(result).toEqual({ ok: false });
    expect(cleared).toEqual({ ok: false });
    expect(commitDayLogChanges).toHaveBeenCalledWith(
      expect.objectContaining({ profile: expect.objectContaining({ lastPeriodStart: "2026-05-01" }) }),
    );
    expect(storage.writeDayLogRecord).not.toHaveBeenCalled();
    expect(storage.deleteDayLogRecord).not.toHaveBeenCalled();
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
  });
});

describe("one-time stored cycle start repoint", () => {
  it("repoints data stored under the earlier rule once, stashing the old value", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-12" }, [
      may,
      { ...createEmptyDayLogRecord("2026-06-12"), mood: 3 },
    ]);

    await repointLegacyStoredCycleStart(storage, NOW, { force: false });
    const migrated = await storage.readProfileRecord();
    expect(migrated.lastPeriodStart).toBe("2026-05-01");
    expect(migrated.lastPeriodStartBeforeRepoint).toBe("2026-06-12");
    expect(migrated.storedCycleStartRepointVersion).toBe(STORED_CYCLE_START_REPOINT_VERSION);

    await storage.writeProfileRecord({ ...migrated, lastPeriodStart: "2026-06-12" });
    await repointLegacyStoredCycleStart(storage, NOW, { force: false });
    expect(await storedStart(storage)).toBe("2026-06-12");
  });

  it("only stamps the version when nothing withdraws the stored start", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-12" }, [may]);

    await repointLegacyStoredCycleStart(storage, NOW, { force: false });

    const profile = await storage.readProfileRecord();
    expect(profile.lastPeriodStart).toBe("2026-06-12");
    expect(profile.lastPeriodStartBeforeRepoint).toBeUndefined();
    expect(profile.storedCycleStartRepointVersion).toBe(STORED_CYCLE_START_REPOINT_VERSION);
  });

  it("does not stash when the repoint lands on the same date", async () => {
    const uncertainRun = [
      { ...createEmptyDayLogRecord("2026-06-12"), isPeriod: true, cycleStart: true, isUncertain: true },
      { ...createEmptyDayLogRecord("2026-06-13"), isPeriod: true },
    ];
    const storage = await seed({ lastPeriodStart: "2026-06-12" }, uncertainRun);

    await repointLegacyStoredCycleStart(storage, NOW, { force: true });

    const profile = await storage.readProfileRecord();
    expect(profile.lastPeriodStart).toBe("2026-06-12");
    expect(profile.lastPeriodStartBeforeRepoint).toBeUndefined();
  });

  it("repoints after a JSON import brings in the profile and its rows", async () => {
    const storage = createVolatileWebAppStorage();

    await importBackupEnvelope(storage, {
      profile: { ...createDefaultProfileRecord(), lastPeriodStart: "2026-06-12", cycleLength: 30 },
      dayLogs: [may, { ...createEmptyDayLogRecord("2026-06-12"), mood: 3 }],
      symptoms: [],
    } as unknown as Parameters<typeof importBackupEnvelope>[1]);

    expect(await storedStart(storage)).toBe("2026-05-01");
  });
});
