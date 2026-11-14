import goldenVectors from "./__fixtures__/cycle-prediction-golden-vectors.json";
import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import { STATS_CYCLE_PREDICTION_WINDOW } from "../models/stats";
import { predictCycleWindow } from "./cycle-prediction-policy";
import {
  averageInts,
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
  medianInt,
  predictedCycleLength,
  projectCycleStartForward,
  shiftCycleStartToFutureOvulation,
  tailInts,
} from "./cycle-history-service";
import {
  addDays,
  diffCalendarDays,
  formatLocalDate,
  parseLocalDate,
} from "./profile-settings-policy";

// A settings cycle length no vector selects, so a projection that fell back to
// the profile instead of the observed median would fail stage 1.
const UNSELECTED_PROFILE_CYCLE_LENGTH = 21;

function profileFor(lastPeriodStart: string): ProfileRecord {
  return {
    lastPeriodStart,
    cycleLength: UNSELECTED_PROFILE_CYCLE_LENGTH,
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
  };
}

// Runs the production projection over a day-log history whose completed cycles
// are exactly `cycleLengths`, the last of them closing on `lastPeriod`.
function projectFromHistory(
  cycleLengths: readonly number[],
  lastPeriod: Date,
  today: Date,
) {
  const totalDays = cycleLengths.reduce((sum, length) => sum + length, 0);
  let cursor = addDays(lastPeriod, -totalDays);
  const starts = [cursor];
  for (const length of cycleLengths) {
    cursor = addDays(cursor, length);
    starts.push(cursor);
  }
  const records: DayLogRecord[] = starts.map((start) => ({
    ...createEmptyDayLogRecord(formatLocalDate(start)),
    isPeriod: true,
    cycleStart: true,
  }));
  const profile = profileFor(formatLocalDate(lastPeriod));
  const history = buildCycleHistorySummary(profile, records, today);
  expect(history.recentCycleLengths).toEqual(cycleLengths);
  return buildCurrentCycleProjection(profile, history, records, today);
}

// Golden-vector parity test for the projection / anchor layer that production
// layers ON TOP of the pure window math (cycle-prediction-reference.test.ts).
//
// This consumes the ADDITIVE "projection" section of the shared fixture
// (./__fixtures__/cycle-prediction-golden-vectors.json), vendored byte-identical
// from ovumcy-web (internal/services/testdata/). It is the TypeScript twin of
// ovumcy-web's internal/services/cycle_projection_reference_test.go: both replay,
// per vector, the exact production projection sequence (web
// DashboardUpcomingPredictions) against the same numbers, so a mean-vs-median
// regression or a DST/boundary drift in either hand-parallel port
// (cycles.go / cycle-history-service.ts) fails CI on both sides.
//
// Each vector pins four stages:
//   1. the median-first prediction length (predictedCycleLength over the recent
//      window) — the mean-vs-median pin ([28,28,28,28,60] → 28, never ~34);
//   2. the projected current-cycle start + 1-based cycle day
//      (projectCycleStartForward, web ProjectCycleStart);
//   3. the displayed next-period date, which closes the RUNNING cycle
//      (lastPeriodStart + length, never rolled), read from the production
//      projection (buildCurrentCycleProjection) so the vectors pin what the
//      surfaces show; that projection is also cross-checked against stages 1,
//      2 and 4;
//   4. the ovulation date after the single forward roll
//      (shiftCycleStartToFutureOvulation) that keeps ovulation on/after `today`.
//
// The fixture carries an IANA `timezone` per vector (incl. the Europe/Berlin
// 2026-03-29 spring-forward case). The app prediction math is calendar-day based
// and DST-immune by construction — day counts anchor on Date.UTC (see
// calendarDayCount in profile-settings-policy.ts) and dates are formatted from
// local Y/M/D — so every vector projects identically regardless of the runner's
// zone, and no tz database load is required (the app mirror of web's
// projectionLocation skip policy). If the projection math changes, update the
// fixture, docs/cycle-prediction.md, and BOTH reference tests in the same change.
describe("cycle-projection golden vectors (shared with ovumcy-web)", () => {
  for (const vector of goldenVectors.projection.vectors) {
    it(vector.name, () => {
      const { cycleLengths, lastPeriodStart, lutealPhase } = vector.input;
      const expected = vector.expected;

      const lastPeriod = parseLocalDate(lastPeriodStart);
      const today = parseLocalDate(vector.input.today);
      expect(lastPeriod).not.toBeNull();
      expect(today).not.toBeNull();

      // 1. Median-first prediction length over the recent-cycle window, exactly
      // as production selects it (resolvePredictionCycleLength) and as web's
      // reference test does: predictedCycleLength(medianInt(recent),
      // averageInts(recent)).
      const recent = tailInts(cycleLengths, STATS_CYCLE_PREDICTION_WINDOW);
      const predictionLength = predictedCycleLength(
        medianInt(recent),
        averageInts(recent),
      );
      expect(predictionLength).toBe(expected.predictionLength);

      // 2. Projected current-cycle anchor + 1-based cycle day for `today`. The
      // DST vector exercises the calendar-day rollover a truncating instant
      // subtraction would get wrong across the 23-hour spring-forward day.
      const cycleStart = projectCycleStartForward(
        lastPeriod!,
        predictionLength,
        today!,
      );
      expect(formatLocalDate(cycleStart)).toBe(expected.projectedCycleStart);
      const cycleDay = diffCalendarDays(cycleStart, today!) + 1;
      expect(cycleDay).toBe(expected.projectedCycleDay);

      // 3. Displayed next-period date, read from the production projection the
      // surfaces consume (buildCurrentCycleProjection over a day-log history
      // carrying exactly this vector's cycle lengths), not re-derived here. It
      // is the period that closes the RUNNING cycle — lastPeriodStart plus the
      // selected length, never rolled forward with the stage-2 start — so on
      // cycle day m+1 it names the day the period is due, not a cycle later.
      const projection = projectFromHistory(
        cycleLengths,
        lastPeriod!,
        today!,
      );
      expect(projection.lutealPhase).toBe(lutealPhase);
      expect(projection.predictionCycleLength).toBe(expected.predictionLength);
      expect(projection.currentCycleDay).toBe(expected.projectedCycleDay);
      expect(projection.nextPeriodDate).toBe(expected.displayedNextPeriodStart);
      expect(projection.upcomingOvulationDate).toBe(expected.ovulationDate);

      // 4. Ovulation date: the window for the projected cycle, rolled forward
      // once if its ovulation already fell before `today` (the exact
      // DashboardUpcomingPredictions sequence). The roll is applied to a SEPARATE
      // anchor so it cannot disturb the displayed next-period from step 3.
      const window = predictCycleWindow(
        formatLocalDate(cycleStart),
        predictionLength,
        lutealPhase,
      );
      expect(window.calculable).toBe(true);
      let ovulationValue = window.ovulationDate;
      const ovulation = window.ovulationDate
        ? parseLocalDate(window.ovulationDate)
        : null;
      if (ovulation && ovulation < today!) {
        const shiftedStart = shiftCycleStartToFutureOvulation(
          cycleStart,
          ovulation,
          predictionLength,
          today!,
        );
        ovulationValue = predictCycleWindow(
          formatLocalDate(shiftedStart),
          predictionLength,
          lutealPhase,
        ).ovulationDate;
      }
      expect(ovulationValue).toBe(expected.ovulationDate);
    });
  }
});
