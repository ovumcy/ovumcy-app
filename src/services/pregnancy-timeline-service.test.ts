import { BIRTH_OPTION_MIN_WEEK, KICK_COUNTS_START_WEEK } from "../models/pregnancy";
import {
  MAX_GESTATIONAL_AGE_DAYS,
  calcEddFromLmp,
  calcGestationalAge,
  resolveBirthOptionVisible,
  resolveCurrentMilestones,
  resolveMilestoneWindows,
  resolveOutOfWindowReason,
} from "./pregnancy-timeline-service";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";

const EDD = "2026-10-08"; // = 2026-01-01 (LMP) + 280 days, verified below.

// Builds the `today` LocalDateISO that makes calcGestationalAge(EDD, today)
// report exactly `gaDays`, without hand-computing calendar dates per case:
// gaDays = 280 - (edd - today)  =>  today = edd - (280 - gaDays).
function todayForGaDays(gaDays: number): string {
  const eddDate = parseLocalDate(EDD)!;
  return formatLocalDate(addDays(eddDate, gaDays - 280));
}

describe("calcEddFromLmp", () => {
  it("adds 280 days to the LMP date (Naegele's rule)", () => {
    expect(calcEddFromLmp("2026-01-01")).toBe(EDD);
  });

  it("passes through an unparseable LMP date unchanged", () => {
    expect(calcEddFromLmp("not-a-date")).toBe("not-a-date");
  });
});

describe("calcGestationalAge", () => {
  it("is 40 weeks 0 days, trimester 3, at the due date itself", () => {
    expect(calcGestationalAge(EDD, EDD)).toEqual({
      gaDays: 280,
      weeks: 40,
      days: 0,
      trimester: 3,
    });
  });

  it("is 39 weeks 6 days the day before the due date", () => {
    const dayBeforeEdd = todayForGaDays(279);
    expect(calcGestationalAge(EDD, dayBeforeEdd)).toEqual({
      gaDays: 279,
      weeks: 39,
      days: 6,
      trimester: 3,
    });
  });

  it("is 0 weeks 0 days, trimester 1, at the LMP date", () => {
    expect(calcGestationalAge(EDD, todayForGaDays(0))).toEqual({
      gaDays: 0,
      weeks: 0,
      days: 0,
      trimester: 1,
    });
  });

  it("crosses the trimester 1 -> 2 boundary between 13w6d and 14w0d", () => {
    expect(calcGestationalAge(EDD, todayForGaDays(97))).toEqual({
      gaDays: 97,
      weeks: 13,
      days: 6,
      trimester: 1,
    });
    expect(calcGestationalAge(EDD, todayForGaDays(98))).toEqual({
      gaDays: 98,
      weeks: 14,
      days: 0,
      trimester: 2,
    });
  });

  it("crosses the trimester 2 -> 3 boundary between 27w6d and 28w0d", () => {
    expect(calcGestationalAge(EDD, todayForGaDays(195))).toEqual({
      gaDays: 195,
      weeks: 27,
      days: 6,
      trimester: 2,
    });
    expect(calcGestationalAge(EDD, todayForGaDays(196))).toEqual({
      gaDays: 196,
      weeks: 28,
      days: 0,
      trimester: 3,
    });
  });

  it("returns null before conception (today earlier than LMP)", () => {
    expect(calcGestationalAge(EDD, todayForGaDays(-1))).toBeNull();
  });

  it("stays valid exactly at the 43-week sane-window boundary", () => {
    expect(calcGestationalAge(EDD, todayForGaDays(MAX_GESTATIONAL_AGE_DAYS))).toEqual(
      {
        gaDays: MAX_GESTATIONAL_AGE_DAYS,
        weeks: 43,
        days: 0,
        trimester: 3,
      },
    );
  });

  it("returns null past the 43-week sane window", () => {
    expect(
      calcGestationalAge(EDD, todayForGaDays(MAX_GESTATIONAL_AGE_DAYS + 1)),
    ).toBeNull();
    expect(calcGestationalAge(EDD, todayForGaDays(400))).toBeNull();
  });

  it("returns null for a malformed edd or today", () => {
    expect(calcGestationalAge("not-a-date", EDD)).toBeNull();
    expect(calcGestationalAge(EDD, "not-a-date")).toBeNull();
  });

  // Proves the engine uses DST-safe calendar-day math (diffLocalDays), not a
  // raw getTime()/86400000 subtraction, which would drift across the 2026 US
  // spring-forward transition (2026-03-08, a 23-hour local day; see
  // profile-settings-date-diff.test.ts for the same verified boundary date).
  it("counts calendar days exactly across the 2026-03-08 DST spring-forward boundary", () => {
    // edd is exactly 2 calendar days after today, spanning 2026-03-08.
    expect(calcGestationalAge("2026-03-09", "2026-03-07")).toEqual({
      gaDays: 278,
      weeks: 39,
      days: 5,
      trimester: 3,
    });
  });

  it("counts calendar days exactly across the 2026-11-01 DST fall-back boundary", () => {
    // edd is exactly 2 calendar days after today, spanning 2026-11-01.
    expect(calcGestationalAge("2026-11-02", "2026-10-31")).toEqual({
      gaDays: 278,
      weeks: 39,
      days: 5,
      trimester: 3,
    });
  });
});

