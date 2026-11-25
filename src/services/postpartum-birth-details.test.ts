import type { PostpartumRecord } from "../models/postpartum";
import type { PregnancyRecord } from "../models/pregnancy";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { updatePostpartumBirthDetails } from "./postpartum-mode-service";
import { validatePregnancyEndDate } from "./pregnancy-mode-service";

const NOW = new Date(2026, 5, 10, 12, 0, 0); // 2026-06-10 local.

function endedBirth(overrides: Partial<PregnancyRecord> = {}): PregnancyRecord {
  return {
    id: "pregnancy_birth",
    status: "ended",
    edd: "2026-06-05",
    eddBasis: "ultrasound",
    lmpDate: null,
    schedulePreset: "who2016",
    startedAt: "2025-09-01",
    endedAt: "2026-06-01",
    endReason: "birth",
    modeOfDelivery: "cesarean",
    ...overrides,
  };
}

function activePostpartum(
  overrides: Partial<PostpartumRecord> = {},
): PostpartumRecord {
  return {
    id: "postpartum_1",
    status: "active",
    startedAt: "2026-06-01",
    modeOfDelivery: "cesarean",
    endedAt: null,
    endReason: null,
    ...overrides,
  };
}

describe("validatePregnancyEndDate", () => {
  const pregnancy = { edd: "2026-10-17", lmpDate: "2026-01-10" };

  it.each([
    ["", "missing_date"],
    ["   ", "missing_date"],
    ["not a date", "invalid_date"],
    ["2026-02-30", "invalid_date"],
    ["2026-06-11", "future"],
    ["2026-01-09", "before_start"],
  ])("rejects %j as %s", (value, expected) => {
    expect(validatePregnancyEndDate(value, pregnancy, NOW)).toBe(expected);
  });

  it("accepts today, the start day and a date between, ignoring padding", () => {
    expect(validatePregnancyEndDate("2026-06-10", pregnancy, NOW)).toBeNull();
    expect(validatePregnancyEndDate("2026-01-10", pregnancy, NOW)).toBeNull();
    expect(validatePregnancyEndDate(" 2026-05-01 ", pregnancy, NOW)).toBeNull();
  });

  it("skips the lower bound when there is no pregnancy record", () => {
    expect(validatePregnancyEndDate("1999-01-01", null, NOW)).toBeNull();
  });

  it("bounds by EDD minus 280 days when no LMP is recorded", () => {
    const scanDated = { edd: "2026-06-05", lmpDate: null };
    expect(validatePregnancyEndDate("2025-08-28", scanDated, NOW)).toBe(
      "before_start",
    );
    expect(validatePregnancyEndDate("2025-08-29", scanDated, NOW)).toBeNull();
  });

  it("skips the lower bound when neither LMP nor EDD parses", () => {
    expect(
      validatePregnancyEndDate("1999-01-01", { edd: "junk", lmpDate: null }, NOW),
    ).toBeNull();
  });
});

