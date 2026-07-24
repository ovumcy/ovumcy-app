import {
  MAX_CONTRACTIONS_PER_SESSION,
  MAX_CONTRACTION_DURATION_SECONDS,
  MAX_CONTRACTION_SESSION_SPAN_HOURS,
  MIN_CONTRACTION_DURATION_SECONDS,
  createPregnancyRecord,
  type ContractionEntry,
  type ContractionSession,
} from "../models/pregnancy";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import {
  CONTRACTION_RESUME_WINDOW_MINUTES,
  buildContractionSessionHistoryViewData,
  buildContractionTimerViewData,
  computeContractionIntervals,
  computeWindowSummary,
  createContractionSession,
  deleteContractionHistorySession,
  discardSession,
  formatMinSecLabel,
  matches511Pattern,
  resolveResumableSession,
  resumeOrCreateSession,
  startContraction,
  stopContraction,
} from "./contraction-timer-service";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";

const EDD = "2026-10-08";

// `now` (Date) that makes calcGestationalAge(EDD, formatLocalDate(now))
// report `gaDays`, mirroring pregnancy-timeline-service.test.ts's identical
// helper (here returning a Date directly, since buildContractionTimerViewData
// takes `now: Date`).
function nowForGaDays(gaDays: number): Date {
  return addDays(parseLocalDate(EDD)!, gaDays - 280);
}

function session(overrides: Partial<ContractionSession> = {}): ContractionSession {
  return {
    id: "contraction_1",
    date: "2026-06-01",
    startedAt: "2026-06-01T09:00:00.000Z",
    contractions: [],
    ...overrides,
  };
}

function entry(startedAt: string, durationSeconds = 60): ContractionEntry {
  return { startedAt, durationSeconds };
}

// Builds N contractions starting at `startISO`, `gapMinutes` apart
// (start-to-start), each lasting `durationSeconds`.
function buildRegularContractions(
  startISO: string,
  count: number,
  gapMinutes: number,
  durationSeconds: number,
): ContractionEntry[] {
  const startMs = new Date(startISO).getTime();
  return Array.from({ length: count }, (_, index) =>
    entry(new Date(startMs + index * gapMinutes * 60_000).toISOString(), durationSeconds),
  );
}

function activeRecord() {
  return createPregnancyRecord({
    edd: EDD,
    eddBasis: "lmp",
    lmpDate: "2026-01-01",
    startedAt: "2026-03-01",
  });
}

describe("createContractionSession", () => {
  it("creates an empty, well-formed session anchored at the given instant", () => {
    const now = new Date("2026-06-01T09:30:00.000Z");
    const created = createContractionSession(now);

    expect(created.id).toMatch(/^contraction_/);
    expect(created.date).toBe("2026-06-01");
    expect(created.startedAt).toBe(now.toISOString());
    expect(created.contractions).toEqual([]);
  });

  it("generates distinct ids for two sessions created back to back", () => {
    const now = new Date("2026-06-01T09:30:00.000Z");
    const first = createContractionSession(now);
    const second = createContractionSession(now);
    expect(first.id).not.toBe(second.id);
  });
});

describe("resolveResumableSession", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("returns null when there are no sessions", () => {
    expect(resolveResumableSession([], now)).toBeNull();
  });

  it("resumes a session whose last activity is exactly at the 2-hour boundary", () => {
    const lastActivity = new Date(
      now.getTime() - CONTRACTION_RESUME_WINDOW_MINUTES * 60_000,
    ).toISOString();
    const stale = session({ id: "contraction_boundary", startedAt: lastActivity });

    expect(resolveResumableSession([stale], now)).toEqual(stale);
  });

  it("does not resume a session just past the 2-hour boundary", () => {
    const lastActivity = new Date(
      now.getTime() - (CONTRACTION_RESUME_WINDOW_MINUTES * 60_000 + 1),
    ).toISOString();
    const stale = session({ id: "contraction_over", startedAt: lastActivity });

    expect(resolveResumableSession([stale], now)).toBeNull();
  });

  it("uses the latest contraction's startedAt, not the session's own startedAt, as last activity", () => {
    // Session started 3 hours ago (outside the window on its own), but its
    // most recent contraction was logged 10 minutes ago -- still resumable.
    const oldSession = session({
      id: "contraction_active",
      startedAt: new Date(now.getTime() - 3 * 60 * 60_000).toISOString(),
      contractions: [entry(new Date(now.getTime() - 10 * 60_000).toISOString())],
    });

    expect(resolveResumableSession([oldSession], now)).toEqual(oldSession);
  });

  it("picks the session with the most recent activity among several", () => {
    const older = session({
      id: "contraction_older",
      startedAt: new Date(now.getTime() - 90 * 60_000).toISOString(),
    });
    const newer = session({
      id: "contraction_newer",
      startedAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
    });

    expect(resolveResumableSession([older, newer], now)).toEqual(newer);
  });
});

