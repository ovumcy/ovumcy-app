import AsyncStorage from "@react-native-async-storage/async-storage";

import { createEmptyDayLogRecord } from "../../models/day-log";
import { createDefaultProfileRecord } from "../../models/profile";
import { createDefaultSyncPreferencesRecord } from "../../sync/sync-contract";
import {
  createAsyncStorageAppStorage,
  DAY_LOG_RECORDS_KEY,
  hasAsyncStorageLocalAppData,
  ONBOARDING_RECORD_KEY,
  PROFILE_RECORD_KEY,
  SYMPTOM_RECORDS_KEY,
} from "./async-storage-app-storage";

describe("async-storage-app-storage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("returns defaults when no local onboarding state exists", async () => {
    const storage = createAsyncStorageAppStorage();

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: false,
      profileVersion: 2,
      incompleteOnboardingStep: 1,
    });
    await expect(storage.readProfileRecord()).resolves.toEqual(
      createDefaultProfileRecord(),
    );
    await expect(storage.readOnboardingRecord()).resolves.toEqual({
      lastPeriodStart: null,
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
    });
    await expect(storage.readDayLogRecord("2026-03-17")).resolves.toEqual({
      date: "2026-03-17",
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
    await expect(storage.listSymptomRecords()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cramps",
          isDefault: true,
        }),
      ]),
    );
  });

  it("persists bootstrap state and onboarding record locally", async () => {
    const storage = createAsyncStorageAppStorage();

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
    await expect(storage.readOnboardingRecord()).resolves.toEqual({
      lastPeriodStart: "2026-03-14",
      cycleLength: 30,
      periodLength: 6,
      autoPeriodFill: true,
      irregularCycle: true,
      unpredictableCycle: false,
      ageGroup: "age_45_plus",
      usageGoal: "trying_to_conceive",
    });
  });

  it("persists canonical day logs in the legacy async-storage adapter", async () => {
    const storage = createAsyncStorageAppStorage();

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
      notes: "Web fallback note",
      weightKg: 65.436,
      bpSystolic: 118.6,
      bpDiastolic: 76.2,
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
      notes: "Web fallback note",
      weightKg: 65.44,
      bpSystolic: 119,
      bpDiastolic: 76,
    });

    await expect(
      storage.listDayLogRecordsInRange("2026-03-01", "2026-03-31"),
    ).resolves.toEqual([
      expect.objectContaining({
        date: "2026-03-18",
        isPeriod: true,
        weightKg: 65.44,
        bpSystolic: 119,
        bpDiastolic: 76,
      }),
    ]);
    await expect(
      storage.readDayLogSummary("2026-03-01", "2026-03-31"),
    ).resolves.toEqual({
      totalEntries: 1,
      hasData: true,
      dateFrom: "2026-03-18",
      dateTo: "2026-03-18",
    });
  });

  it("loads a legacy day-log JSON blob predating pregnancy metrics with those fields left undefined", async () => {
    const storage = createAsyncStorageAppStorage();
    await AsyncStorage.setItem(
      DAY_LOG_RECORDS_KEY,
      JSON.stringify({
        "2026-03-19": {
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
          notes: "Pre-pregnancy-mode entry",
          // weightKg / bpSystolic / bpDiastolic intentionally absent — this
          // simulates an app-version JSON blob written before this feature
          // existed.
        },
      }),
    );

    const record = await storage.readDayLogRecord("2026-03-19");

    expect(record).toEqual(
      expect.objectContaining({
        date: "2026-03-19",
        notes: "Pre-pregnancy-mode entry",
      }),
    );
    expect(record).not.toHaveProperty("weightKg");
    expect(record).not.toHaveProperty("bpSystolic");
    expect(record).not.toHaveProperty("bpDiastolic");
  });

  it("persists custom symptom records in the async-storage adapter", async () => {
    const storage = createAsyncStorageAppStorage();

    await storage.writeSymptomRecord({
      id: "custom_jaw_pain",
      slug: "jaw-pain",
      label: "Jaw pain",
      icon: "🔥",
      color: "#E8799F",
      isArchived: false,
      sortOrder: 999,
      isDefault: false,
    });

    await expect(storage.listSymptomRecords()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "custom_jaw_pain",
          label: "Jaw pain",
          icon: "🔥",
          isArchived: false,
        }),
      ]),
    );
  });

  it("normalizes legacy ageGroup values to unspecified on profile read", async () => {
    const storage = createAsyncStorageAppStorage();

    await AsyncStorage.setItem(
      "ovumcy/profile-record",
      JSON.stringify({
        ...createDefaultProfileRecord(),
        ageGroup: "age_35_plus",
      }),
    );
    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({ ageGroup: "" }),
    );

    await AsyncStorage.setItem(
      "ovumcy/profile-record",
      JSON.stringify({
        ...createDefaultProfileRecord(),
        ageGroup: "age_20_35",
      }),
    );
    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({ ageGroup: "" }),
    );

    await AsyncStorage.setItem(
      "ovumcy/profile-record",
      JSON.stringify({
        ...createDefaultProfileRecord(),
        ageGroup: "under_20",
      }),
    );
    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({ ageGroup: "" }),
    );
  });

  it("clears local async-storage data and falls back to defaults", async () => {
    const storage = createAsyncStorageAppStorage();

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
      notes: "Clear me",
    });

    await storage.clearAllLocalData();

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: false,
      profileVersion: 2,
      incompleteOnboardingStep: 1,
    });
    await expect(storage.readProfileRecord()).resolves.toEqual(
      createDefaultProfileRecord(),
    );
    await expect(storage.readDayLogSummary()).resolves.toEqual({
      totalEntries: 0,
      hasData: false,
      dateFrom: null,
      dateTo: null,
    });
  });

  it("round-trips sync preferences through the legacy async-storage adapter", async () => {
    const storage = createAsyncStorageAppStorage();

    await expect(storage.readSyncPreferencesRecord()).resolves.toEqual(
      createDefaultSyncPreferencesRecord(),
    );

    await storage.writeSyncPreferencesRecord({
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted",
      endpointInput: "192.168.1.20:8080",
      deviceLabel: "Pixel 7",
      setupStatus: "connected",
    });

    await expect(storage.readSyncPreferencesRecord()).resolves.toEqual(
      expect.objectContaining({
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
      }),
    );
  });

  it("deletes a day log record from the legacy async-storage adapter", async () => {
    const storage = createAsyncStorageAppStorage();
    await storage.writeDayLogRecord({
      ...createEmptyDayLogRecord("2026-03-18"),
      isPeriod: true,
      notes: "delete me",
    });

    await storage.deleteDayLogRecord("2026-03-18");

    await expect(
      storage.listDayLogRecordsInRange("2026-03-01", "2026-03-31"),
    ).resolves.toEqual([]);
  });

  it("returns an inert default managed-billing cache and treats writes as a no-op", async () => {
    // The legacy AsyncStorage adapter deliberately never caches managed
    // billing state in a plaintext store (see SECURITY.md); the active
    // backends (encrypted SQLite, volatile web) carry the real cache.
    const storage = createAsyncStorageAppStorage();

    await storage.writeManagedBillingCacheRecord({
      snapshot: {
        hasActivePlan: true,
        premiumFeatures: {
          advancedFertility: true,
          advancedInsights: true,
          doctorPDF: true,
          extendedReports: true,
          partnerAccess: true,
          reminders: true,
        },
        fetchedAt: "2026-03-18T00:00:00.000Z",
      },
      dismissedOfferIDs: ["winback_2026"],
    });

    await expect(storage.readManagedBillingCacheRecord()).resolves.toEqual({
      snapshot: null,
      dismissedOfferIDs: [],
    });
  });

  it("migrates a legacy onboarding-only record into the canonical profile on first read", async () => {
    // Before the canonical profile-record key existed, onboarding state
    // lived under ONBOARDING_RECORD_KEY alone. readProfileRecord must
    // recognize that one-time shape and fold it into a full ProfileRecord
    // rather than silently dropping the pre-migration data.
    await AsyncStorage.setItem(
      ONBOARDING_RECORD_KEY,
      JSON.stringify({
        lastPeriodStart: "2026-02-01",
        cycleLength: 27,
        periodLength: 4,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "age_20_35",
        usageGoal: "avoid_pregnancy",
      }),
    );

    const storage = createAsyncStorageAppStorage();

    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({
        lastPeriodStart: "2026-02-01",
        cycleLength: 27,
        periodLength: 4,
        usageGoal: "avoid_pregnancy",
      }),
    );
  });

  it("reports whether any legacy local data is present", async () => {
    await expect(hasAsyncStorageLocalAppData()).resolves.toBe(false);

    await AsyncStorage.setItem(
      PROFILE_RECORD_KEY,
      JSON.stringify(createDefaultProfileRecord()),
    );

    await expect(hasAsyncStorageLocalAppData()).resolves.toBe(true);
  });

  it("falls back to defaults when a stored record is corrupted JSON", async () => {
    // safeParse must never let a corrupted legacy value throw out of the
    // storage layer; it degrades to defaults exactly like a missing key.
    await AsyncStorage.setItem(PROFILE_RECORD_KEY, "{not valid json");

    const storage = createAsyncStorageAppStorage();

    await expect(storage.readProfileRecord()).resolves.toEqual(
      createDefaultProfileRecord(),
    );
  });

  it("falls back to default symptoms when the stored record is not an array", async () => {
    await AsyncStorage.setItem(SYMPTOM_RECORDS_KEY, JSON.stringify({}));

    const storage = createAsyncStorageAppStorage();

    await expect(storage.listSymptomRecords()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cramps", isDefault: true }),
      ]),
    );
  });

  // NOTE: the pregnancy repository tests are placed BEFORE the "overwrites
  // legacy plaintext keys" test on purpose. That test spies on
  // `AsyncStorage.multiSet` and calls `mockRestore()`; because the jest-expo
  // AsyncStorage mock implements `setItem` on top of `multiSet`, the restore
  // strips `multiSet`'s implementation and leaves `setItem` a no-op for every
  // later test in the file — so any write-then-read test must run ahead of it.
  it("persists and lists pregnancy records, kick sessions, and contraction sessions", async () => {
    const storage = createAsyncStorageAppStorage();

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
      expect.objectContaining({
        id: "pregnancy_1",
        status: "active",
        edd: "2026-08-15",
      }),
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

    await expect(storage.listKickSessions()).resolves.toEqual([
      expect.objectContaining({ id: "kick_a" }),
      expect.objectContaining({ id: "kick_b" }),
    ]);
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
    await expect(
      storage.listContractionSessions("2026-08-01", "2026-08-31"),
    ).resolves.toEqual([expect.objectContaining({ id: "contraction_1" })]);

    await storage.deleteKickSession("kick_a");
    await expect(storage.listKickSessions()).resolves.toEqual([
      expect.objectContaining({ id: "kick_b" }),
    ]);
    await storage.deleteContractionSession("contraction_1");
    await expect(storage.listContractionSessions()).resolves.toEqual([]);
  });

  it("enforces the at-most-one-active pregnancy invariant in the async-storage adapter", async () => {
    const storage = createAsyncStorageAppStorage();

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

    // Updating the SAME active record still succeeds.
    await expect(
      storage.writePregnancyRecord({
        id: "pregnancy_1",
        status: "active",
        edd: "2026-08-20",
        eddBasis: "lmp",
        lmpDate: null,
        schedulePreset: "who2016",
        startedAt: "2025-11-10",
        endedAt: null,
        endReason: null,
        modeOfDelivery: null,
      }),
    ).resolves.toBeUndefined();
  });

  it("clears pregnancy data on destructive local reset", async () => {
    const storage = createAsyncStorageAppStorage();

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
    await storage.writeKickSession({
      id: "kick_1",
      date: "2026-07-20",
      durationMinutes: 60,
      kickCount: 10,
    });

    await storage.clearAllLocalData();

    await expect(storage.readActivePregnancy()).resolves.toBeNull();
    await expect(storage.listPregnancyRecords()).resolves.toEqual([]);
    await expect(storage.listKickSessions()).resolves.toEqual([]);
  });

  // Postpartum repository tests, placed (like the pregnancy ones) BEFORE the
  // spy-then-mockRestore tests below: restoring the AsyncStorage multiSet spy
  // strips the jest-expo setItem implementation for every later test, so any
  // write-then-read test must run ahead of the first restore.
  it("persists and lists postpartum records", async () => {
    const storage = createAsyncStorageAppStorage();

    await storage.writePostpartumRecord({
      id: "postpartum_1",
      status: "active",
      startedAt: "2026-06-01",
      modeOfDelivery: "cesarean",
      endedAt: null,
      endReason: null,
    });

    await expect(storage.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({
        id: "postpartum_1",
        status: "active",
        modeOfDelivery: "cesarean",
      }),
    );
    await expect(storage.listPostpartumRecords()).resolves.toHaveLength(1);
  });

  it("enforces the at-most-one-active postpartum invariant in the async-storage adapter", async () => {
    const storage = createAsyncStorageAppStorage();

    await storage.writePostpartumRecord({
      id: "postpartum_1",
      status: "active",
      startedAt: "2026-06-01",
      modeOfDelivery: null,
      endedAt: null,
      endReason: null,
    });

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

    // Updating the SAME active record still succeeds.
    await expect(
      storage.writePostpartumRecord({
        id: "postpartum_1",
        status: "active",
        startedAt: "2026-06-01",
        modeOfDelivery: "vaginal",
        endedAt: null,
        endReason: null,
      }),
    ).resolves.toBeUndefined();
  });

  it("clears postpartum data on destructive local reset", async () => {
    const storage = createAsyncStorageAppStorage();

    await storage.writePostpartumRecord({
      id: "postpartum_1",
      status: "active",
      startedAt: "2026-06-01",
      modeOfDelivery: null,
      endedAt: null,
      endReason: null,
    });

    await storage.clearAllLocalData();

    await expect(storage.readActivePostpartum()).resolves.toBeNull();
    await expect(storage.listPostpartumRecords()).resolves.toEqual([]);
  });

  it("deleteAllPostpartumData clears postpartum but leaves pregnancy + day-log intact", async () => {
    const storage = createAsyncStorageAppStorage();

    await storage.writeDayLogRecord({
      date: "2026-03-18",
      isPeriod: true,
      cycleStart: true,
      isUncertain: false,
      flow: "medium",
      mood: 4,
      sexActivity: "protected",
      bbt: 36.7,
      cervicalMucus: "creamy",
      lhTest: "none",
      pregnancyTest: "positive",
      cycleFactorKeys: ["stress"],
      symptomIDs: ["cramps"],
      notes: "cycle data survives",
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

    // Pregnancy + day-log data (its own delete action) is untouched — postpartum
    // and pregnancy data are deleted independently. The overwrite-before-remove
    // forensic scrub is the same shared multiSet/multiRemove mechanism proven by
    // the pregnancy delete test below (clearAsyncStoragePostpartumData reuses it).
    await expect(storage.listPregnancyRecords()).resolves.toHaveLength(1);
    await expect(storage.readDayLogRecord("2026-03-18")).resolves.toEqual(
      expect.objectContaining({ date: "2026-03-18", isPeriod: true }),
    );
  });

  it("persists screening responses and hard-deletes them via their own scrubbed action", async () => {
    const storage = createAsyncStorageAppStorage();

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
    await expect(
      AsyncStorage.getItem("ovumcy/screening-responses"),
    ).resolves.toBeNull();
    // The postpartum record survives — separate sensitive class.
    await expect(storage.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({ id: "postpartum_1" }),
    );

    await AsyncStorage.clear();
  });

  it("rejects writes that fail sanitize in the legacy adapter", async () => {
    const storage = createAsyncStorageAppStorage();

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

    await AsyncStorage.clear();
  });

  it("orders lists by date with id as the tie-breaker and honors the upper range bound", async () => {
    const storage = createAsyncStorageAppStorage();

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
    await expect(storage.listKickSessions()).resolves.toEqual([
      expect.objectContaining({ id: "kick_a" }),
      expect.objectContaining({ id: "kick_b" }),
    ]);
    await expect(
      storage.listKickSessions(undefined, "2026-07-05"),
    ).resolves.toEqual([]);

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

    await AsyncStorage.clear();
  });

  it("deleteAllPregnancyData clears the pregnancy keys, scrubs them first, and leaves other keys intact", async () => {
    const storage = createAsyncStorageAppStorage();

    await storage.writeDayLogRecord({
      date: "2026-03-18",
      isPeriod: true,
      cycleStart: true,
      isUncertain: false,
      flow: "medium",
      mood: 4,
      sexActivity: "protected",
      bbt: 36.7,
      cervicalMucus: "creamy",
      lhTest: "none",
      pregnancyTest: "positive",
      cycleFactorKeys: ["stress"],
      symptomIDs: ["cramps"],
      notes: "cycle data survives",
    });
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

    const multiSetSpy = jest.spyOn(AsyncStorage, "multiSet");
    const multiRemoveSpy = jest.spyOn(AsyncStorage, "multiRemove");
    multiSetSpy.mockClear();
    multiRemoveSpy.mockClear();

    await storage.deleteAllPregnancyData();

    // All three pregnancy collections are empty.
    await expect(storage.readActivePregnancy()).resolves.toBeNull();
    await expect(storage.listPregnancyRecords()).resolves.toEqual([]);
    await expect(storage.listKickSessions()).resolves.toEqual([]);
    await expect(storage.listContractionSessions()).resolves.toEqual([]);

    // The day log (and every other key) is untouched.
    await expect(storage.readDayLogRecord("2026-03-18")).resolves.toEqual(
      expect.objectContaining({ date: "2026-03-18", isPeriod: true }),
    );

    // Overwrite-before-remove forensic scrub, targeting ONLY the three
    // pregnancy keys — the day-log key is never removed.
    expect(multiSetSpy.mock.invocationCallOrder[0]).toBeLessThan(
      multiRemoveSpy.mock.invocationCallOrder[0]!,
    );
    const removedKeys = multiRemoveSpy.mock.calls.flatMap((call) => call[0]);
    expect([...removedKeys].sort()).toEqual(
      [
        "ovumcy/contraction-sessions",
        "ovumcy/kick-sessions",
        "ovumcy/pregnancy-records",
      ].sort(),
    );
    expect(removedKeys).not.toContain("ovumcy/day-log-records");

    multiSetSpy.mockRestore();
    multiRemoveSpy.mockRestore();
  });

  // NOTE: keep this test last in the file. jest.spyOn(AsyncStorage, "multiSet")
  // below spies on a method that the official async-storage jest mock already
  // exposes as a jest.fn(); mockRestore() on a spy layered over a pre-existing
  // jest.fn() resets it to a bare no-op mock rather than the real
  // implementation (a quirk of that mock package, not of this repo's code),
  // which would silently break every AsyncStorage write in any test that runs
  // afterward. Confirmed by isolated repro against the same mock package.
  it("overwrites legacy plaintext keys before removing them", async () => {
    // Purge-hardening for #57: `multiRemove` alone unlinks keys but leaves the
    // old plaintext in the store's freed pages. The clear path first overwrites
    // each key with an inert filler (no health data, no secrets), then removes
    // it — so the residue exposed to forensic recovery is filler, not the
    // original health data. Assert the overwrite runs before the removal and
    // that the values written back carry none of the original record content.
    const storage = createAsyncStorageAppStorage();

    await storage.writeProfileRecord({
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-03-14",
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
      symptomIDs: ["cramps"],
      notes: "forensic residue check",
    });

    const multiSetSpy = jest.spyOn(AsyncStorage, "multiSet");
    const multiRemoveSpy = jest.spyOn(AsyncStorage, "multiRemove");
    // Ignore any writes the setup performed; only observe the clear path.
    multiSetSpy.mockClear();
    multiRemoveSpy.mockClear();

    await storage.clearAllLocalData();

    // Overwrite happened, and before the removal.
    expect(multiSetSpy).toHaveBeenCalled();
    expect(multiRemoveSpy).toHaveBeenCalled();
    expect(multiSetSpy.mock.invocationCallOrder[0]).toBeLessThan(
      multiRemoveSpy.mock.invocationCallOrder[0]!,
    );

    // The clear path overwrites every legacy key with inert filler that
    // carries none of the original record content.
    const overwritePairs = multiSetSpy.mock.calls.flatMap((call) => call[0]);
    const overwrittenKeys = overwritePairs.map(([key]) => key);
    expect(overwrittenKeys).toEqual(
      expect.arrayContaining([
        "ovumcy/profile-record",
        "ovumcy/day-log-records",
      ]),
    );
    for (const [, value] of overwritePairs) {
      expect(value).not.toContain("2026-03-14");
      expect(value).not.toContain("forensic residue check");
      expect(value).not.toContain("spotting");
    }

    multiSetSpy.mockRestore();
    multiRemoveSpy.mockRestore();
  });
});
