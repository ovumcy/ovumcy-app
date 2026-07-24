import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import type { ModeOfDelivery, PregnancyRecord } from "../models/pregnancy";
import type { PostpartumRecord } from "../models/postpartum";
import { getPostpartumCopy } from "../i18n/postpartum-copy";
import {
  buildPostpartumCycleReturnOfferViewData,
  buildPostpartumDashboardViewData,
  buildPostpartumStaleCardViewData,
  deleteAllPostpartumData,
  endPostpartum,
  hasRecentEndedBirthPregnancy,
  resolvePostpartumPhase,
  startPostpartumFromBirth,
  type PostpartumPhase,
} from "./postpartum-mode-service";

function endedBirthPregnancy(
  overrides: Partial<PregnancyRecord> = {},
): PregnancyRecord {
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
    modeOfDelivery: "vaginal",
    endedAt: null,
    endReason: null,
    ...overrides,
  };
}

describe("startPostpartumFromBirth", () => {
  it("creates an active record with startedAt copied from the birth's endedAt and modeOfDelivery copied", async () => {
    const written: PostpartumRecord[] = [];
    const storage = createLocalAppStorageMock({
      listPregnancyRecords: jest.fn().mockResolvedValue([endedBirthPregnancy()]),
      readActivePostpartum: jest.fn().mockResolvedValue(null),
      writePostpartumRecord: jest.fn(async (record: PostpartumRecord) => {
        written.push(record);
      }),
    });

    const result = await startPostpartumFromBirth(storage, {
      now: new Date(2026, 5, 15),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.record.status).toBe("active");
    expect(result.record.startedAt).toBe("2026-06-01");
    expect(result.record.modeOfDelivery).toBe("cesarean");
    expect(written).toHaveLength(1);
    expect(written[0]?.startedAt).toBe("2026-06-01");
  });

  it("picks the MOST RECENT ended-birth pregnancy when several exist", async () => {
    const storage = createLocalAppStorageMock({
      listPregnancyRecords: jest.fn().mockResolvedValue([
        endedBirthPregnancy({ id: "old", endedAt: "2025-01-01", modeOfDelivery: "vaginal" }),
        endedBirthPregnancy({ id: "recent", endedAt: "2026-06-01", modeOfDelivery: "cesarean" }),
      ]),
      readActivePostpartum: jest.fn().mockResolvedValue(null),
    });

    const result = await startPostpartumFromBirth(storage);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.startedAt).toBe("2026-06-01");
      expect(result.record.modeOfDelivery).toBe("cesarean");
    }
  });

  it("rejects when an active pregnancy still exists", async () => {
    const storage = createLocalAppStorageMock({
      listPregnancyRecords: jest.fn().mockResolvedValue([
        endedBirthPregnancy(),
        { ...endedBirthPregnancy(), id: "active", status: "active", endedAt: null, endReason: null },
      ]),
      readActivePostpartum: jest.fn().mockResolvedValue(null),
    });

    const result = await startPostpartumFromBirth(storage);

    expect(result).toEqual({ ok: false, errorCode: "active_pregnancy_exists" });
  });

  it("rejects when a postpartum is already active", async () => {
    const storage = createLocalAppStorageMock({
      listPregnancyRecords: jest.fn().mockResolvedValue([endedBirthPregnancy()]),
      readActivePostpartum: jest.fn().mockResolvedValue(activePostpartum()),
    });

    const result = await startPostpartumFromBirth(storage);

    expect(result).toEqual({ ok: false, errorCode: "active_postpartum_exists" });
  });

  it("rejects when there is no ended-birth pregnancy (a loss is never a source — rule B8)", async () => {
    const storage = createLocalAppStorageMock({
      listPregnancyRecords: jest.fn().mockResolvedValue([
        endedBirthPregnancy({ endReason: "loss", modeOfDelivery: null }),
      ]),
      readActivePostpartum: jest.fn().mockResolvedValue(null),
    });

    const result = await startPostpartumFromBirth(storage);

    expect(result).toEqual({ ok: false, errorCode: "no_birth_pregnancy" });
  });

  it("surfaces a save failure as save_failed rather than throwing", async () => {
    const storage = createLocalAppStorageMock({
      listPregnancyRecords: jest.fn().mockResolvedValue([endedBirthPregnancy()]),
      readActivePostpartum: jest.fn().mockResolvedValue(null),
      writePostpartumRecord: jest
        .fn()
        .mockRejectedValue(new Error("another postpartum is already active")),
    });

    const result = await startPostpartumFromBirth(storage);

    expect(result).toEqual({ ok: false, errorCode: "save_failed" });
  });
});