describe("resumeOrCreateSession", () => {
  it("returns a fresh session when storage has none", async () => {
    const storage = createLocalAppStorageMock({
      listContractionSessions: jest.fn().mockResolvedValue([]),
    });
    const now = new Date("2026-06-01T09:00:00.000Z");

    const resumed = await resumeOrCreateSession(storage, now);

    expect(resumed.contractions).toEqual([]);
    expect(resumed.startedAt).toBe(now.toISOString());
  });

  it("returns the persisted session when it is within the resume window", async () => {
    const now = new Date("2026-06-01T09:00:00.000Z");
    const recent = session({
      id: "contraction_recent",
      startedAt: new Date(now.getTime() - 30 * 60_000).toISOString(),
    });
    const storage = createLocalAppStorageMock({
      listContractionSessions: jest.fn().mockResolvedValue([recent]),
    });

    const resumed = await resumeOrCreateSession(storage, now);
    expect(resumed).toEqual(recent);
  });
});

describe("startContraction", () => {
  it("returns the ISO string of the given instant", () => {
    const now = new Date("2026-06-01T09:15:30.000Z");
    expect(startContraction(now)).toBe(now.toISOString());
  });
});

describe("stopContraction", () => {
  it("persists the whole session with the new contraction appended, duration clamped into range", async () => {
    const storage = createLocalAppStorageMock();
    const startedAt = new Date("2026-06-01T09:00:00.000Z");
    const now = new Date("2026-06-01T09:00:52.000Z"); // 52 seconds later

    const result = await stopContraction(
      storage,
      session({ contractions: [] }),
      startedAt.toISOString(),
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.rolledOver).toBe(false);
    expect(result.session.contractions).toEqual([
      { startedAt: startedAt.toISOString(), durationSeconds: 52 },
    ]);
    expect(storage.writeContractionSession).toHaveBeenCalledWith(result.session);
  });

  it("accumulates contractions across repeated calls, persisting after EACH one", async () => {
    const storage = createLocalAppStorageMock();
    let current = session({ contractions: [] });

    const first = await stopContraction(
      storage,
      current,
      "2026-06-01T09:00:00.000Z",
      new Date("2026-06-01T09:01:00.000Z"),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    current = first.session;

    const second = await stopContraction(
      storage,
      current,
      "2026-06-01T09:06:00.000Z",
      new Date("2026-06-01T09:07:00.000Z"),
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.session.contractions).toHaveLength(2);
    expect(storage.writeContractionSession).toHaveBeenCalledTimes(2);
    // The second write carries BOTH contractions -- an app kill right after
    // this call loses at most a third, not-yet-stopped contraction.
    expect(storage.writeContractionSession).toHaveBeenLastCalledWith(
      expect.objectContaining({ contractions: expect.arrayContaining([
        expect.objectContaining({ startedAt: "2026-06-01T09:00:00.000Z" }),
        expect.objectContaining({ startedAt: "2026-06-01T09:06:00.000Z" }),
      ]) }),
    );
  });

  it("clamps a too-short contraction up to the model minimum duration", async () => {
    const storage = createLocalAppStorageMock();
    const startedAt = new Date("2026-06-01T09:00:00.000Z");
    const now = new Date("2026-06-01T09:00:01.000Z"); // 1 second later

    const result = await stopContraction(storage, session(), startedAt.toISOString(), now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.contractions[0]!.durationSeconds).toBe(
      MIN_CONTRACTION_DURATION_SECONDS,
    );
  });

  it("clamps an unusually long contraction down to the model maximum duration", async () => {
    const storage = createLocalAppStorageMock();
    const startedAt = new Date("2026-06-01T09:00:00.000Z");
    const now = new Date("2026-06-01T09:20:00.000Z"); // 20 minutes later

    const result = await stopContraction(storage, session(), startedAt.toISOString(), now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.contractions[0]!.durationSeconds).toBe(
      MAX_CONTRACTION_DURATION_SECONDS,
    );
  });

  it("rolls over into a brand-new session when the current one is already at the contraction cap", async () => {
    const storage = createLocalAppStorageMock();
    const full = session({
      id: "contraction_full",
      startedAt: "2026-06-01T00:00:00.000Z",
      contractions: buildRegularContractions("2026-06-01T00:00:00.000Z", MAX_CONTRACTIONS_PER_SESSION, 1, 30),
    });
    const contractionStartedAt = "2026-06-01T09:00:00.000Z";

    const result = await stopContraction(
      storage,
      full,
      contractionStartedAt,
      new Date("2026-06-01T09:00:45.000Z"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rolledOver).toBe(true);
    expect(result.session.id).not.toBe(full.id);
    expect(result.session.contractions).toHaveLength(1);
    expect(storage.writeContractionSession).toHaveBeenCalledWith(
      expect.objectContaining({ contractions: expect.arrayContaining([
        expect.objectContaining({ startedAt: contractionStartedAt }),
      ]), id: result.session.id }),
    );
  });

  it("rolls over into a brand-new session when the contraction falls outside the 24h session span", async () => {
    const storage = createLocalAppStorageMock();
    const dayOld = session({
      id: "contraction_day_old",
      startedAt: "2026-06-01T00:00:00.000Z",
      contractions: [entry("2026-06-01T00:05:00.000Z")],
    });
    const contractionStartedAt = new Date(
      new Date(dayOld.startedAt).getTime() + MAX_CONTRACTION_SESSION_SPAN_HOURS * 60 * 60_000 + 60_000,
    ).toISOString();

    const result = await stopContraction(
      storage,
      dayOld,
      contractionStartedAt,
      new Date(new Date(contractionStartedAt).getTime() + 45_000),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rolledOver).toBe(true);
    expect(result.session.id).not.toBe(dayOld.id);
    expect(result.session.contractions).toHaveLength(1);
  });

  it("does not roll over when the session is still under both bounds", async () => {
    const storage = createLocalAppStorageMock();
    const roomy = session({ id: "contraction_roomy", contractions: [entry("2026-06-01T09:00:00.000Z")] });

    const result = await stopContraction(
      storage,
      roomy,
      "2026-06-01T09:10:00.000Z",
      new Date("2026-06-01T09:10:45.000Z"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rolledOver).toBe(false);
    expect(result.session.id).toBe(roomy.id);
    expect(result.session.contractions).toHaveLength(2);
  });

  it("reports save_failed when the storage write rejects", async () => {
    const storage = createLocalAppStorageMock({
      writeContractionSession: jest.fn().mockRejectedValue(new Error("busy")),
    });

    const result = await stopContraction(
      storage,
      session(),
      "2026-06-01T09:00:00.000Z",
      new Date("2026-06-01T09:00:45.000Z"),
    );

    expect(result).toEqual({ ok: false, errorCode: "save_failed" });
  });
});

describe("discardSession", () => {
  it("succeeds without deleting when the session has no completed contractions", async () => {
    const storage = createLocalAppStorageMock();

    const result = await discardSession(storage, session({ contractions: [] }));

    expect(result).toEqual({ ok: true });
    expect(storage.deleteContractionSession).not.toHaveBeenCalled();
  });

  it("deletes the persisted session when it has at least one completed contraction", async () => {
    const storage = createLocalAppStorageMock();
    const withData = session({ id: "contraction_x", contractions: [entry("2026-06-01T09:00:00.000Z")] });

    const result = await discardSession(storage, withData);

    expect(result).toEqual({ ok: true });
    expect(storage.deleteContractionSession).toHaveBeenCalledWith("contraction_x");
  });

  it("returns a generic error when the storage delete throws", async () => {
    const storage = createLocalAppStorageMock({
      deleteContractionSession: jest.fn().mockRejectedValue(new Error("io")),
    });

    const result = await discardSession(
      storage,
      session({ contractions: [entry("2026-06-01T09:00:00.000Z")] }),
    );

    expect(result).toEqual({ ok: false, errorCode: "generic" });
  });
});

describe("deleteContractionHistorySession", () => {
  it("delegates to the storage method", async () => {
    const storage = createLocalAppStorageMock();

    const result = await deleteContractionHistorySession(storage, "contraction_1");

    expect(result).toEqual({ ok: true });
    expect(storage.deleteContractionSession).toHaveBeenCalledWith("contraction_1");
  });

  it("returns a generic error when the storage delete throws", async () => {
    const storage = createLocalAppStorageMock({
      deleteContractionSession: jest.fn().mockRejectedValue(new Error("io")),
    });

    const result = await deleteContractionHistorySession(storage, "contraction_1");

    expect(result).toEqual({ ok: false, errorCode: "generic" });
  });
});

describe("computeContractionIntervals", () => {
  it("returns an empty array for a session with no contractions", () => {
    expect(computeContractionIntervals(session())).toEqual([]);
  });

  it("reports a null interval for the first (only) contraction", () => {
    const rows = computeContractionIntervals(
      session({ contractions: [entry("2026-06-01T09:00:00.000Z", 45)] }),
    );
    expect(rows).toEqual([
      { startedAt: "2026-06-01T09:00:00.000Z", durationSeconds: 45, intervalSeconds: null },
    ]);
  });

  it("computes start-to-start intervals in chronological order, independent of input order", () => {
    const rows = computeContractionIntervals(
      session({
        contractions: [
          entry("2026-06-01T09:10:00.000Z", 50), // out of order on purpose
          entry("2026-06-01T09:00:00.000Z", 40),
          entry("2026-06-01T09:05:30.000Z", 55),
        ],
      }),
    );

    expect(rows).toEqual([
      { startedAt: "2026-06-01T09:00:00.000Z", durationSeconds: 40, intervalSeconds: null },
      { startedAt: "2026-06-01T09:05:30.000Z", durationSeconds: 55, intervalSeconds: 330 },
      { startedAt: "2026-06-01T09:10:00.000Z", durationSeconds: 50, intervalSeconds: 270 },
    ]);
  });
});

describe("computeWindowSummary", () => {
  const now = new Date("2026-06-01T10:00:00.000Z");

  it("reports zero count and null averages for an empty session", () => {
    expect(computeWindowSummary(session(), now)).toEqual({
      count: 0,
      averageIntervalSeconds: null,
      averageDurationSeconds: null,
      windowMinutes: 60,
    });
  });

  it("excludes contractions older than the window", () => {
    const summary = computeWindowSummary(
      session({
        contractions: [
          entry("2026-06-01T08:30:00.000Z", 90), // 90 min ago -- outside the 60-min window
          entry("2026-06-01T09:50:00.000Z", 50), // 10 min ago -- inside
        ],
      }),
      now,
    );

    expect(summary.count).toBe(1);
    expect(summary.averageDurationSeconds).toBe(50);
    expect(summary.averageIntervalSeconds).toBeNull();
  });

  it("averages duration and start-to-start interval across contractions within the window", () => {
    const summary = computeWindowSummary(
      session({
        contractions: [
          entry("2026-06-01T09:40:00.000Z", 40),
          entry("2026-06-01T09:45:00.000Z", 60), // +5 min
          entry("2026-06-01T09:50:00.000Z", 50), // +5 min
        ],
      }),
      now,
    );

    expect(summary.count).toBe(3);
    expect(summary.averageDurationSeconds).toBe(50); // (40+60+50)/3
    expect(summary.averageIntervalSeconds).toBe(300); // two 5-min gaps
  });

  it("does not let a gap to a pre-window contraction pollute the windowed average interval", () => {
    const summary = computeWindowSummary(
      session({
        contractions: [
          entry("2026-06-01T08:00:00.000Z", 60), // 2h before now, well outside
          entry("2026-06-01T09:55:00.000Z", 60), // 5 min ago, inside
        ],
      }),
      now,
    );

    // Only one contraction is inside the window, so there is no interval to
    // average -- NOT the ~115-minute gap to the excluded contraction.
    expect(summary.count).toBe(1);
    expect(summary.averageIntervalSeconds).toBeNull();
  });
});

describe("matches511Pattern", () => {
  it("is false with zero contractions", () => {
    expect(matches511Pattern(session(), new Date("2026-06-01T09:00:00.000Z"))).toBe(false);
  });

  it("is false with exactly one contraction", () => {
    const withOne = session({ contractions: [entry("2026-06-01T09:00:00.000Z")] });
    expect(matches511Pattern(withOne, new Date("2026-06-01T09:00:30.000Z"))).toBe(false);
  });

  it("matches a streak of exactly-5-minute intervals and exactly-60s durations spanning exactly 60 minutes", () => {
    // 13 contractions, 12 gaps of exactly 5 min = 60-min span; every
    // duration exactly at the 60s minimum.
    const contractions = buildRegularContractions("2026-06-01T09:00:00.000Z", 13, 5, 60);
    const latest = contractions[contractions.length - 1]!;
    const matching = session({ contractions });

    expect(matches511Pattern(matching, new Date(latest.startedAt))).toBe(true);
  });

  it("does not match when the streak has not yet covered a full 60-minute span", () => {
    // Only two contractions, 5 min apart -- perfectly qualifying gap, but far
    // short of the required 60-minute span.
    const contractions = buildRegularContractions("2026-06-01T09:00:00.000Z", 2, 5, 60);
    const latest = contractions[contractions.length - 1]!;
    const short = session({ contractions });

    expect(matches511Pattern(short, new Date(latest.startedAt))).toBe(false);
  });

  it("does not match when one duration in the streak falls 1 second under the minimum", () => {
    const contractions = buildRegularContractions("2026-06-01T09:00:00.000Z", 13, 5, 60);
    contractions[6] = entry(contractions[6]!.startedAt, 59); // breaks the streak there
    const latest = contractions[contractions.length - 1]!;

    expect(matches511Pattern(session({ contractions }), new Date(latest.startedAt))).toBe(false);
  });

  it("a gap over 5 minutes breaks the streak, even if the full history would otherwise qualify", () => {
    // c0..c5 five minutes apart (a 25-min run), then a 10-min gap to c6, then
    // c6..c8 five minutes apart again. The streak since the latest
    // contraction only reaches back to c6 -- a 10-minute span, not enough.
    const before = buildRegularContractions("2026-06-01T09:00:00.000Z", 6, 5, 60); // c0..c5
    const afterGapStart = new Date(
      new Date(before[before.length - 1]!.startedAt).getTime() + 10 * 60_000,
    ).toISOString();
    const after = buildRegularContractions(afterGapStart, 3, 5, 60); // c6..c8
    const contractions = [...before, ...after];
    const latest = contractions[contractions.length - 1]!;

    expect(matches511Pattern(session({ contractions }), new Date(latest.startedAt))).toBe(false);
  });

  it("does not match once it has been more than 5 minutes since the latest contraction", () => {
    const contractions = buildRegularContractions("2026-06-01T09:00:00.000Z", 13, 5, 60);
    const latest = contractions[contractions.length - 1]!;
    const staleNow = new Date(new Date(latest.startedAt).getTime() + 6 * 60_000);

    expect(matches511Pattern(session({ contractions }), staleNow)).toBe(false);
  });

  it("still matches exactly at the 5-minute recency boundary", () => {
    const contractions = buildRegularContractions("2026-06-01T09:00:00.000Z", 13, 5, 60);
    const latest = contractions[contractions.length - 1]!;
    const boundaryNow = new Date(new Date(latest.startedAt).getTime() + 5 * 60_000);

    expect(matches511Pattern(session({ contractions }), boundaryNow)).toBe(true);
  });
});

describe("formatMinSecLabel", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [45, "0:45"],
    [65, "1:05"],
    [600, "10:00"],
  ])("formats %d seconds as %s", (seconds, expected) => {
    expect(formatMinSecLabel(seconds)).toBe(expected);
  });

  it("clamps a negative value to zero", () => {
    expect(formatMinSecLabel(-5)).toBe("0:00");
  });
});

