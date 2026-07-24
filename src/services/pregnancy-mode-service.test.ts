import { getBabyWeekCopy } from "../i18n/baby-week-copy";
import { getPregnancyCopy } from "../i18n/pregnancy-copy";
import { createDefaultProfileRecord } from "../models/profile";
import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createPregnancyRecord, type Chorionicity, type FetusCount } from "../models/pregnancy";
import { createVolatileWebAppStorage } from "../storage/local/volatile-web-app-storage";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import {
  buildPregnancyDashboardViewData,
  buildPregnancyStaleCardViewData,
  buildPregnancyStartDefaults,
  buildPregnancyStartPreview,
  deleteAllPregnancyData,
  endPregnancy,
  startPregnancy,
  updateEddForActivePregnancy,
  formatDisplayDate,
} from "./pregnancy-mode-service";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";

const LMP = "2026-01-01";
const EDD = "2026-10-08"; // LMP + 280 days (Naegele).

// today (LocalDateISO) that makes calcGestationalAge(EDD, today) report gaDays.
function todayForGaDays(gaDays: number): string {
  return formatLocalDate(addDays(parseLocalDate(EDD)!, gaDays - 280));
}

// Date form of the same, for `now`-taking helpers.
function nowForGaDays(gaDays: number): Date {
  return addDays(parseLocalDate(EDD)!, gaDays - 280);
}

function activeRecord(edd = EDD) {
  return createPregnancyRecord({
    edd,
    eddBasis: "lmp",
    lmpDate: LMP,
    startedAt: "2026-03-01",
  });
}

// Multiples variant of activeRecord, for the multiplesCard view-data
// matrix -- kept separate so every existing activeRecord() call site is
// unaffected.
function multiplesRecord(overrides: {
  fetusCount?: FetusCount;
  chorionicity?: Chorionicity;
} = {}) {
  return createPregnancyRecord({
    edd: EDD,
    eddBasis: "lmp",
    lmpDate: LMP,
    startedAt: "2026-03-01",
    ...overrides,
  });
}

describe("startPregnancy", () => {
  it("creates an active record from an LMP basis (Naegele EDD)", async () => {
    const storage = createLocalAppStorageMock();
    const result = await startPregnancy(
      storage,
      { eddBasis: "lmp", lmpDate: LMP },
      nowForGaDays(59),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.record).toEqual(
      expect.objectContaining({
        status: "active",
        edd: EDD,
        eddBasis: "lmp",
        lmpDate: LMP,
        schedulePreset: "who2016",
      }),
    );
    expect(storage.writePregnancyRecord).toHaveBeenCalledWith(result.record);
  });

  it("creates an active record from a manual EDD with no stored LMP", async () => {
    const storage = createLocalAppStorageMock();
    const result = await startPregnancy(
      storage,
      { eddBasis: "manual", edd: EDD },
      nowForGaDays(120),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.record.edd).toBe(EDD);
    expect(result.record.eddBasis).toBe("manual");
    expect(result.record.lmpDate).toBeNull();
  });

  it("rejects when an active pregnancy already exists", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });
    const result = await startPregnancy(
      storage,
      { eddBasis: "lmp", lmpDate: LMP },
      nowForGaDays(59),
    );

    expect(result).toEqual({ ok: false, errorCode: "active_pregnancy_exists" });
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
  });

  it("rejects a missing basis date", async () => {
    const storage = createLocalAppStorageMock();
    const result = await startPregnancy(storage, { eddBasis: "lmp" });
    expect(result).toEqual({ ok: false, errorCode: "missing_date" });
  });

  it("rejects an unparseable date", async () => {
    const storage = createLocalAppStorageMock();
    const result = await startPregnancy(storage, {
      eddBasis: "manual",
      edd: "not-a-date",
    });
    expect(result).toEqual({ ok: false, errorCode: "invalid_date" });
  });

  it("rejects a future-dated EDD outside the trackable window", async () => {
    const storage = createLocalAppStorageMock();
    const result = await startPregnancy(
      storage,
      { eddBasis: "manual", edd: "2028-01-01" },
      new Date(2026, 2, 1),
    );
    expect(result).toEqual({ ok: false, errorCode: "out_of_range" });
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
  });

  it("surfaces a storage rejection as save_failed", async () => {
    const storage = createLocalAppStorageMock({
      writePregnancyRecord: jest.fn().mockRejectedValue(new Error("busy")),
    });
    const result = await startPregnancy(
      storage,
      { eddBasis: "lmp", lmpDate: LMP },
      nowForGaDays(59),
    );
    expect(result).toEqual({ ok: false, errorCode: "save_failed" });
  });

  describe("multiples", () => {
    it("creates a singleton record (no fetusCount/chorionicity) when the fields are omitted, exactly like today", async () => {
      const storage = createLocalAppStorageMock();
      const result = await startPregnancy(
        storage,
        { eddBasis: "lmp", lmpDate: LMP },
        nowForGaDays(59),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.record.fetusCount).toBeUndefined();
      expect(result.record.chorionicity).toBeUndefined();
      expect(
        Object.prototype.hasOwnProperty.call(result.record, "fetusCount"),
      ).toBe(false);
      expect(
        Object.prototype.hasOwnProperty.call(result.record, "chorionicity"),
      ).toBe(false);
    });

    it("passes fetusCount and chorionicity through onto the created record", async () => {
      const storage = createLocalAppStorageMock();
      const result = await startPregnancy(
        storage,
        { eddBasis: "lmp", lmpDate: LMP, fetusCount: 2, chorionicity: "mcda" },
        nowForGaDays(59),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.record.fetusCount).toBe(2);
      expect(result.record.chorionicity).toBe("mcda");
      expect(storage.writePregnancyRecord).toHaveBeenCalledWith(
        expect.objectContaining({ fetusCount: 2, chorionicity: "mcda" }),
      );
    });

    it("passes fetusCount 3 ('three or more') without a chorionicity choice", async () => {
      const storage = createLocalAppStorageMock();
      const result = await startPregnancy(
        storage,
        { eddBasis: "lmp", lmpDate: LMP, fetusCount: 3 },
        nowForGaDays(59),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.record.fetusCount).toBe(3);
      expect(result.record.chorionicity).toBeUndefined();
    });
  });
});

