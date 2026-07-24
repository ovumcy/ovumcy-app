import { createDefaultProfileRecord } from "../../models/profile";
import { createVolatileWebAppStorage } from "./volatile-web-app-storage";

describe("volatile-web-app-storage", () => {
  it("keeps health data only for the current app session", async () => {
    const storage = createVolatileWebAppStorage();

    await storage.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    });
    await storage.writeOnboardingRecord({
      lastPeriodStart: "2026-03-14",
      cycleLength: 30,
      periodLength: 6,
      autoPeriodFill: true,
      irregularCycle: true,
      unpredictableCycle: false,
      ageGroup: "age_45_plus",
      usageGoal: "trying_to_conceive",
    });
    await storage.writeDayLogRecord({
      date: "2026-03-18",
      isPeriod: true,
      cycleStart: false,
      isUncertain: false,
      flow: "spotting",
      mood: 3,
      sexActivity: "protected",
      bbt: 36.7,
      cervicalMucus: "creamy",
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: ["stress"],
      symptomIDs: ["cramps", "fatigue"],
      notes: "Session-only web note",
      weightKg: 65.436,
      bpSystolic: 118.6,
      bpDiastolic: 76.2,
    });

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    });
    await expect(storage.readProfileRecord()).resolves.toEqual({
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-03-14",
      cycleLength: 30,
      periodLength: 6,
      irregularCycle: true,
      ageGroup: "age_45_plus",
      usageGoal: "trying_to_conceive",
    });
    await expect(storage.readDayLogRecord("2026-03-18")).resolves.toEqual({
      date: "2026-03-18",
      isPeriod: true,
      cycleStart: false,
      isUncertain: false,
      flow: "spotting",
      mood: 3,
      sexActivity: "protected",
      bbt: 36.7,
      cervicalMucus: "creamy",
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: ["stress"],
      symptomIDs: ["cramps", "fatigue"],
      notes: "Session-only web note",
      weightKg: 65.44,
      bpSystolic: 119,
      bpDiastolic: 76,
    });
    await expect(
      storage.readDayLogSummary("2026-03-01", "2026-03-31"),
    ).resolves.toEqual({
      totalEntries: 1,
      hasData: true,
      dateFrom: "2026-03-18",
      dateTo: "2026-03-18",
    });
    await expect(storage.listSymptomRecords()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cramps",
          isDefault: true,
        }),
      ]),
    );
  });

  it("leaves pregnancy metrics absent for a day log written without them", async () => {
    // Volatile web storage has no durable persistence to hold a "legacy"
    // snapshot (state resets every session by design — see
    // security-constitution.md on web preview never being durable secure
    // storage for health data). The relevant guarantee here is narrower:
    // omitting the fields on write must not default them to a sentinel.
    const storage = createVolatileWebAppStorage();

    await storage.writeDayLogRecord({
      date: "2026-03-19",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none",
      mood: 0,
      sexActivity: "none",
      bbt: 0,
      cervicalMucus: "none",
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "No pregnancy metrics today",
    });

    const record = await storage.readDayLogRecord("2026-03-19");

    expect(record).toEqual(
      expect.objectContaining({
        date: "2026-03-19",
        notes: "No pregnancy metrics today",
      }),
    );
    expect(record).not.toHaveProperty("weightKg");
    expect(record).not.toHaveProperty("bpSystolic");
    expect(record).not.toHaveProperty("bpDiastolic");
  });

  it("does not persist sensitive health data across a new web app instance", async () => {
    const firstSession = createVolatileWebAppStorage();

    await firstSession.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    });
    await firstSession.writeDayLogRecord({
      date: "2026-03-18",
      isPeriod: true,
      cycleStart: false,
      isUncertain: false,
      flow: "medium",
      mood: 4,
      sexActivity: "unprotected",
      bbt: 36.8,
      cervicalMucus: "eggwhite",
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: ["travel"],
      symptomIDs: ["fatigue"],
      notes: "Should not survive a reload",
    });

    const nextSession = createVolatileWebAppStorage();

    await expect(nextSession.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: false,
      profileVersion: 2,
      incompleteOnboardingStep: 1,
    });
    await expect(nextSession.readDayLogRecord("2026-03-18")).resolves.toEqual({
      date: "2026-03-18",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none",
      mood: 0,
      sexActivity: "none",
      bbt: 0,
      cervicalMucus: "none",
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    });
  });

  it("keeps custom symptoms only for the current web session", async () => {
    const firstSession = createVolatileWebAppStorage();

    await firstSession.writeSymptomRecord({
      id: "custom_jaw_pain",
      slug: "jaw-pain",
      label: "Jaw pain",
      icon: "🔥",
      color: "#E8799F",
      isArchived: false,
      sortOrder: 999,
      isDefault: false,
    });

    await expect(firstSession.listSymptomRecords()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "custom_jaw_pain",
          label: "Jaw pain",
        }),
      ]),
    );

    const nextSession = createVolatileWebAppStorage();

    await expect(nextSession.listSymptomRecords()).resolves.not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "custom_jaw_pain",
        }),
      ]),
    );
  });

  it("normalizes legacy ageGroup values to unspecified on profile read", async () => {
    const storage = createVolatileWebAppStorage();

    // Simulate a profile stored with the pre-medical-audit bucket values.
    await storage.writeProfileRecord({
      ...createDefaultProfileRecord(),
      ageGroup: "age_35_plus" as unknown as "",
    });

    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({ ageGroup: "" }),
    );

    await storage.writeProfileRecord({
      ...createDefaultProfileRecord(),
      ageGroup: "age_20_35" as unknown as "",
    });
    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({ ageGroup: "" }),
    );

    await storage.writeProfileRecord({
      ...createDefaultProfileRecord(),
      ageGroup: "under_20" as unknown as "",
    });
    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({ ageGroup: "" }),
    );
  });

  it("clears in-memory web state explicitly when the danger flow requests it", async () => {
    const storage = createVolatileWebAppStorage();

    await storage.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    });
    await storage.writeDayLogRecord({
      date: "2026-03-18",
      isPeriod: true,
      cycleStart: false,
      isUncertain: false,
      flow: "medium",
      mood: 4,
      sexActivity: "unprotected",
      bbt: 36.8,
      cervicalMucus: "eggwhite",
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: ["travel"],
      symptomIDs: ["fatigue"],
      notes: "Explicitly wiped",
    });

    await storage.clearAllLocalData();

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: false,
      profileVersion: 2,
      incompleteOnboardingStep: 1,
    });
    await expect(storage.readDayLogSummary()).resolves.toEqual({
      totalEntries: 0,
      hasData: false,
      dateFrom: null,
      dateTo: null,
    });
  });

  it("keeps pregnancy records, kick sessions, and contraction sessions for the current session", async () => {
    const storage = createVolatileWebAppStorage();

    await storage.writePregnancyRecord({
      id: "pregnancy_1",
      status: "active",
      edd: "2026-08-15",
      eddBasis: "ultrasound",
      lmpDate: "2025-11-08",
      schedulePreset: "who2016",
      startedAt: "2025-11-10",
      endedAt: null,
      endReason: null,
      modeOfDelivery: null,
    });

    await expect(storage.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({ id: "pregnancy_1", status: "active" }),
    );
    await expect(storage.listPregnancyRecords()).resolves.toHaveLength(1);

    await storage.writeKickSession({
      id: "kick_a",
      date: "2026-07-10",
      durationMinutes: 60,
      kickCount: 8,
    });
    await storage.writeKickSession({
      id: "kick_b",
      date: "2026-07-25",
      durationMinutes: 45,
      kickCount: 11,
    });
    await expect(
      storage.listKickSessions("2026-07-20", "2026-07-31"),
    ).resolves.toEqual([expect.objectContaining({ id: "kick_b" })]);

    await storage.writeContractionSession({
      id: "contraction_1",
      date: "2026-08-10",
      startedAt: "2026-08-10T14:30:00.000Z",
      contractions: [
        { startedAt: "2026-08-10T14:30:00.000Z", durationSeconds: 40 },
      ],
    });
    await expect(storage.listContractionSessions()).resolves.toEqual([
      expect.objectContaining({ id: "contraction_1" }),
    ]);

    await storage.deleteKickSession("kick_a");
    await expect(storage.listKickSessions()).resolves.toEqual([
      expect.objectContaining({ id: "kick_b" }),
    ]);
  });

  it("deleteAllPregnancyData clears every pregnancy collection but keeps other data", async () => {
    const storage = createVolatileWebAppStorage();

    // Non-pregnancy data (profile) stands witness that it is left intact.
    await storage.writeProfileRecord({
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-03-10",
    });

    await storage.writePregnancyRecord({
      id: "pregnancy_1",
      status: "active",
      edd: "2026-08-15",
      eddBasis: "ultrasound",
      lmpDate: "2025-11-08",
      schedulePreset: "who2016",
      startedAt: "2025-11-10",
      endedAt: null,
      endReason: null,
      modeOfDelivery: null,
    });
    await storage.writeKickSession({
      id: "kick_1",
      date: "2026-07-20",
      durationMinutes: 60,
      kickCount: 10,
    });
    await storage.writeContractionSession({
      id: "contraction_1",
      date: "2026-08-10",
      startedAt: "2026-08-10T14:30:00.000Z",
      contractions: [
        { startedAt: "2026-08-10T14:30:00.000Z", durationSeconds: 40 },
      ],
    });

    await storage.deleteAllPregnancyData();

    await expect(storage.readActivePregnancy()).resolves.toBeNull();
    await expect(storage.listPregnancyRecords()).resolves.toEqual([]);
    await expect(storage.listKickSessions()).resolves.toEqual([]);
    await expect(storage.listContractionSessions()).resolves.toEqual([]);

    // Profile (and everything outside the pregnancy collections) is untouched.
    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({ lastPeriodStart: "2026-03-10" }),
    );
  });

  it("enforces the at-most-one-active pregnancy invariant in the volatile web adapter", async () => {
    const storage = createVolatileWebAppStorage();

    await storage.writePregnancyRecord({
      id: "pregnancy_1",
      status: "active",
      edd: "2026-08-15",
      eddBasis: "lmp",
      lmpDate: null,
      schedulePreset: "who2016",
      startedAt: "2025-11-10",
      endedAt: null,
      endReason: null,
      modeOfDelivery: null,
    });

    await expect(
      storage.writePregnancyRecord({
        id: "pregnancy_2",
        status: "active",
        edd: "2026-09-15",
        eddBasis: "lmp",
        lmpDate: null,
        schedulePreset: "who2016",
        startedAt: "2025-12-10",
        endedAt: null,
        endReason: null,
        modeOfDelivery: null,
      }),
    ).rejects.toThrow("another pregnancy is already active");
  });

  it("does not persist pregnancy data across a new web app instance", async () => {
    const firstSession = createVolatileWebAppStorage();

    await firstSession.writePregnancyRecord({
      id: "pregnancy_1",
      status: "active",
      edd: "2026-08-15",
      eddBasis: "lmp",
      lmpDate: null,
      schedulePreset: "who2016",
      startedAt: "2025-11-10",
      endedAt: null,
      endReason: null,
      modeOfDelivery: null,
    });
    await firstSession.writeKickSession({
      id: "kick_1",
      date: "2026-07-20",
      durationMinutes: 60,
      kickCount: 10,
    });

    const nextSession = createVolatileWebAppStorage();

    await expect(nextSession.readActivePregnancy()).resolves.toBeNull();
    await expect(nextSession.listPregnancyRecords()).resolves.toEqual([]);
    await expect(nextSession.listKickSessions()).resolves.toEqual([]);
  });

  it("keeps postpartum records for the current session and enforces one-active", async () => {
    const storage = createVolatileWebAppStorage();

    await storage.writePostpartumRecord({
      id: "postpartum_1",
      status: "active",
      startedAt: "2026-06-01",
      modeOfDelivery: "cesarean",
      endedAt: null,
      endReason: null,
    });

    await expect(storage.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({ id: "postpartum_1", status: "active" }),
    );
    await expect(storage.listPostpartumRecords()).resolves.toHaveLength(1);

    await expect(
      storage.writePostpartumRecord({
        id: "postpartum_2",
        status: "active",
        startedAt: "2026-06-05",
        modeOfDelivery: null,
        endedAt: null,
        endReason: null,
      }),
    ).rejects.toThrow("another postpartum is already active");
  });

  it("deleteAllPostpartumData clears postpartum but keeps pregnancy + other data", async () => {
    const storage = createVolatileWebAppStorage();

    await storage.writeProfileRecord({
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-03-10",
    });
    await storage.writePregnancyRecord({
      id: "pregnancy_1",
      status: "ended",
      edd: "2026-06-05",
      eddBasis: "ultrasound",
      lmpDate: null,
      schedulePreset: "who2016",
      startedAt: "2025-09-01",
      endedAt: "2026-06-01",
      endReason: "birth",
      modeOfDelivery: "cesarean",
    });
    await storage.writePostpartumRecord({
      id: "postpartum_1",
      status: "active",
      startedAt: "2026-06-01",
      modeOfDelivery: "cesarean",
      endedAt: null,
      endReason: null,
    });

    await storage.deleteAllPostpartumData();

    await expect(storage.readActivePostpartum()).resolves.toBeNull();
    await expect(storage.listPostpartumRecords()).resolves.toEqual([]);

    // Pregnancy + profile are untouched.
    await expect(storage.listPregnancyRecords()).resolves.toHaveLength(1);
    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({ lastPeriodStart: "2026-03-10" }),
    );
  });

  it("does not persist postpartum data across a new web app instance", async () => {
    const firstSession = createVolatileWebAppStorage();

    await firstSession.writePostpartumRecord({
      id: "postpartum_1",
      status: "active",
      startedAt: "2026-06-01",
      modeOfDelivery: null,
      endedAt: null,
      endReason: null,
    });

    const nextSession = createVolatileWebAppStorage();

    await expect(nextSession.readActivePostpartum()).resolves.toBeNull();
    await expect(nextSession.listPostpartumRecords()).resolves.toEqual([]);
  });

  it("keeps screening responses for the session and hard-deletes them only via their own action", async () => {
    const storage = createVolatileWebAppStorage();

    await storage.writeScreeningResponse({
      id: "screening_b",
      date: "2026-07-01",
      instrument: "epds",
      answers: [1, 2, 0, 3, 1, 0, 2, 1, 0, 0],
      score: 10,
      selfHarmFlag: false,
    });
    await storage.writeScreeningResponse({
      id: "screening_a",
      date: "2026-07-01",
      instrument: "epds",
      answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      score: 0,
      selfHarmFlag: false,
    });
    await storage.writePostpartumRecord({
      id: "postpartum_1",
      status: "active",
      startedAt: "2026-06-01",
      modeOfDelivery: null,
      endedAt: null,
      endReason: null,
    });

    await storage.writeScreeningResponse({
      id: "screening_c",
      date: "2026-06-01",
      instrument: "epds",
      answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      score: 0,
      selfHarmFlag: false,
    });

    // Earlier day first; same-day responses order deterministically by id.
    await expect(storage.listScreeningResponses()).resolves.toEqual([
      expect.objectContaining({ id: "screening_c" }),
      expect.objectContaining({ id: "screening_a" }),
      expect.objectContaining({ id: "screening_b" }),
    ]);

    await storage.deleteAllScreeningData();

    await expect(storage.listScreeningResponses()).resolves.toEqual([]);
    // The postpartum record survives — separate sensitive class.
    await expect(storage.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({ id: "postpartum_1" }),
    );

    const nextSession = createVolatileWebAppStorage();
    await expect(nextSession.listScreeningResponses()).resolves.toEqual([]);
  });

  it("deletes kick and contraction sessions by id", async () => {
    const storage = createVolatileWebAppStorage();

    await storage.writeKickSession({
      id: "kick_1",
      date: "2026-07-10",
      durationMinutes: 60,
      kickCount: 8,
    });
    await storage.writeContractionSession({
      id: "contraction_1",
      date: "2026-08-10",
      startedAt: "2026-08-10T14:30:00.000Z",
      contractions: [],
    });

    await storage.deleteKickSession("kick_1");
    await storage.deleteContractionSession("contraction_1");

    await expect(storage.listKickSessions()).resolves.toEqual([]);
    await expect(storage.listContractionSessions()).resolves.toEqual([]);
  });

  it("allows updating the active record in place and starting a new one after an end", async () => {
    const storage = createVolatileWebAppStorage();

    const active = {
      id: "pregnancy_1",
      status: "active" as const,
      edd: "2026-08-15",
      eddBasis: "ultrasound" as const,
      lmpDate: null,
      schedulePreset: "who2016" as const,
      startedAt: "2025-11-10",
      endedAt: null,
      endReason: null,
      modeOfDelivery: null,
    };
    await storage.writePregnancyRecord(active);
    // Same id: an in-place update of the active record is not a conflict.
    await storage.writePregnancyRecord({ ...active, edd: "2026-08-20" });
    // End it, then a NEW active record is allowed.
    await storage.writePregnancyRecord({
      ...active,
      status: "ended",
      endedAt: "2026-08-20",
      endReason: "birth",
    });
    await storage.writePregnancyRecord({
      ...active,
      id: "pregnancy_2",
      startedAt: "2026-09-01",
    });
    await expect(storage.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({ id: "pregnancy_2" }),
    );

    const postpartum = {
      id: "postpartum_1",
      status: "active" as const,
      startedAt: "2026-06-01",
      modeOfDelivery: null,
      endedAt: null,
      endReason: null,
    };
    await storage.writePostpartumRecord(postpartum);
    await storage.writePostpartumRecord({ ...postpartum, modeOfDelivery: "vaginal" });
    await storage.writePostpartumRecord({
      ...postpartum,
      status: "ended",
      endedAt: "2026-07-15",
      endReason: "cycle_returned",
    });
    await storage.writePostpartumRecord({
      ...postpartum,
      id: "postpartum_2",
      startedAt: "2026-08-01",
    });
    await expect(storage.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({ id: "postpartum_2" }),
    );
  });

  it("rejects writes that fail sanitize instead of storing garbage", async () => {
    const storage = createVolatileWebAppStorage();

    await expect(
      storage.writePregnancyRecord({
        id: "  ",
        status: "active",
        edd: "2026-08-15",
        eddBasis: "ultrasound",
        lmpDate: null,
        schedulePreset: "who2016",
        startedAt: "2025-11-10",
        endedAt: null,
        endReason: null,
        modeOfDelivery: null,
      }),
    ).rejects.toThrow("writePregnancyRecord: record failed sanitize");
    await expect(
      storage.writeKickSession({
        id: "kick_1",
        date: "not-a-date",
        durationMinutes: 60,
        kickCount: 8,
      }),
    ).rejects.toThrow("writeKickSession: session failed sanitize");
    await expect(
      storage.writeContractionSession({
        id: "",
        date: "2026-08-10",
        startedAt: "2026-08-10T14:30:00.000Z",
        contractions: [],
      }),
    ).rejects.toThrow("writeContractionSession: session failed sanitize");
    await expect(
      storage.writePostpartumRecord({
        id: "postpartum_1",
        status: "active",
        startedAt: "not-a-date",
        modeOfDelivery: null,
        endedAt: null,
        endReason: null,
      }),
    ).rejects.toThrow("writePostpartumRecord: record failed sanitize");
    await expect(
      storage.writeScreeningResponse({
        id: "screening_1",
        date: "2026-07-01",
        instrument: "epds",
        answers: [1] as unknown as [number],
        score: 1,
        selfHarmFlag: false,
      }),
    ).rejects.toThrow("writeScreeningResponse: response failed sanitize");
  });

  it("orders lists by date with id as the tie-breaker and honors the upper range bound", async () => {
    const storage = createVolatileWebAppStorage();

    await storage.writePregnancyRecord({
      id: "pregnancy_b",
      status: "ended",
      edd: "2026-08-15",
      eddBasis: "ultrasound",
      lmpDate: null,
      schedulePreset: "who2016",
      startedAt: "2025-11-10",
      endedAt: "2026-08-01",
      endReason: "birth",
      modeOfDelivery: null,
    });
    await storage.writePregnancyRecord({
      id: "pregnancy_a",
      status: "ended",
      edd: "2026-08-15",
      eddBasis: "ultrasound",
      lmpDate: null,
      schedulePreset: "who2016",
      startedAt: "2025-11-10",
      endedAt: "2026-08-01",
      endReason: "birth",
      modeOfDelivery: null,
    });
    await storage.writePregnancyRecord({
      id: "pregnancy_c",
      status: "ended",
      edd: "2025-11-20",
      eddBasis: "ultrasound",
      lmpDate: null,
      schedulePreset: "who2016",
      startedAt: "2025-03-01",
      endedAt: "2025-11-20",
      endReason: "birth",
      modeOfDelivery: null,
    });
    await expect(storage.listPregnancyRecords()).resolves.toEqual([
      expect.objectContaining({ id: "pregnancy_c" }),
      expect.objectContaining({ id: "pregnancy_a" }),
      expect.objectContaining({ id: "pregnancy_b" }),
    ]);

    await storage.writePostpartumRecord({
      id: "postpartum_b",
      status: "ended",
      startedAt: "2026-06-01",
      modeOfDelivery: null,
      endedAt: "2026-07-15",
      endReason: "cycle_returned",
    });
    await storage.writePostpartumRecord({
      id: "postpartum_a",
      status: "ended",
      startedAt: "2026-06-01",
      modeOfDelivery: null,
      endedAt: "2026-07-15",
      endReason: "cycle_returned",
    });
    await storage.writePostpartumRecord({
      id: "postpartum_c",
      status: "ended",
      startedAt: "2025-01-10",
      modeOfDelivery: null,
      endedAt: "2025-03-01",
      endReason: "cycle_returned",
    });
    await expect(storage.listPostpartumRecords()).resolves.toEqual([
      expect.objectContaining({ id: "postpartum_c" }),
      expect.objectContaining({ id: "postpartum_a" }),
      expect.objectContaining({ id: "postpartum_b" }),
    ]);

    await storage.writeKickSession({
      id: "kick_b",
      date: "2026-07-10",
      durationMinutes: 60,
      kickCount: 8,
    });
    await storage.writeKickSession({
      id: "kick_a",
      date: "2026-07-10",
      durationMinutes: 45,
      kickCount: 11,
    });
    await storage.writeKickSession({
      id: "kick_c",
      date: "2026-06-15",
      durationMinutes: 30,
      kickCount: 10,
    });
    await expect(storage.listKickSessions()).resolves.toEqual([
      expect.objectContaining({ id: "kick_c" }),
      expect.objectContaining({ id: "kick_a" }),
      expect.objectContaining({ id: "kick_b" }),
    ]);
    // The upper range bound filters the July sessions, keeping the June one.
    await expect(
      storage.listKickSessions(undefined, "2026-07-05"),
    ).resolves.toEqual([expect.objectContaining({ id: "kick_c" })]);

    await storage.writeContractionSession({
      id: "contraction_b",
      date: "2026-08-10",
      startedAt: "2026-08-10T14:30:00.000Z",
      contractions: [],
    });
    await storage.writeContractionSession({
      id: "contraction_a",
      date: "2026-08-10",
      startedAt: "2026-08-10T15:30:00.000Z",
      contractions: [],
    });
    await expect(storage.listContractionSessions()).resolves.toEqual([
      expect.objectContaining({ id: "contraction_a" }),
      expect.objectContaining({ id: "contraction_b" }),
    ]);
  });
});
