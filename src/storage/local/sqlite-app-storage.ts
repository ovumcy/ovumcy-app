import { openDatabaseAsync } from "expo-sqlite";

import type { OnboardingRecord } from "../../models/onboarding";
import { createDefaultOnboardingRecord } from "../../services/onboarding-policy";
import {
  clearAsyncStorageLocalAppData,
  hasAsyncStorageLocalAppData,
  readAsyncStorageBootstrapState,
  readAsyncStorageOnboardingRecord,
} from "./async-storage-app-storage";
import type {
  LocalAppStorage,
  LocalBootstrapState,
} from "./storage-contract";
import { createDefaultBootstrapState } from "./storage-contract";

const DATABASE_NAME = "ovumcy-local.db";
const DATABASE_VERSION = 1;

const CREATE_BOOTSTRAP_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS bootstrap_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    has_completed_onboarding INTEGER NOT NULL DEFAULT 0,
    profile_version INTEGER NOT NULL DEFAULT 1
  );
`;

const CREATE_ONBOARDING_PROFILE_TABLE = `
  CREATE TABLE IF NOT EXISTS onboarding_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_period_start TEXT,
    cycle_length INTEGER NOT NULL,
    period_length INTEGER NOT NULL,
    auto_period_fill INTEGER NOT NULL,
    irregular_cycle INTEGER NOT NULL,
    age_group TEXT NOT NULL,
    usage_goal TEXT NOT NULL
  );
`;

type BootstrapStateRow = {
  has_completed_onboarding: number;
  profile_version: number;
};

type OnboardingProfileRow = {
  last_period_start: string | null;
  cycle_length: number;
  period_length: number;
  auto_period_fill: number;
  irregular_cycle: number;
  age_group: string;
  usage_goal: string;
};

type CountRow = {
  count: number;
};

export interface LocalAppDatabase {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
}

type LegacyLocalAppStorageSource = {
  clear(): Promise<void>;
  hasData(): Promise<boolean>;
  readBootstrapState(): Promise<LocalBootstrapState>;
  readOnboardingRecord(): Promise<OnboardingRecord>;
};

type CreateSQLiteAppStorageOptions = {
  legacyStorageSource?: LegacyLocalAppStorageSource;
  openDatabase?: () => Promise<LocalAppDatabase>;
};

const defaultLegacyStorageSource: LegacyLocalAppStorageSource = {
  async clear() {
    await clearAsyncStorageLocalAppData();
  },
  async hasData() {
    return hasAsyncStorageLocalAppData();
  },
  async readBootstrapState() {
    return readAsyncStorageBootstrapState();
  },
  async readOnboardingRecord() {
    return readAsyncStorageOnboardingRecord();
  },
};

export function createSQLiteAppStorage(
  options: CreateSQLiteAppStorageOptions = {},
): LocalAppStorage {
  const openDatabase = options.openDatabase ?? openLocalAppDatabase;
  const legacyStorageSource =
    options.legacyStorageSource ?? defaultLegacyStorageSource;
  let hydratedDatabasePromise: Promise<LocalAppDatabase> | null = null;

  async function getHydratedDatabase() {
    if (!hydratedDatabasePromise) {
      hydratedDatabasePromise = hydrateLocalAppDatabase(
        openDatabase,
        legacyStorageSource,
      );
    }

    return hydratedDatabasePromise;
  }

  return {
    async readBootstrapState(): Promise<LocalBootstrapState> {
      const database = await getHydratedDatabase();
      const row = await database.getFirstAsync<BootstrapStateRow>(
        "SELECT has_completed_onboarding, profile_version FROM bootstrap_state WHERE id = 1;",
      );

      return row ? mapBootstrapStateRow(row) : createDefaultBootstrapState();
    },

    async writeBootstrapState(state: LocalBootstrapState): Promise<void> {
      const database = await getHydratedDatabase();
      await upsertBootstrapState(database, state);
    },

    async readOnboardingRecord(): Promise<OnboardingRecord> {
      const database = await getHydratedDatabase();
      const row = await database.getFirstAsync<OnboardingProfileRow>(
        `SELECT
          last_period_start,
          cycle_length,
          period_length,
          auto_period_fill,
          irregular_cycle,
          age_group,
          usage_goal
         FROM onboarding_profile
         WHERE id = 1;`,
      );

      return row ? mapOnboardingProfileRow(row) : createDefaultOnboardingRecord();
    },

    async writeOnboardingRecord(record: OnboardingRecord): Promise<void> {
      const database = await getHydratedDatabase();
      await upsertOnboardingRecord(database, record);
    },
  };
}

async function openLocalAppDatabase(): Promise<LocalAppDatabase> {
  return openDatabaseAsync(DATABASE_NAME);
}

async function hydrateLocalAppDatabase(
  openDatabase: () => Promise<LocalAppDatabase>,
  legacyStorageSource: LegacyLocalAppStorageSource,
): Promise<LocalAppDatabase> {
  const database = await openDatabase();

  await ensureLocalAppSchema(database);
  await maybeMigrateLegacyLocalAppData(database, legacyStorageSource);
  await ensureSeedRows(database);

  return database;
}

async function ensureLocalAppSchema(database: LocalAppDatabase): Promise<void> {
  const versionRow = await database.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version;",
  );
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  await database.execAsync(CREATE_BOOTSTRAP_STATE_TABLE);
  await database.execAsync(CREATE_ONBOARDING_PROFILE_TABLE);
  await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
}

async function maybeMigrateLegacyLocalAppData(
  database: LocalAppDatabase,
  legacyStorageSource: LegacyLocalAppStorageSource,
): Promise<void> {
  const [bootstrapCount, onboardingCount, hasLegacyData] = await Promise.all([
    readRowCount(database, "bootstrap_state"),
    readRowCount(database, "onboarding_profile"),
    legacyStorageSource.hasData(),
  ]);

  if (bootstrapCount > 0 || onboardingCount > 0 || !hasLegacyData) {
    return;
  }

  const [bootstrapState, onboardingRecord] = await Promise.all([
    legacyStorageSource.readBootstrapState(),
    legacyStorageSource.readOnboardingRecord(),
  ]);

  await upsertBootstrapState(database, bootstrapState);
  await upsertOnboardingRecord(database, onboardingRecord);
  await legacyStorageSource.clear();
}

async function ensureSeedRows(database: LocalAppDatabase): Promise<void> {
  const [bootstrapCount, onboardingCount] = await Promise.all([
    readRowCount(database, "bootstrap_state"),
    readRowCount(database, "onboarding_profile"),
  ]);

  if (bootstrapCount === 0) {
    await upsertBootstrapState(database, createDefaultBootstrapState());
  }

  if (onboardingCount === 0) {
    await upsertOnboardingRecord(database, createDefaultOnboardingRecord());
  }
}

async function readRowCount(
  database: LocalAppDatabase,
  tableName: "bootstrap_state" | "onboarding_profile",
): Promise<number> {
  const row = await database.getFirstAsync<CountRow>(
    `SELECT COUNT(*) AS count FROM ${tableName};`,
  );

  return row?.count ?? 0;
}

async function upsertBootstrapState(
  database: LocalAppDatabase,
  state: LocalBootstrapState,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO bootstrap_state (id, has_completed_onboarding, profile_version)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       has_completed_onboarding = excluded.has_completed_onboarding,
       profile_version = excluded.profile_version;`,
    state.hasCompletedOnboarding ? 1 : 0,
    state.profileVersion,
  );
}

