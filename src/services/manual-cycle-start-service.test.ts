import { createEmptyDayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import {
  applyManualCycleStart,
  buildManualCycleStartViewData,
} from "./manual-cycle-start-service";

function createProfileRecord(
  overrides?: Partial<ProfileRecord>,
): ProfileRecord {
  return {
    lastPeriodStart: "2026-03-01",
    cycleLength: 28,
    periodLength: 5,
    autoPeriodFill: true,
    irregularCycle: false,
    unpredictableCycle: false,
    ageGroup: "",
    usageGoal: "health",
    trackBBT: false,
    temperatureUnit: "c",
    trackCervicalMucus: false,
    hideSexChip: false,
    languageOverride: null,
    themeOverride: null,
    ...overrides,
  };
}

describe("manual-cycle-start-service", () => {
  it("builds conflict and short-gap prompts from the canonical web policy", () => {
    const profile = createProfileRecord();
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        isPeriod: true,
        cycleStart: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-10"),
        isPeriod: true,
        cycleStart: true,
      },
    ];
    const draftRecord = {
      ...createEmptyDayLogRecord("2026-03-09"),
      isPeriod: true,
      notes: "keep me",
    };

    const viewData = buildManualCycleStartViewData(
      profile,
      records,
      draftRecord,
      new Date(2026, 2, 17),
    );

    expect(viewData).not.toBeNull();
    expect(viewData?.prompts).toHaveLength(2);
    expect(viewData?.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "replace_existing",
          acceptLabel: "Replace",
          message: expect.stringContaining("Mar 10, 2026"),
        }),
        expect.objectContaining({
          kind: "short_gap",
          acceptLabel: "Mark anyway",
          message: expect.stringContaining("8"),
        }),
      ]),
    );
  });

  it("marks a new cycle start, clears competing starts in the cluster, and leaves settings untouched", async () => {
    const profile = createProfileRecord();
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        isPeriod: true,
        cycleStart: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-09"),
        isPeriod: true,
        notes: "keep me",
      },
      {
        ...createEmptyDayLogRecord("2026-03-10"),
        isPeriod: true,
        cycleStart: true,
        isUncertain: true,
      },
    ];
    const storage = createLocalAppStorageMock();
    const draftRecord = {
      ...createEmptyDayLogRecord("2026-03-09"),
      isPeriod: true,
      notes: "keep me",
    };

    const result = await applyManualCycleStart(
      storage,
      profile,
      records,
      draftRecord,
      new Date(2026, 2, 17),
      "en",
      {
        markUncertain: true,
        replaceExisting: true,
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        record: expect.objectContaining({
          date: "2026-03-09",
          isPeriod: true,
          cycleStart: true,
          isUncertain: true,
          notes: "keep me",
        }),
      }),
    );
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-03-09",
        cycleStart: true,
        isUncertain: true,
      }),
    );
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-03-10",
        cycleStart: false,
        isUncertain: false,
      }),
    );
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
  });

  it("rejects dates beyond the allowed future window", async () => {
    const storage = createLocalAppStorageMock();
    const profile = createProfileRecord();
    const draftRecord = createEmptyDayLogRecord("2026-03-25");

    const result = await applyManualCycleStart(
      storage,
      profile,
      [],
      draftRecord,
      new Date(2026, 2, 17),
      "en",
      {
        markUncertain: false,
        replaceExisting: false,
      },
    );

    expect(result).toEqual({
      ok: false,
      errorMessage:
        "A new cycle start can be marked only for past days and no more than 2 days ahead.",
    });
  });
});
