import goldenVectors from "./__fixtures__/cycle-prediction-golden-vectors.json";
import { STATS_CYCLE_PREDICTION_WINDOW } from "../models/stats";
import { predictCycleWindow } from "./cycle-prediction-policy";
import {
  averageInts,
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
//   3. the displayed next-period date, derived from the UN-shifted projected
//      start (so the ovulation roll below cannot disturb it);
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

      // 3. Displayed next-period date: the UN-shifted projected start plus the
      // selected length. Mirrors DashboardUpcomingPredictions, which derives the
      // displayed next-period BEFORE the ovulation forward roll.
      const displayedNext = formatLocalDate(
        addDays(cycleStart, predictionLength),
      );
      expect(displayedNext).toBe(expected.displayedNextPeriodStart);

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