async function upsertOnboardingRecord(
  database: LocalAppDatabase,
  record: OnboardingRecord,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO onboarding_profile (
       id,
       last_period_start,
       cycle_length,
       period_length,
       auto_period_fill,
       irregular_cycle,
       age_group,
       usage_goal
     )
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       last_period_start = excluded.last_period_start,
       cycle_length = excluded.cycle_length,
       period_length = excluded.period_length,
       auto_period_fill = excluded.auto_period_fill,
       irregular_cycle = excluded.irregular_cycle,
       age_group = excluded.age_group,
       usage_goal = excluded.usage_goal;`,
    record.lastPeriodStart,
    record.cycleLength,
    record.periodLength,
    record.autoPeriodFill ? 1 : 0,
    record.irregularCycle ? 1 : 0,
    record.ageGroup,
    record.usageGoal,
  );
}

function mapBootstrapStateRow(row: BootstrapStateRow): LocalBootstrapState {
  return {
    hasCompletedOnboarding: row.has_completed_onboarding === 1,
    profileVersion: row.profile_version,
  };
}

function mapOnboardingProfileRow(row: OnboardingProfileRow): OnboardingRecord {
  return {
    lastPeriodStart: row.last_period_start,
    cycleLength: row.cycle_length,
    periodLength: row.period_length,
    autoPeriodFill: row.auto_period_fill === 1,
    irregularCycle: row.irregular_cycle === 1,
    ageGroup: row.age_group as OnboardingRecord["ageGroup"],
    usageGoal: row.usage_goal as OnboardingRecord["usageGoal"],
  };
}
