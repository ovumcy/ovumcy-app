import type { CompletedCycleSummary, StatsCycleHistorySummary } from "../models/stats";
import { buildStatsCompletedCycleList } from "./stats-completed-cycle-list-service";

function cycle(startDate: string, cycleLength: number): CompletedCycleSummary {
  return {
    startDate,
    nextStartDate: startDate,
    cycleLength,
    periodLength: 5,
    observedPeriodLength: 5,
    factorKeys: [],
    comparisonKind: "variable",
  };
}

function history(cycles: CompletedCycleSummary[]): StatsCycleHistorySummary {
  return { completedCycles: cycles } as unknown as StatsCycleHistorySummary;
}

describe("buildStatsCompletedCycleList", () => {
  it("returns no rows below two completed cycles", () => {
    expect(buildStatsCompletedCycleList(history([]))).toEqual([]);
    expect(
      buildStatsCompletedCycleList(history([cycle("2026-01-01", 28)])),
    ).toEqual([]);
  });

  it("keeps the latest four cycles, newest first", () => {
    const rows = buildStatsCompletedCycleList(
      history([
        cycle("2026-01-01", 28),
        cycle("2026-01-29", 29),
        cycle("2026-02-27", 27),
        cycle("2026-03-26", 30),
        cycle("2026-04-25", 26),
      ]),
    );

    expect(rows.map((row) => row.startDate)).toEqual([
      "2026-04-25",
      "2026-03-26",
      "2026-02-27",
      "2026-01-29",
    ]);
    expect(rows[0]).toEqual({
      cycleLength: 26,
      key: "2026-04-25",
      periodLength: 5,
      startDate: "2026-04-25",
    });
  });
});
