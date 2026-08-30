import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import {
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
  inferUserLutealPhase,
} from "./cycle-history-service";
import {
  DEFAULT_LUTEAL_PHASE_DAYS,
  calcOvulationDay,
  predictCycleWindow,
} from "./cycle-prediction-policy";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";
import { buildStatsAdvancedFertility } from "./stats-advanced-fertility-service";

// The round-trip invariant pinned here: an ovulation OBSERVED on cycle day N
// must train a luteal-phase parameter that predicts cycle day N again on an
// identical next cycle. Inference (inferUserLutealPhase) and prediction
// (calcOvulationDay) are the two directions of one arithmetic, and nothing but
// a test crosses them — each is self-consistent alone, so a disagreement about
// whether the ovulation day itself belongs to the luteal phase is invisible
// from either side.
//
// It was not invisible to owners. Reading the parameter as the calendar span
// from the ovulation date to the next period start counts the ovulation day
// twice, making the value one day too large; calcOvulationDay then subtracts it
// from the cycle length and lands one day early. An ovulation observed on cycle
// day 15 predicted cycle day 14 — moving the ovulation date and both edges of
// the fertile window a day earlier on the dashboard, the calendar, the doctor
// PDF and the local reminders, for exactly the owners who had logged enough BBT
// or cervical-mucus signal to earn a personalized model.
//
// The pure pair (calcOvulationDay and its inverse calcLutealPhase) is pinned
// separately, by the "Step 2a reference vectors" table in
// cycle-prediction-policy.test.ts. That table documents the arithmetic; it can
// never catch this defect, because the two functions are exact inverses by
// construction and both stay correct when the span reading returns. What
// drifted was the third thing: the step that reads an ovulation out of the logs
// and works out which argument to hand them.

// Six flat opening readings form the coverline window; the elevated run must
// clear the coverline by more than the detector's third-day margin.
const BBT_BASELINE_CELSIUS = 36.2;
const BBT_ELEVATED_CELSIUS = 36.5;
const BBT_COVERLINE_WINDOW = 6;
const BBT_ELEVATED_STREAK_DAYS = 3;

type LutealSignalKind = "bbt" | "eggwhite";

function createProfileRecord(overrides?: Partial<ProfileRecord>): ProfileRecord {
  return {
    lastPeriodStart: "2026-01-01",
    cycleLength: 28,
    periodLength: 5,
    autoPeriodFill: false,
    irregularCycle: false,
    unpredictableCycle: false,
    ageGroup: "",
    usageGoal: "health",
    trackBBT: true,
    temperatureUnit: "c",
    trackCervicalMucus: true,
    hideSexChip: false,
    languageOverride: null,
    themeOverride: null,
    dismissedCalendarPredictionNoticeKey: null,
    dismissedOnboardingHelperNoticeKey: null,
    ...overrides,
  };
}

/**
 * Builds `ovulationCycleDays.length + 1` observed cycle starts, `cycleLength`
 * days apart from `originDate`, and plants an ovulation signal in every cycle
 * but the last (the last start only closes the previous cycle, exactly as an
 * in-progress cycle does in production). Cycle i's signal is placed so the
 * inference must read its ovulation on cycle day `ovulationCycleDays[i]`.
 *
 * The BBT layout is dictated by the shared "3-over-6" detector: six flat
 * readings open the cycle as the coverline window, then three consecutive
 * elevated days start the day AFTER ovulation, because the thermal shift
 * follows ovulation. That needs `ovulationCycleDay >= 6` and
 * `ovulationCycleDay + 3 <= cycleLength`. The egg-white layout is the peak-day
 * rule read backwards: ovulation is peak + 1, so the peak sits on the day
 * before, which needs `ovulationCycleDay >= 2`.
 *
 * Those bounds are checked rather than merely documented. A case built outside
 * them yields no detectable signal, and inferUserLutealPhase then declines to
 * refine — a failure that reads as a defect in the production inference instead
 * of as a fixture built outside its own range.
 */
