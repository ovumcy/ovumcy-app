import { createEmptyDayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import {
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
  collectCycleStartDates,
  hasDataDrivenPredictionSpan,
  shouldShowAgeVariabilityHint,
} from "./cycle-history-service";

function createProfileRecord(
  overrides?: Partial<ProfileRecord>,
): ProfileRecord {
  return {
    lastPeriodStart: "2026-03-24",
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
    dismissedCalendarPredictionNoticeKey: null,
    dismissedOnboardingHelperNoticeKey: null,
    ...overrides,
  };
}

describe("cycle-history-service", () => {
  it("clusters nearby period days into one observed cycle start", () => {
    const profile = createProfileRecord({
      lastPeriodStart: "2026-03-24",
    });
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-02"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-03"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-24"),
        isPeriod: true,
      },
    ];

    expect(collectCycleStartDates(profile, records, "2026-03-24")).toEqual([
      "2026-03-01",
      "2026-03-24",
    ]);
  });

  it("keeps the settings cycle length until there are at least two completed cycles", () => {
    const profile = createProfileRecord();
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-02"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-03"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-24"),
        isPeriod: true,
      },
    ];
    const now = new Date(2026, 2, 24);
    const history = buildCycleHistorySummary(profile, records, now);
    const projection = buildCurrentCycleProjection(profile, history, records, now);

    expect(projection.predictionCycleLength).toBe(28);
    expect(projection.ovulationDate).toBe("2026-04-06");
    expect(projection.isPredictionStale).toBe(false);
  });

  it("stops exposing stale prediction dates after the expected next period has passed", () => {
    const profile = createProfileRecord({
      lastPeriodStart: "2026-02-01",
    });
    const now = new Date(2026, 2, 25);
    const history = buildCycleHistorySummary(profile, [], now);
    const projection = buildCurrentCycleProjection(profile, history, [], now);

    expect(projection).toEqual(
      expect.objectContaining({
        currentCycleDay: null,
        currentPhase: "unknown",
        isPredictionStale: true,
        nextPeriodDate: null,
        ovulationDate: null,
      }),
    );
  });

  describe("data-driven prediction span", () => {
    const cycleStarts = [
      "2025-12-01",
      "2025-12-29",
      "2026-01-26",
      "2026-02-23",
    ];

    function buildVaryingCycles(
      lastPeriodStart: string,
      lengths: number[],
    ): { profile: ProfileRecord; records: ReturnType<typeof createEmptyDayLogRecord>[] } {
      const profile = createProfileRecord({ lastPeriodStart });
      const records: ReturnType<typeof createEmptyDayLogRecord>[] = [];
      let cursor = new Date(2025, 11, 1);
      for (const length of lengths) {
        const dateValue = `${cursor.getFullYear()}-${String(
          cursor.getMonth() + 1,
        ).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        records.push({
          ...createEmptyDayLogRecord(dateValue),
          isPeriod: true,
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + length);
      }
      return { profile, records };
    }

    it("returns no range window with fewer than 3 completed cycles", () => {
      const profile = createProfileRecord({ lastPeriodStart: "2026-01-01" });
      const records = [
        { ...createEmptyDayLogRecord("2026-01-01"), isPeriod: true },
        { ...createEmptyDayLogRecord("2026-01-29"), isPeriod: true },
      ];
      const now = new Date(2026, 1, 5);

      const history = buildCycleHistorySummary(profile, records, now);
      const projection = buildCurrentCycleProjection(profile, history, records, now);

      expect(history.completedCycleCount).toBe(1);
      expect(projection.nextPeriodDate).not.toBeNull();
      expect(projection.nextPeriodWindowStartDate).toBeNull();
      expect(projection.nextPeriodWindowEndDate).toBeNull();
      expect(hasDataDrivenPredictionSpan(profile, history)).toBe(false);
    });

    it("returns no range window when all cycle lengths are identical (SD = 0)", () => {
      // 4 period markers separated by 28 days each → 3 completed cycles of length 28.
      const { profile, records } = buildVaryingCycles("2025-12-01", [28, 28, 28, 28]);
      const now = new Date(2026, 2, 1);

      const history = buildCycleHistorySummary(profile, records, now);
      const projection = buildCurrentCycleProjection(profile, history, records, now);

      expect(history.completedCycleCount).toBe(3);
      expect(projection.nextPeriodDate).not.toBeNull();
      expect(projection.nextPeriodWindowStartDate).toBeNull();
      expect(projection.nextPeriodWindowEndDate).toBeNull();
      expect(hasDataDrivenPredictionSpan(profile, history)).toBe(false);
    });

    it("uses round(SD) clamped [1,5] when there are >=3 completed cycles with variability", () => {
      // 4 markers with varying gaps → 3 completed cycle lengths [25, 30, 28], SD ≈ 2.05.
      const { profile, records } = buildVaryingCycles("2025-12-01", [25, 30, 28, 27]);
      const now = new Date(2026, 2, 10);

      const history = buildCycleHistorySummary(profile, records, now);
      const projection = buildCurrentCycleProjection(profile, history, records, now);

      expect(history.completedCycleCount).toBe(3);
      expect(hasDataDrivenPredictionSpan(profile, history)).toBe(true);

      expect(projection.nextPeriodDate).not.toBeNull();
      expect(projection.nextPeriodWindowStartDate).not.toBeNull();
      expect(projection.nextPeriodWindowEndDate).not.toBeNull();

      const start = new Date(projection.nextPeriodWindowStartDate!);
      const end = new Date(projection.nextPeriodWindowEndDate!);
      const center = new Date(projection.nextPeriodDate!);
      const startSpan = Math.round(
        (center.getTime() - start.getTime()) / 86400000,
      );
      const endSpan = Math.round(
        (end.getTime() - center.getTime()) / 86400000,
      );
      expect(startSpan).toBeGreaterThanOrEqual(1);
      expect(startSpan).toBeLessThanOrEqual(5);
      expect(endSpan).toBeGreaterThanOrEqual(1);
      expect(endSpan).toBeLessThanOrEqual(5);
      expect(startSpan).toBe(endSpan);

      // Tracks future regression: the 45+ legacy '+1' must NOT widen the span.
      const profile45 = createProfileRecord({
        lastPeriodStart: profile.lastPeriodStart,
        ageGroup: "age_45_plus",
      });
      const projection45 = buildCurrentCycleProjection(profile45, history, records, now);
      expect(projection45.nextPeriodWindowStartDate).toBe(
        projection.nextPeriodWindowStartDate,
      );
      expect(projection45.nextPeriodWindowEndDate).toBe(
        projection.nextPeriodWindowEndDate,
      );
    });

    it("derives 3 completed cycles from a set of 4 period entries spread across months", () => {
      const firstStart = cycleStarts[0] ?? "2025-12-01";
      const profile = createProfileRecord({ lastPeriodStart: firstStart });
      const records = cycleStarts.map((date) => ({
        ...createEmptyDayLogRecord(date),
        isPeriod: true,
      }));
      const now = new Date(2026, 2, 28);
      const starts = collectCycleStartDates(profile, records, "2026-02-23");
      expect(starts.length).toBeGreaterThanOrEqual(3);
      const history = buildCycleHistorySummary(profile, records, now);
      expect(history.completedCycleCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe("shouldShowAgeVariabilityHint", () => {
    it("returns true only for the 45+ bucket", () => {
      expect(shouldShowAgeVariabilityHint(createProfileRecord({ ageGroup: "age_45_plus" }))).toBe(true);
      expect(shouldShowAgeVariabilityHint(createProfileRecord({ ageGroup: "age_40_45" }))).toBe(false);
      expect(shouldShowAgeVariabilityHint(createProfileRecord({ ageGroup: "under_40" }))).toBe(false);
      expect(shouldShowAgeVariabilityHint(createProfileRecord({ ageGroup: "" }))).toBe(false);
    });
  });
});
