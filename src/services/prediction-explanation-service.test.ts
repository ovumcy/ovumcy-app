import { getDashboardCopy } from "../i18n/dashboard-copy";
import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord, type ProfileRecord } from "../models/profile";
import { buildCurrentCycleProjection, buildCycleHistorySummary } from "./cycle-history-service";
import type { StatsCycleProjection } from "../models/stats";
import {
  buildPredictionExplanation,
  buildPredictionExplanationText,
  resolvePredictionExplanationKind,
} from "./prediction-explanation-service";

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

  it("explains a facts-only profile with the facts-only hint", () => {
    const factsOnly = { ...createDefaultProfileRecord(), unpredictableCycle: true };
    expect(explain(factsOnly, [])).toBe(copy.factsOnlyHint);
  });

  it("explains a paused projection with the pregnancy-paused hint", () => {
    const records = [
      { ...createEmptyDayLogRecord("2026-06-01"), isPeriod: true, cycleStart: true },
      { ...createEmptyDayLogRecord("2026-06-10"), pregnancyTest: "positive" as const },
    ];
    expect(explain(createDefaultProfileRecord(), records)).toBe(copy.pregnancyPausedHint);
  });

  it("resolves each explanation kind independent of locale", () => {
    const base = {
      cycleAnchorDate: "2026-06-01",
      isPredictionStale: false,
      isPregnancyPaused: false,
      nextPeriodWindowStartDate: "2026-06-27",
      nextPeriodWindowEndDate: "2026-06-29",
    } as StatsCycleProjection;
    const profile = createDefaultProfileRecord();

    expect(resolvePredictionExplanationKind(profile, base)).toBe("variable_ranges");
    expect(
      resolvePredictionExplanationKind(profile, { ...base, isPredictionStale: true }),
    ).toBeNull();
    expect(
      resolvePredictionExplanationKind(profile, {
        ...base,
        nextPeriodWindowEndDate: "2026-06-27",
      }),
    ).toBeNull();
    expect(
      resolvePredictionExplanationKind(profile, { ...base, isPregnancyPaused: true }),
    ).toBe("pregnancy_paused");
  });

  it("renders each shareable kind as its dashboard copy and nothing for none", () => {
    expect(buildPredictionExplanationText("variable_ranges", "en")).toBe(
      copy.predictionVariableRangesHint,
    );
    expect(buildPredictionExplanationText("approximate", "en")).toBe(
      copy.predictionsApproximateHint,
    );
    expect(buildPredictionExplanationText("facts_only", "en")).toBe(copy.factsOnlyHint);
    expect(buildPredictionExplanationText(null, "en")).toBe("");
  });

  it("defaults to English when no locale is given", () => {
    const profile = { ...createDefaultProfileRecord(), unpredictableCycle: true };
    const projection = buildCurrentCycleProjection(
      profile,
      buildCycleHistorySummary(profile, [], NOW),
      [],
      NOW,
    );

    expect(buildPredictionExplanationText("facts_only")).toBe(copy.factsOnlyHint);
    expect(buildPredictionExplanation(profile, projection)).toBe(copy.factsOnlyHint);
  });
});