describe("endPregnancy", () => {
  it("ends an active pregnancy as a birth with a mode of delivery", async () => {
    const active = activeRecord();
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(active),
    });
    const result = await endPregnancy(
      storage,
      { reason: "birth", modeOfDelivery: "cesarean" },
      new Date(2026, 5, 15),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.record).toEqual(
      expect.objectContaining({
        status: "ended",
        endReason: "birth",
        modeOfDelivery: "cesarean",
        endedAt: "2026-06-15",
      }),
    );
    // The ended write reuses the same repo; the id/edd carry over untouched.
    expect(result.record.id).toBe(active.id);
    expect(result.record.edd).toBe(EDD);
    expect(storage.writePregnancyRecord).toHaveBeenCalledWith(result.record);
  });

  it("ends a birth with a skipped mode of delivery as null", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });
    const result = await endPregnancy(
      storage,
      { reason: "birth" },
      new Date(2026, 5, 15),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.record.endReason).toBe("birth");
    expect(result.record.modeOfDelivery).toBeNull();
  });

  it("ends a loss and forces mode of delivery to null even if one is passed", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });
    const result = await endPregnancy(
      storage,
      { reason: "loss", modeOfDelivery: "vaginal" },
      new Date(2026, 5, 15),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.record.endReason).toBe("loss");
    expect(result.record.modeOfDelivery).toBeNull();
  });

  it("ends for the 'other' reason with no mode of delivery", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });
    const result = await endPregnancy(
      storage,
      { reason: "other" },
      new Date(2026, 5, 15),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.record.endReason).toBe("other");
    expect(result.record.modeOfDelivery).toBeNull();
  });

  it("defaults endedAt to today when not provided", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });
    const result = await endPregnancy(
      storage,
      { reason: "birth" },
      new Date(2026, 6, 4),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.record.endedAt).toBe("2026-07-04");
  });

  it("rejects when there is no active pregnancy", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(null),
    });
    const result = await endPregnancy(storage, { reason: "birth" });

    expect(result).toEqual({ ok: false, errorCode: "no_active_pregnancy" });
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
  });

  it("surfaces a storage rejection as save_failed", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      writePregnancyRecord: jest.fn().mockRejectedValue(new Error("busy")),
    });
    const result = await endPregnancy(storage, { reason: "loss" });

    expect(result).toEqual({ ok: false, errorCode: "save_failed" });
  });

  it("persists the ended record and lets a new pregnancy start afterward", async () => {
    const storage = createVolatileWebAppStorage();
    const started = await startPregnancy(
      storage,
      { eddBasis: "lmp", lmpDate: LMP },
      nowForGaDays(59),
    );
    expect(started.ok).toBe(true);

    const ended = await endPregnancy(
      storage,
      { reason: "birth", modeOfDelivery: "vaginal" },
      new Date(2026, 5, 15),
    );
    expect(ended.ok).toBe(true);

    // The active pregnancy is gone; the ended record is retained.
    await expect(storage.readActivePregnancy()).resolves.toBeNull();
    const records = await storage.listPregnancyRecords();
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(
      expect.objectContaining({
        status: "ended",
        endReason: "birth",
        modeOfDelivery: "vaginal",
      }),
    );

    // A brand new pregnancy can be started again after the previous one ended.
    const restarted = await startPregnancy(
      storage,
      { eddBasis: "manual", edd: EDD },
      nowForGaDays(120),
    );
    expect(restarted.ok).toBe(true);
    await expect(storage.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({ status: "active" }),
    );
  });
});