function lutealRoundTripRecords(
  originDate: string,
  cycleLength: number,
  ovulationCycleDays: number[],
  kind: LutealSignalKind,
): DayLogRecord[] {
  const origin = parseLocalDate(originDate);
  if (!origin) {
    throw new Error(`fixture: unparseable origin ${originDate}`);
  }

  for (const ovulationCycleDay of ovulationCycleDays) {
    if (kind === "eggwhite" && ovulationCycleDay < 2) {
      throw new Error(
        `fixture: egg-white ovulation on cycle day ${ovulationCycleDay} leaves no room for the peak day before it`,
      );
    }
    if (kind === "bbt" && ovulationCycleDay < BBT_COVERLINE_WINDOW) {
      throw new Error(
        `fixture: BBT ovulation on cycle day ${ovulationCycleDay} starts the elevated run before the ${BBT_COVERLINE_WINDOW}-day coverline window is full`,
      );
    }
    if (
      kind === "bbt" &&
      ovulationCycleDay + BBT_ELEVATED_STREAK_DAYS > cycleLength
    ) {
      throw new Error(
        `fixture: BBT ovulation on cycle day ${ovulationCycleDay} leaves fewer than ${BBT_ELEVATED_STREAK_DAYS} days for the elevated run inside a ${cycleLength}-day cycle`,
      );
    }
    if (ovulationCycleDay > cycleLength) {
      throw new Error(
        `fixture: ovulation on cycle day ${ovulationCycleDay} falls outside a ${cycleLength}-day cycle`,
      );
    }
  }

  const byDate = new Map<string, DayLogRecord>();
  const patch = (date: string, fields: Partial<DayLogRecord>) => {
    const existing = byDate.get(date) ?? createEmptyDayLogRecord(date);
    byDate.set(date, { ...existing, ...fields });
  };

  for (let cycle = 0; cycle <= ovulationCycleDays.length; cycle += 1) {
    const start = addDays(origin, cycle * cycleLength);
    patch(formatLocalDate(start), {
      isPeriod: true,
      cycleStart: true,
      flow: "medium",
    });
    patch(formatLocalDate(addDays(start, 1)), {
      isPeriod: true,
      flow: "medium",
    });

    const ovulationCycleDay = ovulationCycleDays[cycle];
    if (ovulationCycleDay === undefined) {
      continue;
    }

    if (kind === "eggwhite") {
      patch(formatLocalDate(addDays(start, ovulationCycleDay - 2)), {
        cervicalMucus: "eggwhite",
      });
      continue;
    }

    for (let offset = 0; offset < BBT_COVERLINE_WINDOW; offset += 1) {
      patch(formatLocalDate(addDays(start, offset)), {
        bbt: BBT_BASELINE_CELSIUS,
      });
    }
    for (let offset = 0; offset < BBT_ELEVATED_STREAK_DAYS; offset += 1) {
      patch(formatLocalDate(addDays(start, ovulationCycleDay + offset)), {
        bbt: BBT_ELEVATED_CELSIUS,
      });
    }
  }

  return [...byDate.values()].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

/**
 * Runs the loop the owner-facing surfaces run: infer the parameter from the
 * logged signal, then predict with it on the fixture's own in-progress cycle
 * (the last start the records carry) and check the prediction lands back on the
 * observed cycle day — as a day number, as a date, and as the fertile window's
 * peak edge. Returns the inferred parameter.
 */
function assertLutealRoundTrip(
  records: DayLogRecord[],
  originDate: string,
  cycleLength: number,
  cycleCount: number,
  wantOvulationCycleDay: number,
): number {
  const origin = parseLocalDate(originDate);
  expect(origin).not.toBeNull();

  const nextCycleStart = addDays(origin!, cycleCount * cycleLength);
  const todayValue = formatLocalDate(addDays(nextCycleStart, 1));
  const profile = createProfileRecord({
    lastPeriodStart: originDate,
    cycleLength,
  });

  const luteal = inferUserLutealPhase(profile, records, todayValue);
  expect(luteal).not.toBeNull();
  // cycleLength − observedOvulationDay, the parameter calcOvulationDay consumes
  // — one day SHORTER than the ovulation-to-next-start calendar span.
  expect(luteal).toBe(cycleLength - wantOvulationCycleDay);

  expect(calcOvulationDay(cycleLength, luteal!)).toEqual({
    day: wantOvulationCycleDay,
    isExact: true,
  });

  // The same trip as a date, through the function the surfaces actually call.
  const wantOvulationDate = formatLocalDate(
    addDays(nextCycleStart, wantOvulationCycleDay - 1),
  );
  const window = predictCycleWindow(
    formatLocalDate(nextCycleStart),
    cycleLength,
    luteal!,
  );
  expect(window.calculable).toBe(true);
  expect(window.ovulationDate).toBe(wantOvulationDate);
  // The window ends on the ovulation day, so its peak edge moves with the
  // defect exactly as the ovulation date does.
  expect(window.fertilityEnd).toBe(wantOvulationDate);
  expect(window.fertilityStart).toBe(
    formatLocalDate(addDays(parseLocalDate(wantOvulationDate)!, -5)),
  );

  return luteal!;
}

describe("inferred luteal phase round-trips through prediction", () => {
  const originDate = "2026-01-01";

  const cases: {
    name: string;
    kind: LutealSignalKind;
    cycleLength: number;
    ovulationCycleDay: number;
  }[] = [
    // The headline case: a textbook 28-day cycle whose thermal shift starts on
    // cycle day 16, so ovulation is cycle day 15.
    { name: "bbt, 28-day cycle, ovulation on day 15", kind: "bbt", cycleLength: 28, ovulationCycleDay: 15 },
    { name: "mucus, 28-day cycle, ovulation on day 15", kind: "eggwhite", cycleLength: 28, ovulationCycleDay: 15 },
    // Short cycle: the follicular phase absorbs the shortening, so the luteal
    // phase stays physiological and the prediction stays exact.
    { name: "bbt, short 21-day cycle, ovulation on day 8", kind: "bbt", cycleLength: 21, ovulationCycleDay: 8 },
    { name: "mucus, short 21-day cycle, ovulation on day 9", kind: "eggwhite", cycleLength: 21, ovulationCycleDay: 9 },
    // Long cycles: the same, in the other direction.
    { name: "bbt, long 35-day cycle, ovulation on day 21", kind: "bbt", cycleLength: 35, ovulationCycleDay: 21 },
    { name: "mucus, long 40-day cycle, ovulation on day 26", kind: "eggwhite", cycleLength: 40, ovulationCycleDay: 26 },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      // Two signalled cycles plus the in-progress third, which is the one a
      // prediction is actually made for.
      const records = lutealRoundTripRecords(
        originDate,
        testCase.cycleLength,
        [testCase.ovulationCycleDay, testCase.ovulationCycleDay],
        testCase.kind,
      );
      assertLutealRoundTrip(
        records,
        originDate,
        testCase.cycleLength,
        2,
        testCase.ovulationCycleDay,
      );
    });
  }

  // Covers the aggregating path rather than the single-sample one: three cycles
  // ovulating on days 14, 15 and 16 of a 28-day cycle yield luteal samples 14,
  // 13 and 12, whose mean is 13 — the parameter that predicts the middle
  // observation back. The aggregation is a mean of the surviving samples, not a
  // median (the median is what selects the cycle LENGTH), so a shift applied
  // per sample would survive it unchanged; the round trip is what catches it.
  it("aggregates several samples and still round-trips the mean", () => {
    const cycleLength = 28;
    const records = lutealRoundTripRecords(
      originDate,
      cycleLength,
      [14, 15, 16],
      "bbt",
    );

    const luteal = assertLutealRoundTrip(records, originDate, cycleLength, 3, 15);
    expect(luteal).toBe(13);
  });
});

