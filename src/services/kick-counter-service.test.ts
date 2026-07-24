import {
  MAX_KICK_COUNT,
  MAX_KICK_COUNT_SESSION_DURATION_MINUTES,
  MIN_KICK_COUNT_SESSION_DURATION_MINUTES,
  createPregnancyRecord,
  type KickCountSession,
} from "../models/pregnancy";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import {
  buildKickCounterViewData,
  deleteKickCountSession,
  finishKickCountSession,
} from "./kick-counter-service";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";

const LMP = "2026-01-01";
const EDD = "2026-10-08"; // LMP + 280 days (Naegele).

// today (LocalDateISO) that makes calcGestationalAge(EDD, today) report gaDays.
function todayForGaDays(gaDays: number): string {
  return formatLocalDate(addDays(parseLocalDate(EDD)!, gaDays - 280));
}

function activeRecord(edd = EDD) {
  return createPregnancyRecord({
    edd,
    eddBasis: "lmp",
    lmpDate: LMP,
    startedAt: "2026-03-01",
  });
}

function session(overrides: Partial<KickCountSession> = {}): KickCountSession {
  return {
    id: "kick_1",
    date: "2026-06-01",
    durationMinutes: 30,
    kickCount: 10,
    ...overrides,
  };
}

describe("buildKickCounterViewData", () => {
  it("is not accessible one week before the start week", () => {
    const viewData = buildKickCounterViewData(
      activeRecord(),
      todayForGaDays(27 * 7 + 6),
      [],
      "en",
    );
    expect(viewData.accessible).toBe(false);
  });

  it("is accessible from the exact start week", () => {
    const viewData = buildKickCounterViewData(
      activeRecord(),
      todayForGaDays(28 * 7),
      [],
      "en",
    );
    expect(viewData.accessible).toBe(true);
  });

  it("is not accessible with no pregnancy", () => {
    const viewData = buildKickCounterViewData(null, "2026-06-01", [], "en");
    expect(viewData.accessible).toBe(false);
  });

  it("is not accessible with an ended pregnancy, even past week 28", () => {
    const ended = {
      ...activeRecord(),
      status: "ended" as const,
      endedAt: "2026-09-01",
      endReason: "birth" as const,
      modeOfDelivery: "vaginal" as const,
    };
    const viewData = buildKickCounterViewData(
      ended,
      todayForGaDays(30 * 7),
      [],
      "en",
    );
    expect(viewData.accessible).toBe(false);
  });

  it("is not accessible when the record is outside the trackable gestational window", () => {
    const viewData = buildKickCounterViewData(
      activeRecord(),
      formatLocalDate(addDays(parseLocalDate(EDD)!, 40)),
      [],
      "en",
    );
    expect(viewData.accessible).toBe(false);
  });

  it("exposes the same neutral education line regardless of session history", () => {
    const withNoSessions = buildKickCounterViewData(
      activeRecord(),
      todayForGaDays(30 * 7),
      [],
      "en",
    );
    const withLowCount = buildKickCounterViewData(
      activeRecord(),
      todayForGaDays(30 * 7),
      [session({ kickCount: 2 })],
      "en",
    );
    const withHighCount = buildKickCounterViewData(
      activeRecord(),
      todayForGaDays(30 * 7),
      [session({ kickCount: 25 })],
      "en",
    );

    expect(withNoSessions.educationLine).toBe(withLowCount.educationLine);
    expect(withLowCount.educationLine).toBe(withHighCount.educationLine);
    expect(withNoSessions.educationLine.length).toBeGreaterThan(0);
    // Neutral education copy, never a verdict on any specific count.
    expect(withNoSessions.educationLine).not.toMatch(/\d+ kicks?/i);
  });

  it("orders recent-session history rows newest first", () => {
    const sessions: KickCountSession[] = [
      session({ id: "kick_a", date: "2026-06-01", kickCount: 8 }),
      session({ id: "kick_b", date: "2026-06-03", kickCount: 12 }),
      session({ id: "kick_c", date: "2026-06-02", kickCount: 10 }),
    ];

    const viewData = buildKickCounterViewData(
      activeRecord(),
      todayForGaDays(30 * 7),
      sessions,
      "en",
    );

    expect(viewData.history.rows.map((row) => row.id)).toEqual([
      "kick_b",
      "kick_c",
      "kick_a",
    ]);
  });

  it("shapes each history row with date, kick count, and duration", () => {
    const viewData = buildKickCounterViewData(
      activeRecord(),
      todayForGaDays(30 * 7),
      [session({ id: "kick_1", date: "2026-06-01", kickCount: 11, durationMinutes: 42 })],
      "en",
    );

    expect(viewData.history.rows).toEqual([
      {
        id: "kick_1",
        dateLabel: expect.any(String),
        kickCount: 11,
        durationLabel: "42 min",
      },
    ]);
  });

  it("reports the empty-history label distinctly from a populated one", () => {
    const empty = buildKickCounterViewData(
      activeRecord(),
      todayForGaDays(30 * 7),
      [],
      "en",
    );
    expect(empty.history.rows).toEqual([]);
    expect(empty.history.emptyLabel.length).toBeGreaterThan(0);
  });
});

