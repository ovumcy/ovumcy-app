import {
  createSQLiteAppStorage,
  type LocalAppDatabase,
} from "./sqlite-app-storage";
import type { LocalDataKeyStore } from "../../security/local-data-key-store";
import { createDefaultProfileRecord } from "../../models/profile";

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
    language_override: string | null;
    theme_override: string | null;
    encrypted_payload?: string | null;
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
    encrypted_payload?: string | null;
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
    encrypted_payload?: string | null;
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
  syncPreferencesColumns: string[];
  syncPreferencesRow: {
    mode: string;
    endpoint_input: string;
    normalized_endpoint: string;
    device_label: string;
    setup_status: string;
    prepared_at: string | null;
    last_remote_generation?: number | null;
    last_synced_at?: string | null;
  } | null;
  userVersion: number;
};

function createInspectableFakeDatabase(state?: Partial<FakeDatabaseState>) {
  const databaseState: FakeDatabaseState = {
    bootstrapRow: null,
    profileRow: null,
    dayLogRows: [],
    symptomRows: [],
    onboardingRow: null,
    syncPreferencesColumns: [
      "id",
      "mode",
      "endpoint_input",
      "normalized_endpoint",
      "device_label",
      "setup_status",
      "prepared_at",
      "last_remote_generation",
      "last_synced_at",
    ],
    syncPreferencesRow: null,
    userVersion: 0,
    ...state,
  };

  const database: LocalAppDatabase = {
    async execAsync(source: string) {
      if (source.startsWith("PRAGMA user_version =")) {
        databaseState.userVersion = Number(source.replace(/\D/g, ""));
      }

      if (source.includes("ALTER TABLE profile_settings ADD COLUMN language_override")) {
        if (databaseState.profileRow) {
          databaseState.profileRow.language_override ??= null;
        }
      }

      if (source.includes("ALTER TABLE profile_settings ADD COLUMN theme_override")) {
        if (databaseState.profileRow) {
          databaseState.profileRow.theme_override ??= null;
        }
      }

      if (source.includes("ALTER TABLE profile_settings ADD COLUMN encrypted_payload")) {
        if (databaseState.profileRow) {
          databaseState.profileRow.encrypted_payload ??= null;
        }
      }

      if (source.includes("ALTER TABLE day_logs ADD COLUMN encrypted_payload")) {
        databaseState.dayLogRows = databaseState.dayLogRows.map((row) => ({
          ...row,
          encrypted_payload: row.encrypted_payload ?? null,
        }));
      }

      if (source.includes("ALTER TABLE symptoms ADD COLUMN encrypted_payload")) {
        databaseState.symptomRows = databaseState.symptomRows.map((row) => ({
          ...row,
          encrypted_payload: row.encrypted_payload ?? null,
        }));
      }

      if (source.includes("DROP TABLE IF EXISTS onboarding_profile")) {
        databaseState.onboardingRow = null;
      }

      if (
        source.includes(
          "ALTER TABLE sync_preferences ADD COLUMN last_remote_generation",
        ) &&
        !databaseState.syncPreferencesColumns.includes("last_remote_generation")
      ) {
        databaseState.syncPreferencesColumns.push("last_remote_generation");
        if (databaseState.syncPreferencesRow) {
          databaseState.syncPreferencesRow.last_remote_generation ??= null;
        }
      }

      if (
        source.includes("ALTER TABLE sync_preferences ADD COLUMN last_synced_at") &&
        !databaseState.syncPreferencesColumns.includes("last_synced_at")
      ) {
        databaseState.syncPreferencesColumns.push("last_synced_at");
        if (databaseState.syncPreferencesRow) {
          databaseState.syncPreferencesRow.last_synced_at ??= null;
        }
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
      if (source.includes("COUNT(*) AS count FROM sync_preferences")) {
        return { count: databaseState.syncPreferencesRow ? 1 : 0 } as T;
      }
      if (source.includes("COUNT(*) AS count FROM symptoms")) {
        return { count: databaseState.symptomRows.length } as T;
      }

      if (source.includes("COUNT(*) AS total_entries")) {
        const from = params.length > 0 ? (params[0] as string | null) : null;
        const to = params.length > 2 ? (params[2] as string | null) : null;
        const filtered = databaseState.dayLogRows.filter((row) => {
          if (from && row.day < from) {
            return false;
          }
          if (to && row.day > to) {
            return false;
          }
          return true;
        });

        const firstRow = filtered[0] ?? null;
        const lastRow = filtered[filtered.length - 1] ?? null;

        return {
          total_entries: filtered.length,
          date_from: firstRow ? firstRow.day : null,
          date_to: lastRow ? lastRow.day : null,
        } as T;
      }

      if (
        source.includes("SELECT encrypted_payload FROM profile_settings") &&
        source.includes("encrypted_payload IS NOT NULL")
      ) {
        if (databaseState.profileRow?.encrypted_payload) {
          return {
            encrypted_payload: databaseState.profileRow.encrypted_payload,
          } as T;
        }
        return null;
      }

      if (
        source.includes("SELECT encrypted_payload FROM day_logs") &&
        source.includes("encrypted_payload IS NOT NULL")
      ) {
        const row = databaseState.dayLogRows.find(
          (entry) => entry.encrypted_payload,
        );
        return row
          ? ({ encrypted_payload: row.encrypted_payload ?? null } as T)
          : null;
      }

      if (
        source.includes("SELECT encrypted_payload FROM symptoms") &&
        source.includes("encrypted_payload IS NOT NULL")
      ) {
        const row = databaseState.symptomRows.find(
          (entry) => entry.encrypted_payload,
        );
        return row
          ? ({ encrypted_payload: row.encrypted_payload ?? null } as T)
          : null;
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

      if (source.includes("FROM sync_preferences")) {
        return (databaseState.syncPreferencesRow as T) ?? null;
      }

      return null;
    },

    async getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]> {
      if (source === "PRAGMA table_info(sync_preferences);") {
        return databaseState.syncPreferencesColumns.map((name, index) => ({
          cid: index,
          name,
        })) as T[];
      }
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
          language_override: (params[12] as string | null) ?? null,
          theme_override: (params[13] as string | null) ?? null,
          encrypted_payload: (params[14] as string | null) ?? null,
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
          encrypted_payload: (params[12] as string | null) ?? null,
        };
        databaseState.dayLogRows = databaseState.dayLogRows.filter(
          (row) => row.day !== nextRow.day,
        );
        databaseState.dayLogRows.push(nextRow);
      }

      if (source.includes("DELETE FROM day_logs")) {
        if (!source.includes("WHERE day =")) {
          databaseState.dayLogRows = [];
          return { changes: 1 };
        }
        const day = String(params[0]);
        databaseState.dayLogRows = databaseState.dayLogRows.filter((row) => row.day !== day);
      }
      if (source.includes("DELETE FROM bootstrap_state")) {
        databaseState.bootstrapRow = null;
      }
      if (source.includes("DELETE FROM profile_settings")) {
        databaseState.profileRow = null;
      }
      if (source.includes("DELETE FROM sync_preferences")) {
        databaseState.syncPreferencesRow = null;
      }
      if (source.includes("DELETE FROM symptoms")) {
        databaseState.symptomRows = [];
      }
      if (source.includes("INSERT INTO sync_preferences")) {
        databaseState.syncPreferencesRow = {
          mode: String(params[0]),
          endpoint_input: String(params[1]),
          normalized_endpoint: String(params[2]),
          device_label: String(params[3]),
          setup_status: String(params[4]),
          prepared_at: (params[5] as string | null) ?? null,
          last_remote_generation: (params[6] as number | null) ?? null,
          last_synced_at: (params[7] as string | null) ?? null,
        };
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
          encrypted_payload: (params[8] as string | null) ?? null,
        };
        databaseState.symptomRows = databaseState.symptomRows.filter(
          (row) => row.id !== nextRow.id,
        );
        databaseState.symptomRows.push(nextRow);
      }

      return { changes: 1 };
    },

    async closeAsync() {
      return undefined;
    },
  };

  return {
    database,
    state: databaseState,
  };
}

