import AsyncStorage from "@react-native-async-storage/async-storage";

import { createDefaultProfileRecord } from "../../models/profile";
import { createAsyncStorageAppStorage } from "./async-storage-app-storage";

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
    });

    await expect(
      storage.listDayLogRecordsInRange("2026-03-01", "2026-03-31"),
    ).resolves.toEqual([
      expect.objectContaining({
        date: "2026-03-18",
        isPeriod: true,
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
