import { deleteDatabaseAsync, openDatabaseAsync } from "expo-sqlite";

import {
  createEmptyDayLogRecord,
  type DayLogRecord,
} from "../../models/day-log";
import type { OnboardingRecord } from "../../models/onboarding";
import {
  createLocalDataKeyHex,
  decryptLocalDataRecord,
  encryptLocalDataRecord,
} from "../../security/local-data-crypto";
import {
  createInMemoryLocalDataKeyStore,
  type LocalDataKeyStore,
} from "../../security/local-data-key-store";
import {
  createDefaultProfileRecord,
  normalizeInterfaceLanguage,
  normalizeThemePreference,
  type ProfileRecord,
} from "../../models/profile";
import {
  createDefaultSyncPreferencesRecord,
  normalizeSyncMode,
  normalizeSyncSetupStatus,
  type SyncPreferencesRecord,
} from "../../sync/sync-contract";
import {
  createDefaultSymptomRecords,
  type SymptomRecord,
} from "../../models/symptom";
import {
  applyOnboardingRecordToProfile,
  profileToOnboardingRecord,
} from "../../services/onboarding-policy";
import { sanitizeDayLogRecord } from "../../services/day-log-policy";
import { normalizeTemperatureUnit } from "../../services/profile-settings-policy";
import {
  clearAsyncStorageLocalAppData,
  hasAsyncStorageLocalAppData,
  readAsyncStorageBootstrapState,
  readAsyncStorageProfileRecord,
} from "./async-storage-app-storage";
import type {
  LocalAppStorage,
  LocalBootstrapState,
  LocalDayLogSummary,
} from "./storage-contract";
import { createDefaultBootstrapState } from "./storage-contract";

const DATABASE_NAME = "ovumcy-local.db";
const DATABASE_VERSION = 8;

const CREATE_BOOTSTRAP_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS bootstrap_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    has_completed_onboarding INTEGER NOT NULL DEFAULT 0,
    profile_version INTEGER NOT NULL DEFAULT 2
  );
`;

const CREATE_PROFILE_SETTINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS profile_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_period_start TEXT,
    cycle_length INTEGER NOT NULL,
    period_length INTEGER NOT NULL,
    auto_period_fill INTEGER NOT NULL,
    irregular_cycle INTEGER NOT NULL,
    unpredictable_cycle INTEGER NOT NULL DEFAULT 0,
    age_group TEXT NOT NULL,
    usage_goal TEXT NOT NULL,
    track_bbt INTEGER NOT NULL DEFAULT 0,
    temperature_unit TEXT NOT NULL DEFAULT 'c',
    track_cervical_mucus INTEGER NOT NULL DEFAULT 0,
    hide_sex_chip INTEGER NOT NULL DEFAULT 0,
    language_override TEXT,
    theme_override TEXT,
    encrypted_payload TEXT
  );
`;

const CREATE_DAY_LOGS_TABLE = `
  CREATE TABLE IF NOT EXISTS day_logs (
    day TEXT PRIMARY KEY,
    is_period INTEGER NOT NULL DEFAULT 0,
    cycle_start INTEGER NOT NULL DEFAULT 0,
    is_uncertain INTEGER NOT NULL DEFAULT 0,
    flow TEXT NOT NULL DEFAULT 'none',
    mood INTEGER NOT NULL DEFAULT 0,
    sex_activity TEXT NOT NULL DEFAULT 'none',
    bbt REAL NOT NULL DEFAULT 0,
    cervical_mucus TEXT NOT NULL DEFAULT 'none',
    cycle_factor_keys TEXT NOT NULL DEFAULT '[]',
    symptom_ids TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    encrypted_payload TEXT
  );
`;

const CREATE_SYNC_PREFERENCES_TABLE = `
  CREATE TABLE IF NOT EXISTS sync_preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    mode TEXT NOT NULL DEFAULT 'managed',
    endpoint_input TEXT NOT NULL DEFAULT '',
    normalized_endpoint TEXT NOT NULL DEFAULT 'https://sync.ovumcy.com',
    device_label TEXT NOT NULL DEFAULT '',
    setup_status TEXT NOT NULL DEFAULT 'not_configured',
    prepared_at TEXT,
    last_remote_generation INTEGER,
    last_synced_at TEXT
  );
`;

const CREATE_SYMPTOMS_TABLE = `
  CREATE TABLE IF NOT EXISTS symptoms (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    label TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL,
    encrypted_payload TEXT
  );
`;

const CREATE_SYMPTOMS_SLUG_INDEX = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_symptoms_slug
  ON symptoms(slug);
`;

const ADD_PROFILE_ENCRYPTED_PAYLOAD_COLUMN = `
  ALTER TABLE profile_settings ADD COLUMN encrypted_payload TEXT;
`;

const ADD_DAY_LOG_ENCRYPTED_PAYLOAD_COLUMN = `
  ALTER TABLE day_logs ADD COLUMN encrypted_payload TEXT;
`;

const ADD_SYMPTOM_ENCRYPTED_PAYLOAD_COLUMN = `
  ALTER TABLE symptoms ADD COLUMN encrypted_payload TEXT;
`;

const ADD_SYNC_LAST_REMOTE_GENERATION_COLUMN = `
  ALTER TABLE sync_preferences ADD COLUMN last_remote_generation INTEGER;
`;

const ADD_SYNC_LAST_SYNCED_AT_COLUMN = `
  ALTER TABLE sync_preferences ADD COLUMN last_synced_at TEXT;
