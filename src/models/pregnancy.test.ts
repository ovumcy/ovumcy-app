import {
  MAX_CONTRACTIONS_PER_SESSION,
  MAX_CONTRACTION_DURATION_SECONDS,
  MAX_KICK_COUNT,
  MAX_KICK_COUNT_SESSION_DURATION_MINUTES,
  MIN_CONTRACTION_DURATION_SECONDS,
  MIN_KICK_COUNT,
  MIN_KICK_COUNT_SESSION_DURATION_MINUTES,
  type PregnancyRecord,
  createPregnancyRecord,
  hasActivePregnancy,
  sanitizeContractionSession,
  sanitizeKickCountSession,
  sanitizePregnancyRecord,
} from "./pregnancy";

describe("createPregnancyRecord (multiples)", () => {
  it("omits fetusCount/chorionicity entirely when not provided (identical to a singleton record)", () => {
    const record = createPregnancyRecord({
      edd: "2026-10-08",
      eddBasis: "lmp",
      lmpDate: "2026-01-01",
      startedAt: "2026-01-05",
    });

    expect(record.fetusCount).toBeUndefined();
    expect(record.chorionicity).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(record, "fetusCount")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(record, "chorionicity")).toBe(false);
  });

  it("passes fetusCount and chorionicity through unchanged when provided", () => {
    const record = createPregnancyRecord({
      edd: "2026-10-08",
      eddBasis: "lmp",
      lmpDate: "2026-01-01",
      startedAt: "2026-01-05",
      fetusCount: 2,
      chorionicity: "mcda",
    });

    expect(record.fetusCount).toBe(2);
    expect(record.chorionicity).toBe("mcda");
  });
});

describe("createPregnancyRecord", () => {
  it("creates an active record with the given fields and null end fields", () => {
    const record = createPregnancyRecord({
      edd: "2026-10-08",
      eddBasis: "lmp",
      lmpDate: "2026-01-01",
      startedAt: "2026-01-05",
    });

    expect(record.status).toBe("active");
    expect(record.edd).toBe("2026-10-08");
    expect(record.eddBasis).toBe("lmp");
    expect(record.lmpDate).toBe("2026-01-01");
    expect(record.startedAt).toBe("2026-01-05");
    expect(record.schedulePreset).toBe("who2016");
    expect(record.endedAt).toBeNull();
    expect(record.endReason).toBeNull();
    expect(record.modeOfDelivery).toBeNull();
    expect(record.id.length).toBeGreaterThan(0);
  });

  it("defaults lmpDate to null when omitted", () => {
    const record = createPregnancyRecord({
      edd: "2026-10-08",
      eddBasis: "ultrasound",
      startedAt: "2026-01-05",
    });

    expect(record.lmpDate).toBeNull();
  });

  it("gives each record a distinct id", () => {
    const a = createPregnancyRecord({
      edd: "2026-10-08",
      eddBasis: "manual",
      startedAt: "2026-01-05",
    });
    const b = createPregnancyRecord({
      edd: "2026-10-08",
      eddBasis: "manual",
      startedAt: "2026-01-05",
    });

    expect(a.id).not.toBe(b.id);
  });
});

describe("hasActivePregnancy", () => {
  const active = createPregnancyRecord({
    edd: "2026-10-08",
    eddBasis: "lmp",
    startedAt: "2026-01-05",
  });
  const ended: PregnancyRecord = { ...active, id: "ended-1", status: "ended" };

  it("is true when at least one record is active", () => {
    expect(hasActivePregnancy([ended, active])).toBe(true);
  });

  it("is false when no record is active", () => {
    expect(hasActivePregnancy([ended])).toBe(false);
    expect(hasActivePregnancy([])).toBe(false);
  });
});