describe("resolveMilestoneWindows", () => {
  it("returns the full who2016 catalog in order", () => {
    const windows = resolveMilestoneWindows("who2016");
    expect(windows.map((window) => window.id)).toEqual([
      "nipt",
      "nt_scan",
      "anatomy_scan",
      "gdm_screen",
      "anti_d",
      "tdap",
      "gbs",
      "kick_counts_start",
      "birth_prep",
    ]);
  });

  it("bounds birth_prep to weeks 36-42, inclusive", () => {
    const window = resolveMilestoneWindows("who2016").find(
      (candidate) => candidate.id === "birth_prep",
    );
    expect(window).toEqual({ id: "birth_prep", fromWeek: 36, toWeek: 42 });
  });

  it("anchors kick_counts_start on the shared KICK_COUNTS_START_WEEK constant, one week wide", () => {
    // A one-week window marking the start only -- the standing kick-teaser
    // card already covers every week from KICK_COUNTS_START_WEEK onward, so
    // this milestone card must not duplicate it forever (CHANGE 4).
    const window = resolveMilestoneWindows("who2016").find(
      (candidate) => candidate.id === "kick_counts_start",
    );
    expect(window).toEqual({
      id: "kick_counts_start",
      fromWeek: KICK_COUNTS_START_WEEK,
      toWeek: KICK_COUNTS_START_WEEK + 1,
    });
  });
});

describe("resolveCurrentMilestones", () => {
  function idsAt(gaWeeks: number): string[] {
    return resolveCurrentMilestones("who2016", gaWeeks).map((window) => window.id);
  }

  it("includes nipt only within its bounded 10-22 window, inclusive (CHANGE 4: no longer open-ended)", () => {
    expect(idsAt(9)).not.toContain("nipt");
    expect(idsAt(10)).toContain("nipt"); // fromWeek boundary
    expect(idsAt(22)).toContain("nipt"); // toWeek boundary
    expect(idsAt(23)).not.toContain("nipt");
    // Was open-ended before CHANGE 4 -- an early-screening offer must not
    // still surface this late.
    expect(idsAt(52)).not.toContain("nipt");
  });

  it("includes kick_counts_start only within its bounded 28-29 window, inclusive (CHANGE 4: marks the start only)", () => {
    expect(idsAt(27)).not.toContain("kick_counts_start");
    expect(idsAt(28)).toContain("kick_counts_start"); // fromWeek boundary
    expect(idsAt(29)).toContain("kick_counts_start"); // toWeek boundary
    expect(idsAt(30)).not.toContain("kick_counts_start");
    // Was open-ended before CHANGE 4 -- the standing kick-teaser card (not
    // this milestone card) covers every week from here on.
    expect(idsAt(40)).not.toContain("kick_counts_start");
  });

  it("includes a bounded window at both boundaries, inclusive", () => {
    expect(idsAt(10)).not.toContain("nt_scan");
    expect(idsAt(11)).toContain("nt_scan"); // fromWeek boundary
    expect(idsAt(12)).toContain("nt_scan");
    expect(idsAt(14)).toContain("nt_scan"); // toWeek boundary
    expect(idsAt(15)).not.toContain("nt_scan");
  });

  it("includes a single-week window only at that exact week", () => {
    expect(idsAt(27)).not.toContain("anti_d");
    expect(idsAt(28)).toContain("anti_d");
    expect(idsAt(29)).not.toContain("anti_d");
  });

  it("can report multiple simultaneous windows", () => {
    // Week 28: gdm_screen (24-28), anti_d (28-28), tdap (27-36),
    // kick_counts_start (28-29). nipt (10-22, CHANGE 4) has already closed by
    // week 28.
    expect(idsAt(28).sort()).toEqual(
      ["anti_d", "gdm_screen", "kick_counts_start", "tdap"].sort(),
    );
  });

  it("returns an empty list once every window has closed (birth_prep is now the latest-closing window, at week 42)", () => {
    // gbs (the latest-closing window before multiples support) ends at week 37; birth_prep
    // (36-42) now keeps the list non-empty through week 42.
    // Every window in the WHO2016 table is bounded, so nothing remains
    // active past that.
    expect(idsAt(40)).toEqual(["birth_prep"]);
    expect(idsAt(42)).toEqual(["birth_prep"]);
    expect(idsAt(43)).toEqual([]);
  });

  it("returns an empty list before any window opens", () => {
    expect(idsAt(0)).toEqual([]);
  });

  it("includes birth_prep only within its bounded 36-42 window, inclusive", () => {
    // 35+6 collapses to gaWeeks 35 (floor), so it is equivalent to idsAt(35).
    expect(idsAt(35)).not.toContain("birth_prep");
    expect(idsAt(36)).toContain("birth_prep"); // fromWeek boundary (36+0)
    expect(idsAt(42)).toContain("birth_prep"); // toWeek boundary, whole week 42
    // 43 is included here for window-table completeness only: in a real
    // buildPregnancyDashboardViewData call this is moot, since
    // calcGestationalAge's own sane window (MAX_GESTATIONAL_AGE_DAYS = 43*7)
    // means gaWeeks reaches exactly 43 on a single boundary day and resolves
    // to null on every day after -- see calcGestationalAge's "stays valid
    // exactly at the 43-week sane-window boundary" test above.
    expect(idsAt(43)).not.toContain("birth_prep");
  });
});