describe("updateEddForActivePregnancy", () => {
  it("updates the edd and basis to ultrasound, leaving id/startedAt/lmpDate/status untouched", async () => {
    const active = activeRecord(); // lmp-based originally
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(active),
    });
    const newEdd = todayForGaDays(100);
    const result = await updateEddForActivePregnancy(
      storage,
      { eddBasis: "ultrasound", edd: newEdd },
      nowForGaDays(100),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.record.edd).toBe(newEdd);
    expect(result.record.eddBasis).toBe("ultrasound");
    expect(result.record.id).toBe(active.id);
    expect(result.record.startedAt).toBe(active.startedAt);
    expect(result.record.lmpDate).toBe(active.lmpDate);
    expect(result.record.status).toBe(active.status);
    expect(storage.writePregnancyRecord).toHaveBeenCalledWith(result.record);
  });

  it("updates the edd and basis to manual", async () => {
    const active = activeRecord();
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(active),
    });
    const newEdd = todayForGaDays(59);
    const result = await updateEddForActivePregnancy(
      storage,
      { eddBasis: "manual", edd: newEdd },
      nowForGaDays(59),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.record.edd).toBe(newEdd);
    expect(result.record.eddBasis).toBe("manual");
    // lmpDate is preserved even though the basis is no longer "lmp" -- this
    // update never fabricates or clears a field it wasn't asked to change.
    expect(result.record.lmpDate).toBe(active.lmpDate);
  });

  it("rejects when there is no active pregnancy", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(null),
    });
    const result = await updateEddForActivePregnancy(storage, {
      eddBasis: "manual",
      edd: EDD,
    });

    expect(result).toEqual({ ok: false, errorCode: "no_active_pregnancy" });
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
  });

  it("rejects a missing date", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });
    const result = await updateEddForActivePregnancy(storage, {
      eddBasis: "manual",
      edd: "",
    });

    expect(result).toEqual({ ok: false, errorCode: "missing_date" });
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
  });

  it("rejects an unparseable date", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });
    const result = await updateEddForActivePregnancy(storage, {
      eddBasis: "ultrasound",
      edd: "not-a-date",
    });

    expect(result).toEqual({ ok: false, errorCode: "invalid_date" });
  });

  it("rejects an edd outside the trackable window (same sane-GA window as startPregnancy)", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });
    const result = await updateEddForActivePregnancy(
      storage,
      { eddBasis: "manual", edd: "2028-01-01" },
      new Date(2026, 2, 1),
    );

    expect(result).toEqual({ ok: false, errorCode: "out_of_range" });
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
  });

  it("surfaces a storage rejection as save_failed", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      writePregnancyRecord: jest.fn().mockRejectedValue(new Error("busy")),
    });
    const result = await updateEddForActivePregnancy(
      storage,
      { eddBasis: "manual", edd: EDD },
      nowForGaDays(59),
    );

    expect(result).toEqual({ ok: false, errorCode: "save_failed" });
  });

  it("persists through a real storage roundtrip and the updated record feeds the dashboard's W+D hero", async () => {
    const storage = createVolatileWebAppStorage();
    await startPregnancy(
      storage,
      { eddBasis: "lmp", lmpDate: LMP },
      nowForGaDays(59),
    );

    const newEdd = "2026-11-05";
    const now = new Date(2026, 5, 15); // well within the new edd's trackable window
    const result = await updateEddForActivePregnancy(
      storage,
      { eddBasis: "ultrasound", edd: newEdd },
      now,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    await expect(storage.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({ edd: newEdd, eddBasis: "ultrasound" }),
    );

    const viewData = buildPregnancyDashboardViewData(
      result.record,
      formatLocalDate(now),
      "en",
    );
    expect(viewData).not.toBeNull();
    expect(viewData?.hero.edd).toBe(newEdd);
    // Ground truth: 2026-06-15 -> 2026-11-05 is 143 days away, so
    // gaDays = 280 - 143 = 137 = 19 weeks + 4 days.
    expect(viewData?.hero.weeks).toBe(19);
    expect(viewData?.hero.days).toBe(4);
  });
});

