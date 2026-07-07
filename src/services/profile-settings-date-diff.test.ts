import * as fc from "fast-check";

import {
  diffCalendarDays,
  diffLocalDays,
  parseLocalDate,
} from "./profile-settings-policy";

// Calendar-day differences must be exact whole-day counts anchored to the
// wall-clock date, independent of the device time zone and of any DST
// transition between the two dates. This mirrors the UTC-anchored `dateOnly`
// day arithmetic in the Go prediction source of truth (see
// docs/cycle-prediction.md). Subtracting raw local `Date#getTime()` instants
// would drift by ±1h across a spring-forward / fall-back boundary; here we
// prove the count stays exact so the prediction pipeline can never miscount a
// cycle day because of DST.
describe("calendar-day differences are DST-immune", () => {
  it("counts across the US spring-forward boundary (2026-03-08)", () => {
    // 23-hour local day in America/* zones; the count must still be 1 per day.
    expect(diffLocalDays("2026-03-07", "2026-03-09")).toBe(2);
    expect(diffLocalDays("2026-03-08", "2026-03-08")).toBe(0);
    expect(
      diffCalendarDays(
        parseLocalDate("2026-03-08"),
        parseLocalDate("2026-03-09")!,
      ),
    ).toBe(1);
  });

  it("counts across the US fall-back boundary (2026-11-01)", () => {
    // 25-hour local day; the count must still be 1 per day.
    expect(diffLocalDays("2026-10-31", "2026-11-02")).toBe(2);
    expect(
      diffCalendarDays(
        parseLocalDate("2026-11-01"),
        parseLocalDate("2026-11-02")!,
      ),
    ).toBe(1);
  });

  it("is negative when the end precedes the start", () => {
    expect(diffLocalDays("2026-03-10", "2026-03-07")).toBe(-3);
  });

  it("returns 0 for unparseable inputs", () => {
    expect(diffLocalDays("not-a-date", "2026-03-10")).toBe(0);
    expect(diffCalendarDays(null, parseLocalDate("2026-03-10")!)).toBe(0);
  });

  // Property: the day count between any two local dates equals the exact
  // difference of their day-ordinals, with no rounding slack to absorb.
  it("equals the exact ordinal difference for arbitrary date pairs", () => {
    const isoDateArb = fc
      .date({
        min: new Date(Date.UTC(2000, 0, 1)),
        max: new Date(Date.UTC(2100, 11, 31)),
        noInvalidDate: true,
      })
      .map((d) => {
        const year = String(d.getUTCFullYear()).padStart(4, "0");
        const month = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        return { iso: `${year}-${month}-${day}`, ordinal: Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
        ) / 86400000 };
      });

    fc.assert(
      fc.property(isoDateArb, isoDateArb, (start, end) => {
        expect(diffLocalDays(start.iso, end.iso)).toBe(
          end.ordinal - start.ordinal,
        );
      }),
    );
  });
});