describe("buildContractionTimerViewData", () => {
  it("is accessible with an active pregnancy at any gestational age (no week gate)", () => {
    // `now` is deliberately far outside any sane gestational window -- proves
    // accessibility never depends on gestational age math at all.
    const farFuture = new Date("2030-01-01T00:00:00.000Z");
    const viewData = buildContractionTimerViewData(activeRecord(), session(), farFuture, "en");
    expect(viewData.accessible).toBe(true);
  });

  it("is not accessible with no active pregnancy", () => {
    const viewData = buildContractionTimerViewData(
      null,
      session(),
      new Date("2026-06-01T09:00:00.000Z"),
      "en",
    );
    expect(viewData.accessible).toBe(false);
  });

  it("is not accessible with an ended pregnancy", () => {
    const ended = { ...activeRecord(), status: "ended" as const, endedAt: "2026-09-01", endReason: "birth" as const, modeOfDelivery: "vaginal" as const };
    const viewData = buildContractionTimerViewData(
      ended,
      session(),
      new Date("2026-06-01T09:00:00.000Z"),
      "en",
    );
    expect(viewData.accessible).toBe(false);
  });

  it("orders rows most-recent-first and labels the first contraction's interval distinctly", () => {
    const viewData = buildContractionTimerViewData(
      activeRecord(),
      session({
        contractions: [
          entry("2026-06-01T09:00:00.000Z", 45),
          entry("2026-06-01T09:05:00.000Z", 50),
        ],
      }),
      new Date("2026-06-01T09:05:50.000Z"),
      "en",
    );

    expect(viewData.rows).toHaveLength(2);
    expect(viewData.rows[0]!.durationLabel).toBe("0:50"); // most recent first
    expect(viewData.rows[0]!.intervalLabel).toBe("5:00");
    expect(viewData.rows[1]!.durationLabel).toBe("0:45");
    expect(viewData.rows[1]!.intervalLabel).toBe(viewData.rows[1]!.intervalLabel); // sanity
    expect(viewData.rows[1]!.intervalLabel).not.toBe("5:00");
  });

  it("reports window-summary data presence distinctly from the empty case", () => {
    const empty = buildContractionTimerViewData(
      activeRecord(),
      session(),
      new Date("2026-06-01T09:00:00.000Z"),
      "en",
    );
    expect(empty.windowSummary.hasData).toBe(false);

    const withData = buildContractionTimerViewData(
      activeRecord(),
      session({ contractions: [entry("2026-06-01T08:59:00.000Z", 50)] }),
      new Date("2026-06-01T09:00:00.000Z"),
      "en",
    );
    expect(withData.windowSummary.hasData).toBe(true);
  });

  it("exposes the same neutral routine education line regardless of whether the 5-1-1 pattern currently matches", () => {
    // Anchored at term (37+0) so this specifically exercises the routine_511
    // variant (see the "GA-aware education variant" suite below for the
    // preterm variant) -- educationProminent must not change the WORDING,
    // only the presentation, for whichever variant applies.
    const now = nowForGaDays(37 * 7);
    const notMatching = buildContractionTimerViewData(activeRecord(), session(), now, "en");

    const contractions = buildRegularContractions(
      new Date(now.getTime() - 60 * 60_000).toISOString(),
      13,
      5,
      60,
    );
    const matching = buildContractionTimerViewData(
      activeRecord(),
      session({ contractions }),
      new Date(contractions[contractions.length - 1]!.startedAt),
      "en",
    );

    expect(notMatching.educationVariant).toBe("routine_511");
    expect(matching.educationVariant).toBe("routine_511");
    expect(notMatching.educationProminent).toBe(false);
    expect(matching.educationProminent).toBe(true);
    expect(notMatching.educationLine).toBe(matching.educationLine);
    expect(notMatching.educationLine.length).toBeGreaterThan(0);
    // Neutral guideline copy, never an alarm/verdict wording.
    expect(notMatching.educationLine).not.toMatch(/!|hospital now/i);
  });

  it("always exposes a birth CTA label, independent of accessibility", () => {
    const accessible = buildContractionTimerViewData(
      activeRecord(),
      session(),
      new Date("2026-06-01T09:00:00.000Z"),
      "en",
    );
    const notAccessible = buildContractionTimerViewData(
      null,
      session(),
      new Date("2026-06-01T09:00:00.000Z"),
      "en",
    );
    expect(accessible.birthCta.label.length).toBeGreaterThan(0);
    expect(notAccessible.birthCta.label).toBe(accessible.birthCta.label);
  });
});