describe("sanitizePregnancyRecord", () => {
  const valid: PregnancyRecord = {
    id: "pregnancy_1",
    status: "active",
    edd: "2026-10-08",
    eddBasis: "lmp",
    lmpDate: "2026-01-01",
    schedulePreset: "who2016",
    startedAt: "2026-01-05",
    endedAt: null,
    endReason: null,
    modeOfDelivery: null,
  };

  it("passes through an already-valid record unchanged", () => {
    expect(sanitizePregnancyRecord(valid)).toEqual(valid);
  });

  it("returns null for a non-object", () => {
    expect(sanitizePregnancyRecord(null)).toBeNull();
    expect(sanitizePregnancyRecord(undefined)).toBeNull();
    expect(sanitizePregnancyRecord("nope")).toBeNull();
    expect(sanitizePregnancyRecord([])).toBeNull();
  });

  it("returns null when id is missing or blank", () => {
    expect(sanitizePregnancyRecord({ ...valid, id: "" })).toBeNull();
    expect(sanitizePregnancyRecord({ ...valid, id: "   " })).toBeNull();
    const { id: _id, ...withoutId } = valid;
    expect(sanitizePregnancyRecord(withoutId)).toBeNull();
  });

  it("trims a padded id", () => {
    expect(sanitizePregnancyRecord({ ...valid, id: "  pregnancy_1  " })).toEqual(
      valid,
    );
  });

  it("returns null when status is not a known enum value", () => {
    expect(sanitizePregnancyRecord({ ...valid, status: "pending" })).toBeNull();
  });

  it("returns null when edd is not a valid calendar date", () => {
    expect(sanitizePregnancyRecord({ ...valid, edd: "2026-13-40" })).toBeNull();
    expect(sanitizePregnancyRecord({ ...valid, edd: 12345 })).toBeNull();
  });

  it("returns null when eddBasis or schedulePreset is unknown", () => {
    expect(sanitizePregnancyRecord({ ...valid, eddBasis: "guess" })).toBeNull();
    expect(
      sanitizePregnancyRecord({ ...valid, schedulePreset: "acog2020" }),
    ).toBeNull();
  });

  it("returns null when startedAt is not a valid calendar date", () => {
    expect(sanitizePregnancyRecord({ ...valid, startedAt: "" })).toBeNull();
  });

  it("defaults an invalid nullable field to null instead of rejecting the record", () => {
    expect(sanitizePregnancyRecord({ ...valid, lmpDate: "not-a-date" })).toEqual({
      ...valid,
      lmpDate: null,
    });
    expect(sanitizePregnancyRecord({ ...valid, endedAt: 42 })).toEqual({
      ...valid,
      endedAt: null,
    });
    expect(
      sanitizePregnancyRecord({ ...valid, endReason: "unknown_reason" }),
    ).toEqual({ ...valid, endReason: null });
    expect(
      sanitizePregnancyRecord({ ...valid, modeOfDelivery: "forceps" }),
    ).toEqual({ ...valid, modeOfDelivery: null });
  });

  describe("multiples (fetusCount / chorionicity)", () => {
    it("leaves fetusCount and chorionicity absent when the input never had them (absent -> absent, never invented)", () => {
      const result = sanitizePregnancyRecord(valid);
      expect(result?.fetusCount).toBeUndefined();
      expect(result?.chorionicity).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(result, "fetusCount")).toBe(
        false,
      );
      expect(
        Object.prototype.hasOwnProperty.call(result, "chorionicity"),
      ).toBe(false);
    });

    it("round-trips a valid twins record with chorionicity", () => {
      const result = sanitizePregnancyRecord({
        ...valid,
        fetusCount: 2,
        chorionicity: "mcda",
      });
      expect(result?.fetusCount).toBe(2);
      expect(result?.chorionicity).toBe("mcda");
    });

    it("round-trips fetusCount 3 ('three or more') with chorionicity unknown", () => {
      const result = sanitizePregnancyRecord({
        ...valid,
        fetusCount: 3,
        chorionicity: "unknown",
      });
      expect(result?.fetusCount).toBe(3);
      expect(result?.chorionicity).toBe("unknown");
    });

    it("drops chorionicity when fetusCount is absent, even if chorionicity itself is valid", () => {
      const result = sanitizePregnancyRecord({ ...valid, chorionicity: "mcda" });
      expect(result?.fetusCount).toBeUndefined();
      expect(result?.chorionicity).toBeUndefined();
    });

    it("drops chorionicity when fetusCount is explicitly 1 (singleton)", () => {
      const result = sanitizePregnancyRecord({
        ...valid,
        fetusCount: 1,
        chorionicity: "mcma",
      });
      expect(result?.fetusCount).toBe(1);
      expect(result?.chorionicity).toBeUndefined();
    });

    it("defaults an invalid fetusCount to absent instead of rejecting the record", () => {
      const result = sanitizePregnancyRecord({
        ...valid,
        fetusCount: 4,
        chorionicity: "mcda",
      });
      expect(result?.fetusCount).toBeUndefined();
      // chorionicity is dropped too, since the sanitized fetusCount is absent.
      expect(result?.chorionicity).toBeUndefined();

      expect(
        sanitizePregnancyRecord({ ...valid, fetusCount: "2" })?.fetusCount,
      ).toBeUndefined();
      expect(
        sanitizePregnancyRecord({ ...valid, fetusCount: 0 })?.fetusCount,
      ).toBeUndefined();
    });

    it("defaults an invalid chorionicity to absent instead of rejecting the record", () => {
      const result = sanitizePregnancyRecord({
        ...valid,
        fetusCount: 2,
        chorionicity: "monoamniotic-twins",
      });
      expect(result?.fetusCount).toBe(2);
      expect(result?.chorionicity).toBeUndefined();
    });
  });
});

