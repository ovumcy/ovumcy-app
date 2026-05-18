import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import {
  collectAutoFilledPeriodDaysToClear,
  isAutoFilledPeriodCandidate,
} from "./period-auto-fill-service";

function periodDay(date: string, overrides: Partial<DayLogRecord> = {}): DayLogRecord {
  return {
    ...createEmptyDayLogRecord(date),
    isPeriod: true,
    ...overrides,
  };
}

describe("isAutoFilledPeriodCandidate", () => {
  it("returns true for a bare period-only day", () => {
    expect(isAutoFilledPeriodCandidate(periodDay("2026-05-06"))).toBe(true);
  });

  it("returns false when the day was explicitly marked as a cycle start", () => {
    expect(
      isAutoFilledPeriodCandidate(periodDay("2026-05-06", { cycleStart: true })),
    ).toBe(false);
  });

  it("returns false when the user added any extra signal to the day", () => {
    expect(
      isAutoFilledPeriodCandidate(periodDay("2026-05-06", { flow: "light" })),
    ).toBe(false);
    expect(
      isAutoFilledPeriodCandidate(periodDay("2026-05-06", { mood: 4 })),
    ).toBe(false);
    expect(
      isAutoFilledPeriodCandidate(
        periodDay("2026-05-06", { symptomIDs: ["cramps"] }),
      ),
    ).toBe(false);
    expect(
      isAutoFilledPeriodCandidate(periodDay("2026-05-06", { notes: "  noted  " })),
    ).toBe(false);
  });
});

describe("collectAutoFilledPeriodDaysToClear", () => {
  it("collects the auto-fill window when every day is bare", () => {
    const records = [
      periodDay("2026-05-06"),
      periodDay("2026-05-07"),
      periodDay("2026-05-08"),
      periodDay("2026-05-09"),
    ];
    const cleared = collectAutoFilledPeriodDaysToClear(records, "2026-05-05", 5);
    expect(cleared.map((record) => record.date)).toEqual([
      "2026-05-06",
      "2026-05-07",
      "2026-05-08",
      "2026-05-09",
    ]);
  });

  it("stops at the first day that carries manual data", () => {
    const records = [
      periodDay("2026-05-06"),
      periodDay("2026-05-07", { flow: "heavy" }),
      periodDay("2026-05-08"),
    ];
    const cleared = collectAutoFilledPeriodDaysToClear(records, "2026-05-05", 5);
    expect(cleared.map((record) => record.date)).toEqual(["2026-05-06"]);
  });

  it("returns an empty list when the anchor has no auto-filled neighbors", () => {
    const records = [periodDay("2026-05-06", { symptomIDs: ["cramps"] })];
    expect(
      collectAutoFilledPeriodDaysToClear(records, "2026-05-05", 5),
    ).toEqual([]);
  });

  it("returns an empty list when the anchor date is malformed", () => {
    expect(
      collectAutoFilledPeriodDaysToClear([periodDay("2026-05-06")], "not-a-date", 5),
    ).toEqual([]);
  });
});