// The inference measures two whole-day counts — the cycle length, and the
// ovulation's offset from the cycle start — and both go through
// diffCalendarDays, which anchors on Date.UTC so that one calendar day always
// counts as one day whatever the device zone does. These cases run the round
// trip over cycles that straddle a daylight-saving transition, where an
// arithmetic that subtracted raw instants would see a 23- or 25-hour day and
// drift.
//
// What they deliberately do NOT do is switch zones. Assigning process.env.TZ at
// runtime does not take effect under this project's Jest setup — measured: with
// TZ set to "UTC" and then to "Pacific/Kiritimati",
// `new Date(2026, 0, 1).getTimezoneOffset()` returns the runner's own offset
// both times. A test built on that would compare the runner's zone against
// itself and could never fail, which is worse than no coverage. Zone coverage
// is available only by running the whole suite under an external TZ, and the
// day-count primitive itself is pinned regardless of zone by
// profile-settings-date-diff.test.ts.
describe("inferred luteal phase is unmoved by daylight-saving transitions", () => {
  const cases: {
    name: string;
    originDate: string;
    kind: LutealSignalKind;
    observed: number;
  }[] = [
    // Europe/Berlin springs forward on 2026-03-29 — cycle day 15 of the first
    // cycle here, the observed ovulation day itself.
    { name: "a spring-forward date falls on the observed ovulation", originDate: "2026-03-15", kind: "bbt", observed: 15 },
    // America/Toronto falls back on 2026-11-01, between the first cycle's start
    // and its observed ovulation.
    { name: "a fall-back date sits between the cycle start and ovulation", originDate: "2026-10-20", kind: "eggwhite", observed: 15 },
    // A cycle with no transition anywhere near it, as the control: the
    // parameter must be the same number as the two above.
    { name: "a cycle clear of any transition reads the same", originDate: "2026-06-01", kind: "bbt", observed: 15 },
  ];

  const cycleLength = 28;

  for (const testCase of cases) {
    it(testCase.name, () => {
      const records = lutealRoundTripRecords(
        testCase.originDate,
        cycleLength,
        [testCase.observed, testCase.observed],
        testCase.kind,
      );
      assertLutealRoundTrip(
        records,
        testCase.originDate,
        cycleLength,
        2,
        testCase.observed,
      );
    });
  }
});