describe("sanitizeKickCountSession", () => {
  const valid = {
    id: "kick_1",
    date: "2026-05-01",
    durationMinutes: 30,
    kickCount: 10,
  };

  it("passes through an already-valid session unchanged", () => {
    expect(sanitizeKickCountSession(valid)).toEqual(valid);
  });

  it("returns null for a missing id or invalid date", () => {
    expect(sanitizeKickCountSession(null)).toBeNull();
    expect(sanitizeKickCountSession({ ...valid, id: "" })).toBeNull();
    expect(sanitizeKickCountSession({ ...valid, date: "not-a-date" })).toBeNull();
  });

  it("clamps an out-of-range kickCount instead of rejecting the session", () => {
    expect(sanitizeKickCountSession({ ...valid, kickCount: 500 })).toEqual({
      ...valid,
      kickCount: MAX_KICK_COUNT,
    });
    expect(sanitizeKickCountSession({ ...valid, kickCount: -5 })).toEqual({
      ...valid,
      kickCount: MIN_KICK_COUNT,
    });
  });

  it("clamps an out-of-range durationMinutes instead of rejecting the session", () => {
    expect(sanitizeKickCountSession({ ...valid, durationMinutes: 999 })).toEqual({
      ...valid,
      durationMinutes: MAX_KICK_COUNT_SESSION_DURATION_MINUTES,
    });
    expect(
      sanitizeKickCountSession({ ...valid, durationMinutes: "banana" }),
    ).toEqual({
      ...valid,
      durationMinutes: MIN_KICK_COUNT_SESSION_DURATION_MINUTES,
    });
  });
});

