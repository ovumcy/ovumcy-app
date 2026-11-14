import goldenVectors from "./__fixtures__/cycle-prediction-golden-vectors.json";
import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord } from "../models/profile";
import {
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
  collectCycleStartDates,
  resolveLatestCycleStartAnchorBeforeOrOn,
} from "./cycle-history-service";

// The cycleBoundaries section of the shared fixture (vendored byte-identical
// from ovumcy-web, consumed there by TestCycleBoundaries_GoldenVectors) pins
// where cycles start and the two readers that must agree on it: the running
// cycle anchor and the pregnancy pause. See docs/cycle-prediction.md.

type BoundaryDay = {
  date: string;
  period?: boolean;
  flow?: string;
  spottingSymptom?: boolean;
  cycleStart?: boolean;
  uncertain?: boolean;
  pregnancyTest?: string;
};

type BoundaryCase = {
  name: string;
  today: string;
  storedStart: string | null;
  days: BoundaryDay[];
  expected: { boundaries: string[]; anchor: string | null; pausedSince: string | null };
};

const section = goldenVectors.cycleBoundaries as { schemaVersion: number; cases: BoundaryCase[] };

function toRecord(day: BoundaryDay): DayLogRecord {
  return {
    ...createEmptyDayLogRecord(day.date),
    isPeriod: day.period === true,
    flow: (day.flow ?? "none") as DayLogRecord["flow"],
    symptomIDs: day.spottingSymptom === true ? ["spotting"] : [],
    cycleStart: day.cycleStart === true,
    isUncertain: day.uncertain === true,
    pregnancyTest: (day.pregnancyTest ?? "none") as DayLogRecord["pregnancyTest"],
  };
}

function localNoon(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12);
}

describe("cycle-boundary golden vectors", () => {
  it("loads the shared section", () => {
    expect(section.schemaVersion).toBe(1);
    expect(section.cases.length).toBe(13);
  });

  it.each(section.cases.map((vector) => [vector.name, vector] as const))("%s", (_name, vector) => {
    const profile = { ...createDefaultProfileRecord(), lastPeriodStart: vector.storedStart };
    const records = vector.days.map(toRecord);
    const now = localNoon(vector.today);

    expect(collectCycleStartDates(profile, records, vector.today)).toEqual(
      vector.expected.boundaries,
    );
    const anchor = resolveLatestCycleStartAnchorBeforeOrOn(profile, records, vector.today);
    expect(anchor).toBe(vector.expected.anchor);

    const projection = buildCurrentCycleProjection(
      profile,
      buildCycleHistorySummary(profile, records, now),
      records,
      now,
    );
    expect(projection.isPregnancyPaused).toBe(vector.expected.pausedSince !== null);
    expect(projection.isPregnancyPaused ? projection.pregnancyTestDate : null).toBe(
      vector.expected.pausedSince,
    );
    expect(projection.cycleAnchorDate).toBe(vector.expected.anchor);

    const positives = records
      .filter((record) => record.pregnancyTest === "positive")
      .map((record) => record.date)
      .sort();
    const latestPositive = positives[positives.length - 1];
    if (latestPositive && !projection.isPregnancyPaused) {
      expect(anchor !== null && anchor > latestPositive).toBe(true);
    }
  });
});