`;

type BootstrapStateRow = {
  has_completed_onboarding: number;
  profile_version: number;
};

type ProfileSettingsRow = {
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
  encrypted_payload: string | null;
};

type LegacyOnboardingProfileRow = {
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

type SyncPreferencesRow = {
  mode: string;
  endpoint_input: string;
  normalized_endpoint: string;
  device_label: string;
  setup_status: string;
  prepared_at: string | null;
  last_remote_generation: number | null;
  last_synced_at: string | null;
};

type TableInfoRow = {
  name: string;
};

type DayLogSummaryRow = {
  total_entries: number;
  date_from: string | null;
  date_to: string | null;
};

type DayLogRow = {
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
  encrypted_payload: string | null;
};

type SymptomRow = {
  id: string;
  slug: string;
  label: string;
  icon: string;
  color: string;
  is_default: number;
  is_archived: number;
  sort_order: number;
  encrypted_payload: string | null;
};

export interface LocalAppDatabase {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
  closeAsync?(): Promise<void>;
}

type LegacyLocalAppStorageSource = {
  clear(): Promise<void>;
  hasData(): Promise<boolean>;
  readBootstrapState(): Promise<LocalBootstrapState>;
  readProfileRecord(): Promise<ProfileRecord>;
};

type CreateSQLiteAppStorageOptions = {
  deleteDatabase?: () => Promise<void>;
  legacyStorageSource?: LegacyLocalAppStorageSource;
  localDataKeyStore?: LocalDataKeyStore;
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
  async readProfileRecord() {
    return readAsyncStorageProfileRecord();
  },
};

export function createSQLiteAppStorage(
  options: CreateSQLiteAppStorageOptions = {},
): LocalAppStorage {
  const deleteDatabase = options.deleteDatabase ?? deleteLocalAppDatabase;
  const openDatabase = options.openDatabase ?? openLocalAppDatabase;
  const localDataKeyStore =
    options.localDataKeyStore ?? createInMemoryLocalDataKeyStore();
  const legacyStorageSource =
    options.legacyStorageSource ?? defaultLegacyStorageSource;
  let hydratedDatabasePromise: Promise<LocalAppDatabase> | null = null;
  let localDataKeyPromise: Promise<string> | null = null;

  async function getHydratedDatabase() {
    if (!hydratedDatabasePromise) {
      hydratedDatabasePromise = hydrateLocalAppDatabase(
        openDatabase,
        legacyStorageSource,
        localDataKeyStore,
      );
    }

    return hydratedDatabasePromise;
  }

  async function getLocalDataKey(database: LocalAppDatabase) {
    if (!localDataKeyPromise) {
      localDataKeyPromise = resolveLocalDataKey(database, localDataKeyStore);
    }

    return localDataKeyPromise;
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

    async clearAllLocalData(): Promise<void> {
      const database = await getHydratedDatabase();
      hydratedDatabasePromise = null;
      localDataKeyPromise = null;

      try {
        if (typeof database.closeAsync === "function") {
          await database.closeAsync();
        }

        await deleteDatabase();
        await legacyStorageSource.clear();
        await localDataKeyStore.clearLocalDataKey();
      } catch (error) {
        hydratedDatabasePromise = null;
        localDataKeyPromise = null;
        throw error;
      }
    },

    async readProfileRecord(): Promise<ProfileRecord> {
      const database = await getHydratedDatabase();
      const localDataKey = await getLocalDataKey(database);
      const row = await database.getFirstAsync<ProfileSettingsRow>(
        `SELECT
          last_period_start,
          cycle_length,
          period_length,
          auto_period_fill,
          irregular_cycle,
          unpredictable_cycle,
          age_group,
          usage_goal,
          track_bbt,
          temperature_unit,
          track_cervical_mucus,
          hide_sex_chip,
          language_override,
          theme_override,
          encrypted_payload
         FROM profile_settings
         WHERE id = 1;`,
      );

      return row
        ? mapProfileSettingsRow(row, localDataKey)
        : createDefaultProfileRecord();
    },

    async writeProfileRecord(record: ProfileRecord): Promise<void> {
      const database = await getHydratedDatabase();
      await upsertProfileRecord(database, record, await getLocalDataKey(database));
    },

    async readSyncPreferencesRecord(): Promise<SyncPreferencesRecord> {
      const database = await getHydratedDatabase();
      const row = await database.getFirstAsync<SyncPreferencesRow>(
        `SELECT
          mode,
          endpoint_input,
          normalized_endpoint,
          device_label,
          setup_status,
          prepared_at,
          last_remote_generation,
          last_synced_at
         FROM sync_preferences
         WHERE id = 1;`,
      );

      return row ? mapSyncPreferencesRow(row) : createDefaultSyncPreferencesRecord();
    },

    async writeSyncPreferencesRecord(record: SyncPreferencesRecord): Promise<void> {
      const database = await getHydratedDatabase();
      await upsertSyncPreferencesRecord(database, record);
    },

    async readOnboardingRecord(): Promise<OnboardingRecord> {
      const profile = await this.readProfileRecord();
      return profileToOnboardingRecord(profile);
    },

    async writeOnboardingRecord(record: OnboardingRecord): Promise<void> {
      const currentProfile = await this.readProfileRecord();
      const nextProfile = applyOnboardingRecordToProfile(currentProfile, record);

      await this.writeProfileRecord(nextProfile);
    },

    async readDayLogRecord(date: DayLogRecord["date"]): Promise<DayLogRecord> {
      const database = await getHydratedDatabase();
      const localDataKey = await getLocalDataKey(database);
      const row = await database.getFirstAsync<DayLogRow>(
        `SELECT
          day,
          is_period,
          cycle_start,
          is_uncertain,
          flow,
          mood,
          sex_activity,
          bbt,
          cervical_mucus,
          cycle_factor_keys,
          symptom_ids,
          notes,
          encrypted_payload
         FROM day_logs
         WHERE day = ?;`,
        date,
      );

      return row ? mapDayLogRow(row, localDataKey) : createEmptyDayLogRecord(date);
    },

    async writeDayLogRecord(record: DayLogRecord): Promise<void> {
      const database = await getHydratedDatabase();
      await upsertDayLogRecord(database, record, await getLocalDataKey(database));
    },

    async deleteDayLogRecord(date: DayLogRecord["date"]): Promise<void> {
      const database = await getHydratedDatabase();
      await database.runAsync("DELETE FROM day_logs WHERE day = ?;", date);
    },

    async listDayLogRecordsInRange(
      from: DayLogRecord["date"],
      to: DayLogRecord["date"],
    ): Promise<DayLogRecord[]> {
      const database = await getHydratedDatabase();
      const localDataKey = await getLocalDataKey(database);
      const rows = await database.getAllAsync<DayLogRow>(
        `SELECT
          day,
          is_period,
          cycle_start,
          is_uncertain,
          flow,
          mood,
          sex_activity,
          bbt,
          cervical_mucus,
          cycle_factor_keys,
          symptom_ids,
          notes,
          encrypted_payload
         FROM day_logs
         WHERE day >= ? AND day <= ?
         ORDER BY day ASC;`,
        from,
        to,
      );

      return rows.map((row) => mapDayLogRow(row, localDataKey));
    },

    async readDayLogSummary(
      from?: DayLogRecord["date"],
      to?: DayLogRecord["date"],
    ): Promise<LocalDayLogSummary> {
      const database = await getHydratedDatabase();
      const row = from || to
        ? await database.getFirstAsync<DayLogSummaryRow>(
            `SELECT
              COUNT(*) AS total_entries,
              MIN(day) AS date_from,
              MAX(day) AS date_to
             FROM day_logs
             WHERE (? IS NULL OR day >= ?)
               AND (? IS NULL OR day <= ?);`,
            from ?? null,
            from ?? null,
            to ?? null,
            to ?? null,
          )
        : await database.getFirstAsync<DayLogSummaryRow>(
            `SELECT
              COUNT(*) AS total_entries,
              MIN(day) AS date_from,
              MAX(day) AS date_to
             FROM day_logs;`,
          );

      return mapDayLogSummaryRow(row);
    },

    async listSymptomRecords(): Promise<SymptomRecord[]> {
      const database = await getHydratedDatabase();
      const localDataKey = await getLocalDataKey(database);
      const rows = await database.getAllAsync<SymptomRow>(
        `SELECT
          id,
          slug,
          label,
          icon,
          color,
          is_default,
          is_archived,
          sort_order,
          encrypted_payload
         FROM symptoms
         ORDER BY sort_order ASC, id ASC;`,
      );

      return rows.length > 0
        ? rows.map((row) => mapSymptomRow(row, localDataKey))
        : createDefaultSymptomRecords();
    },

    async writeSymptomRecord(record: SymptomRecord): Promise<void> {
      const database = await getHydratedDatabase();
      await upsertSymptomRecord(database, record, await getLocalDataKey(database));
    },
  };
}

async function openLocalAppDatabase(): Promise<LocalAppDatabase> {
  return openDatabaseAsync(DATABASE_NAME);
}

async function deleteLocalAppDatabase(): Promise<void> {
  await deleteDatabaseAsync(DATABASE_NAME);
}

async function hydrateLocalAppDatabase(
  openDatabase: () => Promise<LocalAppDatabase>,
  legacyStorageSource: LegacyLocalAppStorageSource,
  localDataKeyStore: LocalDataKeyStore,
): Promise<LocalAppDatabase> {
  const database = createSerializedLocalAppDatabase(await openDatabase());

  await ensureLocalAppSchema(database);
  const localDataKey = await resolveLocalDataKey(database, localDataKeyStore);
  await maybeMigrateLegacyLocalAppData(database, legacyStorageSource, localDataKey);
  await migratePlaintextLocalDataRows(database, localDataKey);
  await ensureSeedRows(database, localDataKey);

  return database;
}

function createSerializedLocalAppDatabase(
  database: LocalAppDatabase,
): LocalAppDatabase {
  let queue = Promise.resolve();

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = queue.then(task, task);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  const serializedDatabase: LocalAppDatabase = {
    execAsync(source) {
      return enqueue(() => database.execAsync(source));
    },
    getFirstAsync<T>(source: string, ...params: unknown[]) {
      return enqueue(() => database.getFirstAsync<T>(source, ...params));
    },
    getAllAsync<T>(source: string, ...params: unknown[]) {
      return enqueue(() => database.getAllAsync<T>(source, ...params));
    },
    runAsync(source, ...params) {
      return enqueue(() => database.runAsync(source, ...params));
    },
  };

  if (typeof database.closeAsync === "function") {
    serializedDatabase.closeAsync = () => enqueue(() => database.closeAsync!());
  }

  return serializedDatabase;
}

async function ensureLocalAppSchema(database: LocalAppDatabase): Promise<void> {
  const versionRow = await database.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version;",
  );
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    await reconcileSyncPreferencesSchema(database);
    return;
  }

  if (currentVersion === 0) {
    await database.execAsync(CREATE_BOOTSTRAP_STATE_TABLE);
    await database.execAsync(CREATE_PROFILE_SETTINGS_TABLE);
    await database.execAsync(CREATE_DAY_LOGS_TABLE);
    await database.execAsync(CREATE_SYNC_PREFERENCES_TABLE);
    await database.execAsync(CREATE_SYMPTOMS_TABLE);
    await database.execAsync(CREATE_SYMPTOMS_SLUG_INDEX);
    await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
    await reconcileSyncPreferencesSchema(database);
    return;
  }

  if (currentVersion === 1) {
    await database.execAsync(CREATE_PROFILE_SETTINGS_TABLE);
    await migrateV1OnboardingProfile(database);
    await database.execAsync("DROP TABLE IF EXISTS onboarding_profile;");
    await database.runAsync(
      `UPDATE bootstrap_state
       SET profile_version = ?
       WHERE id = 1 AND profile_version < ?;`,
      2,
      2,
    );
    await database.execAsync(CREATE_DAY_LOGS_TABLE);
    await database.execAsync(CREATE_SYNC_PREFERENCES_TABLE);
    await database.execAsync(CREATE_SYMPTOMS_TABLE);
    await database.execAsync(CREATE_SYMPTOMS_SLUG_INDEX);
    await database.execAsync(`PRAGMA user_version = 6;`);
    await migrateV7EncryptedLocalData(database);
    await database.execAsync(`PRAGMA user_version = 7;`);
    await migrateV8SyncMetadata(database);
    await database.execAsync(`PRAGMA user_version = 8;`);
    await reconcileSyncPreferencesSchema(database);
    return;
  }

  if (currentVersion === 2) {
    await migrateV4InterfacePreferences(database);
    await database.execAsync(CREATE_DAY_LOGS_TABLE);
    await database.execAsync(CREATE_SYNC_PREFERENCES_TABLE);
    await database.execAsync(CREATE_SYMPTOMS_TABLE);
    await database.execAsync(CREATE_SYMPTOMS_SLUG_INDEX);
    await database.execAsync(`PRAGMA user_version = 6;`);
    await migrateV7EncryptedLocalData(database);
    await database.execAsync(`PRAGMA user_version = 7;`);
    await migrateV8SyncMetadata(database);
    await database.execAsync(`PRAGMA user_version = 8;`);
    await reconcileSyncPreferencesSchema(database);
    return;
  }

  if (currentVersion === 3) {
    await migrateV4InterfacePreferences(database);
    await database.execAsync(CREATE_SYNC_PREFERENCES_TABLE);
    await database.execAsync(CREATE_SYMPTOMS_TABLE);
    await database.execAsync(CREATE_SYMPTOMS_SLUG_INDEX);
    await database.execAsync(`PRAGMA user_version = 6;`);
    await migrateV7EncryptedLocalData(database);
    await database.execAsync(`PRAGMA user_version = 7;`);
    await migrateV8SyncMetadata(database);
    await database.execAsync(`PRAGMA user_version = 8;`);
    await reconcileSyncPreferencesSchema(database);
    return;
  }

  if (currentVersion === 4) {
    await migrateV4InterfacePreferences(database);
    await database.execAsync(CREATE_SYNC_PREFERENCES_TABLE);
    await database.execAsync(`PRAGMA user_version = 6;`);
    await migrateV7EncryptedLocalData(database);
    await database.execAsync(`PRAGMA user_version = 7;`);
    await migrateV8SyncMetadata(database);
    await database.execAsync(`PRAGMA user_version = 8;`);
    await reconcileSyncPreferencesSchema(database);
    return;
  }

  if (currentVersion === 5) {
    await database.execAsync(CREATE_SYNC_PREFERENCES_TABLE);
    await database.execAsync(`PRAGMA user_version = 6;`);
    await migrateV7EncryptedLocalData(database);
    await database.execAsync(`PRAGMA user_version = 7;`);
    await migrateV8SyncMetadata(database);
    await database.execAsync(`PRAGMA user_version = 8;`);
    await reconcileSyncPreferencesSchema(database);
    return;
  }

  if (currentVersion === 6) {
    await migrateV7EncryptedLocalData(database);
    await database.execAsync(`PRAGMA user_version = 7;`);
    await migrateV8SyncMetadata(database);
    await database.execAsync(`PRAGMA user_version = 8;`);
    await reconcileSyncPreferencesSchema(database);
    return;
  }

  if (currentVersion === 7) {
    await migrateV8SyncMetadata(database);
    await database.execAsync(`PRAGMA user_version = 8;`);
    await reconcileSyncPreferencesSchema(database);
    return;
  }

  await database.execAsync(CREATE_BOOTSTRAP_STATE_TABLE);
  await database.execAsync(CREATE_PROFILE_SETTINGS_TABLE);
  await database.execAsync(CREATE_DAY_LOGS_TABLE);
  await database.execAsync(CREATE_SYNC_PREFERENCES_TABLE);
  await database.execAsync(CREATE_SYMPTOMS_TABLE);
  await database.execAsync(CREATE_SYMPTOMS_SLUG_INDEX);
  await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
  await reconcileSyncPreferencesSchema(database);
}

async function migrateV1OnboardingProfile(
  database: LocalAppDatabase,
): Promise<void> {
  const legacyRow = await database.getFirstAsync<LegacyOnboardingProfileRow>(
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

  if (!legacyRow) {
    return;
  }

  await upsertLegacyProfileRecord(
    database,
    applyOnboardingRecordToProfile(createDefaultProfileRecord(), {
      lastPeriodStart: legacyRow.last_period_start,
      cycleLength: legacyRow.cycle_length,
      periodLength: legacyRow.period_length,
      autoPeriodFill: legacyRow.auto_period_fill === 1,
      irregularCycle: legacyRow.irregular_cycle === 1,
      ageGroup: legacyRow.age_group as OnboardingRecord["ageGroup"],
      usageGoal: legacyRow.usage_goal as OnboardingRecord["usageGoal"],
    }),
  );
}

async function migrateV4InterfacePreferences(
  database: LocalAppDatabase,
): Promise<void> {
  await database.execAsync(
    "ALTER TABLE profile_settings ADD COLUMN language_override TEXT;",
  );
  await database.execAsync(
    "ALTER TABLE profile_settings ADD COLUMN theme_override TEXT;",
  );
}

async function migrateV7EncryptedLocalData(
	database: LocalAppDatabase,
): Promise<void> {
  await execIgnoringDuplicateColumn(
    database,
    ADD_PROFILE_ENCRYPTED_PAYLOAD_COLUMN,
  );
  await execIgnoringDuplicateColumn(
    database,
    ADD_DAY_LOG_ENCRYPTED_PAYLOAD_COLUMN,
  );
  await execIgnoringDuplicateColumn(
    database,
    ADD_SYMPTOM_ENCRYPTED_PAYLOAD_COLUMN,
	);
}

async function migrateV8SyncMetadata(
	database: LocalAppDatabase,
): Promise<void> {
	await execIgnoringDuplicateColumn(
		database,
		ADD_SYNC_LAST_REMOTE_GENERATION_COLUMN,
	);
	await execIgnoringDuplicateColumn(
		database,
		ADD_SYNC_LAST_SYNCED_AT_COLUMN,
	);
}

async function reconcileSyncPreferencesSchema(
  database: LocalAppDatabase,
): Promise<void> {
  await database.execAsync(CREATE_SYNC_PREFERENCES_TABLE);
  const tableInfoRows = await database.getAllAsync<TableInfoRow>(
    "PRAGMA table_info(sync_preferences);",
  );
  const existingColumns = new Set(
    tableInfoRows
      .map((row) => row.name)
      .filter((name): name is string => typeof name === "string"),
  );

  if (!existingColumns.has("last_remote_generation")) {
    await execIgnoringDuplicateColumn(
      database,
      ADD_SYNC_LAST_REMOTE_GENERATION_COLUMN,
    );
  }

  if (!existingColumns.has("last_synced_at")) {
    await execIgnoringDuplicateColumn(
      database,
      ADD_SYNC_LAST_SYNCED_AT_COLUMN,
    );
  }
}

async function execIgnoringDuplicateColumn(
  database: LocalAppDatabase,
  source: string,
): Promise<void> {
  try {
    await database.execAsync(source);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("duplicate column name")
    ) {
      return;
    }

    throw error;
  }
}

async function resolveLocalDataKey(
  database: LocalAppDatabase,
  localDataKeyStore: LocalDataKeyStore,
): Promise<string> {
  const existingKey = await localDataKeyStore.readLocalDataKey();
  if (existingKey) {
    return existingKey;
  }

  if (await hasEncryptedLocalData(database)) {
    await resetEncryptedLocalData(database);
  }

  const keyHex = createLocalDataKeyHex();
  await localDataKeyStore.writeLocalDataKey(keyHex);
  return keyHex;
}

async function hasEncryptedLocalData(database: LocalAppDatabase): Promise<boolean> {
  const [profileRow, dayLogRow, symptomRow] = await Promise.all([
    database.getFirstAsync<{ encrypted_payload: string | null }>(
      "SELECT encrypted_payload FROM profile_settings WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    ),
    database.getFirstAsync<{ encrypted_payload: string | null }>(
      "SELECT encrypted_payload FROM day_logs WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    ),
    database.getFirstAsync<{ encrypted_payload: string | null }>(
      "SELECT encrypted_payload FROM symptoms WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    ),
  ]);

  return Boolean(
    profileRow?.encrypted_payload ||
      dayLogRow?.encrypted_payload ||
      symptomRow?.encrypted_payload,
  );
}

async function resetEncryptedLocalData(database: LocalAppDatabase): Promise<void> {
  await database.runAsync("DELETE FROM day_logs;");
  await database.runAsync("DELETE FROM symptoms;");
  await database.runAsync("DELETE FROM profile_settings;");
  await database.runAsync("DELETE FROM bootstrap_state;");
  await database.runAsync("DELETE FROM sync_preferences;");
}

async function maybeMigrateLegacyLocalAppData(
  database: LocalAppDatabase,
  legacyStorageSource: LegacyLocalAppStorageSource,
  localDataKey: string,
): Promise<void> {
  const [bootstrapCount, profileCount, hasLegacyData] = await Promise.all([
    readRowCount(database, "bootstrap_state"),
    readRowCount(database, "profile_settings"),
    legacyStorageSource.hasData(),
  ]);

  if (bootstrapCount > 0 || profileCount > 0 || !hasLegacyData) {
    return;
  }

  const [bootstrapState, profileRecord] = await Promise.all([
    legacyStorageSource.readBootstrapState(),
    legacyStorageSource.readProfileRecord(),
  ]);

  await upsertBootstrapState(database, bootstrapState);
  await upsertProfileRecord(database, profileRecord, localDataKey);
  await legacyStorageSource.clear();
}

async function migratePlaintextLocalDataRows(
  database: LocalAppDatabase,
  localDataKey: string,
): Promise<void> {
  const profileRow = await database.getFirstAsync<ProfileSettingsRow>(
    `SELECT
      last_period_start,
      cycle_length,
      period_length,
      auto_period_fill,
      irregular_cycle,
      unpredictable_cycle,
      age_group,
      usage_goal,
      track_bbt,
      temperature_unit,
      track_cervical_mucus,
      hide_sex_chip,
      language_override,
      theme_override,
      encrypted_payload
     FROM profile_settings
     WHERE id = 1;`,
  );

  if (profileRow && !profileRow.encrypted_payload) {
    await upsertProfileRecord(
      database,
      mapLegacyProfileSettingsRow(profileRow),
      localDataKey,
    );
  }

  const dayLogRows = await database.getAllAsync<DayLogRow>(
    `SELECT
      day,
      is_period,
      cycle_start,
      is_uncertain,
      flow,
      mood,
      sex_activity,
      bbt,
      cervical_mucus,
      cycle_factor_keys,
      symptom_ids,
      notes,
      encrypted_payload
     FROM day_logs
     ORDER BY day ASC;`,
  );

  for (const row of dayLogRows) {
    if (row.encrypted_payload) {
      continue;
    }

    await upsertDayLogRecord(database, mapLegacyDayLogRow(row), localDataKey);
  }

  const symptomRows = await database.getAllAsync<SymptomRow>(
    `SELECT
      id,
      slug,
      label,
      icon,
      color,
      is_default,
      is_archived,
      sort_order,
      encrypted_payload
     FROM symptoms
     ORDER BY sort_order ASC, id ASC;`,
  );

  for (const row of symptomRows) {
    if (row.encrypted_payload) {
      continue;
    }

    await upsertSymptomRecord(database, mapLegacySymptomRow(row), localDataKey);
  }
}

async function ensureSeedRows(
  database: LocalAppDatabase,
  localDataKey: string,
): Promise<void> {
  const [bootstrapCount, profileCount, syncPreferencesCount, symptomCount] = await Promise.all([
    readRowCount(database, "bootstrap_state"),
    readRowCount(database, "profile_settings"),
    readRowCount(database, "sync_preferences"),
    readRowCount(database, "symptoms"),
  ]);

  if (bootstrapCount === 0) {
    await upsertBootstrapState(database, createDefaultBootstrapState());
  }

  if (profileCount === 0) {
    await upsertProfileRecord(database, createDefaultProfileRecord(), localDataKey);
  }

  if (syncPreferencesCount === 0) {
    await upsertSyncPreferencesRecord(database, createDefaultSyncPreferencesRecord());
  }

  if (symptomCount === 0) {
    for (const record of createDefaultSymptomRecords()) {
      await upsertSymptomRecord(database, record, localDataKey);
    }
  }
}

async function readRowCount(
  database: LocalAppDatabase,
  tableName:
    | "bootstrap_state"
    | "profile_settings"
    | "day_logs"
    | "sync_preferences"
    | "symptoms",
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

async function upsertProfileRecord(
  database: LocalAppDatabase,
  record: ProfileRecord,
  localDataKey: string,
): Promise<void> {
  const defaults = createDefaultProfileRecord();

  await database.runAsync(
    `INSERT INTO profile_settings (
       id,
       last_period_start,
       cycle_length,
       period_length,
       auto_period_fill,
       irregular_cycle,
       unpredictable_cycle,
       age_group,
       usage_goal,
       track_bbt,
       temperature_unit,
       track_cervical_mucus,
       hide_sex_chip,
       language_override,
       theme_override,
       encrypted_payload
     )
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       last_period_start = excluded.last_period_start,
       cycle_length = excluded.cycle_length,
       period_length = excluded.period_length,
       auto_period_fill = excluded.auto_period_fill,
       irregular_cycle = excluded.irregular_cycle,
       unpredictable_cycle = excluded.unpredictable_cycle,
       age_group = excluded.age_group,
       usage_goal = excluded.usage_goal,
       track_bbt = excluded.track_bbt,
       temperature_unit = excluded.temperature_unit,
       track_cervical_mucus = excluded.track_cervical_mucus,
       hide_sex_chip = excluded.hide_sex_chip,
       language_override = excluded.language_override,
       theme_override = excluded.theme_override,
       encrypted_payload = excluded.encrypted_payload;`,
    defaults.lastPeriodStart,
    defaults.cycleLength,
    defaults.periodLength,
    defaults.autoPeriodFill ? 1 : 0,
    defaults.irregularCycle ? 1 : 0,
    defaults.unpredictableCycle ? 1 : 0,
    defaults.ageGroup,
    defaults.usageGoal,
    defaults.trackBBT ? 1 : 0,
    normalizeTemperatureUnit(defaults.temperatureUnit),
    defaults.trackCervicalMucus ? 1 : 0,
    defaults.hideSexChip ? 1 : 0,
    normalizeInterfaceLanguage(defaults.languageOverride),
    normalizeThemePreference(defaults.themeOverride),
    encryptLocalDataRecord(localDataKey, record),
  );
}

async function upsertLegacyProfileRecord(
  database: LocalAppDatabase,
  record: ProfileRecord,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO profile_settings (
       id,
       last_period_start,
       cycle_length,
       period_length,
       auto_period_fill,
       irregular_cycle,
       unpredictable_cycle,
       age_group,
       usage_goal,
       track_bbt,
       temperature_unit,
       track_cervical_mucus,
       hide_sex_chip,
       language_override,
       theme_override,
       encrypted_payload
     )
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       last_period_start = excluded.last_period_start,
       cycle_length = excluded.cycle_length,
       period_length = excluded.period_length,
       auto_period_fill = excluded.auto_period_fill,
       irregular_cycle = excluded.irregular_cycle,
       unpredictable_cycle = excluded.unpredictable_cycle,
       age_group = excluded.age_group,
       usage_goal = excluded.usage_goal,
       track_bbt = excluded.track_bbt,
       temperature_unit = excluded.temperature_unit,
       track_cervical_mucus = excluded.track_cervical_mucus,
       hide_sex_chip = excluded.hide_sex_chip,
       language_override = excluded.language_override,
       theme_override = excluded.theme_override,
       encrypted_payload = excluded.encrypted_payload;`,
    record.lastPeriodStart,
    record.cycleLength,
    record.periodLength,
    record.autoPeriodFill ? 1 : 0,
    record.irregularCycle ? 1 : 0,
    record.unpredictableCycle ? 1 : 0,
    record.ageGroup,
    record.usageGoal,
    record.trackBBT ? 1 : 0,
    normalizeTemperatureUnit(record.temperatureUnit),
    record.trackCervicalMucus ? 1 : 0,
    record.hideSexChip ? 1 : 0,
    normalizeInterfaceLanguage(record.languageOverride),
    normalizeThemePreference(record.themeOverride),
    null,
  );
}

