import { createEmptyDayLogRecord } from "../../../models/day-log";
import { createDefaultProfileRecord } from "../../../models/profile";
import { createPostpartumRecord } from "../../../models/postpartum";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import { buildManualCycleStartViewData } from "../../../services/manual-cycle-start-service";
import { runManualCycleStartAction } from "./run-manual-cycle-start-action";

describe("run-manual-cycle-start-action", () => {
  it("confirms prompts and applies the shared manual cycle start flow", async () => {
    const storage = createLocalAppStorageMock();
    const profile = {
      ...createDefaultProfileRecord(),
      autoPeriodFill: false,
      lastPeriodStart: "2026-03-10",
    };
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-10"),
        cycleStart: true,
        isPeriod: true,
      },
    ];
    const draftRecord = {
      ...createEmptyDayLogRecord("2026-03-20"),
      isPeriod: true,
    };
    const manualCycleStart = buildManualCycleStartViewData(
      profile,
      records,
      draftRecord,
      new Date(2026, 2, 26),
      "en",
    );

    expect(manualCycleStart?.prompts).toHaveLength(1);

    const confirmPrompt = jest.fn().mockResolvedValue(true);
    const result = await runManualCycleStartAction({
      cancelLabel: "Cancel",
      confirmPrompt,
      locale: "en",
      manualCycleStart: manualCycleStart!,
      now: new Date(2026, 2, 26),
      profile,
      record: draftRecord,
      records,
      storage,
    });

    expect(confirmPrompt).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
      }),
    );
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-03-20",
        cycleStart: true,
        isPeriod: true,
        isUncertain: true,
      }),
    );
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        // An uncertain mark is not mirrored into the stored start.
        lastPeriodStart: "2026-03-10",
      }),
    );
  });

  it("stops the action when the owner cancels a confirmation prompt", async () => {
    const storage = createLocalAppStorageMock();
    const profile = {
      ...createDefaultProfileRecord(),
      autoPeriodFill: false,
      lastPeriodStart: "2026-03-10",
    };
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-10"),
        cycleStart: true,
        isPeriod: true,
      },
    ];
    const draftRecord = {
      ...createEmptyDayLogRecord("2026-03-20"),
      isPeriod: true,
    };
    const manualCycleStart = buildManualCycleStartViewData(
      profile,
      records,
      draftRecord,
      new Date(2026, 2, 26),
      "en",
    );

    const result = await runManualCycleStartAction({
      cancelLabel: "Cancel",
      confirmPrompt: jest.fn().mockResolvedValue(false),
      locale: "en",
      manualCycleStart: manualCycleStart!,
      now: new Date(2026, 2, 26),
      profile,
      record: draftRecord,
      records,
      storage,
    });

    expect(result).toBeNull();
    expect(storage.writeDayLogRecord).not.toHaveBeenCalled();
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
  });

  it("replaces a competing cycle start within the same period cluster when the owner confirms", async () => {
    const storage = createLocalAppStorageMock();
    const profile = {
      ...createDefaultProfileRecord(),
      autoPeriodFill: false,
      lastPeriodStart: "2026-02-01",
    };
    const existingCycleStart = {
      ...createEmptyDayLogRecord("2026-03-10"),
      cycleStart: true,
      isPeriod: true,
    };
    const adjacentPeriodDay = {
      ...createEmptyDayLogRecord("2026-03-11"),
      cycleStart: false,
      isPeriod: true,
    };
    const records = [existingCycleStart, adjacentPeriodDay];
    const draftRecord = {
      ...createEmptyDayLogRecord("2026-03-11"),
      isPeriod: true,
    };
    const manualCycleStart = buildManualCycleStartViewData(
      profile,
      records,
      draftRecord,
      new Date(2026, 2, 26),
      "en",
    );

    // Two prompts stack here: the target day is adjacent to an existing
    // cycle-start day (replace_existing) and the gap to the resolved
    // previous anchor is short (short_gap).
    expect(manualCycleStart?.prompts.map((prompt) => prompt.kind)).toEqual([
      "replace_existing",
      "short_gap",
    ]);

    const confirmPrompt = jest.fn().mockResolvedValue(true);
    const result = await runManualCycleStartAction({
      cancelLabel: "Cancel",
      confirmPrompt,
      locale: "en",
      manualCycleStart: manualCycleStart!,
      now: new Date(2026, 2, 26),
      profile,
      record: draftRecord,
      records,
      storage,
    });

    expect(confirmPrompt).toHaveBeenCalledTimes(2);
    expect(result).toEqual(expect.objectContaining({ ok: true }));
    // The old cycle-start day within the cluster is demoted...
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-03-10",
        cycleStart: false,
      }),
    );
    // ...and the newly targeted day becomes the cycle start instead.
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-03-11",
        cycleStart: true,
        isPeriod: true,
      }),
    );
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      // The short-gap confirmation makes the mark uncertain, so it is not
      // mirrored; the stored start lies outside the marked cluster and stays.
      expect.objectContaining({ lastPeriodStart: "2026-02-01" }),
    );
  });
});

describe("run-manual-cycle-start-action after a pregnancy ends", () => {
  it("rebuilds the prompts with the stored birth date and marks the start uncertain", async () => {
    const storage = createLocalAppStorageMock({
      listPostpartumRecords: jest
        .fn()
        .mockResolvedValue([createPostpartumRecord({ startedAt: "2026-06-01" })]),
    });
    const profile = {
      ...createDefaultProfileRecord(),
      autoPeriodFill: false,
      lastPeriodStart: "2025-09-01",
    };
    const records = [
      { ...createEmptyDayLogRecord("2025-09-01"), cycleStart: true, isPeriod: true },
    ];
    const draftRecord = { ...createEmptyDayLogRecord("2026-06-11"), isPeriod: true };
    const now = new Date(2026, 5, 20);
    // The screen's view data carries no pregnancy end dates, so no prompt.
    const manualCycleStart = buildManualCycleStartViewData(profile, records, draftRecord, now, "en");
    expect(manualCycleStart?.prompts).toEqual([]);

    const confirmPrompt = jest.fn().mockResolvedValue(true);
    const result = await runManualCycleStartAction({
      cancelLabel: "Cancel",
      confirmPrompt,
      locale: "en",
      manualCycleStart: manualCycleStart!,
      now,
      profile,
      record: draftRecord,
      records,
      storage,
    });

    expect(confirmPrompt).toHaveBeenCalledWith(
      expect.stringContaining("Days since the pregnancy ended: 10."),
      "Mark anyway",
      "Cancel",
    );
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        record: expect.objectContaining({ isUncertain: true }),
      }),
    );
  });
});
