import AsyncStorage from "@react-native-async-storage/async-storage";

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
    });
    await expect(storage.readProfileRecord()).resolves.toEqual({
      lastPeriodStart: null,
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: false,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
    });
    await expect(storage.readOnboardingRecord()).resolves.toEqual({
      lastPeriodStart: null,
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      ageGroup: "",
      usageGoal: "health",
    });
  });

  it("persists bootstrap state and onboarding record locally", async () => {
    const storage = createAsyncStorageAppStorage();

    await storage.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
    });
    await storage.writeOnboardingRecord({
      lastPeriodStart: "2026-03-14",
      cycleLength: 30,
      periodLength: 6,
      autoPeriodFill: true,
      irregularCycle: true,
      ageGroup: "age_35_plus",
      usageGoal: "trying_to_conceive",
    });

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: true,
      profileVersion: 2,
    });
    await expect(storage.readProfileRecord()).resolves.toEqual({
      lastPeriodStart: "2026-03-14",
      cycleLength: 30,
      periodLength: 6,
      autoPeriodFill: true,
      irregularCycle: true,
      unpredictableCycle: false,
      ageGroup: "age_35_plus",
      usageGoal: "trying_to_conceive",
      trackBBT: false,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
    });
    await expect(storage.readOnboardingRecord()).resolves.toEqual({
      lastPeriodStart: "2026-03-14",
      cycleLength: 30,
      periodLength: 6,
      autoPeriodFill: true,
      irregularCycle: true,
      ageGroup: "age_35_plus",
      usageGoal: "trying_to_conceive",
    });
  });
});