describe("buildContractionTimerViewData GA-aware education variant (CHANGE 1)", () => {
  it("is preterm just below term (36+6)", () => {
    const viewData = buildContractionTimerViewData(
      activeRecord(),
      session(),
      nowForGaDays(36 * 7 + 6),
      "en",
    );
    expect(viewData.educationVariant).toBe("preterm");
    expect(viewData.educationLine).toMatch(/preterm labour/i);
  });

  it("is routine_511 exactly at term (37+0)", () => {
    const viewData = buildContractionTimerViewData(
      activeRecord(),
      session(),
      nowForGaDays(37 * 7),
      "en",
    );
    expect(viewData.educationVariant).toBe("routine_511");
    expect(viewData.educationLine).toMatch(/common guideline/i);
  });

  it("defaults to routine_511 when there is no active pregnancy (GA unknown)", () => {
    const viewData = buildContractionTimerViewData(
      null,
      session(),
      new Date("2026-06-01T09:00:00.000Z"),
      "en",
    );
    expect(viewData.educationVariant).toBe("routine_511");
  });

  it("defaults to routine_511 for a stale record whose GA no longer resolves", () => {
    // Deliberately far outside the sane gestational window (see
    // accessible's own "any gestational age" test above) -- GA unknown here
    // too, so this stays routine_511 rather than fabricating a preterm claim.
    const viewData = buildContractionTimerViewData(
      activeRecord(),
      session(),
      new Date("2030-01-01T00:00:00.000Z"),
      "en",
    );
    expect(viewData.educationVariant).toBe("routine_511");
  });

  it("the preterm line is calm, with no exclamation marks or alarm wording", () => {
    const viewData = buildContractionTimerViewData(
      activeRecord(),
      session(),
      nowForGaDays(20 * 7),
      "en",
    );
    expect(viewData.educationVariant).toBe("preterm");
    expect(viewData.educationLine).not.toMatch(/!|hospital now/i);
  });
});

