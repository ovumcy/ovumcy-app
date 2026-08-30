import { getDashboardCopy } from "../i18n/dashboard-copy";
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

  it("marks a new cycle start, clears competing starts in the cluster, and syncs the canonical last-period date", async () => {
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
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        lastPeriodStart: "2026-03-09",
      }),
    );
  });

  it("auto-fills the rest of the period window after a confirmed cycle start", async () => {
    const profile = createProfileRecord({
      autoPeriodFill: true,
      lastPeriodStart: null,
      periodLength: 4,
    });
    const storage = createLocalAppStorageMock();
    const draftRecord = {
      ...createEmptyDayLogRecord("2026-03-09"),
      isPeriod: true,
      notes: "keep me",
    };

    await applyManualCycleStart(
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

    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-03-10",
        cycleStart: false,
        isPeriod: true,
      }),
    );
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-03-11",
        cycleStart: false,
        isPeriod: true,
      }),
    );
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-03-12",
        cycleStart: false,
        isPeriod: true,
      }),
    );
  });

  it("does not auto-fill period days after today", async () => {
    const profile = createProfileRecord({
      autoPeriodFill: true,
      lastPeriodStart: null,
      periodLength: 5,
    });
    const storage = createLocalAppStorageMock();
    const draftRecord = {
      ...createEmptyDayLogRecord("2026-05-31"),
      isPeriod: true,
    };

    await applyManualCycleStart(
      storage,
      profile,
      [],
      draftRecord,
      new Date(2026, 4, 31),
      "en",
      {
        markUncertain: false,
        replaceExisting: false,
      },
    );

    const writtenDates = (storage.writeDayLogRecord as jest.Mock).mock.calls.map(
      ([written]) => written.date,
    );
    expect(writtenDates).toEqual(["2026-05-31"]);
  });

  it("localizes the manual cycle start button label with the active locale", () => {
    const profile = createProfileRecord();
    const draftRecord = {
      ...createEmptyDayLogRecord("2026-03-17"),
      isPeriod: true,
    };

    const viewData = buildManualCycleStartViewData(
      profile,
      [],
      draftRecord,
      new Date(2026, 2, 17),
      "de",
    );

    expect(viewData?.buttonLabel).toBe("Neuen Zyklusbeginn markieren");
  });

  it("rejects future dates for manual cycle starts", async () => {
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
      errorMessage: "A new cycle start can be marked only for today or past days.",
    });
  });

  it("returns null view data for a date outside the allowed manual-cycle-start window", () => {
    const profile = createProfileRecord();
    // MANUAL_CYCLE_START_FUTURE_DAYS is 2, so 3 days ahead is disallowed.
    const draftRecord = createEmptyDayLogRecord("2026-03-20");

    const viewData = buildManualCycleStartViewData(
      profile,
      [],
      draftRecord,
      new Date(2026, 2, 17),
    );

    expect(viewData).toBeNull();
  });

  it("rejects an unparseable manual-cycle-start date", () => {
    const profile = createProfileRecord();
    const draftRecord = {
      ...createEmptyDayLogRecord("2026-03-17"),
      date: "not-a-date" as never,
    };

    const viewData = buildManualCycleStartViewData(
      profile,
      [],
      draftRecord,
      new Date(2026, 2, 17),
    );

    expect(viewData).toBeNull();
  });

  it("blocks a conflicting cycle start until the caller explicitly confirms replacement", async () => {
    const profile = createProfileRecord();
    const storage = createLocalAppStorageMock();
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-10"),
        isPeriod: true,
        cycleStart: true,
      },
    ];
    const draftRecord = {
      ...createEmptyDayLogRecord("2026-03-09"),
      isPeriod: true,
    };

    const result = await applyManualCycleStart(
      storage,
      profile,
      records,
      draftRecord,
      new Date(2026, 2, 17),
      "en",
      { markUncertain: false, replaceExisting: false },
    );

    expect(result).toEqual({
      ok: false,
      errorMessage: "Confirm replacing the already marked cycle start.",
    });
    expect(storage.writeDayLogRecord).not.toHaveBeenCalled();
  });

  it("blocks a short-gap cycle start until the caller explicitly confirms the warning", async () => {
    const profile = createProfileRecord();
    const storage = createLocalAppStorageMock();
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        isPeriod: true,
        cycleStart: true,
      },
    ];
    const draftRecord = {
      ...createEmptyDayLogRecord("2026-03-09"),
      isPeriod: true,
    };

    const result = await applyManualCycleStart(
      storage,
      profile,
      records,
      draftRecord,
      new Date(2026, 2, 17),
      "en",
      { markUncertain: false, replaceExisting: false },
    );

    expect(result).toEqual({
      ok: false,
      errorMessage: "Confirm marking a cycle start with a short gap.",
    });
    expect(storage.writeDayLogRecord).not.toHaveBeenCalled();
  });

  it("reports a failure message when the storage write throws mid-commit", async () => {
    const profile = createProfileRecord({ lastPeriodStart: null });
    const storage = createLocalAppStorageMock();
    (storage.writeDayLogRecord as jest.Mock).mockRejectedValueOnce(
      new Error("simulated write failure"),
    );
    const draftRecord = {
      ...createEmptyDayLogRecord("2026-03-09"),
      isPeriod: true,
    };

    const result = await applyManualCycleStart(
      storage,
      profile,
      [],
      draftRecord,
      new Date(2026, 2, 17),
      "en",
      { markUncertain: false, replaceExisting: false },
    );

    expect(result).toEqual({
      ok: false,
      errorMessage: "Unable to mark a new cycle start. Please try again.",
    });
  });

  it("does not suggest a manual cycle start when there is no prior cycle-start anchor", () => {
    const profile = createProfileRecord({ lastPeriodStart: null });
    const draftRecord = {
      ...createEmptyDayLogRecord("2026-03-17"),
      isPeriod: true,
    };

    const viewData = buildManualCycleStartViewData(
      profile,
      [],
      draftRecord,
      new Date(2026, 2, 17),
    );

    expect(viewData?.notices.suggestion).toBeUndefined();
  });
});

