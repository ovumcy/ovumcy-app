import {
  createSQLiteAppStorage,
  type LocalAppDatabase,
} from "./sqlite-app-storage";

type FakeDatabaseState = {
  bootstrapRow: {
    has_completed_onboarding: number;
    profile_version: number;
  } | null;
  onboardingRow: {
    last_period_start: string | null;
    cycle_length: number;
    period_length: number;
    auto_period_fill: number;
    irregular_cycle: number;
    age_group: string;
    usage_goal: string;
  } | null;
  userVersion: number;
};

function createFakeDatabase(state?: Partial<FakeDatabaseState>): LocalAppDatabase {
  const databaseState: FakeDatabaseState = {
    bootstrapRow: null,
    onboardingRow: null,
    userVersion: 0,
    ...state,
  };

  return {
    async execAsync(source: string) {
      if (source.startsWith("PRAGMA user_version =")) {
        databaseState.userVersion = Number(source.replace(/\D/g, ""));
      }
    },

    async getFirstAsync<T>(source: string): Promise<T | null> {
      if (source === "PRAGMA user_version;") {
        return { user_version: databaseState.userVersion } as T;
      }

      if (source.includes("COUNT(*) AS count FROM bootstrap_state")) {
        return { count: databaseState.bootstrapRow ? 1 : 0 } as T;
      }

      if (source.includes("COUNT(*) AS count FROM onboarding_profile")) {
        return { count: databaseState.onboardingRow ? 1 : 0 } as T;
      }

      if (source.includes("FROM bootstrap_state WHERE id = 1")) {
        return (databaseState.bootstrapRow as T) ?? null;
      }

      if (source.includes("FROM onboarding_profile")) {
        return (databaseState.onboardingRow as T) ?? null;
      }

      return null;
    },

    async runAsync(source: string, ...params: unknown[]) {
      if (source.includes("INSERT INTO bootstrap_state")) {
        databaseState.bootstrapRow = {
          has_completed_onboarding: Number(params[0]),
          profile_version: Number(params[1]),
        };
      }

      if (source.includes("INSERT INTO onboarding_profile")) {
        databaseState.onboardingRow = {
          last_period_start: (params[0] as string | null) ?? null,
          cycle_length: Number(params[1]),
          period_length: Number(params[2]),
          auto_period_fill: Number(params[3]),
          irregular_cycle: Number(params[4]),
          age_group: String(params[5]),
          usage_goal: String(params[6]),
        };
      }

      return { changes: 1 };
    },
  };
}

describe("sqlite-app-storage", () => {
  it("migrates legacy onboarding data into sqlite and clears the legacy source", async () => {
    const legacyStorageSource = {
      clear: jest.fn().mockResolvedValue(undefined),
      hasData: jest.fn().mockResolvedValue(true),
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: true,
        profileVersion: 3,
      }),
      readOnboardingRecord: jest.fn().mockResolvedValue({
        lastPeriodStart: "2026-03-14",
        cycleLength: 31,
        periodLength: 6,
        autoPeriodFill: true,
        irregularCycle: true,
        ageGroup: "age_35_plus",
        usageGoal: "trying_to_conceive",
      }),
    };
    const storage = createSQLiteAppStorage({
      legacyStorageSource,
      openDatabase: async () => createFakeDatabase(),
    });

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: true,
      profileVersion: 3,
    });
    await expect(storage.readOnboardingRecord()).resolves.toEqual({
      lastPeriodStart: "2026-03-14",
      cycleLength: 31,
      periodLength: 6,
      autoPeriodFill: true,
      irregularCycle: true,
      ageGroup: "age_35_plus",
      usageGoal: "trying_to_conceive",
    });
    expect(legacyStorageSource.clear).toHaveBeenCalledTimes(1);
  });

  it("seeds default rows when no legacy data exists", async () => {
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readOnboardingRecord: jest.fn(),
      },
      openDatabase: async () => createFakeDatabase(),
    });

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: false,
      profileVersion: 1,
    });
    await expect(storage.readOnboardingRecord()).resolves.toEqual({
      lastPeriodStart: null,
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: false,
      irregularCycle: false,
      ageGroup: "",
      usageGoal: "health",
    });
  });

  it("persists bootstrap and onboarding updates in sqlite", async () => {
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readOnboardingRecord: jest.fn(),
      },
      openDatabase: async () => createFakeDatabase(),
    });

    await storage.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
    });
    await storage.writeOnboardingRecord({
      lastPeriodStart: "2026-03-15",
      cycleLength: 30,
      periodLength: 6,
      autoPeriodFill: true,
      irregularCycle: false,
      ageGroup: "age_20_35",
      usageGoal: "avoid_pregnancy",
    });

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: true,
      profileVersion: 2,
    });
    await expect(storage.readOnboardingRecord()).resolves.toEqual({
      lastPeriodStart: "2026-03-15",
      cycleLength: 30,
      periodLength: 6,
      autoPeriodFill: true,
      irregularCycle: false,
      ageGroup: "age_20_35",
      usageGoal: "avoid_pregnancy",
    });
  });
});