describe("finishKickCountSession", () => {
  it("persists a sanitized session shaped from elapsed time and tap count", async () => {
    const storage = createLocalAppStorageMock();
    const startedAt = new Date(2026, 5, 1, 10, 0, 0, 0);
    const now = new Date(2026, 5, 1, 10, 4, 30, 0); // 4.5 minutes later

    const result = await finishKickCountSession(
      storage,
      { startedAt, kickCount: 10 },
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.session).toEqual({
      id: expect.any(String),
      date: "2026-06-01",
      durationMinutes: 5, // rounds 4.5 -> 5
      kickCount: 10,
    });
    expect(storage.writeKickSession).toHaveBeenCalledWith(result.session);
  });

  it("clamps duration up to the minimum when finished within the same minute", async () => {
    const storage = createLocalAppStorageMock();
    const startedAt = new Date(2026, 5, 1, 10, 0, 0, 0);
    const now = new Date(2026, 5, 1, 10, 0, 10, 0); // 10 seconds later

    const result = await finishKickCountSession(
      storage,
      { startedAt, kickCount: 3 },
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.session.durationMinutes).toBe(MIN_KICK_COUNT_SESSION_DURATION_MINUTES);
  });

  it("clamps an unusually long session down to the model maximum duration", async () => {
    const storage = createLocalAppStorageMock();
    const startedAt = new Date(2026, 5, 1, 10, 0, 0, 0);
    const now = new Date(2026, 5, 2, 10, 0, 0, 0); // 24 hours later

    const result = await finishKickCountSession(
      storage,
      { startedAt, kickCount: 10 },
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.session.durationMinutes).toBe(
      MAX_KICK_COUNT_SESSION_DURATION_MINUTES,
    );
  });

  it("allows finishing early, before reaching the count-to-10 convention", async () => {
    const storage = createLocalAppStorageMock();
    const result = await finishKickCountSession(
      storage,
      { startedAt: new Date(2026, 5, 1, 9, 0, 0, 0), kickCount: 3 },
      new Date(2026, 5, 1, 9, 20, 0, 0),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.session.kickCount).toBe(3);
  });

  it("allows continuing past 10 taps, clamped to the model max", async () => {
    const storage = createLocalAppStorageMock();
    const result = await finishKickCountSession(
      storage,
      { startedAt: new Date(2026, 5, 1, 9, 0, 0, 0), kickCount: 250 },
      new Date(2026, 5, 1, 9, 40, 0, 0),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.session.kickCount).toBe(MAX_KICK_COUNT);
  });

  it("reports save_failed when the storage write rejects", async () => {
    const storage = createLocalAppStorageMock({
      writeKickSession: jest.fn().mockRejectedValue(new Error("busy")),
    });

    const result = await finishKickCountSession(storage, {
      startedAt: new Date(2026, 5, 1, 9, 0, 0, 0),
      kickCount: 10,
    });

    expect(result).toEqual({ ok: false, errorCode: "save_failed" });
  });
});

describe("deleteKickCountSession", () => {
  it("delegates to the storage method", async () => {
    const storage = createLocalAppStorageMock();

    const result = await deleteKickCountSession(storage, "kick_1");

    expect(result).toEqual({ ok: true });
    expect(storage.deleteKickSession).toHaveBeenCalledWith("kick_1");
  });

  it("returns a generic error when the storage delete throws", async () => {
    const storage = createLocalAppStorageMock({
      deleteKickSession: jest.fn().mockRejectedValue(new Error("io")),
    });

    const result = await deleteKickCountSession(storage, "kick_1");

    expect(result).toEqual({ ok: false, errorCode: "generic" });
  });
});

describe("defensive branches", () => {
  it("reports save_failed when the start instant is an invalid Date", async () => {
    const storage = createLocalAppStorageMock();

    const result = await finishKickCountSession(
      storage,
      { startedAt: new Date("not-a-date"), kickCount: 8 },
      new Date("2026-06-01T12:00:00.000Z"),
    );

    expect(result).toEqual({ ok: false, errorCode: "save_failed" });
    expect(storage.writeKickSession).not.toHaveBeenCalled();
  });

  it("orders same-day sessions deterministically by id, newest first", () => {
    const viewData = buildKickCounterViewData(
      activeRecord(),
      todayForGaDays(200),
      [
        session({ id: "kick_a", date: todayForGaDays(199) }),
        session({ id: "kick_b", date: todayForGaDays(199) }),
      ],
      "en",
    );

    expect(viewData.history.rows.map((row) => row.id)).toEqual([
      "kick_b",
      "kick_a",
    ]);
  });

  it("renders a raw date string in history rows when a stored value does not parse", () => {
    const viewData = buildKickCounterViewData(
      activeRecord(),
      todayForGaDays(200),
      [session({ id: "kick_bad", date: "junk" as KickCountSession["date"] })],
      "en",
    );

    expect(viewData.history.rows[0]?.dateLabel).toBe("junk");
  });

  it("falls back to a time+counter session id when the platform lacks randomUUID", async () => {
    const cryptoObject = globalThis.crypto as { randomUUID?: () => string };
    Object.defineProperty(cryptoObject, "randomUUID", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      const storage = createLocalAppStorageMock();
      const result = await finishKickCountSession(
        storage,
        { startedAt: new Date("2026-06-01T11:00:00.000Z"), kickCount: 8 },
        new Date("2026-06-01T12:00:00.000Z"),
      );
      expect(result.ok).toBe(true);
      expect(storage.writeKickSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^kick_[0-9a-z]+_[0-9a-z]+$/),
        }),
      );
    } finally {
      delete (cryptoObject as Record<string, unknown>).randomUUID;
    }
  });
});
