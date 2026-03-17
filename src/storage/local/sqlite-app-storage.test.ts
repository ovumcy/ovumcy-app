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
  dayLogRows: {
    day: string;
    is_period: number;
    cycle_start: number;
    is_uncertain: number;
    flow: string;
    mood: number;
    sex_activity: string;
    bbt: number;
    cervical_mucus: string;
    cycle_factor_keys: string;
    symptom_ids: string;
    notes: string;
  }[];
  symptomRows: {
    id: string;
    slug: string;
    label: string;
    icon: string;
    color: string;
    is_default: number;
    is_archived: number;
    sort_order: number;
  }[];
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
    dayLogRows: [],
    symptomRows: [],
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

    async getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null> {
      if (source === "PRAGMA user_version;") {
        return { user_version: databaseState.userVersion } as T;
      }

      if (source.includes("COUNT(*) AS count FROM bootstrap_state")) {
        return { count: databaseState.bootstrapRow ? 1 : 0 } as T;
      }

      if (source.includes("COUNT(*) AS count FROM profile_settings")) {
        return { count: databaseState.profileRow ? 1 : 0 } as T;
      }

      if (source.includes("COUNT(*) AS count FROM day_logs")) {
        return { count: databaseState.dayLogRows.length } as T;
      }
      if (source.includes("COUNT(*) AS count FROM symptoms")) {
        return { count: databaseState.symptomRows.length } as T;
      }

      if (source.includes("FROM bootstrap_state WHERE id = 1")) {
        return (databaseState.bootstrapRow as T) ?? null;
      }

      if (source.includes("FROM profile_settings")) {
        return (databaseState.profileRow as T) ?? null;
      }

      if (source.includes("FROM day_logs") && source.includes("WHERE day =")) {
        const day = String(params[0]);
        const row = databaseState.dayLogRows.find((entry) => entry.day === day);
        return (row as T) ?? null;
      }

      if (source.includes("FROM onboarding_profile")) {
        return (databaseState.onboardingRow as T) ?? null;
      }

      return null;
    },

    async getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]> {
      if (source.includes("FROM day_logs")) {
        const from = String(params[0]);
        const to = String(params[1]);
        return databaseState.dayLogRows.filter((row) => row.day >= from && row.day <= to) as T[];
      }
      if (source.includes("FROM symptoms")) {
        return [...databaseState.symptomRows]
          .sort((left, right) => {
            if (left.sort_order !== right.sort_order) {
              return left.sort_order - right.sort_order;
            }
            return left.label.localeCompare(right.label, "en", { sensitivity: "base" });
          }) as T[];
      }

      return [];
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

      if (source.includes("INSERT INTO day_logs")) {
        const nextRow = {
          day: String(params[0]),
          is_period: Number(params[1]),
          cycle_start: Number(params[2]),
          is_uncertain: Number(params[3]),
          flow: String(params[4]),
          mood: Number(params[5]),
          sex_activity: String(params[6]),
          bbt: Number(params[7]),
          cervical_mucus: String(params[8]),
          cycle_factor_keys: String(params[9]),
          symptom_ids: String(params[10]),
          notes: String(params[11]),
        };
        databaseState.dayLogRows = databaseState.dayLogRows.filter(
          (row) => row.day !== nextRow.day,
        );
        databaseState.dayLogRows.push(nextRow);
      }

      if (source.includes("DELETE FROM day_logs")) {
        const day = String(params[0]);
        databaseState.dayLogRows = databaseState.dayLogRows.filter((row) => row.day !== day);
      }
      if (source.includes("INSERT INTO symptoms")) {
        const nextRow = {
          id: String(params[0]),
          slug: String(params[1]),
          label: String(params[2]),
          icon: String(params[3]),
          color: String(params[4]),
          is_default: Number(params[5]),
          is_archived: Number(params[6]),
          sort_order: Number(params[7]),
        };
        databaseState.symptomRows = databaseState.symptomRows.filter(
          (row) => row.id !== nextRow.id,
        );
        databaseState.symptomRows.push(nextRow);
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
    await expect(storage.listSymptomRecords()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cramps",
          label: "Cramps",
          isDefault: true,
        }),
      ]),
    );
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

  it("persists and lists canonical day logs in sqlite", async () => {
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => createFakeDatabase(),
    });

    await storage.writeDayLogRecord({
      date: "2026-03-17",
      isPeriod: true,
      cycleStart: false,
      isUncertain: false,
      flow: "light",
      mood: 4,
      sexActivity: "protected",
      bbt: 36.55,
      cervicalMucus: "creamy",
      cycleFactorKeys: ["stress"],
      symptomIDs: ["cramps"],
      notes: "Localized journal note",
    });

    await expect(storage.readDayLogRecord("2026-03-17")).resolves.toEqual({
      date: "2026-03-17",
      isPeriod: true,
      cycleStart: false,
      isUncertain: false,
      flow: "light",
      mood: 4,
      sexActivity: "protected",
      bbt: 36.55,
      cervicalMucus: "creamy",
      cycleFactorKeys: ["stress"],
      symptomIDs: ["cramps"],
      notes: "Localized journal note",
    });

    await expect(
      storage.listDayLogRecordsInRange("2026-03-01", "2026-03-31"),
    ).resolves.toEqual([
      expect.objectContaining({
        date: "2026-03-17",
        isPeriod: true,
      }),
    ]);

    await storage.deleteDayLogRecord("2026-03-17");
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
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    });
  });

  it("persists custom symptoms alongside the seeded built-in catalog", async () => {
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => createFakeDatabase(),
    });

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
          id: "cramps",
          isDefault: true,
        }),
        expect.objectContaining({
          id: "custom_jaw_pain",
          label: "Jaw pain",
          icon: "🔥",
          isArchived: false,
          isDefault: false,
        }),
      ]),
    );
  });
});
