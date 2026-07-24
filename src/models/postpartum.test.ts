import {
  CORE_RECOVERY_WEEKS_MAX,
  EARLY_WEEKS_MAX,
  createPostpartumRecord,
  hasActivePostpartum,
  sanitizePostpartumRecord,
  type PostpartumRecord,
} from "./postpartum";

describe("createPostpartumRecord", () => {
  it("creates an active record with the birth date and null end fields", () => {
    const record = createPostpartumRecord({
      startedAt: "2026-06-01",
      modeOfDelivery: "cesarean",
    });

    expect(record.status).toBe("active");
    expect(record.startedAt).toBe("2026-06-01");
    expect(record.modeOfDelivery).toBe("cesarean");
    expect(record.endedAt).toBeNull();
    expect(record.endReason).toBeNull();
    expect(record.id.startsWith("postpartum_")).toBe(true);
  });

  it("defaults modeOfDelivery to null when omitted", () => {
    const record = createPostpartumRecord({ startedAt: "2026-06-01" });
    expect(record.modeOfDelivery).toBeNull();
  });

  it("gives each record a distinct id", () => {
    const a = createPostpartumRecord({ startedAt: "2026-06-01" });
    const b = createPostpartumRecord({ startedAt: "2026-06-01" });
    expect(a.id).not.toBe(b.id);
  });
});

describe("hasActivePostpartum", () => {
  it("is true only when a record has status active", () => {
    const active = createPostpartumRecord({ startedAt: "2026-06-01" });
    const ended: PostpartumRecord = {
      ...active,
      id: "postpartum_ended",
      status: "ended",
      endedAt: "2026-06-20",
      endReason: "manual",
    };

    expect(hasActivePostpartum([])).toBe(false);
    expect(hasActivePostpartum([ended])).toBe(false);
    expect(hasActivePostpartum([ended, active])).toBe(true);
  });
});

describe("recovery-phase constants", () => {
  it("anchor the early/core boundaries at 2 and 6 weeks", () => {
    expect(EARLY_WEEKS_MAX).toBe(2);
    expect(CORE_RECOVERY_WEEKS_MAX).toBe(6);
  });
});

describe("sanitizePostpartumRecord", () => {
  function validRecord(): PostpartumRecord {
    return {
      id: "postpartum_1",
      status: "active",
      startedAt: "2026-06-01",
      modeOfDelivery: "vaginal",
      endedAt: null,
      endReason: null,
    };
  }

  it("round-trips a fully valid record unchanged", () => {
    const record = validRecord();
    expect(sanitizePostpartumRecord(record)).toEqual(record);
  });

  it("round-trips a valid ended record with an end reason", () => {
    const record: PostpartumRecord = {
      ...validRecord(),
      status: "ended",
      endedAt: "2026-07-15",
      endReason: "cycle_returned",
    };
    expect(sanitizePostpartumRecord(record)).toEqual(record);
  });

  it.each([null, undefined, 42, "x", []])(
    "rejects a non-object payload (%p)",
    (value) => {
      expect(sanitizePostpartumRecord(value)).toBeNull();
    },
  );

  it("rejects a record with a blank id", () => {
    expect(sanitizePostpartumRecord({ ...validRecord(), id: "   " })).toBeNull();
  });

  it("rejects a record with an unknown status", () => {
    expect(
      sanitizePostpartumRecord({ ...validRecord(), status: "paused" }),
    ).toBeNull();
  });

  it("rejects a record whose startedAt is not a valid calendar date", () => {
    expect(
      sanitizePostpartumRecord({ ...validRecord(), startedAt: "2026-02-30" }),
    ).toBeNull();
    expect(
      sanitizePostpartumRecord({ ...validRecord(), startedAt: "not-a-date" }),
    ).toBeNull();
  });

  it("falls back to null for an invalid modeOfDelivery / endedAt / endReason", () => {
    const sanitized = sanitizePostpartumRecord({
      ...validRecord(),
      modeOfDelivery: "twins",
      endedAt: "2026-13-40",
      endReason: "loss",
    });
    expect(sanitized).not.toBeNull();
    expect(sanitized?.modeOfDelivery).toBeNull();
    expect(sanitized?.endedAt).toBeNull();
    expect(sanitized?.endReason).toBeNull();
  });

  it("trims a padded id", () => {
    const sanitized = sanitizePostpartumRecord({
      ...validRecord(),
      id: "  postpartum_pad  ",
    });
    expect(sanitized?.id).toBe("postpartum_pad");
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
      const record = createPostpartumRecord({ startedAt: "2026-06-01" });
      expect(record.id).toMatch(/^postpartum_[0-9a-z]+_[0-9a-z]+$/);
    } finally {
      delete (cryptoObject as Record<string, unknown>).randomUUID;
    }
  });
});