describe("buildContractionTimerViewData birthCta.visible (CHANGE 2, week-20 loss-taxonomy gate)", () => {
  it("hides the birth CTA below week 20", () => {
    const viewData = buildContractionTimerViewData(
      activeRecord(),
      session(),
      nowForGaDays(19 * 7 + 6),
      "en",
    );
    expect(viewData.birthCta.visible).toBe(false);
  });

  it("shows the birth CTA from week 20", () => {
    const viewData = buildContractionTimerViewData(
      activeRecord(),
      session(),
      nowForGaDays(20 * 7),
      "en",
    );
    expect(viewData.birthCta.visible).toBe(true);
  });

  it("keeps the birth CTA visible at week 38, unaffected by the dashboard's separate >=37 term gate", () => {
    const viewData = buildContractionTimerViewData(
      activeRecord(),
      session(),
      nowForGaDays(38 * 7),
      "en",
    );
    expect(viewData.birthCta.visible).toBe(true);
  });

  it("defaults visible when there is no active pregnancy (moot -- the screen never renders the CTA area then)", () => {
    const viewData = buildContractionTimerViewData(
      null,
      session(),
      new Date("2026-06-01T09:00:00.000Z"),
      "en",
    );
    expect(viewData.birthCta.visible).toBe(true);
  });
});

