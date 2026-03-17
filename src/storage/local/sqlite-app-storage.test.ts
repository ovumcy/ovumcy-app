import {
  createSQLiteAppStorage,
  type LocalAppDatabase,
} from "./sqlite-app-storage";

type FakeDatabaseState = {
  bootstrapRow: {
    has_completed_onboarding: number;
    profile_version: number;
  } | null;
  profileRow: {
    last_period_start: string | null;
    cycle_length: number;
    period_length: number;
    auto_period_fill: number;
    irregular_cycle: number;
    unpredictable_cycle: number;
    age_group: string;
    usage_goal: string;
    track_bbt: number;
    temperature_unit: string;
    track_cervical_mucus: number;
    hide_sex_chip: number;
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
    profileRow: null,
    onboardingRow: null,
    userVersion: 0,
    ...state,
  };

  return {
    async execAsync(source: string) {
      if (source.startsWith("PRAGMA user_version =")) {
        databaseState.userVersion = Number(source.replace(/\D/g, ""));
      }

      if (source.includes("DROP TABLE IF EXISTS onboarding_profile")) {
        databaseState.onboardingRow = null;
      }
    },

    async getFirstAsync<T>(source: string): Promise<T | null> {
      if (source === "PRAGMA user_version;") {
        return { user_version: databaseState.userVersion } as T;
      }

      if (source.includes("COUNT(*) AS count FROM bootstrap_state")) {
        return { count: databaseState.bootstrapRow ? 1 : 0 } as T;
      }

      if (source.includes("COUNT(*) AS count FROM profile_settings")) {
        return { count: databaseState.profileRow ? 1 : 0 } as T;
      }

      if (source.includes("FROM bootstrap_state WHERE id = 1")) {
        return (databaseState.bootstrapRow as T) ?? null;
      }

      if (source.includes("FROM profile_settings")) {
        return (databaseState.profileRow as T) ?? null;
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

      if (source.includes("INSERT INTO profile_settings")) {
        databaseState.profileRow = {
          last_period_start: (params[0] as string | null) ?? null,
          cycle_length: Number(params[1]),
          period_length: Number(params[2]),
          auto_period_fill: Number(params[3]),
          irregular_cycle: Number(params[4]),
          unpredictable_cycle: Number(params[5]),
          age_group: String(params[6]),
          usage_goal: String(params[7]),
          track_bbt: Number(params[8]),
          temperature_unit: String(params[9]),
          track_cervical_mucus: Number(params[10]),
          hide_sex_chip: Number(params[11]),
        };
      }

      if (source.includes("UPDATE bootstrap_state")) {
        if (databaseState.bootstrapRow) {
          databaseState.bootstrapRow.profile_version = Number(params[0]);
        }
      }

      return { changes: 1 };
    },
  };
}

describe("sqlite-app-storage", () => {
  it("migrates legacy async-storage profile data into sqlite and clears the legacy source", async () => {
    const legacyStorageSource = {
      clear: jest.fn().mockResolvedValue(undefined),
      hasData: jest.fn().mockResolvedValue(true),
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: true,
        profileVersion: 3,
      }),
      readProfileRecord: jest.fn().mockResolvedValue({
        lastPeriodStart: "2026-03-14",
        cycleLength: 31,
        periodLength: 6,
        autoPeriodFill: true,
        irregularCycle: true,
        unpredictableCycle: true,
        ageGroup: "age_35_plus",
        usageGoal: "trying_to_conceive",
        trackBBT: true,
        temperatureUnit: "f",
        trackCervicalMucus: true,
        hideSexChip: true,
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
    await expect(storage.readProfileRecord()).resolves.toEqual({
      lastPeriodStart: "2026-03-14",
      cycleLength: 31,
      periodLength: 6,
      autoPeriodFill: true,
      irregularCycle: true,
      unpredictableCycle: true,
      ageGroup: "age_35_plus",
      usageGoal: "trying_to_conceive",
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
    });
    expect(legacyStorageSource.clear).toHaveBeenCalledTimes(1);
  });

  it("migrates a v1 onboarding_profile row into the canonical profile table", async () => {
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () =>
        createFakeDatabase({
          bootstrapRow: {
            has_completed_onboarding: 1,
            profile_version: 1,
          },
          onboardingRow: {
            last_period_start: "2026-03-09",
            cycle_length: 29,
            period_length: 5,
            auto_period_fill: 1,
            irregular_cycle: 1,
            age_group: "age_20_35",
            usage_goal: "avoid_pregnancy",
          },
          userVersion: 1,
        }),
    });

    await expect(storage.readProfileRecord()).resolves.toEqual({
      lastPeriodStart: "2026-03-09",
      cycleLength: 29,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: true,
      unpredictableCycle: false,
      ageGroup: "age_20_35",
      usageGoal: "avoid_pregnancy",
      trackBBT: false,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
    });
  });

  it("seeds default rows when no legacy data exists", async () => {
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => createFakeDatabase(),
    });

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
  });

  it("persists bootstrap and canonical profile updates in sqlite", async () => {
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => createFakeDatabase(),
    });

    await storage.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
    });
    await storage.writeProfileRecord({
      lastPeriodStart: "2026-03-15",
      cycleLength: 30,
      periodLength: 6,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "age_20_35",
      usageGoal: "avoid_pregnancy",
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
    });

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: true,
      profileVersion: 2,
    });
    await expect(storage.readProfileRecord()).resolves.toEqual({
      lastPeriodStart: "2026-03-15",
      cycleLength: 30,
      periodLength: 6,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "age_20_35",
      usageGoal: "avoid_pregnancy",
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
    });
  });
});
