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
});
