import { createEmptyDayLogRecord } from "../../../models/day-log";
import { createDefaultProfileRecord } from "../../../models/profile";
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
        lastPeriodStart: "2026-03-20",
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
});