async function upsertSyncPreferencesRecord(
  database: LocalAppDatabase,
  record: SyncPreferencesRecord,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO sync_preferences (
       id,
       mode,
       endpoint_input,
       normalized_endpoint,
       device_label,
       setup_status,
       prepared_at,
       last_remote_generation,
       last_synced_at
     )
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       mode = excluded.mode,
       endpoint_input = excluded.endpoint_input,
       normalized_endpoint = excluded.normalized_endpoint,
       device_label = excluded.device_label,
       setup_status = excluded.setup_status,
       prepared_at = excluded.prepared_at,
       last_remote_generation = excluded.last_remote_generation,
       last_synced_at = excluded.last_synced_at;`,
    normalizeSyncMode(record.mode),
    record.endpointInput,
    record.normalizedEndpoint,
    record.deviceLabel,
    normalizeSyncSetupStatus(record.setupStatus),
    record.preparedAt,
    record.lastRemoteGeneration,
    record.lastSyncedAt,
  );
}

async function upsertDayLogRecord(
  database: LocalAppDatabase,
  record: DayLogRecord,
  localDataKey: string,
): Promise<void> {
  const normalized = sanitizeDayLogRecord(record);
  const defaults = createEmptyDayLogRecord(normalized.date);

  await database.runAsync(
    `INSERT INTO day_logs (
       day,
       is_period,
       cycle_start,
       is_uncertain,
       flow,
       mood,
       sex_activity,
       bbt,
       cervical_mucus,
       cycle_factor_keys,
       symptom_ids,
       notes,
       encrypted_payload
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       is_period = excluded.is_period,
       cycle_start = excluded.cycle_start,
       is_uncertain = excluded.is_uncertain,
       flow = excluded.flow,
       mood = excluded.mood,
       sex_activity = excluded.sex_activity,
       bbt = excluded.bbt,
       cervical_mucus = excluded.cervical_mucus,
       cycle_factor_keys = excluded.cycle_factor_keys,
       symptom_ids = excluded.symptom_ids,
       notes = excluded.notes,
       encrypted_payload = excluded.encrypted_payload;`,
    normalized.date,
    defaults.isPeriod ? 1 : 0,
    defaults.cycleStart ? 1 : 0,
    defaults.isUncertain ? 1 : 0,
    defaults.flow,
    defaults.mood,
    defaults.sexActivity,
    defaults.bbt,
    defaults.cervicalMucus,
    JSON.stringify(defaults.cycleFactorKeys),
    JSON.stringify(defaults.symptomIDs),
    defaults.notes,
    encryptLocalDataRecord(localDataKey, normalized),
  );
}

async function upsertSymptomRecord(
  database: LocalAppDatabase,
  record: SymptomRecord,
  localDataKey: string,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO symptoms (
       id,
       slug,
       label,
       icon,
       color,
       is_default,
       is_archived,
       sort_order,
       encrypted_payload
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       slug = excluded.slug,
       label = excluded.label,
       icon = excluded.icon,
       color = excluded.color,
       is_default = excluded.is_default,
       is_archived = excluded.is_archived,
       sort_order = excluded.sort_order,
       encrypted_payload = excluded.encrypted_payload;`,
    record.id,
    record.id,
    "",
    "",
    "#000000",
    record.isDefault ? 1 : 0,
    record.isArchived ? 1 : 0,
    record.sortOrder,
    encryptLocalDataRecord(localDataKey, record),
  );
}