describe("buildContractionSessionHistoryViewData", () => {
  it("excludes the active session and sorts the rest newest first", () => {
    const active = session({ id: "contraction_active", startedAt: "2026-06-02T09:00:00.000Z" });
    const older = session({ id: "contraction_older", startedAt: "2026-06-01T09:00:00.000Z" });
    const newer = session({ id: "contraction_newer", startedAt: "2026-06-01T20:00:00.000Z" });

    const viewData = buildContractionSessionHistoryViewData(
      [active, older, newer],
      active.id,
      "en",
    );

    expect(viewData.rows.map((row) => row.id)).toEqual(["contraction_newer", "contraction_older"]);
  });

  it("reports the contraction count per past session", () => {
    const past = session({
      id: "contraction_past",
      contractions: [entry("2026-06-01T09:00:00.000Z"), entry("2026-06-01T09:05:00.000Z")],
    });

    const viewData = buildContractionSessionHistoryViewData([past], null, "en");
    expect(viewData.rows[0]!.contractionCountLabel).toContain("2");
  });

  it("reports an empty list distinctly from a populated one", () => {
    const viewData = buildContractionSessionHistoryViewData([], null, "en");
    expect(viewData.rows).toEqual([]);
    expect(viewData.emptyLabel.length).toBeGreaterThan(0);
  });
});