describe("endPostpartum", () => {
  it("ends the active postpartum with reason cycle_returned and today's date", async () => {
    const written: PostpartumRecord[] = [];
    const storage = createLocalAppStorageMock({
      readActivePostpartum: jest.fn().mockResolvedValue(activePostpartum()),
      writePostpartumRecord: jest.fn(async (record: PostpartumRecord) => {
        written.push(record);
      }),
    });

    const result = await endPostpartum(
      storage,
      { reason: "cycle_returned" },
      new Date(2026, 6, 15),
    );

    expect(result.ok).toBe(true);
    expect(written[0]?.status).toBe("ended");
    expect(written[0]?.endReason).toBe("cycle_returned");
    expect(written[0]?.endedAt).toBe("2026-07-15");
  });

  it("ends the active postpartum with reason manual", async () => {
    const storage = createLocalAppStorageMock({
      readActivePostpartum: jest.fn().mockResolvedValue(activePostpartum()),
    });

    const result = await endPostpartum(storage, { reason: "manual" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.endReason).toBe("manual");
    }
  });

  it("rejects when there is no active postpartum", async () => {
    const storage = createLocalAppStorageMock({
      readActivePostpartum: jest.fn().mockResolvedValue(null),
    });

    const result = await endPostpartum(storage, { reason: "manual" });

    expect(result).toEqual({ ok: false, errorCode: "no_active_postpartum" });
  });

  it("surfaces a save failure as save_failed", async () => {
    const storage = createLocalAppStorageMock({
      readActivePostpartum: jest.fn().mockResolvedValue(activePostpartum()),
      writePostpartumRecord: jest.fn().mockRejectedValue(new Error("io")),
    });

    const result = await endPostpartum(storage, { reason: "manual" });

    expect(result).toEqual({ ok: false, errorCode: "save_failed" });
  });
});

describe("deleteAllPostpartumData", () => {
  it("returns ok on success", async () => {
    const storage = createLocalAppStorageMock();
    await expect(deleteAllPostpartumData(storage)).resolves.toEqual({ ok: true });
    expect(storage.deleteAllPostpartumData).toHaveBeenCalledTimes(1);
  });

  it("returns a generic error when the storage delete throws", async () => {
    const storage = createLocalAppStorageMock({
      deleteAllPostpartumData: jest.fn().mockRejectedValue(new Error("io")),
    });
    await expect(deleteAllPostpartumData(storage)).resolves.toEqual({
      ok: false,
      errorCode: "generic",
    });
  });
});

describe("resolvePostpartumPhase", () => {
  it("maps week counts onto early/core/extended with inclusive lower boundaries", () => {
    expect(resolvePostpartumPhase(0)).toBe("early");
    expect(resolvePostpartumPhase(2)).toBe("early");
    expect(resolvePostpartumPhase(3)).toBe("core");
    expect(resolvePostpartumPhase(6)).toBe("core");
    expect(resolvePostpartumPhase(7)).toBe("extended");
  });
});

