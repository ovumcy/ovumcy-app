import {
  EPDS_ITEM_COUNT,
  EPDS_MAX_SCORE,
  SCREENING_REPEAT_MIN_DAYS,
  createScreeningResponse,
  sanitizeScreeningResponse,
  type ScreeningResponse,
} from "./screening";

function answers(...values: number[]): number[] {
  return values;
}

const ALL_ZEROS = new Array<number>(EPDS_ITEM_COUNT).fill(0);
const ALL_THREES = new Array<number>(EPDS_ITEM_COUNT).fill(3);

describe("createScreeningResponse", () => {
  it("computes the total score as the sum of the ten answers", () => {
    const record = createScreeningResponse({
      date: "2026-07-01",
      answers: answers(1, 2, 0, 3, 1, 0, 2, 1, 0, 0),
    });

    expect(record.score).toBe(10);
    expect(record.instrument).toBe("epds");
    expect(record.date).toBe("2026-07-01");
    expect(record.answers).toEqual([1, 2, 0, 3, 1, 0, 2, 1, 0, 0]);
    expect(record.id.startsWith("screening_")).toBe(true);
  });

  it("scores all-zeros as 0 with no self-harm flag", () => {
    const record = createScreeningResponse({
      date: "2026-07-01",
      answers: ALL_ZEROS,
    });
    expect(record.score).toBe(0);
    expect(record.selfHarmFlag).toBe(false);
  });

  it("scores all-threes as the maximum 30 and raises the self-harm flag", () => {
    const record = createScreeningResponse({
      date: "2026-07-01",
      answers: ALL_THREES,
    });
    expect(record.score).toBe(EPDS_MAX_SCORE);
    expect(record.score).toBe(30);
    expect(record.selfHarmFlag).toBe(true);
  });

  it("raises the self-harm flag on ANY non-zero item 10 even when the total is low", () => {
    const record = createScreeningResponse({
      date: "2026-07-01",
      answers: answers(0, 0, 0, 0, 0, 0, 0, 0, 0, 1),
    });
    expect(record.score).toBe(1);
    expect(record.selfHarmFlag).toBe(true);
  });

  it("does NOT raise the self-harm flag for non-zero answers on other items", () => {
    const record = createScreeningResponse({
      date: "2026-07-01",
      answers: answers(3, 3, 3, 0, 0, 0, 0, 0, 0, 0),
    });
    expect(record.score).toBe(9);
    expect(record.selfHarmFlag).toBe(false);
  });

  it("gives each response a distinct id", () => {
    const a = createScreeningResponse({ date: "2026-07-01", answers: ALL_ZEROS });
    const b = createScreeningResponse({ date: "2026-07-01", answers: ALL_ZEROS });
    expect(a.id).not.toBe(b.id);
  });

  it.each([
    ["too few answers", answers(0, 0, 0)],
    ["too many answers", new Array<number>(EPDS_ITEM_COUNT + 1).fill(0)],
    ["an out-of-range answer", answers(4, 0, 0, 0, 0, 0, 0, 0, 0, 0)],
    ["a negative answer", answers(-1, 0, 0, 0, 0, 0, 0, 0, 0, 0)],
    ["a non-integer answer", answers(1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0)],
  ])("throws when given %s", (_label, invalid) => {
    expect(() =>
      createScreeningResponse({ date: "2026-07-01", answers: invalid }),
    ).toThrow();
  });

  it("throws on a malformed completion date", () => {
    expect(() =>
      createScreeningResponse({ date: "2026-13-40", answers: ALL_ZEROS }),
    ).toThrow();
  });
});

describe("SCREENING_REPEAT_MIN_DAYS", () => {
  it("is 14 days", () => {
    expect(SCREENING_REPEAT_MIN_DAYS).toBe(14);
  });
});

describe("sanitizeScreeningResponse", () => {
  function validRecord(): ScreeningResponse {
    return {
      id: "screening_1",
      date: "2026-07-01",
      instrument: "epds",
      answers: [1, 2, 0, 3, 1, 0, 2, 1, 0, 0],
      score: 10,
      selfHarmFlag: false,
    };
  }

  it("round-trips a fully valid record unchanged", () => {
    const record = validRecord();
    expect(sanitizeScreeningResponse(record)).toEqual(record);
  });

  it.each([null, undefined, 42, "x", []])(
    "rejects a non-object payload (%p)",
    (value) => {
      expect(sanitizeScreeningResponse(value)).toBeNull();
    },
  );

  it("rejects a record with a blank id", () => {
    expect(sanitizeScreeningResponse({ ...validRecord(), id: "  " })).toBeNull();
  });

  it("trims a padded id", () => {
    const sanitized = sanitizeScreeningResponse({
      ...validRecord(),
      id: "  screening_pad  ",
    });
    expect(sanitized?.id).toBe("screening_pad");
  });

  it("rejects an unknown instrument", () => {
    expect(
      sanitizeScreeningResponse({ ...validRecord(), instrument: "phq9" }),
    ).toBeNull();
  });

  it("rejects a malformed completion date", () => {
    expect(
      sanitizeScreeningResponse({ ...validRecord(), date: "2026-02-30" }),
    ).toBeNull();
    expect(
      sanitizeScreeningResponse({ ...validRecord(), date: "nope" }),
    ).toBeNull();
  });

  it.each([
    ["wrong length", [0, 0, 0]],
    ["out-of-range value", [4, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    ["non-integer value", [1.5, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    ["not an array", "0000000000"],
  ])("rejects answers with %s", (_label, invalid) => {
    expect(
      sanitizeScreeningResponse({ ...validRecord(), answers: invalid }),
    ).toBeNull();
  });

  it("recomputes and corrects a stored score that disagrees with the answers", () => {
    // History integrity beats stored-value trust: a drifted/tampered row that
    // claims score 0 must never surface as a reassuring zero.
    const sanitized = sanitizeScreeningResponse({
      ...validRecord(),
      answers: [1, 2, 0, 3, 1, 0, 2, 1, 0, 0],
      score: 0,
    });
    expect(sanitized?.score).toBe(10);
  });

  it("recomputes and corrects a stored self-harm flag that disagrees with item 10", () => {
    // A stored flag of false with a non-zero item 10 must be corrected to true.
    const sanitized = sanitizeScreeningResponse({
      ...validRecord(),
      answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
      selfHarmFlag: false,
    });
    expect(sanitized?.selfHarmFlag).toBe(true);
    expect(sanitized?.score).toBe(2);

    // And the inverse: a stored true with a zero item 10 is corrected to false.
    const inverse = sanitizeScreeningResponse({
      ...validRecord(),
      answers: [3, 3, 0, 0, 0, 0, 0, 0, 0, 0],
      selfHarmFlag: true,
    });
    expect(inverse?.selfHarmFlag).toBe(false);
  });
});
