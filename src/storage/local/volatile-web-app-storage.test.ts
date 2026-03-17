import { createVolatileWebAppStorage } from "./volatile-web-app-storage";

describe("volatile-web-app-storage", () => {
  it("keeps health data only for the current app session", async () => {
    const storage = createVolatileWebAppStorage();

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
      cycleFactorKeys: ["stress"],
      symptomIDs: ["cramps", "fatigue"],
      notes: "Session-only web note",
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
      cycleFactorKeys: ["stress"],
      symptomIDs: ["cramps", "fatigue"],
      notes: "Session-only web note",
    });
  });

  it("does not persist sensitive health data across a new web app instance", async () => {
    const firstSession = createVolatileWebAppStorage();

    await firstSession.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
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
      cycleFactorKeys: ["travel"],
      symptomIDs: ["fatigue"],
      notes: "Should not survive a reload",
    });

    const nextSession = createVolatileWebAppStorage();

    await expect(nextSession.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: false,
      profileVersion: 2,
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
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    });
  });
});