describe("buildPostpartumDashboardViewData", () => {
  it("renders the weeks-since-birth label and the early phase at the 2-week boundary", () => {
    const view = buildPostpartumDashboardViewData(
      activePostpartum({ modeOfDelivery: "vaginal" }),
      "2026-06-15",
      "en",
    );
    expect(view).not.toBeNull();
    expect(view?.hero.weeksLabel).toBe("2+0");
    expect(view?.hero.phase).toBe("early");
    // Vaginal body doesn't carry the cesarean-specific abdominal-surgery
    // language (full phase x mode matrix pinned below).
    expect(view?.recoveryCard.body).not.toContain("abdominal surgery");
  });

  it("stays in the core phase at exactly six weeks and extends past it", () => {
    expect(
      buildPostpartumDashboardViewData(activePostpartum(), "2026-07-13", "en")
        ?.hero.phase,
    ).toBe("core");
    expect(
      buildPostpartumDashboardViewData(activePostpartum(), "2026-07-20", "en")
        ?.hero.phase,
    ).toBe("extended");
  });

  it("resolves the early-phase cesarean body (abdominal-surgery recovery) from the matrix", () => {
    const view = buildPostpartumDashboardViewData(
      activePostpartum({ modeOfDelivery: "cesarean" }),
      "2026-06-15",
      "en",
    );
    expect(view?.recoveryCard.body).toContain("abdominal surgery");
  });

  it("returns null past the 26-week trackable window (stale) and at a future birth date", () => {
    // 27 weeks after birth -> out of window.
    expect(
      buildPostpartumDashboardViewData(activePostpartum(), "2026-12-07", "en"),
    ).toBeNull();
    // 26 weeks exactly is still shown.
    expect(
      buildPostpartumDashboardViewData(activePostpartum(), "2026-11-30", "en"),
    ).not.toBeNull();
    // Birth date in the future.
    expect(
      buildPostpartumDashboardViewData(activePostpartum(), "2026-05-01", "en"),
    ).toBeNull();
  });

  describe("redFlags (Y1 phase 2)", () => {
    it("contains all eight postpartum items (psychosis after mental_health), in order, regardless of the recovery phase", () => {
      const early = buildPostpartumDashboardViewData(
        activePostpartum(),
        "2026-06-15", // early phase (2 weeks since birth)
        "en",
      );
      const extended = buildPostpartumDashboardViewData(
        activePostpartum(),
        "2026-08-01", // extended phase, still well inside the 26-week window
        "en",
      );
      const expectedIDs = [
        "heavy_bleeding_pp",
        "bleeding_returns",
        "vte_signs",
        "fever_pp",
        "breast_symptoms",
        "preeclampsia_pp",
        "mental_health",
        "psychosis_signs",
      ];

      for (const viewData of [early, extended]) {
        expect(viewData?.redFlags.items.map((item) => item.id)).toEqual(
          expectedIDs,
        );
        for (const item of viewData?.redFlags.items ?? []) {
          expect(item.title.length).toBeGreaterThan(0);
          expect(item.body.length).toBeGreaterThan(0);
        }
      }
    });

    it("carries the firm-but-calm postpartum-psychosis escalation wording with no exclamation marks", () => {
      const view = buildPostpartumDashboardViewData(
        activePostpartum(),
        "2026-06-15",
        "en",
      );
      const psychosis = view?.redFlags.items.find(
        (item) => item.id === "psychosis_signs",
      );
      expect(psychosis?.body).toContain("urgent medical attention now");
      expect(psychosis?.body).toContain("today");
      expect(psychosis?.body).not.toContain("!");
    });

    it("renders the same shared section copy as the pregnancy dashboard", () => {
      const view = buildPostpartumDashboardViewData(
        activePostpartum(),
        "2026-06-15",
        "en",
      );
      expect(view?.redFlags.title).toBe("When to contact your care team");
      expect(view?.redFlags.intro.length).toBeGreaterThan(0);
      expect(view?.redFlags.expandLabel.length).toBeGreaterThan(0);
      expect(view?.redFlags.collapseLabel.length).toBeGreaterThan(0);
    });
  });

  describe("supportResources (Y4)", () => {
    it("carries the standing support-resources row labels and the mental_health context body", () => {
      const view = buildPostpartumDashboardViewData(
        activePostpartum(),
        "2026-06-15",
        "en",
      );
      expect(view?.supportResources.rowLabel).toBe("Support resources");
      expect(view?.supportResources.expandLabel.length).toBeGreaterThan(0);
      expect(view?.supportResources.collapseLabel.length).toBeGreaterThan(0);
      // The context body is the gentle mental_health red-flag body.
      expect(view?.supportResources.contextBody).toContain("unable to cope");
      // The crisis contact itself never rides the postpartum view-data — the
      // container builds the CrisisSupportCard's own view-data from the profile.
      expect(JSON.stringify(view?.supportResources)).not.toContain(
        "crisisContact",
      );
    });
  });

  describe("recovery body matrix (Y5 phase 2: phase x mode-of-delivery)", () => {
    // Same birth date as `activePostpartum()` (2026-06-01); "today" lands
    // exactly on each phase's inclusive boundary, reusing the dates already
    // exercised above (early = 2 weeks, core = 6 weeks, extended = 7 weeks).
    const phaseDates: Record<PostpartumPhase, string> = {
      early: "2026-06-15",
      core: "2026-07-13",
      extended: "2026-07-20",
    };
    const modeCases: readonly {
      label: string;
      modeOfDelivery: ModeOfDelivery | null;
      matrixKey: "vaginal" | "cesarean" | "neutral";
    }[] = [
      { label: "vaginal", modeOfDelivery: "vaginal", matrixKey: "vaginal" },
      { label: "cesarean", modeOfDelivery: "cesarean", matrixKey: "cesarean" },
      { label: "null (unknown)", modeOfDelivery: null, matrixKey: "neutral" },
    ];
    const phases = ["early", "core", "extended"] as const;

    for (const phase of phases) {
      for (const modeCase of modeCases) {
        it(`resolves the ${phase} x ${modeCase.label} cell from the copy matrix`, () => {
          const view = buildPostpartumDashboardViewData(
            activePostpartum({ modeOfDelivery: modeCase.modeOfDelivery }),
            phaseDates[phase],
            "en",
          );
          expect(view?.hero.phase).toBe(phase);
          expect(view?.recoveryCard.body).toBe(
            getPostpartumCopy("en").recovery.bodies[phase][modeCase.matrixKey],
          );
        });
      }
    }

    it("falls back to the neutral body for a null (unknown) mode of delivery", () => {
      const view = buildPostpartumDashboardViewData(
        activePostpartum({ modeOfDelivery: null }),
        phaseDates.early,
        "en",
      );
      const neutralBody = getPostpartumCopy("en").recovery.bodies.early.neutral;
      const vaginalBody = getPostpartumCopy("en").recovery.bodies.early.vaginal;
      expect(view?.recoveryCard.body).toBe(neutralBody);
      expect(view?.recoveryCard.body).not.toBe(vaginalBody);
    });

    it("early-phase cesarean body mentions lifting and ties circulation to lower clot risk, without duplicating the VTE red-flag symptom list", () => {
      const view = buildPostpartumDashboardViewData(
        activePostpartum({ modeOfDelivery: "cesarean" }),
        phaseDates.early,
        "en",
      );
      const body = view?.recoveryCard.body ?? "";
      expect(body).toContain("abdominal surgery");
      expect(body).toContain("lifting anything heavier than your baby");
      expect(body).toContain("circulation");
      expect(body).toContain("blood clots");
      // Ties to the VTE red flag's clot risk without repeating ITS specific
      // symptom list (leg swelling / breathlessness / chest pain) -- see
      // red-flag-copy.ts's vte_signs item.
      expect(body).not.toContain("breathlessness");
      expect(body).not.toContain("chest pain");
    });

    it("extended-phase cesarean body mentions the scar; vaginal and neutral share the same extended base text", () => {
      const cesarean = buildPostpartumDashboardViewData(
        activePostpartum({ modeOfDelivery: "cesarean" }),
        phaseDates.extended,
        "en",
      );
      const vaginal = buildPostpartumDashboardViewData(
        activePostpartum({ modeOfDelivery: "vaginal" }),
        phaseDates.extended,
        "en",
      );
      const neutral = buildPostpartumDashboardViewData(
        activePostpartum({ modeOfDelivery: null }),
        phaseDates.extended,
        "en",
      );
      expect(cesarean?.recoveryCard.body).toContain("scar");
      expect(vaginal?.recoveryCard.body).toBe(neutral?.recoveryCard.body);
      // Cesarean extends the SAME shared base text with one extra clause,
      // rather than diverging from it.
      expect(cesarean?.recoveryCard.body).toContain(
        vaginal?.recoveryCard.body ?? "\0",
      );
      expect(cesarean?.recoveryCard.body).not.toBe(vaginal?.recoveryCard.body);
    });
  });

  describe("cycleReturnOffer / lamCard (Y6 phase 2)", () => {
    it("shows the cycle-return offer and supersedes (hides) the LAM card when hasNewCycleStart is true", () => {
      const view = buildPostpartumDashboardViewData(
        activePostpartum(),
        "2026-06-15",
        "en",
        [],
        true,
      );
      expect(view?.cycleReturnOffer.visible).toBe(true);
      expect(view?.cycleReturnOffer.title).toBe("Your cycle may be back");
      expect(view?.cycleReturnOffer.acceptCtaLabel).toBe(
        "Close postpartum tracking",
      );
      expect(view?.cycleReturnOffer.keepCtaLabel).toBe("Keep postpartum view");
      // Confirm dialog mirrors the manage screen's manual-end dialog: a
      // two-button, dismissal-keeps-tracking contract (see
      // postpartum-copy.ts manage.endDialog and PregnancyEndScreen).
      expect(view?.cycleReturnOffer.confirmDialog).toEqual({
        title: "Close postpartum tracking?",
        body: expect.any(String),
        confirmLabel: "Close tracking",
        cancelLabel: "Keep tracking",
      });
      expect(view?.lamCard).toBeNull();
    });

    it("hides the cycle-return offer and keeps the LAM card by default (no new cycle start)", () => {
      const view = buildPostpartumDashboardViewData(
        activePostpartum(),
        "2026-06-15",
        "en",
      );
      expect(view?.cycleReturnOffer.visible).toBe(false);
      expect(view?.lamCard).not.toBeNull();
      expect(view?.lamCard?.title).toBe("Breastfeeding and your cycle");
    });

    it("states all three LAM conditions and defers to the care team, never framed as configuring contraception", () => {
      const view = buildPostpartumDashboardViewData(
        activePostpartum(),
        "2026-06-15",
        "en",
      );
      const body = view?.lamCard?.body ?? "";
      expect(body).toContain("no period since birth");
      expect(body).toContain("exclusive");
      expect(body).toContain("six months");
      expect(body).toContain("care team");
      // Education register only -- never an imperative to use/rely on it.
      expect(body).not.toMatch(/\buse (this|it) as\b/i);
    });
  });
});