describe("deleteAllPregnancyData", () => {
  it("delegates to the storage method and reports success", async () => {
    const storage = createLocalAppStorageMock();
    const result = await deleteAllPregnancyData(storage);

    expect(result).toEqual({ ok: true });
    expect(storage.deleteAllPregnancyData).toHaveBeenCalledTimes(1);
  });

  it("clears records, kick sessions, and contraction sessions end-to-end", async () => {
    const storage = createVolatileWebAppStorage();
    await startPregnancy(
      storage,
      { eddBasis: "lmp", lmpDate: LMP },
      nowForGaDays(59),
    );
    await storage.writeKickSession({
      id: "kick_1",
      date: "2026-06-01",
      durationMinutes: 30,
      kickCount: 10,
    });
    await storage.writeContractionSession({
      id: "contraction_1",
      date: "2026-06-01",
      startedAt: "2026-06-01T10:00:00.000Z",
      contractions: [
        { startedAt: "2026-06-01T10:00:00.000Z", durationSeconds: 40 },
      ],
    });

    const result = await deleteAllPregnancyData(storage);

    expect(result).toEqual({ ok: true });
    await expect(storage.readActivePregnancy()).resolves.toBeNull();
    await expect(storage.listPregnancyRecords()).resolves.toEqual([]);
    await expect(storage.listKickSessions()).resolves.toEqual([]);
    await expect(storage.listContractionSessions()).resolves.toEqual([]);
  });

  it("returns a generic error when the storage delete throws", async () => {
    const storage = createLocalAppStorageMock({
      deleteAllPregnancyData: jest.fn().mockRejectedValue(new Error("io")),
    });
    const result = await deleteAllPregnancyData(storage);

    expect(result).toEqual({ ok: false, errorCode: "generic" });
  });
});

describe("buildPregnancyStartDefaults", () => {
  it("prefills LMP and its Naegele EDD from the profile", () => {
    const profile = { ...createDefaultProfileRecord(), lastPeriodStart: LMP };
    expect(buildPregnancyStartDefaults(profile)).toEqual({
      defaultLmp: LMP,
      defaultEdd: EDD,
    });
  });

  it("returns nulls when the profile has no last period start", () => {
    const profile = { ...createDefaultProfileRecord(), lastPeriodStart: null };
    expect(buildPregnancyStartDefaults(profile)).toEqual({
      defaultLmp: null,
      defaultEdd: null,
    });
  });
});

describe("buildPregnancyStartPreview", () => {
  it("computes the EDD and current W+D for a valid LMP", () => {
    const preview = buildPregnancyStartPreview(
      { eddBasis: "lmp", lmpDate: LMP },
      nowForGaDays(171),
      "en",
    );
    expect(preview.edd).toBe(EDD);
    expect(preview.weeks).toBe(24);
    expect(preview.days).toBe(3);
    expect(preview.gaLabel).toBe("24+3");
  });

  it("returns nulls for a missing date", () => {
    const preview = buildPregnancyStartPreview(
      { eddBasis: "lmp", lmpDate: "" },
      new Date(2026, 2, 1),
      "en",
    );
    expect(preview).toEqual({
      edd: null,
      eddLabel: null,
      weeks: null,
      days: null,
      gaLabel: null,
    });
  });

  it("resolves the EDD but leaves W+D null when out of range", () => {
    const preview = buildPregnancyStartPreview(
      { eddBasis: "manual", edd: "2028-01-01" },
      new Date(2026, 2, 1),
      "en",
    );
    expect(preview.edd).toBe("2028-01-01");
    expect(preview.eddLabel).not.toBeNull();
    expect(preview.weeks).toBeNull();
    expect(preview.gaLabel).toBeNull();
  });
});