function mapBootstrapStateRow(row: BootstrapStateRow): LocalBootstrapState {
  return {
    hasCompletedOnboarding: row.has_completed_onboarding === 1,
    profileVersion:
      Number.isFinite(row.profile_version) && row.profile_version > 0
        ? row.profile_version
        : createDefaultBootstrapState().profileVersion,
  };
}

function mapProfileSettingsRow(
  row: ProfileSettingsRow,
  localDataKey: string,
): ProfileRecord {
  if (row.encrypted_payload) {
    const record = decryptLocalDataRecord<ProfileRecord>(
      localDataKey,
      row.encrypted_payload,
    );

    return {
      ...createDefaultProfileRecord(),
      ...record,
      temperatureUnit: normalizeTemperatureUnit(record.temperatureUnit),
      languageOverride: normalizeInterfaceLanguage(record.languageOverride),
      themeOverride: normalizeThemePreference(record.themeOverride),
      ageGroup: record.ageGroup ?? "",
      usageGoal: record.usageGoal ?? "health",
    };
  }

  return mapLegacyProfileSettingsRow(row);
}

function mapLegacyProfileSettingsRow(row: ProfileSettingsRow): ProfileRecord {
  const defaults = createDefaultProfileRecord();

  return {
    ...defaults,
    lastPeriodStart: row.last_period_start,
    cycleLength: row.cycle_length,
    periodLength: row.period_length,
    autoPeriodFill: row.auto_period_fill === 1,
    irregularCycle: row.irregular_cycle === 1,
    unpredictableCycle: row.unpredictable_cycle === 1,
    ageGroup: row.age_group as ProfileRecord["ageGroup"],
    usageGoal: row.usage_goal as ProfileRecord["usageGoal"],
    trackBBT: row.track_bbt === 1,
    temperatureUnit: normalizeTemperatureUnit(row.temperature_unit),
    trackCervicalMucus: row.track_cervical_mucus === 1,
    hideSexChip: row.hide_sex_chip === 1,
    languageOverride: normalizeInterfaceLanguage(row.language_override),
    themeOverride: normalizeThemePreference(row.theme_override),
  };
}