describe("resolveOutOfWindowReason", () => {
  it("is past_window when today has drifted more than 3 weeks past the due date", () => {
    expect(resolveOutOfWindowReason(EDD, todayForGaDays(MAX_GESTATIONAL_AGE_DAYS + 1))).toBe(
      "past_window",
    );
    expect(resolveOutOfWindowReason(EDD, todayForGaDays(400))).toBe("past_window");
  });

  it("is future_or_malformed for an EDD implausibly far in the future", () => {
    expect(resolveOutOfWindowReason(EDD, todayForGaDays(-1))).toBe("future_or_malformed");
  });

  it("is future_or_malformed for an unparseable edd or today", () => {
    expect(resolveOutOfWindowReason("not-a-date", EDD)).toBe("future_or_malformed");
    expect(resolveOutOfWindowReason(EDD, "not-a-date")).toBe("future_or_malformed");
  });
});

describe("resolveBirthOptionVisible", () => {
  it("is false below BIRTH_OPTION_MIN_WEEK (19+6)", () => {
    expect(resolveBirthOptionVisible(EDD, todayForGaDays(19 * 7 + 6))).toBe(false);
  });

  it("is true at BIRTH_OPTION_MIN_WEEK (20+0)", () => {
    expect(resolveBirthOptionVisible(EDD, todayForGaDays(20 * 7))).toBe(true);
  });

  it("uses the exact BIRTH_OPTION_MIN_WEEK boundary from the shared constant", () => {
    expect(resolveBirthOptionVisible(EDD, todayForGaDays(BIRTH_OPTION_MIN_WEEK * 7 - 1))).toBe(
      false,
    );
    expect(resolveBirthOptionVisible(EDD, todayForGaDays(BIRTH_OPTION_MIN_WEEK * 7))).toBe(true);
  });

  it("stays true well past the threshold and at term", () => {
    expect(resolveBirthOptionVisible(EDD, todayForGaDays(38 * 7))).toBe(true);
    expect(resolveBirthOptionVisible(EDD, EDD)).toBe(true);
  });

  it("defaults true for a past-window null GA (a stale record is almost certainly well past 20 weeks)", () => {
    expect(resolveBirthOptionVisible(EDD, todayForGaDays(400))).toBe(true);
  });

  it("defaults false for a future/malformed null GA (no plausible birth to record)", () => {
    expect(resolveBirthOptionVisible(EDD, todayForGaDays(-1))).toBe(false);
  });
});
