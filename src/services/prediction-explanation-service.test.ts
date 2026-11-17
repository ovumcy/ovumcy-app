import { getDashboardCopy } from "../i18n/dashboard-copy";
import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord, type ProfileRecord } from "../models/profile";
import { buildCurrentCycleProjection, buildCycleHistorySummary } from "./cycle-history-service";
import { buildPredictionExplanation } from "./prediction-explanation-service";

const NOW = new Date(2026, 5, 20);
const copy = getDashboardCopy("en");

function explain(profile: ProfileRecord, records: DayLogRecord[]): string {
  const projection = buildCurrentCycleProjection(
    profile,
    buildCycleHistorySummary(profile, records, NOW),
    records,
    NOW,
  );
  return buildPredictionExplanation(profile, projection, "en");
}

describe("buildPredictionExplanation", () => {
  const irregular = {
    ...createDefaultProfileRecord(),
    irregularCycle: true,
    lastPeriodStart: null,
  };

  it("explains a projection anchored by a logged start when the stored start is empty", () => {
    const start = { ...createEmptyDayLogRecord("2026-06-08"), isPeriod: true, cycleStart: true };
    expect(explain(irregular, [start])).toBe(copy.predictionsApproximateHint);
  });

  it("stays silent without any cycle anchor", () => {
    expect(explain(irregular, [])).toBe("");
  });
});
