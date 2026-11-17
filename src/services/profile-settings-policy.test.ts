import { sanitizeRestoredLastPeriodStart } from "./profile-settings-policy";

describe("sanitizeRestoredLastPeriodStart", () => {
  const now = new Date(2026, 4, 20, 9, 0, 0);

  it("keeps a start on or before today, trimmed", () => {
    expect(sanitizeRestoredLastPeriodStart("2026-05-20", now)).toBe("2026-05-20");
    expect(sanitizeRestoredLastPeriodStart(" 2026-04-12 ", now)).toBe("2026-04-12");
  });

  it("drops a start after today", () => {
    expect(sanitizeRestoredLastPeriodStart("2026-05-21", now)).toBeNull();
  });

  it("drops a value that is not a valid local date", () => {
    expect(sanitizeRestoredLastPeriodStart(null, now)).toBeNull();
    expect(sanitizeRestoredLastPeriodStart(20260501, now)).toBeNull();
    expect(sanitizeRestoredLastPeriodStart("2026-02-30", now)).toBeNull();
    expect(sanitizeRestoredLastPeriodStart("05/01/2026", now)).toBeNull();
  });
});