function createFakeDatabase(state?: Partial<FakeDatabaseState>): LocalAppDatabase {
  return createInspectableFakeDatabase(state).database;
}

function createConcurrentProbeDatabase(
  state?: Partial<FakeDatabaseState>,
): {
  database: LocalAppDatabase;
  getMaxConcurrentOperations(): number;
} {
  const inspected = createInspectableFakeDatabase(state);
  let inFlightOperations = 0;
  let maxConcurrentOperations = 0;

  async function track<T>(operation: () => Promise<T>): Promise<T> {
    inFlightOperations += 1;
    maxConcurrentOperations = Math.max(
      maxConcurrentOperations,
      inFlightOperations,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      return await operation();
    } finally {
      inFlightOperations -= 1;
    }
  }

  return {
    database: {
      execAsync(source) {
        return track(() => inspected.database.execAsync(source));
      },
      getFirstAsync<T>(source: string, ...params: unknown[]) {
        return track(() => inspected.database.getFirstAsync<T>(source, ...params));
      },
      getAllAsync<T>(source: string, ...params: unknown[]) {
        return track(() => inspected.database.getAllAsync<T>(source, ...params));
      },
      runAsync(source, ...params) {
        return track(() => inspected.database.runAsync(source, ...params));
      },
      async closeAsync() {
        await track(() => inspected.database.closeAsync?.() ?? Promise.resolve());
      },
    },
    getMaxConcurrentOperations() {
      return maxConcurrentOperations;
    },
  };
}