describe("buildPregnancyDashboardViewData", () => {
  it("renders the W+D hero, trimester, and in-window milestones", () => {
    const viewData = buildPregnancyDashboardViewData(
      activeRecord(),
      todayForGaDays(171),
      "en",
    );
    expect(viewData).not.toBeNull();
    if (!viewData) {
      return;
    }
    expect(viewData.hero.weekValueLabel).toBe("24+3");
    expect(viewData.hero.weeks).toBe(24);
    expect(viewData.hero.trimester).toBe(2);
    expect(viewData.hero.trimesterLabel).toBe("Second trimester");
    expect(viewData.hero.edd).toBe(EDD);
    expect(viewData.hero.daysRemaining).toBe(280 - 171);
    expect(viewData.disclaimer).toContain("estimates");

    const ids = viewData.milestones.items.map((item) => item.id);
    // nipt's window now closes at week 22 (CHANGE 4) -- week 24 is past it.
    expect(ids).not.toContain("nipt");
    expect(ids).toContain("gdm_screen");
    expect(ids).not.toContain("anatomy_scan");
  });

  it("hides the kick teaser before week 28 and shows it from week 28", () => {
    const before = buildPregnancyDashboardViewData(
      activeRecord(),
      todayForGaDays(27 * 7),
      "en",
    );
    const atStart = buildPregnancyDashboardViewData(
      activeRecord(),
      todayForGaDays(28 * 7),
      "en",
    );
    expect(before?.kickTeaser.visible).toBe(false);
    expect(atStart?.kickTeaser.visible).toBe(true);
    expect(atStart?.milestones.items.map((item) => item.id)).toContain(
      "kick_counts_start",
    );
  });

  it("shows the birth CTA only from week 37 (term) and always exposes the manage link", () => {
    // Exact boundary: 36+6 (last pre-term day) hides the CTA, 37+0 shows it.
    const week36 = buildPregnancyDashboardViewData(
      activeRecord(),
      todayForGaDays(36 * 7 + 6),
      "en",
    );
    const week37 = buildPregnancyDashboardViewData(
      activeRecord(),
      todayForGaDays(37 * 7),
      "en",
    );

    expect(week36?.birthCta.visible).toBe(false);
    expect(week37?.birthCta.visible).toBe(true);
    expect(week37?.birthCta.label).toBe("I gave birth");
    // The manage link is present at every gestational age (it is the birth
    // path for preterm births, before the term CTA appears).
    expect(week36?.manageCta.label).toBe("Manage pregnancy tracking");
    expect(week37?.manageCta.label).toBe("Manage pregnancy tracking");
  });

  it("always shows the contraction-timer card, prominent only in the third trimester", () => {
    const trimester1 = buildPregnancyDashboardViewData(
      activeRecord(),
      todayForGaDays(59),
      "en",
    );
    const trimester2 = buildPregnancyDashboardViewData(
      activeRecord(),
      todayForGaDays(171),
      "en",
    );
    // Exact boundary: 27+6 (last trimester-II day) is subdued, 28+0 (first
    // trimester-III day) is prominent -- matches resolveTrimester's own
    // TRIMESTER_2_MAX_WEEK boundary in pregnancy-timeline-service.ts.
    const lastTrimester2Day = buildPregnancyDashboardViewData(
      activeRecord(),
      todayForGaDays(27 * 7 + 6),
      "en",
    );
    const firstTrimester3Day = buildPregnancyDashboardViewData(
      activeRecord(),
      todayForGaDays(28 * 7),
      "en",
    );

    for (const viewData of [trimester1, trimester2, lastTrimester2Day, firstTrimester3Day]) {
      expect(viewData?.contractionTimer.visible).toBe(true);
      expect(viewData?.contractionTimer.title.length).toBeGreaterThan(0);
      expect(viewData?.contractionTimer.body.length).toBeGreaterThan(0);
    }
    expect(trimester1?.contractionTimer.prominent).toBe(false);
    expect(trimester2?.contractionTimer.prominent).toBe(false);
    expect(lastTrimester2Day?.contractionTimer.prominent).toBe(false);
    expect(firstTrimester3Day?.contractionTimer.prominent).toBe(true);
  });

  it("surfaces today's weight and blood pressure when logged", () => {
    const todayLog: DayLogRecord = {
      ...createEmptyDayLogRecord(todayForGaDays(196)),
      weightKg: 68,
      bpSystolic: 120,
      bpDiastolic: 80,
    };
    const viewData = buildPregnancyDashboardViewData(
      activeRecord(),
      todayForGaDays(196),
      "en",
      todayLog,
    );
    expect(viewData?.todayMetrics.hasAny).toBe(true);
    expect(viewData?.todayMetrics.weight?.value).toBe("68 kg");
    expect(viewData?.todayMetrics.bloodPressure?.value).toBe("120/80 mmHg");
  });

  it("reports no measurements when today's log is absent", () => {
    const viewData = buildPregnancyDashboardViewData(
      activeRecord(),
      todayForGaDays(196),
      "en",
    );
    expect(viewData?.todayMetrics.hasAny).toBe(false);
    expect(viewData?.todayMetrics.weight).toBeNull();
    expect(viewData?.todayMetrics.bloodPressure).toBeNull();
  });

  it("returns null when the record is outside the trackable window", () => {
    const viewData = buildPregnancyDashboardViewData(
      activeRecord(),
      formatLocalDate(addDays(parseLocalDate(EDD)!, 40)),
      "en",
    );
    expect(viewData).toBeNull();
  });

  it("includes the birth_prep milestone at week 38(within its 36-42 window)", () => {
    const viewData = buildPregnancyDashboardViewData(
      activeRecord(),
      todayForGaDays(38 * 7),
      "en",
    );
    const ids = viewData?.milestones.items.map((item) => item.id);
    expect(ids).toContain("birth_prep");
    const item = viewData?.milestones.items.find((entry) => entry.id === "birth_prep");
    expect(item?.title.length).toBeGreaterThan(0);
    expect(item?.body.length).toBeGreaterThan(0);
  });

  describe("multiplesCard", () => {
    it("is hidden for a singleton record (no fetusCount)", () => {
      const viewData = buildPregnancyDashboardViewData(
        multiplesRecord(),
        todayForGaDays(171),
        "en",
      );
      expect(viewData?.multiplesCard.visible).toBe(false);
    });

    it("is hidden for an explicit fetusCount of 1", () => {
      const viewData = buildPregnancyDashboardViewData(
        multiplesRecord({ fetusCount: 1 }),
        todayForGaDays(171),
        "en",
      );
      expect(viewData?.multiplesCard.visible).toBe(false);
    });

    it("shows the base card (no monochorionic line) for twins with dcda chorionicity", () => {
      const viewData = buildPregnancyDashboardViewData(
        multiplesRecord({ fetusCount: 2, chorionicity: "dcda" }),
        todayForGaDays(171),
        "en",
      );
      expect(viewData?.multiplesCard.visible).toBe(true);
      expect(viewData?.multiplesCard.title.length).toBeGreaterThan(0);
      expect(viewData?.multiplesCard.body).not.toContain("every 2 weeks");
    });

    it("shows the base card with no extra line for twins with unknown chorionicity", () => {
      const viewData = buildPregnancyDashboardViewData(
        multiplesRecord({ fetusCount: 2, chorionicity: "unknown" }),
        todayForGaDays(171),
        "en",
      );
      expect(viewData?.multiplesCard.visible).toBe(true);
      expect(viewData?.multiplesCard.body).not.toContain("every 2 weeks");
    });

    it("shows the base card with no extra line for twins with no chorionicity chosen", () => {
      const viewData = buildPregnancyDashboardViewData(
        multiplesRecord({ fetusCount: 2 }),
        todayForGaDays(171),
        "en",
      );
      expect(viewData?.multiplesCard.visible).toBe(true);
      expect(viewData?.multiplesCard.body).not.toContain("every 2 weeks");
    });

    it("appends the monochorionic extra line for twins with mcda chorionicity", () => {
      const viewData = buildPregnancyDashboardViewData(
        multiplesRecord({ fetusCount: 2, chorionicity: "mcda" }),
        todayForGaDays(171),
        "en",
      );
      expect(viewData?.multiplesCard.visible).toBe(true);
      expect(viewData?.multiplesCard.body).toContain("every 2 weeks");
    });

    it("appends the monochorionic extra line for twins with mcma chorionicity", () => {
      const viewData = buildPregnancyDashboardViewData(
        multiplesRecord({ fetusCount: 2, chorionicity: "mcma" }),
        todayForGaDays(171),
        "en",
      );
      expect(viewData?.multiplesCard.visible).toBe(true);
      expect(viewData?.multiplesCard.body).toContain("every 2 weeks");
    });

    it("is visible for fetusCount 3 ('three or more')", () => {
      const viewData = buildPregnancyDashboardViewData(
        multiplesRecord({ fetusCount: 3 }),
        todayForGaDays(171),
        "en",
      );
      expect(viewData?.multiplesCard.visible).toBe(true);
    });
  });

  describe("redFlags", () => {
    it("hides reduced_movements before week 28 and shows it from week 28", () => {
      const before = buildPregnancyDashboardViewData(
        activeRecord(),
        todayForGaDays(27 * 7 + 6),
        "en",
      );
      const atStart = buildPregnancyDashboardViewData(
        activeRecord(),
        todayForGaDays(28 * 7),
        "en",
      );
      expect(before?.redFlags.items.map((item) => item.id)).not.toContain(
        "reduced_movements",
      );
      expect(atStart?.redFlags.items.map((item) => item.id)).toContain(
        "reduced_movements",
      );
    });

    it("shows waters_early before term (week 37) and hides it from week 37", () => {
      const lastPretermDay = buildPregnancyDashboardViewData(
        activeRecord(),
        todayForGaDays(36 * 7 + 6),
        "en",
      );
      const term = buildPregnancyDashboardViewData(
        activeRecord(),
        todayForGaDays(37 * 7),
        "en",
      );
      expect(lastPretermDay?.redFlags.items.map((item) => item.id)).toContain(
        "waters_early",
      );
      expect(term?.redFlags.items.map((item) => item.id)).not.toContain(
        "waters_early",
      );
    });

    it("always includes the four ungated pregnancy items regardless of gestational age", () => {
      const early = buildPregnancyDashboardViewData(
        activeRecord(),
        todayForGaDays(59),
        "en",
      );
      const late = buildPregnancyDashboardViewData(
        activeRecord(),
        todayForGaDays(38 * 7),
        "en",
      );
      for (const viewData of [early, late]) {
        const ids = viewData?.redFlags.items.map((item) => item.id);
        expect(ids).toContain("heavy_bleeding");
        expect(ids).toContain("preeclampsia_signs");
        expect(ids).toContain("severe_vomiting");
        expect(ids).toContain("fever");
      }
    });

    it("renders the shared section copy and a non-empty title/body for every item", () => {
      const viewData = buildPregnancyDashboardViewData(
        activeRecord(),
        todayForGaDays(171),
        "en",
      );
      expect(viewData?.redFlags.title).toBe("When to contact your care team");
      expect(viewData?.redFlags.intro.length).toBeGreaterThan(0);
      expect(viewData?.redFlags.expandLabel.length).toBeGreaterThan(0);
      expect(viewData?.redFlags.collapseLabel.length).toBeGreaterThan(0);
      for (const item of viewData?.redFlags.items ?? []) {
        expect(item.title.length).toBeGreaterThan(0);
        expect(item.body.length).toBeGreaterThan(0);
      }
    });
  });

  describe("babyThisWeek", () => {
    const babyWeekCopy = getBabyWeekCopy("en");

    it("always includes the catalog title", () => {
      const viewData = buildPregnancyDashboardViewData(
        activeRecord(),
        todayForGaDays(171),
        "en",
      );
      expect(viewData?.babyThisWeek.title).toBe(babyWeekCopy.title);
    });

    it("uses the veryEarly entry through week 3 (before the per-week catalog starts)", () => {
      const viewData = buildPregnancyDashboardViewData(
        activeRecord(),
        todayForGaDays(3 * 7), // 3+0
        "en",
      );
      expect(viewData?.babyThisWeek.sizeLine).toBe(babyWeekCopy.veryEarly.size);
      expect(viewData?.babyThisWeek.developmentLine).toBe(
        babyWeekCopy.veryEarly.development,
      );
    });

    it("switches to week 4's entry exactly at week 4 (the boundary out of veryEarly)", () => {
      const viewData = buildPregnancyDashboardViewData(
        activeRecord(),
        todayForGaDays(4 * 7), // 4+0
        "en",
      );
      expect(viewData?.babyThisWeek.sizeLine).toBe(babyWeekCopy.weeks[4].size);
      expect(viewData?.babyThisWeek.developmentLine).toBe(
        babyWeekCopy.weeks[4].development,
      );
    });

    it("uses week 20's entry at week 20", () => {
      const viewData = buildPregnancyDashboardViewData(
        activeRecord(),
        todayForGaDays(20 * 7),
        "en",
      );
      expect(viewData?.babyThisWeek.sizeLine).toBe(babyWeekCopy.weeks[20].size);
      expect(viewData?.babyThisWeek.developmentLine).toBe(
        babyWeekCopy.weeks[20].development,
      );
    });

    it("uses week 41's entry at week 41 (the top of the authored catalog)", () => {
      const viewData = buildPregnancyDashboardViewData(
        activeRecord(),
        todayForGaDays(41 * 7),
        "en",
      );
      expect(viewData?.babyThisWeek.sizeLine).toBe(babyWeekCopy.weeks[41].size);
      expect(viewData?.babyThisWeek.developmentLine).toBe(
        babyWeekCopy.weeks[41].development,
      );
    });

    it("falls back to week 41's entry from week 42 onward rather than fabricating a new data point", () => {
      const viewData = buildPregnancyDashboardViewData(
        activeRecord(),
        todayForGaDays(42 * 7),
        "en",
      );
      expect(viewData?.babyThisWeek.sizeLine).toBe(babyWeekCopy.weeks[41].size);
      expect(viewData?.babyThisWeek.developmentLine).toBe(
        babyWeekCopy.weeks[41].development,
      );
    });

    describe("multiplesNote", () => {
      it("is null for a singleton record (no fetusCount)", () => {
        const viewData = buildPregnancyDashboardViewData(
          multiplesRecord(),
          todayForGaDays(171),
          "en",
        );
        expect(viewData?.babyThisWeek.multiplesNote).toBeNull();
      });

      it("is null for an explicit fetusCount of 1", () => {
        const viewData = buildPregnancyDashboardViewData(
          multiplesRecord({ fetusCount: 1 }),
          todayForGaDays(171),
          "en",
        );
        expect(viewData?.babyThisWeek.multiplesNote).toBeNull();
      });

      it("is the catalog's multiplesNote for twins (fetusCount 2)", () => {
        const viewData = buildPregnancyDashboardViewData(
          multiplesRecord({ fetusCount: 2 }),
          todayForGaDays(171),
          "en",
        );
        expect(viewData?.babyThisWeek.multiplesNote).toBe(
          babyWeekCopy.multiplesNote,
        );
      });

      it("is the catalog's multiplesNote for fetusCount 3 ('three or more')", () => {
        const viewData = buildPregnancyDashboardViewData(
          multiplesRecord({ fetusCount: 3 }),
          todayForGaDays(171),
          "en",
        );
        expect(viewData?.babyThisWeek.multiplesNote).toBe(
          babyWeekCopy.multiplesNote,
        );
      });
    });

    // Runtime companion to the compile-time completeness guarantee: the
    // `BabyWeekCopy` type (derived via WidenLiteral from the `satisfies
    // BabyWeekEntriesCopy`-checked en catalog) already fails `npm run
    // typecheck` if any locale is missing a week 4-41 key or the
    // title/multiplesNote/veryEarly fields. This loop is a lighter-weight,
    // always-on regression guard that every locale's resolved strings are
    // non-empty at runtime too.
    it("resolves non-empty size/development strings for every week 4-41 in every locale", () => {
      const languages = ["en", "ru", "de", "fr", "es", "it"] as const;
      for (const language of languages) {
        const copy = getBabyWeekCopy(language);
        expect(copy.title.length).toBeGreaterThan(0);
        expect(copy.multiplesNote.length).toBeGreaterThan(0);
        expect(copy.veryEarly.size.length).toBeGreaterThan(0);
        expect(copy.veryEarly.development.length).toBeGreaterThan(0);
        for (let week = 4; week <= 41; week += 1) {
          const entry = copy.weeks[week as keyof typeof copy.weeks];
          expect(entry.size.length).toBeGreaterThan(0);
          expect(entry.development.length).toBeGreaterThan(0);
        }
      }
    });
  });
});

