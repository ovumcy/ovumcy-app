import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord, type ProfileRecord } from "../models/profile";
import { createDefaultSymptomRecords } from "../models/symptom";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { createVolatileWebAppStorage } from "../storage/local/volatile-web-app-storage";
import { createDefaultSyncPreferencesRecord } from "../sync/sync-contract";
import { repointStoredCycleStart } from "./cycle-history-service";
import { planPeriodStartMove } from "./period-start-move-service";
import { saveCycleSettings } from "./settings-screen-service";
import { createLoadedSettingsState } from "./settings-view-service";

const NOW = new Date(2026, 5, 20);
const TODAY = "2026-06-20";

function periodDay(
  date: string,
  overrides: Partial<DayLogRecord> = {},
): DayLogRecord {
  return { ...createEmptyDayLogRecord(date), isPeriod: true, ...overrides };
}

function startDay(date: string, overrides: Partial<DayLogRecord> = {}): DayLogRecord {
  return periodDay(date, { cycleStart: true, ...overrides });
}

// A run the auto-fill wrote: the start mark on the first day, bare period days after.
function filledRun(first: string, length: number): DayLogRecord[] {
  const [year, month, day] = first.split("-").map(Number) as [number, number, number];
  return Array.from({ length }, (_, offset) => {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day + offset).padStart(2, "0")}`;
    return offset === 0 ? startDay(date) : periodDay(date);
  });
}

async function seed(
  profile: Partial<ProfileRecord>,
  records: DayLogRecord[],
): Promise<LocalAppStorage> {
  const storage = createVolatileWebAppStorage();
  await storage.writeProfileRecord({
    ...createDefaultProfileRecord(),
    periodLength: 5,
    autoPeriodFill: true,
    ...profile,
  });
  for (const record of records) {
    await storage.writeDayLogRecord(record);
  }
  return storage;
}

async function moveStart(
  storage: LocalAppStorage,
  lastPeriodStart: string | null,
  overrides: { autoPeriodFill?: boolean } = {},
) {
  const profile = await storage.readProfileRecord();
  return saveCycleSettings(
    storage,
    createLoadedSettingsState(
      profile,
      createDefaultSyncPreferencesRecord(),
      false,
      false,
      createDefaultSymptomRecords(),
      {
        values: { preset: "all", fromDate: "2026-01-01", toDate: TODAY },
        availableSummary: { totalEntries: 0, hasData: false, dateFrom: null, dateTo: null },
        summary: { totalEntries: 0, hasData: false, dateFrom: null, dateTo: null },
        bounds: { minDate: "2026-01-01", maxDate: TODAY },
      },
    ),
    {
      lastPeriodStart,
      cycleLength: profile.cycleLength,
      periodLength: profile.periodLength,
      autoPeriodFill: overrides.autoPeriodFill ?? profile.autoPeriodFill,
      irregularCycle: profile.irregularCycle,
      unpredictableCycle: profile.unpredictableCycle,
      ageGroup: profile.ageGroup,
      usageGoal: profile.usageGoal,
    },
    NOW,
  );
}

async function allRows(storage: LocalAppStorage): Promise<DayLogRecord[]> {
  return storage.listDayLogRecordsInRange("0001-01-01", "9999-12-31");
}

async function rowDates(storage: LocalAppStorage): Promise<string[]> {
  return (await allRows(storage)).map((record) => record.date).sort();
}

async function rowOn(storage: LocalAppStorage, date: string) {
  return (await allRows(storage)).find((record) => record.date === date);
}

describe("settings period start move", () => {
  it("moves the mark, clears the old filled run and fills the new run in one commit", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-10" }, filledRun("2026-06-10", 5));

    const result = await moveStart(storage, "2026-06-08");

    expect(result.ok).toBe(true);
    expect(await rowDates(storage)).toEqual([
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
    ]);
    expect((await rowOn(storage, "2026-06-08"))?.cycleStart).toBe(true);
    const oldStart = await rowOn(storage, "2026-06-10");
    expect(oldStart).toEqual(expect.objectContaining({ isPeriod: true, cycleStart: false }));
    const profile = await storage.readProfileRecord();
    expect(profile.lastPeriodStart).toBe("2026-06-08");
    // The anchor and the pause read the moved start, with no phantom cycle left.
    expect(repointStoredCycleStart(profile, await allRows(storage), TODAY)).toBe("2026-06-08");
  });

  it("removes the old run that the new run does not cover when the start moves later", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-05" }, filledRun("2026-06-05", 5));

    const result = await moveStart(storage, "2026-06-08");

    expect(result.ok).toBe(true);
    expect(await rowDates(storage)).toEqual([
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
    ]);
  });

  it("with auto-fill off, moves the mark and fills nothing", async () => {
    const storage = await seed(
      { lastPeriodStart: "2026-06-10", autoPeriodFill: false },
      [startDay("2026-06-10")],
    );

    const result = await moveStart(storage, "2026-06-12");

    expect(result.ok).toBe(true);
    expect(await rowDates(storage)).toEqual(["2026-06-12"]);
    expect((await rowOn(storage, "2026-06-12"))?.cycleStart).toBe(true);
    expect((await storage.readProfileRecord()).lastPeriodStart).toBe("2026-06-12");
  });

  it("with auto-fill off, leaves bare period days the user ticked in the old range", async () => {
    const storage = await seed(
      { lastPeriodStart: "2026-06-10", autoPeriodFill: false },
      [startDay("2026-06-10"), periodDay("2026-06-11"), periodDay("2026-06-12")],
    );

    await moveStart(storage, "2026-06-04");

    expect(await rowDates(storage)).toEqual(["2026-06-04", "2026-06-11", "2026-06-12"]);
  });

  it("turning auto-fill off with the move still clears the old filled run and writes only the mark", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-10" }, filledRun("2026-06-10", 5));

    const result = await moveStart(storage, "2026-06-12", { autoPeriodFill: false });

    expect(result.ok).toBe(true);
    expect(await rowDates(storage)).toEqual(["2026-06-12"]);
  });

  it("keeps a user-edited row in the old run and everything after it", async () => {
    const edited = periodDay("2026-06-07", { notes: "cramps", mood: 2, flow: "heavy" });
    const storage = await seed({ lastPeriodStart: "2026-06-05" }, [
      startDay("2026-06-05"),
      periodDay("2026-06-06"),
      edited,
      periodDay("2026-06-08"),
      periodDay("2026-06-09"),
    ]);

    const result = await moveStart(storage, "2026-06-12");

    expect(result.ok).toBe(true);
    expect(await rowOn(storage, "2026-06-05")).toBeUndefined();
    expect(await rowOn(storage, "2026-06-06")).toBeUndefined();
    expect(await rowOn(storage, "2026-06-07")).toEqual(edited);
    expect(await rowOn(storage, "2026-06-08")).toBeDefined();
    expect(await rowOn(storage, "2026-06-09")).toBeDefined();
    expect((await rowOn(storage, "2026-06-12"))?.cycleStart).toBe(true);
  });

  it("keeps the old start row and its data, with only the mark released", async () => {
    const noted = startDay("2026-06-10", { notes: "first day", bbt: 36.5 });
    const storage = await seed({ lastPeriodStart: "2026-06-10" }, [
      noted,
      periodDay("2026-06-11"),
      periodDay("2026-06-12"),
    ]);

    await moveStart(storage, "2026-06-16");

    expect(await rowOn(storage, "2026-06-10")).toEqual({ ...noted, cycleStart: false });
    // The start row holds data, so the run after it is not an auto-filled run.
    expect(await rowOn(storage, "2026-06-11")).toBeDefined();
    expect(await rowOn(storage, "2026-06-12")).toBeDefined();
  });

  it("keeps all data on an existing row at the new start and inside the new run", async () => {
    const onNewStart = {
      ...createEmptyDayLogRecord("2026-06-12"),
      notes: "spotting before",
      mood: 3,
    };
    const insideRun = periodDay("2026-06-13", { flow: "heavy", notes: "heavy day" });
    const storage = await seed({ lastPeriodStart: "2026-06-10" }, [
      ...filledRun("2026-06-10", 2),
      onNewStart,
      insideRun,
    ]);

    await moveStart(storage, "2026-06-12");

    expect(await rowOn(storage, "2026-06-12")).toEqual({
      ...onNewStart,
      isPeriod: true,
      cycleStart: true,
    });
    expect(await rowOn(storage, "2026-06-13")).toEqual(insideRun);
    expect((await rowOn(storage, "2026-06-14"))?.isPeriod).toBe(true);
  });

  it("fills only days up to today for a start moved to a recent date", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-10" }, filledRun("2026-06-10", 5));

    await moveStart(storage, "2026-06-19");

    expect(await rowDates(storage)).toEqual(["2026-06-19", "2026-06-20"]);
  });

  it("keeps the old start recorded when the new one is a full shortest cycle later", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-01" }, filledRun("2026-06-01", 5));

    await moveStart(storage, "2026-06-16");

    expect(await rowOn(storage, "2026-06-01")).toEqual(startDay("2026-06-01"));
    expect((await rowOn(storage, "2026-06-05"))?.isPeriod).toBe(true);
    expect((await rowOn(storage, "2026-06-16"))?.cycleStart).toBe(true);
  });

  it("keeps the old run once a later cycle start is logged", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-01" }, [
      ...filledRun("2026-06-01", 5),
      startDay("2026-06-30"),
    ]);

    await moveStart(storage, "2026-06-03");

    // The old rows stay (the later cycle makes the old start history); only the
    // one-start-per-period rule moves the mark inside the shared period.
    expect((await rowOn(storage, "2026-06-01"))?.isPeriod).toBe(true);
    expect((await rowOn(storage, "2026-06-02"))?.isPeriod).toBe(true);
    expect((await rowOn(storage, "2026-06-03"))?.cycleStart).toBe(true);
    expect((await rowOn(storage, "2026-06-01"))?.cycleStart).toBe(false);
    expect((await rowOn(storage, "2026-06-30"))?.cycleStart).toBe(true);
  });

  it("releases a competing mark inside the new start's period", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-10" }, [
      startDay("2026-06-10"),
      periodDay("2026-06-11"),
      startDay("2026-06-12", { isUncertain: true }),
    ]);

    await moveStart(storage, "2026-06-11", { autoPeriodFill: false });

    const marks = (await allRows(storage)).filter((record) => record.cycleStart);
    expect(marks.map((record) => record.date)).toEqual(["2026-06-11"]);
  });

  it("writes nothing when the commit fails", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-10" }, filledRun("2026-06-10", 5));
    const rowsBefore = await allRows(storage);
    const profileBefore = await storage.readProfileRecord();
    const failing: LocalAppStorage = {
      ...storage,
      commitDayLogChanges: jest.fn().mockRejectedValue(new Error("disk full")),
      writeProfileRecord: jest.fn(storage.writeProfileRecord),
      writeDayLogRecord: jest.fn(storage.writeDayLogRecord),
    };

    const result = await moveStart(failing, "2026-06-08");

    expect(result).toEqual({ ok: false, errorCode: "generic" });
    expect(failing.commitDayLogChanges).toHaveBeenCalledTimes(1);
    expect(failing.writeProfileRecord).not.toHaveBeenCalled();
    expect(failing.writeDayLogRecord).not.toHaveBeenCalled();
    expect(await allRows(storage)).toEqual(rowsBefore);
    expect(await storage.readProfileRecord()).toEqual(profileBefore);
  });

  it("rejects a future start before touching storage", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-10" }, filledRun("2026-06-10", 5));
    const commit = jest.spyOn(storage, "commitDayLogChanges");
    const write = jest.spyOn(storage, "writeProfileRecord");

    const result = await moveStart(storage, "2026-06-21");

    expect(result).toEqual({ ok: false, errorCode: "invalid_last_period_start" });
    expect(commit).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(await rowDates(storage)).toHaveLength(5);
  });

  it("saves a cleared or unchanged start as a profile-only write", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-10" }, filledRun("2026-06-10", 5));
    const commit = jest.spyOn(storage, "commitDayLogChanges");

    await moveStart(storage, "2026-06-10", { autoPeriodFill: false });
    await moveStart(storage, null);

    expect(commit).not.toHaveBeenCalled();
    expect(await rowDates(storage)).toHaveLength(5);
    expect((await storage.readProfileRecord()).lastPeriodStart).toBeNull();
  });

  it("marks the first start when none was stored", async () => {
    const storage = await seed({ lastPeriodStart: null }, []);

    await moveStart(storage, "2026-06-18");

    expect(await rowDates(storage)).toEqual(["2026-06-18", "2026-06-19", "2026-06-20"]);
    expect((await storage.readProfileRecord()).lastPeriodStart).toBe("2026-06-18");
  });

  it("leaves an unmarked row at the old stored start untouched", async () => {
    const storage = await seed(
      { lastPeriodStart: "2026-06-10", autoPeriodFill: false },
      [periodDay("2026-06-10", { notes: "kept" })],
    );

    await moveStart(storage, "2026-06-08");

    expect(await rowDates(storage)).toEqual(["2026-06-08", "2026-06-10"]);
    expect(await rowOn(storage, "2026-06-10")).toEqual(
      expect.objectContaining({ isPeriod: true, cycleStart: false, notes: "kept" }),
    );
  });
});

describe("planPeriodStartMove", () => {
  it("plans a profile-only change when the start is cleared", () => {
    const profile = { ...createDefaultProfileRecord(), lastPeriodStart: "2026-06-10" };
    const nextProfile = { ...profile, lastPeriodStart: null };

    expect(planPeriodStartMove(profile, nextProfile, filledRun("2026-06-10", 5), NOW)).toEqual({
      writes: [],
      deletes: [],
      profile: nextProfile,
    });
  });
});