// Closes the loop the cases above leave open. buildCurrentCycleProjection is
// what every owner-facing surface goes through (dashboard, calendar, doctor
// PDF, local reminders), and it is the only place that chooses between the live
// inference and the fallback value a cycle is otherwise predicted with.
//
// The app keeps no persisted luteal_phase column: the fallback is the 14-day
// model default, and for these very logs that is also exactly the value the
// pre-fix inference produced — the ovulation-to-next-start span. So a
// projection that still reads 14 here is indistinguishable from one that never
// personalized at all, which is the shape the precedence has to survive.
describe("the live inference reaches the owner surfaces through the projection", () => {
  it("predicts the observed cycle day, not the day the stale default names", () => {
    const cycleLength = 28;
    const originDate = "2026-01-01";
    const records = lutealRoundTripRecords(originDate, cycleLength, [15, 15], "bbt");

    // Cycle starts Jan 1, Jan 29 and Feb 26; today sits inside the third.
    const now = new Date(2026, 2, 3, 9, 0, 0);
    const profile = createProfileRecord({
      lastPeriodStart: originDate,
      cycleLength,
    });
    const history = buildCycleHistorySummary(profile, records, now);
    const projection = buildCurrentCycleProjection(profile, history, records, now);

    expect(projection.lutealPhase).toBe(13);
    expect(projection.lutealPhase).not.toBe(DEFAULT_LUTEAL_PHASE_DAYS);
    expect(projection.cycleAnchorDate).toBe("2026-02-26");

    // The third cycle starts Feb 26, so its cycle day 15 is March 12. The stale
    // 14 would have named March 11 — the whole defect, in one assertion.
    expect(projection.ovulationDate).toBe("2026-03-12");

    // Only the fertility half of the projection moves. The next-period date is
    // the cycle start plus the predicted length and never touches the luteal
    // phase — it is also the one estimate anchored on a day the owner actually
    // recorded, so a change that reached it would be a scope violation rather
    // than a fix.
    expect(projection.nextPeriodDate).toBe("2026-03-26");
  });

  // The premium surfaces that report an observed luteal length must name the
  // same quantity the prediction is trained on. They each derive it through
  // calcLutealPhase from their own anchor, so a surface that slipped back to
  // measuring the ovulation-to-next-start span would read one day longer than
  // the projection for the very same logs.
  it("reports one luteal length across the projection and the stats surface", () => {
    const cycleLength = 28;
    const originDate = "2026-01-01";
    const records = lutealRoundTripRecords(originDate, cycleLength, [15, 15], "bbt");

    const now = new Date(2026, 2, 3, 9, 0, 0);
    const profile = createProfileRecord({
      lastPeriodStart: originDate,
      cycleLength,
    });
    const history = buildCycleHistorySummary(profile, records, now);
    const projection = buildCurrentCycleProjection(profile, history, records, now);
    const advanced = buildStatsAdvancedFertility(
      history,
      records,
      projection.cycleAnchorDate,
    );

    expect(advanced?.observedLutealSampleCount).toBe(2);
    expect(advanced?.observedLutealAverageDays).toBe(projection.lutealPhase);
    expect(advanced?.observedLutealAverageDays).toBe(13);
  });
});