function mapSyncPreferencesRow(row: SyncPreferencesRow): SyncPreferencesRecord {
  const defaults = createDefaultSyncPreferencesRecord();

  return {
    ...defaults,
    mode: normalizeSyncMode(row.mode),
    endpointInput: row.endpoint_input,
    normalizedEndpoint:
      typeof row.normalized_endpoint === "string" &&
      row.normalized_endpoint.trim().length > 0
        ? row.normalized_endpoint
        : defaults.normalizedEndpoint,
    deviceLabel: row.device_label,
    setupStatus: normalizeSyncSetupStatus(row.setup_status),
    preparedAt: row.prepared_at,
    lastRemoteGeneration:
      typeof row.last_remote_generation === "number" &&
      Number.isFinite(row.last_remote_generation)
        ? row.last_remote_generation
        : null,
    lastSyncedAt: row.last_synced_at,
  };
}

function mapDayLogRow(row: DayLogRow, localDataKey: string): DayLogRecord {
  if (row.encrypted_payload) {
    return sanitizeDayLogRecord(
      decryptLocalDataRecord<DayLogRecord>(localDataKey, row.encrypted_payload),
    );
  }

  return mapLegacyDayLogRow(row);
}

function mapLegacyDayLogRow(row: DayLogRow): DayLogRecord {
  const cycleFactorKeys = safeParseStringArray(row.cycle_factor_keys);
  const symptomIDs = safeParseStringArray(row.symptom_ids);

  return sanitizeDayLogRecord({
    date: row.day,
    isPeriod: row.is_period === 1,
    cycleStart: row.cycle_start === 1,
    isUncertain: row.is_uncertain === 1,
    flow: row.flow as DayLogRecord["flow"],
    mood: row.mood,
    sexActivity: row.sex_activity as DayLogRecord["sexActivity"],
    bbt: row.bbt,
    cervicalMucus: row.cervical_mucus as DayLogRecord["cervicalMucus"],
    cycleFactorKeys: cycleFactorKeys as DayLogRecord["cycleFactorKeys"],
    symptomIDs: symptomIDs as DayLogRecord["symptomIDs"],
    notes: row.notes,
  });
}

function mapSymptomRow(row: SymptomRow, localDataKey: string): SymptomRecord {
  if (row.encrypted_payload) {
    return decryptLocalDataRecord<SymptomRecord>(localDataKey, row.encrypted_payload);
  }

  return mapLegacySymptomRow(row);
}

function mapLegacySymptomRow(row: SymptomRow): SymptomRecord {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    icon: row.icon,
    color: row.color,
    isDefault: row.is_default === 1,
    isArchived: row.is_archived === 1,
    sortOrder: row.sort_order,
  };
}

function safeParseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

function mapDayLogSummaryRow(row: DayLogSummaryRow | null): LocalDayLogSummary {
  if (!row || !Number.isFinite(row.total_entries) || row.total_entries <= 0) {
    return {
      totalEntries: 0,
      hasData: false,
      dateFrom: null,
      dateTo: null,
    };
  }

  return {
    totalEntries: row.total_entries,
    hasData: true,
    dateFrom: row.date_from,
    dateTo: row.date_to,
  };
}