describe("defensive branches", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("ignores a contraction entry older than the session start when picking last activity", () => {
    // The entry predates the session's own startedAt, so it must not extend
    // (or here, shorten) the recency window.
    const recent = session({
      id: "contraction_recent",
      startedAt: new Date(now.getTime() - 10 * 60_000).toISOString(),
      contractions: [
        entry(new Date(now.getTime() - 4 * 60 * 60_000).toISOString()),
      ],
    });

    expect(resolveResumableSession([recent], now)).toEqual(recent);
  });

  it("picks the most recently active of several sessions, in either input order", () => {
    const older = session({
      id: "contraction_older",
      startedAt: new Date(now.getTime() - 60 * 60_000).toISOString(),
    });
    const newer = session({
      id: "contraction_newer",
      startedAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
    });

    expect(resolveResumableSession([older, newer], now)).toEqual(newer);
    expect(resolveResumableSession([newer, older], now)).toEqual(newer);
  });

  it("reports save_failed instead of persisting when the session draft fails sanitize", async () => {
    const storage = createLocalAppStorageMock();
    const corrupt = session({ id: "   " });

    const result = await stopContraction(
      storage,
      corrupt,
      new Date(now.getTime() - 60_000).toISOString(),
      now,
    );

    expect(result).toEqual({ ok: false, errorCode: "save_failed" });
    expect(storage.writeContractionSession).not.toHaveBeenCalled();
  });

  it("falls back to a time+counter session id when the platform lacks randomUUID", () => {
    const cryptoObject = globalThis.crypto as { randomUUID?: () => string };
    Object.defineProperty(cryptoObject, "randomUUID", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      const created = createContractionSession(now);
      expect(created.id).toMatch(/^contraction_[0-9a-z]+_[0-9a-z]+$/);
    } finally {
      delete (cryptoObject as Record<string, unknown>).randomUUID;
    }
  });

  it("renders raw date strings in history rows when a stored value does not parse", () => {
    const history = buildContractionSessionHistoryViewData(
      [
        session({ id: "contraction_bad", date: "junk", startedAt: "not-a-time" }),
        session({
          id: "contraction_mid",
          startedAt: "2026-06-01T10:00:00.000Z",
        }),
        session({
          id: "contraction_new",
          startedAt: "2026-06-01T11:00:00.000Z",
        }),
      ],
      null,
      "en",
    );

    // Unparseable values pass through untouched (never crash, never invent a
    // date); parseable sessions still sort newest first around them.
    const badRow = history.rows.find((row) => row.id === "contraction_bad");
    expect(badRow?.dateLabel).toBe("junk");
    expect(badRow?.startTimeLabel).toBe("not-a-time");
    const parseableIds = history.rows
      .filter((row) => row.id !== "contraction_bad")
      .map((row) => row.id);
    expect(parseableIds).toEqual(["contraction_new", "contraction_mid"]);
  });
});

describe("real-clock defaults", () => {
  it("resumeOrCreateSession defaults `now` to the real clock", async () => {
    const storage = createLocalAppStorageMock();

    const created = await resumeOrCreateSession(storage);

    expect(created.contractions).toEqual([]);
    expect(new Date(created.startedAt).getTime()).toBeGreaterThan(0);
  });

  it("stopContraction defaults `now` to the real clock", async () => {
    const storage = createLocalAppStorageMock();
    const live = session({
      id: "contraction_live",
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      date: formatLocalDate(new Date()),
    });

    const result = await stopContraction(
      storage,
      live,
      new Date(Date.now() - 30_000).toISOString(),
    );

    expect(result.ok).toBe(true);
    expect(storage.writeContractionSession).toHaveBeenCalled();
  });
});