describe("buildPregnancyStaleCardViewData", () => {
  it("returns neutral copy pointing at pregnancy-end management for a past-window record", () => {
    const viewData = buildPregnancyStaleCardViewData(
      activeRecord(),
      todayForGaDays(630), // ~50 weeks past the due date
      "en",
    );
    expect(viewData).not.toBeNull();
    expect(viewData?.title.length).toBeGreaterThan(0);
    expect(viewData?.body).toContain("estimated due date has passed");
    // Reuses the existing manage-pregnancy-tracking CTA copy/destination
    // rather than minting a second near-duplicate label.
    expect(viewData?.ctaLabel).toBe("Manage pregnancy tracking");
  });

  it("returns null for a malformed/future EDD (defensive) rather than guessing", () => {
    const viewData = buildPregnancyStaleCardViewData(
      activeRecord(),
      todayForGaDays(-1),
      "en",
    );
    expect(viewData).toBeNull();
  });

  it("returns null when the gestational age is actually in range", () => {
    const viewData = buildPregnancyStaleCardViewData(
      activeRecord(),
      todayForGaDays(171),
      "en",
    );
    expect(viewData).toBeNull();
  });
});

describe("defensive branches", () => {
  it("rejects an unparseable LMP date distinctly from a missing one", async () => {
    const storage = createLocalAppStorageMock();

    const result = await startPregnancy(storage, {
      eddBasis: "lmp",
      lmpDate: "2026-99-99",
    });

    expect(result).toEqual({ ok: false, errorCode: "invalid_date" });
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
  });

  it("treats an omitted EDD as missing for a non-LMP basis", async () => {
    const storage = createLocalAppStorageMock();

    const result = await startPregnancy(storage, {
      eddBasis: "ultrasound",
    });

    expect(result).toEqual({ ok: false, errorCode: "missing_date" });
  });

  it("falls back to today when endPregnancy receives an unparseable endedAt", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });

    const result = await endPregnancy(
      storage,
      { reason: "birth", endedAt: "2026-99-99" },
      parseLocalDate("2026-06-10")!,
    );

    expect(result.ok).toBe(true);
    expect(storage.writePregnancyRecord).toHaveBeenCalledWith(
      expect.objectContaining({ endedAt: "2026-06-10" }),
    );
  });

  it("renders the due-soon hero labels for one day to go, due today, and one day over", () => {
    const oneDayToGo = buildPregnancyDashboardViewData(
      activeRecord(),
      formatLocalDate(addDays(parseLocalDate(EDD)!, -1)),
      "en",
    );
    const dueToday = buildPregnancyDashboardViewData(
      activeRecord(),
      EDD,
      "en",
    );
    const oneDayOver = buildPregnancyDashboardViewData(
      activeRecord(),
      formatLocalDate(addDays(parseLocalDate(EDD)!, 1)),
      "en",
    );

    const copy = getPregnancyCopy("en");
    expect(oneDayToGo?.hero.daysRemainingLabel).toBe(copy.hero.dayToGo);
    expect(dueToday?.hero.daysRemainingLabel).toBe(copy.hero.dueToday);
    expect(oneDayOver?.hero.daysRemainingLabel).toBe(copy.hero.overdueOne);
  });

  it("passes an unparseable date through the display formatter untouched", () => {
    // Both call sites validate first, so the passthrough is exercised here
    // directly: never crash, never invent a date.
    expect(formatDisplayDate("junk", "en")).toBe("junk");
    expect(formatDisplayDate(EDD, "en")).toContain("2026");
  });
});

describe("endPregnancy explicit endedAt", () => {
  it("persists an explicitly provided valid endedAt", async () => {
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
    });

    const result = await endPregnancy(
      storage,
      { reason: "birth", modeOfDelivery: "vaginal", endedAt: "2026-06-05" },
      new Date("2026-06-10T12:00:00.000Z"),
    );

    expect(result.ok).toBe(true);
    expect(storage.writePregnancyRecord).toHaveBeenCalledWith(
      expect.objectContaining({ endedAt: "2026-06-05" }),
    );
  });
});