function createFakeLocalDataKeyStore(
  initialKey: string | null = null,
): LocalDataKeyStore & {
  clearLocalDataKey: jest.Mock;
  readLocalDataKey: jest.Mock;
  writeLocalDataKey: jest.Mock;
} {
  let keyHex = initialKey;

  return {
    clearLocalDataKey: jest.fn(async () => {
      keyHex = null;
    }),
    readLocalDataKey: jest.fn(async () => keyHex),
    writeLocalDataKey: jest.fn(async (nextKeyHex: string) => {
      keyHex = nextKeyHex;
    }),
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
        languageOverride: null,
        themeOverride: null,
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
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-03-14",
      cycleLength: 31,
      periodLength: 6,
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
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-03-09",
      cycleLength: 29,
      periodLength: 5,
      irregularCycle: true,
      ageGroup: "age_20_35",
      usageGoal: "avoid_pregnancy",
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
    await expect(storage.readProfileRecord()).resolves.toEqual(
      createDefaultProfileRecord(),
    );
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
      languageOverride: null,
      themeOverride: null,
    });

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: true,
      profileVersion: 2,
    });
    await expect(storage.readProfileRecord()).resolves.toEqual({
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-03-15",
      cycleLength: 30,
      periodLength: 6,
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
    await expect(
      storage.readDayLogSummary("2026-03-01", "2026-03-31"),
    ).resolves.toEqual({
      totalEntries: 1,
      hasData: true,
      dateFrom: "2026-03-17",
      dateTo: "2026-03-17",
    });

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

  it("stores sensitive local records in encrypted payload columns instead of plaintext", async () => {
    const inspected = createInspectableFakeDatabase();
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => inspected.database,
    });

    await storage.writeProfileRecord({
      lastPeriodStart: "2026-03-15",
      cycleLength: 31,
      periodLength: 6,
      autoPeriodFill: false,
      irregularCycle: true,
      unpredictableCycle: true,
      ageGroup: "age_35_plus",
      usageGoal: "trying_to_conceive",
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
      languageOverride: "en",
      themeOverride: "dark",
    });
    await storage.writeDayLogRecord({
      date: "2026-03-17",
      isPeriod: true,
      cycleStart: true,
      isUncertain: false,
      flow: "heavy",
      mood: 5,
      sexActivity: "protected",
      bbt: 36.7,
      cervicalMucus: "eggwhite",
      cycleFactorKeys: ["stress"],
      symptomIDs: ["cramps"],
      notes: "Reset me",
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

    expect(inspected.state.profileRow?.encrypted_payload).toEqual(expect.any(String));
    expect(inspected.state.profileRow?.encrypted_payload).not.toContain("2026-03-15");
    expect(inspected.state.profileRow?.last_period_start).toBeNull();

    expect(inspected.state.dayLogRows[0]?.encrypted_payload).toEqual(expect.any(String));
    expect(inspected.state.dayLogRows[0]?.encrypted_payload).not.toContain("Reset me");
    expect(inspected.state.dayLogRows[0]?.notes).toBe("");

    const customSymptomRow = inspected.state.symptomRows.find(
      (row) => row.id === "custom_jaw_pain",
    );
    expect(customSymptomRow?.encrypted_payload).toEqual(expect.any(String));
    expect(customSymptomRow?.encrypted_payload).not.toContain("Jaw pain");
    expect(customSymptomRow?.label).toBe("");
    expect(customSymptomRow?.slug).toBe("custom_jaw_pain");
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

  it("reconciles sync preference columns even when user_version claims the schema is current", async () => {
    const inspected = createInspectableFakeDatabase({
      userVersion: 8,
      syncPreferencesColumns: [
        "id",
        "mode",
        "endpoint_input",
        "normalized_endpoint",
        "device_label",
        "setup_status",
        "prepared_at",
      ],
      syncPreferencesRow: {
        mode: "self_hosted",
        endpoint_input: "192.168.1.20:8080",
        normalized_endpoint: "http://192.168.1.20:8080",
        device_label: "Pixel 7",
        setup_status: "local_ready",
        prepared_at: "2026-03-20T08:00:00.000Z",
      },
    });
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => inspected.database,
    });

    await expect(storage.readSyncPreferencesRecord()).resolves.toEqual({
      mode: "self_hosted",
      endpointInput: "192.168.1.20:8080",
      normalizedEndpoint: "http://192.168.1.20:8080",
      deviceLabel: "Pixel 7",
      setupStatus: "local_ready",
      preparedAt: "2026-03-20T08:00:00.000Z",
      lastRemoteGeneration: null,
      lastSyncedAt: null,
    });
    expect(inspected.state.syncPreferencesColumns).toEqual(
      expect.arrayContaining(["last_remote_generation", "last_synced_at"]),
    );
  });

  it("serializes overlapping sqlite reads on a single connection", async () => {
    const probe = createConcurrentProbeDatabase({
      userVersion: 8,
      bootstrapRow: {
        has_completed_onboarding: 1,
        profile_version: 2,
      },
      profileRow: {
        last_period_start: null,
        cycle_length: 28,
        period_length: 5,
        auto_period_fill: 1,
        irregular_cycle: 0,
        unpredictable_cycle: 0,
        age_group: "",
        usage_goal: "health",
        track_bbt: 0,
        temperature_unit: "c",
        track_cervical_mucus: 0,
        hide_sex_chip: 0,
        language_override: null,
        theme_override: null,
        encrypted_payload: null,
      },
      syncPreferencesRow: {
        mode: "managed",
        endpoint_input: "",
        normalized_endpoint: "https://sync.ovumcy.com",
        device_label: "",
        setup_status: "not_configured",
        prepared_at: null,
        last_remote_generation: null,
        last_synced_at: null,
      },
      dayLogRows: [],
      symptomRows: [],
    });
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      localDataKeyStore: createFakeLocalDataKeyStore(),
      openDatabase: async () => probe.database,
    });

    await Promise.all([
      storage.readProfileRecord(),
      storage.readSyncPreferencesRecord(),
      storage.listSymptomRecords(),
      storage.readDayLogSummary(),
    ]);

    expect(probe.getMaxConcurrentOperations()).toBe(1);
  });

  it("clears local data and reseeds canonical defaults", async () => {
    const deleteDatabase = jest.fn().mockResolvedValue(undefined);
    const legacyStorageSource = {
      clear: jest.fn().mockResolvedValue(undefined),
      hasData: jest.fn().mockResolvedValue(false),
      readBootstrapState: jest.fn(),
      readProfileRecord: jest.fn(),
    };
    const storage = createSQLiteAppStorage({
      deleteDatabase,
      legacyStorageSource,
      openDatabase: async () => createFakeDatabase(),
    });

    await storage.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
    });
    await storage.writeProfileRecord({
      lastPeriodStart: "2026-03-15",
      cycleLength: 31,
      periodLength: 6,
      autoPeriodFill: false,
      irregularCycle: true,
      unpredictableCycle: true,
      ageGroup: "age_35_plus",
      usageGoal: "trying_to_conceive",
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
      languageOverride: null,
      themeOverride: null,
    });
    await storage.writeDayLogRecord({
      date: "2026-03-17",
      isPeriod: true,
      cycleStart: true,
      isUncertain: false,
      flow: "heavy",
      mood: 5,
      sexActivity: "protected",
      bbt: 36.7,
      cervicalMucus: "eggwhite",
      cycleFactorKeys: ["stress"],
      symptomIDs: ["cramps"],
      notes: "Reset me",
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

    await storage.clearAllLocalData();

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: false,
      profileVersion: 2,
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
    await expect(storage.listSymptomRecords()).resolves.toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          id: "custom_jaw_pain",
        }),
      ]),
    );
    await expect(storage.listSymptomRecords()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "cramps",
          isDefault: true,
        }),
      ]),
    );
    expect(legacyStorageSource.clear).toHaveBeenCalledTimes(1);
    expect(deleteDatabase).toHaveBeenCalledTimes(1);
  });

  it("reopens the native sqlite database after clearing local data", async () => {
    const deleteDatabase = jest.fn().mockResolvedValue(undefined);
    let openDatabaseCallCount = 0;
    const closeAsync = jest.fn().mockResolvedValue(undefined);
    const legacyStorageSource = {
      clear: jest.fn().mockResolvedValue(undefined),
      hasData: jest.fn().mockResolvedValue(false),
      readBootstrapState: jest.fn(),
      readProfileRecord: jest.fn(),
    };
    const storage = createSQLiteAppStorage({
      deleteDatabase,
      legacyStorageSource,
      openDatabase: async () => {
        openDatabaseCallCount += 1;
        const database = createFakeDatabase();
        return {
          ...database,
          closeAsync,
        };
      },
    });

    await storage.writeProfileRecord({
      lastPeriodStart: "2026-03-15",
      cycleLength: 31,
      periodLength: 6,
      autoPeriodFill: false,
      irregularCycle: true,
      unpredictableCycle: true,
      ageGroup: "age_35_plus",
      usageGoal: "trying_to_conceive",
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
      languageOverride: null,
      themeOverride: null,
    });

    await storage.clearAllLocalData();
    await storage.readBootstrapState();

    expect(closeAsync).toHaveBeenCalledTimes(1);
    expect(deleteDatabase).toHaveBeenCalledTimes(1);
    expect(openDatabaseCallCount).toBe(2);
  });

  it("waits for local-data reset to finish before reopening sqlite", async () => {
    let releaseDeleteDatabase!: () => void;
    const deleteDatabase = jest.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseDeleteDatabase = resolve;
        }),
    );
    let openDatabaseCallCount = 0;
    const storage = createSQLiteAppStorage({
      deleteDatabase,
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => {
        openDatabaseCallCount += 1;
        return createFakeDatabase();
      },
    });

    await storage.readBootstrapState();
    expect(openDatabaseCallCount).toBe(1);

    const clearPromise = storage.clearAllLocalData();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(deleteDatabase).toHaveBeenCalledTimes(1);

    const readProfilePromise = storage.readProfileRecord();

    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(openDatabaseCallCount).toBe(1);

    releaseDeleteDatabase();

    await clearPromise;
    await expect(readProfilePromise).resolves.toEqual(createDefaultProfileRecord());
    expect(openDatabaseCallCount).toBe(2);
  });

  it("creates and clears the local encrypted-at-rest key through the storage lifecycle", async () => {
    const localDataKeyStore = createFakeLocalDataKeyStore();
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      localDataKeyStore,
      openDatabase: async () => createFakeDatabase(),
    });

    await storage.writeProfileRecord({
      lastPeriodStart: "2026-03-15",
      cycleLength: 31,
      periodLength: 6,
      autoPeriodFill: false,
      irregularCycle: true,
      unpredictableCycle: true,
      ageGroup: "age_35_plus",
      usageGoal: "trying_to_conceive",
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
      languageOverride: "en",
      themeOverride: "dark",
    });

    expect(localDataKeyStore.writeLocalDataKey).toHaveBeenCalledTimes(1);
    expect(localDataKeyStore.readLocalDataKey).toHaveBeenCalled();

    await storage.clearAllLocalData();

    expect(localDataKeyStore.clearLocalDataKey).toHaveBeenCalledTimes(1);
  });

  it("resets encrypted local data if the secure local key is unavailable", async () => {
    const localDataKeyStore = createFakeLocalDataKeyStore(null);
    const inspected = createInspectableFakeDatabase({
      bootstrapRow: {
        has_completed_onboarding: 1,
        profile_version: 2,
      },
      profileRow: {
        last_period_start: null,
        cycle_length: 28,
        period_length: 5,
        auto_period_fill: 1,
        irregular_cycle: 0,
        unpredictable_cycle: 0,
        age_group: "",
        usage_goal: "health",
        track_bbt: 0,
        temperature_unit: "c",
        track_cervical_mucus: 0,
        hide_sex_chip: 0,
        language_override: null,
        theme_override: null,
        encrypted_payload: JSON.stringify({
          algorithm: "xchacha20poly1305",
          nonceHex: "aa",
          ciphertextHex: "bb",
        }),
      },
    });

    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      localDataKeyStore,
      openDatabase: async () => inspected.database,
    });

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: false,
      profileVersion: 2,
    });
    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({
        lastPeriodStart: null,
        cycleLength: 28,
        periodLength: 5,
      }),
    );
    expect(localDataKeyStore.writeLocalDataKey).toHaveBeenCalledTimes(1);
  });
});