describe("buildPostpartumCycleReturnOfferViewData (Y6 phase 2)", () => {
  it("mirrors hasNewCycleStart into `visible` and carries the accept/keep/confirm copy", () => {
    expect(buildPostpartumCycleReturnOfferViewData(false, "en").visible).toBe(
      false,
    );
    const offer = buildPostpartumCycleReturnOfferViewData(true, "en");
    expect(offer.visible).toBe(true);
    expect(offer.title.length).toBeGreaterThan(0);
    expect(offer.body.length).toBeGreaterThan(0);
    expect(offer.acceptCtaLabel.length).toBeGreaterThan(0);
    expect(offer.keepCtaLabel.length).toBeGreaterThan(0);
    expect(offer.confirmDialog.confirmLabel.length).toBeGreaterThan(0);
    expect(offer.confirmDialog.cancelLabel.length).toBeGreaterThan(0);
  });
});

describe("buildPostpartumStaleCardViewData", () => {
  it("returns a review/close card only past the 26-week window", () => {
    expect(
      buildPostpartumStaleCardViewData(activePostpartum(), "2026-11-30", "en"),
    ).toBeNull();
    const stale = buildPostpartumStaleCardViewData(
      activePostpartum(),
      "2026-12-07",
      "en",
    );
    expect(stale).not.toBeNull();
    expect(stale?.ctaLabel.length).toBeGreaterThan(0);
  });

  it("stays silent (null) for a future/malformed birth date", () => {
    expect(
      buildPostpartumStaleCardViewData(activePostpartum(), "2026-05-01", "en"),
    ).toBeNull();
    expect(
      buildPostpartumStaleCardViewData(
        activePostpartum({ startedAt: "not-a-date" }),
        "2026-12-07",
        "en",
      ),
    ).toBeNull();
  });
});

describe("hasRecentEndedBirthPregnancy", () => {
  it("is true for an ended birth within the 8-week window and false beyond it", () => {
    expect(
      hasRecentEndedBirthPregnancy(
        [endedBirthPregnancy({ endedAt: "2026-06-06" })],
        "2026-08-01",
      ),
    ).toBe(true);
    expect(
      hasRecentEndedBirthPregnancy(
        [endedBirthPregnancy({ endedAt: "2026-06-05" })],
        "2026-08-01",
      ),
    ).toBe(false);
  });

  it("ignores non-birth endings and active pregnancies", () => {
    expect(
      hasRecentEndedBirthPregnancy(
        [endedBirthPregnancy({ endReason: "loss", endedAt: "2026-07-20" })],
        "2026-08-01",
      ),
    ).toBe(false);
    expect(
      hasRecentEndedBirthPregnancy(
        [{ ...endedBirthPregnancy(), status: "active", endedAt: null }],
        "2026-08-01",
      ),
    ).toBe(false);
  });
});
