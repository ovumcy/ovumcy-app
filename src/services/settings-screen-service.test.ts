import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  loadSettingsScreenState,
  saveCycleSettings,
  saveTrackingSettings,
} from "./settings-screen-service";

function createStorageMock(overrides?: Partial<LocalAppStorage>): LocalAppStorage {
  return {
    readBootstrapState: jest.fn().mockResolvedValue({
      hasCompletedOnboarding: true,
      profileVersion: 2,
    }),
    writeBootstrapState: jest.fn().mockResolvedValue(undefined),
    readProfileRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-03-10",
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
    }),
    writeProfileRecord: jest.fn().mockResolvedValue(undefined),
    readOnboardingRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-03-10",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      ageGroup: "",
      usageGoal: "health",
    }),
    writeOnboardingRecord: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("settings-screen-service", () => {
  it("loads canonical profile state and resolves the default age-group selection like the web app", async () => {
    const storage = createStorageMock();

    await expect(loadSettingsScreenState(storage)).resolves.toEqual({
      profile: expect.objectContaining({
        ageGroup: "",
        trackBBT: false,
      }),
      cycleValues: expect.objectContaining({
        ageGroup: "age_20_35",
        autoPeriodFill: true,
      }),
      trackingValues: expect.objectContaining({
        temperatureUnit: "c",
      }),
    });
  });

  it("validates and persists cycle settings through the canonical profile repository", async () => {
    const storage = createStorageMock();

    const result = await saveCycleSettings(
      storage,
      await storage.readProfileRecord(),
      {
        lastPeriodStart: "2026-03-16",
        cycleLength: 21,
        periodLength: 20,
        autoPeriodFill: true,
        irregularCycle: true,
        unpredictableCycle: true,
        ageGroup: "age_35_plus",
        usageGoal: "trying_to_conceive",
      },
      new Date(2026, 2, 17),
    );

    expect(result).toEqual({
      ok: true,
      state: expect.objectContaining({
        profile: expect.objectContaining({
          cycleLength: 21,
          periodLength: 11,
          unpredictableCycle: true,
          ageGroup: "age_35_plus",
          usageGoal: "trying_to_conceive",
        }),
      }),
    });
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        lastPeriodStart: "2026-03-16",
        cycleLength: 21,
        periodLength: 11,
        irregularCycle: true,
        unpredictableCycle: true,
      }),
    );
  });

  it("rejects out-of-range cycle start dates", async () => {
    const storage = createStorageMock();

    await expect(
      saveCycleSettings(
        storage,
        await storage.readProfileRecord(),
        {
          lastPeriodStart: "2025-12-31",
          cycleLength: 28,
          periodLength: 5,
          autoPeriodFill: true,
          irregularCycle: false,
          unpredictableCycle: false,
          ageGroup: "age_20_35",
          usageGoal: "health",
        },
        new Date(2026, 2, 17),
      ),
    ).resolves.toEqual({
      ok: false,
      errorCode: "invalid_last_period_start",
    });
  });

  it("normalizes tracking settings before persisting", async () => {
    const storage = createStorageMock();

    const result = await saveTrackingSettings(
      storage,
      await storage.readProfileRecord(),
      {
        trackBBT: true,
        temperatureUnit: "F" as "f",
        trackCervicalMucus: true,
        hideSexChip: true,
      },
    );

    expect(result).toEqual({
      ok: true,
      state: expect.objectContaining({
        profile: expect.objectContaining({
          trackBBT: true,
          temperatureUnit: "f",
          trackCervicalMucus: true,
          hideSexChip: true,
        }),
      }),
    });
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        temperatureUnit: "f",
      }),
    );
  });
});