describe("updatePostpartumBirthDetails", () => {
  function setup(options: {
    source?: PregnancyRecord | null;
    postpartum?: PostpartumRecord | null;
  } = {}) {
    const source = options.source === undefined ? endedBirth() : options.source;
    const postpartum =
      options.postpartum === undefined ? activePostpartum() : options.postpartum;
    const order: string[] = [];
    const storage = createLocalAppStorageMock({
      readActivePostpartum: jest.fn().mockResolvedValue(postpartum),
      listPregnancyRecords: jest.fn().mockResolvedValue(source ? [source] : []),
      writePregnancyRecord: jest.fn(async () => {
        order.push("pregnancy");
      }),
      writePostpartumRecord: jest.fn(async () => {
        order.push("postpartum");
      }),
    });
    return { storage, order };
  }

  it("updates the postpartum record and its source pregnancy, pregnancy first", async () => {
    const { storage, order } = setup();

    const result = await updatePostpartumBirthDetails(
      storage,
      { startedAt: " 2026-05-28 ", modeOfDelivery: "vaginal" },
      NOW,
    );

    expect(result.ok).toBe(true);
    expect(order).toEqual(["pregnancy", "postpartum"]);
    expect(storage.writePostpartumRecord).toHaveBeenCalledWith(
      activePostpartum({ startedAt: "2026-05-28", modeOfDelivery: "vaginal" }),
    );
    expect(storage.writePregnancyRecord).toHaveBeenCalledWith(
      endedBirth({ endedAt: "2026-05-28", modeOfDelivery: "vaginal" }),
    );
  });

  it("stores a cleared delivery mode as null on both records", async () => {
    const { storage } = setup();

    await updatePostpartumBirthDetails(
      storage,
      { startedAt: "2026-06-01", modeOfDelivery: null },
      NOW,
    );

    expect(storage.writePostpartumRecord).toHaveBeenCalledWith(
      expect.objectContaining({ modeOfDelivery: null }),
    );
    expect(storage.writePregnancyRecord).toHaveBeenCalledWith(
      expect.objectContaining({ modeOfDelivery: null }),
    );
  });

  it("edits only the postpartum record when no source pregnancy matches", async () => {
    const { storage } = setup({
      source: endedBirth({ endedAt: "2026-03-03" }),
    });

    const result = await updatePostpartumBirthDetails(
      storage,
      { startedAt: "2020-01-01", modeOfDelivery: "vaginal" },
      NOW,
    );

    expect(result.ok).toBe(true);
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
    expect(storage.writePostpartumRecord).toHaveBeenCalledTimes(1);
  });

  it("ignores a loss pregnancy ended on the same day", async () => {
    const { storage } = setup({ source: endedBirth({ endReason: "loss" }) });

    await updatePostpartumBirthDetails(
      storage,
      { startedAt: "2026-05-30", modeOfDelivery: null },
      NOW,
    );

    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
  });

  it.each([
    ["", "missing_date"],
    ["junk", "invalid_date"],
    ["2026-06-11", "future"],
    ["2025-08-28", "before_start"],
  ])("rejects %j as %s without writing", async (startedAt, errorCode) => {
    const { storage } = setup();

    const result = await updatePostpartumBirthDetails(
      storage,
      { startedAt, modeOfDelivery: "vaginal" },
      NOW,
    );

    expect(result).toEqual({ ok: false, errorCode });
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
    expect(storage.writePostpartumRecord).not.toHaveBeenCalled();
  });

  it("rejects when there is no active postpartum", async () => {
    const { storage } = setup({ postpartum: null });

    const result = await updatePostpartumBirthDetails(
      storage,
      { startedAt: "2026-06-01", modeOfDelivery: null },
      NOW,
    );

    expect(result).toEqual({ ok: false, errorCode: "no_active_postpartum" });
    expect(storage.writePostpartumRecord).not.toHaveBeenCalled();
  });

  it("reports save_failed when the pregnancy write fails and writes nothing else", async () => {
    const { storage } = setup();
    (storage.writePregnancyRecord as jest.Mock).mockRejectedValue(new Error("io"));

    const result = await updatePostpartumBirthDetails(
      storage,
      { startedAt: "2026-05-28", modeOfDelivery: "vaginal" },
      NOW,
    );

    expect(result).toEqual({ ok: false, errorCode: "save_failed" });
    expect(storage.writePostpartumRecord).not.toHaveBeenCalled();
    expect(storage.writePregnancyRecord).toHaveBeenCalledTimes(1);
  });

  it("restores the source pregnancy when the postpartum write fails", async () => {
    const { storage } = setup();
    (storage.writePostpartumRecord as jest.Mock).mockRejectedValue(
      new Error("io"),
    );

    const result = await updatePostpartumBirthDetails(
      storage,
      { startedAt: "2026-05-28", modeOfDelivery: "vaginal" },
      NOW,
    );

    expect(result).toEqual({ ok: false, errorCode: "save_failed" });
    expect(storage.writePregnancyRecord).toHaveBeenCalledTimes(2);
    expect(storage.writePregnancyRecord).toHaveBeenLastCalledWith(endedBirth());
  });

  it("still reports save_failed when the restore write also fails", async () => {
    const { storage } = setup();
    (storage.writePostpartumRecord as jest.Mock).mockRejectedValue(
      new Error("io"),
    );
    (storage.writePregnancyRecord as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("io"));

    const result = await updatePostpartumBirthDetails(
      storage,
      { startedAt: "2026-05-28", modeOfDelivery: "vaginal" },
      NOW,
    );

    expect(result).toEqual({ ok: false, errorCode: "save_failed" });
  });

  it("reports save_failed without a restore when no source exists and the write fails", async () => {
    const { storage } = setup({ source: null });
    (storage.writePostpartumRecord as jest.Mock).mockRejectedValue(
      new Error("io"),
    );

    const result = await updatePostpartumBirthDetails(
      storage,
      { startedAt: "2026-05-28", modeOfDelivery: "vaginal" },
      NOW,
    );

    expect(result).toEqual({ ok: false, errorCode: "save_failed" });
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
  });
});
