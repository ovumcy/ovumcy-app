import { createEmptyDayLogRecord } from "../models/day-log";
import type { StatsCycleProjection } from "../models/stats";
import { MIN_CURRENT_CYCLE_BBT_POINTS } from "../models/stats";
import { buildStatsBBTSeries } from "./stats-insights-service";

function createProjection(
  cycleAnchorDate: string | null = "2026-03-14",
): StatsCycleProjection {
  return {
    cycleAnchorDate,
    currentCycleDay: null,
    currentPhase: "follicular",
    isPredictionStale: false,
    isPregnancyPaused: false,
    pregnancyTestDate: null,
    lutealPhase: 14,
    nextPeriodDate: null,
    nextPeriodWindowStartDate: null,
    nextPeriodWindowEndDate: null,
    ovulationDate: null,
    predictionCycleLength: 28,
  };
}

function makeBBTRecord(date: string, bbt: number) {
  return { ...createEmptyDayLogRecord(date), bbt };
}

describe("buildStatsBBTSeries", () => {
  describe("MIN_CURRENT_CYCLE_BBT_POINTS constant", () => {
    it("is 5", () => {
      expect(MIN_CURRENT_CYCLE_BBT_POINTS).toBe(5);
    });
  });

  it("returns empty series when there are fewer than 5 current-cycle BBT values (4 values → no chart)", () => {
    const records = [
      makeBBTRecord("2026-03-14", 36.5),
      makeBBTRecord("2026-03-15", 36.52),
      makeBBTRecord("2026-03-16", 36.48),
      makeBBTRecord("2026-03-17", 36.55),
    ];

    const result = buildStatsBBTSeries(
      createProjection("2026-03-14"),
      records,
      new Date(2026, 2, 17),
    );

    expect(result).toHaveLength(0);
  });

  it("returns a series with 5 points when there are exactly 5 current-cycle BBT values", () => {
    const records = [
      makeBBTRecord("2026-03-14", 36.5),
      makeBBTRecord("2026-03-15", 36.52),
      makeBBTRecord("2026-03-16", 36.48),
      makeBBTRecord("2026-03-17", 36.55),
      makeBBTRecord("2026-03-18", 36.7),
    ];

    const result = buildStatsBBTSeries(
      createProjection("2026-03-14"),
      records,
      new Date(2026, 2, 18),
    );

    expect(result).toHaveLength(5);
    expect(result[0]?.key).toBe("2026-03-14");
    expect(result[4]?.key).toBe("2026-03-18");
    result.forEach((point) => {
      expect(point.value).toBeGreaterThan(0);
      expect(typeof point.label).toBe("string");
      expect(typeof point.cycleDay).toBe("number");
    });
  });

  it("excludes records outside the current cycle (before anchor date)", () => {
    const records = [
      // Previous cycle — should be excluded
      makeBBTRecord("2026-02-28", 36.4),
      makeBBTRecord("2026-03-01", 36.41),
      makeBBTRecord("2026-03-02", 36.42),
      // Current cycle
      makeBBTRecord("2026-03-14", 36.5),
      makeBBTRecord("2026-03-15", 36.52),
      makeBBTRecord("2026-03-16", 36.48),
      makeBBTRecord("2026-03-17", 36.55),
      makeBBTRecord("2026-03-18", 36.7),
    ];

    const result = buildStatsBBTSeries(
      createProjection("2026-03-14"),
      records,
      new Date(2026, 2, 18),
    );

    expect(result).toHaveLength(5);
    expect(result.every((p) => p.key >= "2026-03-14")).toBe(true);
  });

  it("returns empty series when cycleAnchorDate is null", () => {
    const records = [
      makeBBTRecord("2026-03-14", 36.5),
      makeBBTRecord("2026-03-15", 36.52),
      makeBBTRecord("2026-03-16", 36.48),
      makeBBTRecord("2026-03-17", 36.55),
      makeBBTRecord("2026-03-18", 36.7),
    ];

    const result = buildStatsBBTSeries(
      createProjection(null),
      records,
      new Date(2026, 2, 18),
    );

    expect(result).toHaveLength(0);
  });
});