describe("early-bleeding notice structure (medical safety)", () => {
  // The notice fires when a marked early bleed falls 6-12 days after the
  // ESTIMATED ovulation (previous start + [cycleLength - luteal]). That estimate
  // inherits the prediction's error, so the surface must NOT imply a precise
  // implantation window — it stays a hedged "may not be a new cycle" nudge.
  function earlyBleedViewData(targetDate: string, now: Date) {
    const profile = createProfileRecord({ lastPeriodStart: "2026-03-01" });
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        isPeriod: true,
        cycleStart: true,
      },
    ];
    const draftRecord = {
      ...createEmptyDayLogRecord(targetDate),
      isPeriod: true,
    };
    return buildManualCycleStartViewData(profile, records, draftRecord, now);
  }

  it("fires the hedged notice for a bleed inside the 6-12 day post-ovulation window", () => {
    // calcOvulationDay(28, 14) is cycle day 14, so the estimate is
    // 2026-03-01 + 13 = 2026-03-14; target 2026-03-23 is +9 days, inside [6, 12].
    const viewData = earlyBleedViewData("2026-03-23", new Date(2026, 2, 23));

    const notice = viewData?.notices.implantation;
    expect(notice).toBe(getDashboardCopy("en").implantationWarning);
    // Uncertainty is explicit: timing alone cannot decide.
    expect(notice).toContain("may not be");
    expect(notice).toContain("timing alone cannot tell");
    // The surface must never imply a precise implantation event/window: it does
    // not name "implantation", nor expose the estimated ovulation date or a
    // day-count, so the estimate's error is not dressed up as precision.
    expect(notice).not.toMatch(/implantation/i);
    expect(notice).not.toMatch(/\b\d/);
    expect(notice).not.toContain("2026-03-15");
  });

  it("stays silent for an early bleed too soon after the estimated ovulation", () => {
    // Target 2026-03-19 is only +5 days after the estimated 2026-03-14 ovulation.
    const viewData = earlyBleedViewData("2026-03-19", new Date(2026, 2, 19));

    expect(viewData?.notices.implantation).toBeUndefined();
  });

  // Both edges of the window, and the reason they are worth pinning: the
  // estimate here must be the date calcOvulationDay names, cycleStart + day - 1.
  // Adding the cycle day itself instead put ovulation on 2026-03-15 and carried
  // the whole window a day with it, so the notice appeared a day late at the
  // bottom and a day late at the top. Nothing else asserts this arithmetic.
  it("fires on the first day of the window, six days after the estimated ovulation", () => {
    // 2026-03-20 is +6 from 2026-03-14 — the inclusive lower edge. Read from a
    // 2026-03-15 ovulation it would be +5, and the notice would stay silent.
    const viewData = earlyBleedViewData("2026-03-20", new Date(2026, 2, 20));

    expect(viewData?.notices.implantation).toBe(
      getDashboardCopy("en").implantationWarning,
    );
  });

  it("stays silent one day past the window", () => {
    // 2026-03-27 is +13 from 2026-03-14, just outside [6, 12]. Read from a
    // 2026-03-15 ovulation it would be +12, and the notice would still fire.
    const viewData = earlyBleedViewData("2026-03-27", new Date(2026, 2, 27));

    expect(viewData?.notices.implantation).toBeUndefined();
  });

  it("stays silent when the observed cycles are too short to place an ovulation", () => {
    // Four observed 12-day cycles: below the 15-day floor the model needs, so
    // calcOvulationDay yields no day at all. There is no window to judge the
    // bleed against, and a hedged medical notice hung on an invented estimate
    // would be worse than none.
    const profile = createProfileRecord({ lastPeriodStart: "2026-01-01" });
    const starts = ["2026-01-01", "2026-01-13", "2026-01-25", "2026-02-06", "2026-02-18"];
    const records = starts.map((date) => ({
      ...createEmptyDayLogRecord(date),
      isPeriod: true,
      cycleStart: true,
    }));
    const draftRecord = {
      ...createEmptyDayLogRecord("2026-02-26"),
      isPeriod: true,
    };

    const viewData = buildManualCycleStartViewData(
      profile,
      records,
      draftRecord,
      new Date(2026, 1, 26),
    );

    expect(viewData?.notices.implantation).toBeUndefined();
  });
});
