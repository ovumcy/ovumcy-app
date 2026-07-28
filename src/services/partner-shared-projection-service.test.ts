import {
  buildPartnerSharedProjectionPayload,
  buildPartnerSharedReadState,
} from "./partner-shared-projection-service";
import { buildCycleHistorySummary, buildCurrentCycleProjection } from "./cycle-history-service";
import { createDefaultProfileRecord } from "../models/profile";
import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultSymptomRecords } from "../models/symptom";

describe("partner-shared-projection-service", () => {
  it("redacts detailed day fields for summary access", () => {
    const profile = {
      ...createDefaultProfileRecord(),
      hideNotes: true,
      hideSexChip: true,
      trackBBT: false,
      trackCervicalMucus: false,
    };
    const record = {
      ...createEmptyDayLogRecord("2026-04-05"),
      isPeriod: true,
      cycleStart: true,
      flow: "medium" as const,
      mood: 4,
      sexActivity: "unprotected" as const,
      bbt: 36.7,
      cervicalMucus: "eggwhite" as const,
      lhTest: "peak" as const,
      pregnancyTest: "none" as const,
      symptomIDs: ["cramps"],
      notes: "private note",
    };

    const projection = buildPartnerSharedProjectionPayload({
      accessLevel: "summary",
      dayLogs: [record],
      generatedAt: "2026-04-05T08:00:00.000Z",
      generation: 1,
      grantID: "grant-1",
      ownerAccountID: "owner-1",
      profile,
      symptomRecords: createDefaultSymptomRecords(),
    });

    expect(projection.dayLogs).toHaveLength(1);
    expect(projection.dayLogs[0]).toEqual(
      expect.objectContaining({
        // flow is dropped in summary (data minimisation — not rendered in summary UI)
        flow: "none",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        symptomIDs: [],
        notes: "",
      }),
    );
    expect(projection.symptomRecords).toEqual([]);
  });

  it("keeps full history but respects owner privacy toggles", () => {
    const profile = {
      ...createDefaultProfileRecord(),
      hideNotes: true,
      hideSexChip: true,
      trackBBT: false,
      trackCervicalMucus: false,
    };
    const record = {
      ...createEmptyDayLogRecord("2026-04-05"),
      isPeriod: true,
      flow: "medium" as const,
      mood: 4,
      sexActivity: "unprotected" as const,
      bbt: 36.7,
      cervicalMucus: "eggwhite" as const,
      lhTest: "peak" as const,
      pregnancyTest: "none" as const,
      symptomIDs: ["cramps"],
      notes: "private note",
    };

    const projection = buildPartnerSharedProjectionPayload({
      accessLevel: "full",
      dayLogs: [record],
      generatedAt: "2026-04-05T08:00:00.000Z",
      generation: 1,
      grantID: "grant-1",
      ownerAccountID: "owner-1",
      profile,
      symptomRecords: createDefaultSymptomRecords(),
    });

    expect(projection.dayLogs[0]).toEqual(
      expect.objectContaining({
        mood: 4,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "peak",
        pregnancyTest: "none",
        notes: "",
      }),
    );
    expect(projection.symptomRecords).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "cramps" })]),
    );
  });

  it("builds shared read metrics from the redacted projection", () => {
    const profile = {
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-04-01",
    };
    const records = [
      {
        ...createEmptyDayLogRecord("2026-04-01"),
        isPeriod: true,
        cycleStart: true,
        flow: "heavy" as const,
      },
      {
        ...createEmptyDayLogRecord("2026-04-02"),
        isPeriod: true,
        flow: "medium" as const,
        symptomIDs: ["cramps"],
      },
      {
        ...createEmptyDayLogRecord("2026-03-04"),
        isPeriod: true,
        cycleStart: true,
      },
    ];

    const projection = buildPartnerSharedProjectionPayload({
      accessLevel: "full",
      dayLogs: records,
      generatedAt: "2026-04-05T08:00:00.000Z",
      generation: 1,
      grantID: "grant-1",
      ownerAccountID: "owner-1",
      profile,
      symptomRecords: createDefaultSymptomRecords(),
    });

    const readState = buildPartnerSharedReadState(
      projection,
      new Date("2026-04-05T10:00:00.000Z"),
      "en",
    );

    expect(readState.summaryMetrics.totalLoggedDays).toBe(3);
    expect(readState.summaryMetrics.topSymptoms).toContain("Cramps");
    expect(readState.cycleStatus.state).toBe("regular");
    // With only 1 completed cycle the prediction span is no longer surfaced as a
    // range (medical-correctness rewrite of resolvePredictionSpanDays).
    expect(readState.cycleStatus.nextPeriodWindowStartDate).toBeNull();
    expect(readState.recentRows[0]?.date).toBe("2026-04-02");
  });

  it("full projection strips pregnancyTest even when record has a non-none value (regression)", () => {
    const profile = createDefaultProfileRecord();
    const record = {
      ...createEmptyDayLogRecord("2026-04-05"),
      isPeriod: true,
      pregnancyTest: "positive" as const,
    };

    const projection = buildPartnerSharedProjectionPayload({
      accessLevel: "full",
      dayLogs: [record],
      generatedAt: "2026-04-05T08:00:00.000Z",
      generation: 1,
      grantID: "grant-1",
      ownerAccountID: "owner-1",
      profile,
      symptomRecords: [],
    });

    expect(projection.dayLogs[0]?.pregnancyTest).toBe("none");
  });

  it("summary projection strips flow (data minimisation)", () => {
    const profile = createDefaultProfileRecord();
    const record = {
      ...createEmptyDayLogRecord("2026-04-05"),
      isPeriod: true,
      flow: "heavy" as const,
    };

    const projection = buildPartnerSharedProjectionPayload({
      accessLevel: "summary",
      dayLogs: [record],
      generatedAt: "2026-04-05T08:00:00.000Z",
      generation: 1,
      grantID: "grant-1",
      ownerAccountID: "owner-1",
      profile,
      symptomRecords: [],
    });

    expect(projection.dayLogs[0]?.flow).toBe("none");
  });

  it("sets isStale when snapshot is older than 14 days", () => {
    const profile = {
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-01-01",
    };

    const projection = buildPartnerSharedProjectionPayload({
      accessLevel: "full",
      dayLogs: [{ ...createEmptyDayLogRecord("2026-01-01"), isPeriod: true, cycleStart: true }],
      generatedAt: "2026-01-01T00:00:00.000Z",
      generation: 1,
      grantID: "grant-1",
      ownerAccountID: "owner-1",
      profile,
      symptomRecords: [],
    });

    // 30 days after generatedAt — clearly stale
    const readState = buildPartnerSharedReadState(
      projection,
      new Date("2026-01-31T00:00:00.000Z"),
      "en",
    );

    expect(readState.isStale).toBe(true);
  });

  it("does not set isStale when snapshot is fresh (within 14 days)", () => {
    const profile = {
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-04-01",
    };

    const projection = buildPartnerSharedProjectionPayload({
      accessLevel: "full",
      dayLogs: [{ ...createEmptyDayLogRecord("2026-04-01"), isPeriod: true, cycleStart: true }],
      generatedAt: "2026-04-05T08:00:00.000Z",
      generation: 1,
      grantID: "grant-1",
      ownerAccountID: "owner-1",
      profile,
      symptomRecords: [],
    });

    // Only 5 days after generatedAt — fresh
    const readState = buildPartnerSharedReadState(
      projection,
      new Date("2026-04-10T08:00:00.000Z"),
      "en",
    );

    expect(readState.isStale).toBe(false);
  });

  it("localizes builtin symptom labels in shared summaries and history", () => {
    const profile = {
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-04-01",
    };
    const records = [
      {
        ...createEmptyDayLogRecord("2026-04-02"),
        isPeriod: true,
        flow: "spotting" as const,
        symptomIDs: ["cramps", "headache"],
      },
    ];

    const projection = buildPartnerSharedProjectionPayload({
      accessLevel: "full",
      dayLogs: records,
      generatedAt: "2026-04-05T08:00:00.000Z",
      generation: 1,
      grantID: "grant-1",
      ownerAccountID: "owner-1",
      profile,
      symptomRecords: createDefaultSymptomRecords(),
    });

    const readState = buildPartnerSharedReadState(
      projection,
      new Date("2026-04-05T10:00:00.000Z"),
      "ru",
    );

    expect(readState.summaryMetrics.topSymptoms).toEqual(["Спазмы", "Головная боль"]);
    expect(readState.recentRows[0]?.symptomSummary).toBe("Спазмы, Головная боль");
  });

  // Regression pins for the pregnancy module: owner-only pregnancy
  // data must NEVER reach a partner projection at any access level. The
  // pregnancy/kick/contraction collections never enter the projection input,
  // so those tokens are structural regression pins. The day-log weightKg /
  // bpSystolic / bpDiastolic fields (additive optional) WOULD have leaked
  // via the old `...record` spread — these tests pin the explicit field-pick.
  //
  // Serialized belt-and-braces: we check specific pregnancy-DOMAIN tokens
  // ("pregnancies"/"eddBasis"/"schedulePreset"/"modeOfDelivery") rather than a
  // raw "pregnan" substring, because the legitimate, already-redacted
  // pregnancyTest day-log field contains that substring by design.
  const pregnancyLeakNeedles = [
    "weightKg",
    "bpSystolic",
    "bpDiastolic",
    "kick",
    "contraction",
    "pregnancies",
    "eddBasis",
    "schedulePreset",
    "modeOfDelivery",
  ];

  it.each(["summary", "full"] as const)(
    "never leaks pregnancy-mode day fields into the %s projection",
    (accessLevel) => {
      const profile = createDefaultProfileRecord();
      const record = {
        ...createEmptyDayLogRecord("2026-04-05"),
        isPeriod: true,
        cycleStart: true,
        weightKg: 68.4,
        bpSystolic: 118,
        bpDiastolic: 76,
      };

      const projection = buildPartnerSharedProjectionPayload({
        accessLevel,
        dayLogs: [record],
        generatedAt: "2026-04-05T08:00:00.000Z",
        generation: 1,
        grantID: "grant-1",
        ownerAccountID: "owner-1",
        profile,
        symptomRecords: createDefaultSymptomRecords(),
      });

      // Structural: the redacted day-log carries none of the owner-only fields.
      const shared = projection.dayLogs[0];
      expect(shared).toBeDefined();
      expect(shared).not.toHaveProperty("weightKg");
      expect(shared).not.toHaveProperty("bpSystolic");
      expect(shared).not.toHaveProperty("bpDiastolic");

      // Structural: no pregnancy-domain collection ever enters the projection.
      expect(projection).not.toHaveProperty("pregnancies");
      expect(projection).not.toHaveProperty("kickSessions");
      expect(projection).not.toHaveProperty("contractionSessions");

      // Belt-and-braces: nothing pregnancy-domain survives serialization.
      const serialized = JSON.stringify(projection);
      for (const needle of pregnancyLeakNeedles) {
        expect(serialized).not.toContain(needle);
      }
    },
  );

  // The owner's personal crisis-support contact is owner-only private safety
  // data and must NEVER reach a partner projection at any access level. The
  // profile pick is explicit (both the runtime literal and the
  // PartnerSharedProfileRecord Pick already exclude these fields), so these are
  // structural + serialized regression pins guarding that exclusion.
  it.each(["summary", "full"] as const)(
    "never leaks the crisis-support contact into the %s projection",
    (accessLevel) => {
      const profile = {
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-04-01",
        crisisContactName: "Secret Crisis Contact",
        crisisContactPhone: "07700900555",
      };

      const projection = buildPartnerSharedProjectionPayload({
        accessLevel,
        dayLogs: [
          { ...createEmptyDayLogRecord("2026-04-01"), isPeriod: true, cycleStart: true },
        ],
        generatedAt: "2026-04-05T08:00:00.000Z",
        generation: 1,
        grantID: "grant-1",
        ownerAccountID: "owner-1",
        profile,
        symptomRecords: createDefaultSymptomRecords(),
      });

      // Structural: the shared profile carries neither crisis field.
      expect(projection.profile).not.toHaveProperty("crisisContactName");
      expect(projection.profile).not.toHaveProperty("crisisContactPhone");

      // Serialized: neither the field-name token nor the values survive at any
      // level (belt-and-braces against a future spread regression).
      const serialized = JSON.stringify(projection);
      expect(serialized).not.toContain("crisisContact");
      expect(serialized).not.toContain("Secret Crisis Contact");
      expect(serialized).not.toContain("07700900555");
    },
  );

  // Postpartum recovery data and EPDS mood-screening answers are the most
  // sensitive owner-only classes in the product. Neither entity is part of the
  // projection INPUT SURFACE at all — buildPartnerSharedProjectionPayload takes
  // only accessLevel / dayLogs / profile / symptomRecords + grant metadata — so
  // nothing postpartum- or screening-shaped can reach a partner projection.
  // These are structural + serialized regression pins guarding that the surface
  // never grows to admit them (the explicit-pick discipline), for BOTH
  // access levels. "epds" is the screening instrument value; "answers" +
  // "selfHarmFlag" are the screening answer vector + derived flag; "lochia" is a
  // postpartum bleeding field that must never be added to a shared projection.
  const postpartumScreeningLeakNeedles = [
    "postpartum",
    "screening",
    "lochia",
    "answers",
    "selfHarmFlag",
    "epds",
  ];

  it.each(["summary", "full"] as const)(
    "never leaks postpartum or screening data into the %s projection",
    (accessLevel) => {
      const profile = {
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-04-01",
      };
      const record = {
        ...createEmptyDayLogRecord("2026-04-05"),
        isPeriod: true,
        cycleStart: true,
        symptomIDs: ["cramps"],
        notes: "recovery note",
      };

      const projection = buildPartnerSharedProjectionPayload({
        accessLevel,
        dayLogs: [record],
        generatedAt: "2026-04-05T08:00:00.000Z",
        generation: 1,
        grantID: "grant-1",
        ownerAccountID: "owner-1",
        profile,
        symptomRecords: createDefaultSymptomRecords(),
      });

      // Structural: no postpartum/screening collection ever enters the projection.
      expect(projection).not.toHaveProperty("postpartumRecords");
      expect(projection).not.toHaveProperty("screeningResponses");

      // Belt-and-braces: nothing postpartum/screening-domain survives
      // serialization at either access level.
      const serialized = JSON.stringify(projection);
      for (const needle of postpartumScreeningLeakNeedles) {
        expect(serialized).not.toContain(needle);
      }
    },
  );

  // Closes the last two violators of the amended security-constitution
  // Medical-safety bullet ("While a pregnancy record is ACTIVE, prediction
  // surfaces stay suppressed regardless of that pause") for the partner
  // surface. Partners must never be able to infer pregnancy state, and
  // redactDayLogForPartner already forces the shared pregnancyTest to "none"
  // (both access levels) -- so buildPartnerSharedReadState's own later
  // projection recomputation, run from ONLY the payload (no owner-storage
  // access on the reading device), can never detect a day-log pause by
  // itself. Audit finding (see the "verify" test below): today this does NOT
  // leak pregnancyPausedHint's "positive pregnancy test" wording -- but it
  // DOES leak live, forward-rolled currentCycleDay/nextPeriodDate numbers
  // computed straight through the owner's actual paused/pregnant state.
  describe("prediction suppression for active pregnancy / pregnancy-paused owners", () => {
    // Three completed 28-day cycle-start markers shared by every fixture
    // below; kept separate from the pregnancy-specific tail so each state
    // only differs in what happens after 2026-01-29.
    const completedCycleRecords = [
      { ...createEmptyDayLogRecord("2025-12-04"), isPeriod: true, cycleStart: true },
      { ...createEmptyDayLogRecord("2026-01-01"), isPeriod: true, cycleStart: true },
      { ...createEmptyDayLogRecord("2026-01-29"), isPeriod: true, cycleStart: true },
    ];
    const baseProfile = {
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-01-29",
      cycleLength: 28,
    };

    it("keeps the owner's pregnancy-paused wording out of a partner projection even when predictions are not suppressed", () => {
      // Regression pin for the audit finding: resolvePregnancyPause's only
      // signal (day-log pregnancyTest) is always "none" in the shared
      // payload, so buildPartnerSharedReadState's OWN projection can never
      // set isPregnancyPaused -- dashboardCopy.pregnancyPausedHint
      // ("...paused after a positive pregnancy test...") can never surface
      // through this path, independent of the suppressPredictions option.
      const now = new Date("2026-03-05T09:00:00.000Z");
      const records = [
        ...completedCycleRecords,
        { ...createEmptyDayLogRecord("2026-02-20"), pregnancyTest: "positive" as const },
      ];

      const payload = buildPartnerSharedProjectionPayload({
        accessLevel: "full",
        dayLogs: records,
        generatedAt: now.toISOString(),
        generation: 1,
        grantID: "grant-1",
        ownerAccountID: "owner-1",
        profile: baseProfile,
        symptomRecords: [],
      });
      expect(payload.dayLogs.every((record) => record.pregnancyTest === "none")).toBe(true);

      const readState = buildPartnerSharedReadState(payload, now, "en");
      expect(readState.cycleStatus.predictionExplanation).not.toContain("pregnancy test");
      expect(readState.cycleStatus.predictionExplanation).not.toContain("paused");
    });

    it.each(["summary", "full"] as const)(
      "suppresses partner predictions for an active pregnancy record even after the day-log pause lifts (%s access)",
      (accessLevel) => {
        const now = new Date("2026-03-10T09:00:00.000Z");
        const records = [
          ...completedCycleRecords,
          { ...createEmptyDayLogRecord("2026-02-20"), pregnancyTest: "positive" as const },
          // A period logged AFTER the positive test lifts the owner's OWN
          // day-log pause -- the exact hole the amended constitution closes:
          // suppression must hold anyway because activePregnancy is active.
          { ...createEmptyDayLogRecord("2026-02-25"), isPeriod: true, cycleStart: true },
        ];

        // Sanity check (not vacuous): the owner's REAL projection pause IS
        // lifted in this fixture, so the pin below only holds because of the
        // threaded activePregnancy flag, mirroring the stats/calendar
        // convention (testing.md "Pregnancy pause").
        const ownerHistory = buildCycleHistorySummary(baseProfile, records, now);
        const ownerProjection = buildCurrentCycleProjection(baseProfile, ownerHistory, records, now);
        expect(ownerProjection.isPregnancyPaused).toBe(false);

        const payload = buildPartnerSharedProjectionPayload(
          {
            accessLevel,
            dayLogs: records,
            generatedAt: now.toISOString(),
            generation: 1,
            grantID: "grant-1",
            ownerAccountID: "owner-1",
            profile: baseProfile,
            symptomRecords: [],
          },
          // Caller-computed, mirrors loadStatsScreenState: activePregnancy !== null.
          { suppressPredictions: true },
        );

        expect(payload.profile.unpredictableCycle).toBe(true);
        const serialized = JSON.stringify(payload);
        expect(serialized).not.toContain("paused");
        expect(serialized).not.toContain("pregnancy test");

        const readState = buildPartnerSharedReadState(payload, now, "en");
        expect(readState.cycleStatus.state).toBe("facts_only");
        expect(readState.cycleStatus.nextPeriodDate).toBeNull();
        expect(readState.cycleStatus.nextPeriodWindowStartDate).toBeNull();
        expect(readState.cycleStatus.nextPeriodWindowEndDate).toBeNull();
        expect(readState.cycleStatus.predictionExplanation).not.toContain("pregnancy");
        expect(readState.cycleStatus.predictionExplanation).not.toContain("paused");
        const readSerialized = JSON.stringify(readState);
        expect(readSerialized).not.toContain("paused");
        expect(readSerialized).not.toContain("pregnancy test");
      },
    );

    it.each(["summary", "full"] as const)(
      "suppresses partner predictions for a day-log pause with no active pregnancy record (%s access)",
      (accessLevel) => {
        const now = new Date("2026-03-05T09:00:00.000Z");
        const records = [
          ...completedCycleRecords,
          { ...createEmptyDayLogRecord("2026-02-20"), pregnancyTest: "positive" as const },
        ];

        // Sanity check (not vacuous): the owner's REAL projection IS paused
        // in this fixture -- no period was logged after the positive test --
        // and no active PregnancyRecord exists, so suppression here can only
        // come from the builder's own internal pause recomputation, not the
        // threaded activePregnancy flag.
        const ownerHistory = buildCycleHistorySummary(baseProfile, records, now);
        const ownerProjection = buildCurrentCycleProjection(baseProfile, ownerHistory, records, now);
        expect(ownerProjection.isPregnancyPaused).toBe(true);

        const payload = buildPartnerSharedProjectionPayload(
          {
            accessLevel,
            dayLogs: records,
            generatedAt: now.toISOString(),
            generation: 1,
            grantID: "grant-1",
            ownerAccountID: "owner-1",
            profile: baseProfile,
            symptomRecords: [],
          },
          { suppressPredictions: false }, // no active PregnancyRecord
        );

        expect(payload.profile.unpredictableCycle).toBe(true);
        const serialized = JSON.stringify(payload);
        expect(serialized).not.toContain("paused");
        expect(serialized).not.toContain("pregnancy test");

        const readState = buildPartnerSharedReadState(payload, now, "en");
        expect(readState.cycleStatus.state).toBe("facts_only");
        expect(readState.cycleStatus.nextPeriodDate).toBeNull();
        expect(readState.cycleStatus.predictionExplanation).not.toContain("pregnancy");
        expect(readState.cycleStatus.predictionExplanation).not.toContain("paused");
        const readSerialized = JSON.stringify(readState);
        expect(readSerialized).not.toContain("paused");
        expect(readSerialized).not.toContain("pregnancy test");
      },
    );

    it.each(["summary", "full"] as const)(
      "keeps normal partner predictions for a plain cycle with no pregnancy signal at all (%s access, regression guard)",
      (accessLevel) => {
        const now = new Date("2026-02-10T09:00:00.000Z");

        const payload = buildPartnerSharedProjectionPayload(
          {
            accessLevel,
            dayLogs: completedCycleRecords,
            generatedAt: now.toISOString(),
            generation: 1,
            grantID: "grant-1",
            ownerAccountID: "owner-1",
            profile: baseProfile,
            symptomRecords: [],
          },
          { suppressPredictions: false },
        );

        // Unaffected: the owner's real unpredictableCycle setting (false)
        // passes through untouched, and normal predictions still compute.
        expect(payload.profile.unpredictableCycle).toBe(false);

        const readState = buildPartnerSharedReadState(payload, now, "en");
        expect(readState.cycleStatus.state).not.toBe("facts_only");
        expect(readState.cycleStatus.state).not.toBe("unknown");
        expect(readState.cycleStatus.nextPeriodDate).toBe("2026-02-26");
        expect(readState.cycleStatus.currentCycleDay).toBe(13);
      },
    );
  });
});