describe("sanitizeContractionSession", () => {
  const session = {
    id: "contraction_1",
    date: "2026-05-01",
    startedAt: "2026-05-01T10:00:00.000Z",
    contractions: [
      { startedAt: "2026-05-01T10:00:00.000Z", durationSeconds: 45 },
      { startedAt: "2026-05-01T10:05:00.000Z", durationSeconds: 700 },
    ],
  };

  it("passes through valid entries and clamps each entry's durationSeconds into bounds", () => {
    const result = sanitizeContractionSession(session);
    expect(result?.contractions).toEqual([
      { startedAt: "2026-05-01T10:00:00.000Z", durationSeconds: 45 },
      {
        startedAt: "2026-05-01T10:05:00.000Z",
        durationSeconds: MAX_CONTRACTION_DURATION_SECONDS,
      },
    ]);
  });

  it("clamps a too-short durationSeconds up to the minimum", () => {
    const result = sanitizeContractionSession({
      ...session,
      contractions: [{ startedAt: "2026-05-01T10:00:00.000Z", durationSeconds: 1 }],
    });
    expect(result?.contractions).toEqual([
      {
        startedAt: "2026-05-01T10:00:00.000Z",
        durationSeconds: MIN_CONTRACTION_DURATION_SECONDS,
      },
    ]);
  });

  it("drops entries with an unparseable startedAt", () => {
    const result = sanitizeContractionSession({
      ...session,
      contractions: [
        ...session.contractions,
        { startedAt: "garbage", durationSeconds: 30 },
      ],
    });
    expect(result?.contractions).toHaveLength(2);
  });

  it("drops entries starting more than 24h after the session start", () => {
    const result = sanitizeContractionSession({
      ...session,
      contractions: [
        { startedAt: "2026-05-01T10:00:00.000Z", durationSeconds: 45 },
        { startedAt: "2026-05-03T10:00:01.000Z", durationSeconds: 45 },
      ],
    });
    expect(result?.contractions).toEqual([
      { startedAt: "2026-05-01T10:00:00.000Z", durationSeconds: 45 },
    ]);
  });

  it("drops entries starting before the session start", () => {
    const result = sanitizeContractionSession({
      ...session,
      contractions: [
        { startedAt: "2026-05-01T09:59:59.000Z", durationSeconds: 45 },
      ],
    });
    expect(result?.contractions).toEqual([]);
  });

  it("caps the number of accepted contractions per session", () => {
    const many = Array.from({ length: MAX_CONTRACTIONS_PER_SESSION + 50 }, () => ({
      startedAt: "2026-05-01T10:00:00.000Z",
      durationSeconds: 30,
    }));
    const result = sanitizeContractionSession({ ...session, contractions: many });
    expect(result?.contractions).toHaveLength(MAX_CONTRACTIONS_PER_SESSION);
  });

  it("returns null for a missing id or invalid startedAt", () => {
    expect(sanitizeContractionSession({ ...session, id: "" })).toBeNull();
    expect(sanitizeContractionSession({ ...session, startedAt: "not-iso" })).toBeNull();
  });

  it("treats a missing/non-array contractions field as empty rather than rejecting", () => {
    const { contractions: _contractions, ...withoutContractions } = session;
    expect(sanitizeContractionSession(withoutContractions)).toEqual({
      id: session.id,
      date: session.date,
      startedAt: session.startedAt,
      contractions: [],
    });
  });
});

describe("record id generation without crypto.randomUUID", () => {
  it("falls back to a time+counter id when the platform lacks randomUUID", () => {
    const cryptoObject = globalThis.crypto as { randomUUID?: () => string };
    Object.defineProperty(cryptoObject, "randomUUID", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      const record = createPregnancyRecord({
        edd: "2026-10-08",
        eddBasis: "lmp",
        lmpDate: "2026-01-01",
        startedAt: "2026-01-05",
      });
      expect(record.id).toMatch(/^pregnancy_[0-9a-z]+_[0-9a-z]+$/);
    } finally {
      delete (cryptoObject as Record<string, unknown>).randomUUID;
    }
  });
});

describe("sanitizeContractionSession invalid inputs", () => {
  it("returns null for a non-object value", () => {
    expect(sanitizeContractionSession(42)).toBeNull();
  });

  it("returns null when the completion date is not a local ISO date", () => {
    expect(
      sanitizeContractionSession({
        id: "contraction_1",
        date: "not-a-date",
        startedAt: "2026-08-10T14:30:00.000Z",
        contractions: [],
      }),
    ).toBeNull();
  });

  it("drops non-object contraction entries while keeping the session", () => {
    const session = sanitizeContractionSession({
      id: "contraction_1",
      date: "2026-08-10",
      startedAt: "2026-08-10T14:30:00.000Z",
      contractions: [42, "bogus"],
    });
    expect(session).not.toBeNull();
    expect(session?.contractions).toEqual([]);
  });
});
