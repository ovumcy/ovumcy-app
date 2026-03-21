import { openDatabaseSync } from "expo-sqlite";

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
  normalizeCalendarPredictionNoticeKey,
  normalizeInterfaceLanguage,
  normalizeOnboardingHelperNoticeKey,
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
import {
  createDefaultBootstrapState,
  persistBootstrapIncompleteOnboardingStep,
  resolveBootstrapIncompleteOnboardingStep,
} from "./storage-contract";

const DATABASE_NAME = "ovumcy-local.db";
const DATABASE_VERSION = 9;

const CREATE_BOOTSTRAP_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS bootstrap_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    has_completed_onboarding INTEGER NOT NULL DEFAULT 0,
    profile_version INTEGER NOT NULL DEFAULT 2,
    incomplete_onboarding_step INTEGER DEFAULT 1
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

const ADD_BOOTSTRAP_INCOMPLETE_STEP_COLUMN = `
  ALTER TABLE bootstrap_state ADD COLUMN incomplete_onboarding_step INTEGER DEFAULT 1;
`;

type BootstrapStateRow = {
  has_completed_onboarding: number;
  profile_version: number;
  incomplete_onboarding_step: number | null;
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

function createStorageOperationError(
  operation: string,
  error: unknown,
): Error {
  if (error instanceof Error) {
    return new Error(`${operation}: ${error.message}`, {
      cause: error,
    });
  }

  return new Error(`${operation}: unknown sqlite error`);
}

function collectErrorMessages(error: unknown): string[] {
  if (!(error instanceof Error)) {
    return [];
  }

  const messages = [error.message];

  if (error.cause instanceof Error) {
    messages.push(...collectErrorMessages(error.cause));
  }

  return messages;
}

function isRetryableNativeSQLiteOpenError(error: unknown): boolean {
  const message = collectErrorMessages(error).join(" | ").toLowerCase();
  const touchesNativeDatabase =
    message.includes("nativedatabase.execasync") ||
    message.includes("nativedatabase.prepareasync");
  const indicatesInvalidHandle =
    message.includes("nullpointerexception") ||
    message.includes("has been rejected");

  return touchesNativeDatabase && indicatesInvalidHandle;
}

async function withStorageOperationLabel<T>(
  operation: string,
  task: () => Promise<T>,
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw createStorageOperationError(operation, error);
  }
}

type LegacyLocalAppStorageSource = {
  clear(): Promise<void>;
  hasData(): Promise<boolean>;
  readBootstrapState(): Promise<LocalBootstrapState>;
  readProfileRecord(): Promise<ProfileRecord>;
};

type CreateSQLiteAppStorageOptions = {
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
  const openDatabase = options.openDatabase ?? openLocalAppDatabase;
  const localDataKeyStore =
    options.localDataKeyStore ?? createInMemoryLocalDataKeyStore();
  const legacyStorageSource =
    options.legacyStorageSource ?? defaultLegacyStorageSource;
  let hydratedDatabasePromise: Promise<LocalAppDatabase> | null = null;
  let localDataKeyPromise: Promise<string> | null = null;
  let resetBarrierPromise: Promise<void> | null = null;
  let storageOperationQueue = Promise.resolve();

  function enqueueStorageOperation<T>(task: () => Promise<T>): Promise<T> {
    const result = storageOperationQueue.then(task, task);
    storageOperationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  function beginResetBarrier() {
    let releaseBarrier!: () => void;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    const trackedBarrier = barrier.finally(() => {
      if (resetBarrierPromise === trackedBarrier) {
        resetBarrierPromise = null;
      }
    });
    resetBarrierPromise = trackedBarrier;

    return releaseBarrier;
  }

  async function waitForResetBarrier() {
    if (resetBarrierPromise) {
      await resetBarrierPromise;
    }
  }

  async function getOrCreateHydratedDatabase() {
    if (!hydratedDatabasePromise) {
      const nextPromise = hydrateLocalAppDatabaseWithRetry(
        openDatabase,
        legacyStorageSource,
        localDataKeyStore,
      ).catch((error) => {
        if (hydratedDatabasePromise === nextPromise) {
          hydratedDatabasePromise = null;
        }
        throw error;
      });
      hydratedDatabasePromise = nextPromise;
    }

    return hydratedDatabasePromise;
  }

  async function getHydratedDatabase() {
    await waitForResetBarrier();
    return getOrCreateHydratedDatabase();
  }

  async function getLocalDataKey(database: LocalAppDatabase) {
    if (!localDataKeyPromise) {
      localDataKeyPromise = resolveLocalDataKey(database, localDataKeyStore);
    }

    return localDataKeyPromise;
  }

  async function readBootstrapStateInternal(): Promise<LocalBootstrapState> {
    const database = await getHydratedDatabase();
    const row = await withStorageOperationLabel(
      "sqlite/readBootstrapState/select",
      () =>
        database.getFirstAsync<BootstrapStateRow>(
          `SELECT
            has_completed_onboarding,
            profile_version,
            incomplete_onboarding_step
           FROM bootstrap_state
           WHERE id = 1;`,
        ),
    );

    return row ? mapBootstrapStateRow(row) : createDefaultBootstrapState();
  }

  async function writeBootstrapStateInternal(
    state: LocalBootstrapState,
  ): Promise<void> {
    const database = await getHydratedDatabase();
    await withStorageOperationLabel("sqlite/writeBootstrapState/upsert", () =>
      upsertBootstrapState(database, state),
    );
  }

  async function clearAllLocalDataInternal(): Promise<void> {
    await waitForResetBarrier();
    const releaseBarrier = beginResetBarrier();
    try {
      const database = await getOrCreateHydratedDatabase();
      localDataKeyPromise = null;
      await wipeLocalAppTables(database);
      await legacyStorageSource.clear();
      await localDataKeyStore.clearLocalDataKey();
      await ensureSeedRows(database, await getLocalDataKey(database));
    } catch (error) {
      hydratedDatabasePromise = null;
      localDataKeyPromise = null;
      throw error;
    } finally {
      releaseBarrier();
    }
  }

  async function readProfileRecordInternal(): Promise<ProfileRecord> {
    const database = await getHydratedDatabase();
    const localDataKey = await getLocalDataKey(database);
    const row = await withStorageOperationLabel(
      "sqlite/readProfileRecord/select",
      () =>
        database.getFirstAsync<ProfileSettingsRow>(
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
        ),
    );

    return row
      ? mapProfileSettingsRow(row, localDataKey)
      : createDefaultProfileRecord();
  }

  async function writeProfileRecordInternal(record: ProfileRecord): Promise<void> {
    const database = await getHydratedDatabase();
    const localDataKey = await getLocalDataKey(database);
    await withStorageOperationLabel("sqlite/writeProfileRecord/upsert", () =>
      upsertProfileRecord(database, record, localDataKey),
    );
  }

  async function readSyncPreferencesRecordInternal(): Promise<SyncPreferencesRecord> {
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
  }

  async function writeSyncPreferencesRecordInternal(
    record: SyncPreferencesRecord,
  ): Promise<void> {
    const database = await getHydratedDatabase();
    await upsertSyncPreferencesRecord(database, record);
  }

  async function readOnboardingRecordInternal(): Promise<OnboardingRecord> {
    const profile = await readProfileRecordInternal();
    return profileToOnboardingRecord(profile);
  }

  async function writeOnboardingRecordInternal(
    record: OnboardingRecord,
  ): Promise<void> {
    const currentProfile = await withStorageOperationLabel(
      "sqlite/writeOnboardingRecord/profile",
      () => readProfileRecordInternal(),
    );
    const nextProfile = applyOnboardingRecordToProfile(currentProfile, record);
    await writeProfileRecordInternal(nextProfile);
  }

  async function readDayLogRecordInternal(
    date: DayLogRecord["date"],
  ): Promise<DayLogRecord> {
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
  }

  async function writeDayLogRecordInternal(record: DayLogRecord): Promise<void> {
    const database = await getHydratedDatabase();
    await upsertDayLogRecord(database, record, await getLocalDataKey(database));
  }

  async function deleteDayLogRecordInternal(
    date: DayLogRecord["date"],
  ): Promise<void> {
    const database = await getHydratedDatabase();
    await database.runAsync("DELETE FROM day_logs WHERE day = ?;", date);
  }

  async function listDayLogRecordsInRangeInternal(
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
  }

  async function readDayLogSummaryInternal(
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
  }

  async function listSymptomRecordsInternal(): Promise<SymptomRecord[]> {
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
  }

  async function writeSymptomRecordInternal(record: SymptomRecord): Promise<void> {
    const database = await getHydratedDatabase();
    await upsertSymptomRecord(database, record, await getLocalDataKey(database));
  }

  return {
    readBootstrapState() {
      return enqueueStorageOperation(() => readBootstrapStateInternal());
    },
    writeBootstrapState(state) {
      return enqueueStorageOperation(() => writeBootstrapStateInternal(state));
    },
    clearAllLocalData() {
      return enqueueStorageOperation(() => clearAllLocalDataInternal());
    },
    readProfileRecord() {
      return enqueueStorageOperation(() => readProfileRecordInternal());
    },
    writeProfileRecord(record) {
      return enqueueStorageOperation(() => writeProfileRecordInternal(record));
    },
    readSyncPreferencesRecord() {
      return enqueueStorageOperation(() => readSyncPreferencesRecordInternal());
    },
    writeSyncPreferencesRecord(record) {
      return enqueueStorageOperation(() => writeSyncPreferencesRecordInternal(record));
    },
    readOnboardingRecord() {
      return enqueueStorageOperation(() => readOnboardingRecordInternal());
    },
    writeOnboardingRecord(record) {
      return enqueueStorageOperation(() => writeOnboardingRecordInternal(record));
    },
    readDayLogRecord(date) {
      return enqueueStorageOperation(() => readDayLogRecordInternal(date));
    },
    writeDayLogRecord(record) {
      return enqueueStorageOperation(() => writeDayLogRecordInternal(record));
    },
    deleteDayLogRecord(date) {
      return enqueueStorageOperation(() => deleteDayLogRecordInternal(date));
    },
    listDayLogRecordsInRange(from, to) {
      return enqueueStorageOperation(() => listDayLogRecordsInRangeInternal(from, to));
    },
    readDayLogSummary(from, to) {
      return enqueueStorageOperation(() => readDayLogSummaryInternal(from, to));
    },
    listSymptomRecords() {
      return enqueueStorageOperation(() => listSymptomRecordsInternal());
    },
    writeSymptomRecord(record) {
      return enqueueStorageOperation(() => writeSymptomRecordInternal(record));
    },
  };
}

async function openLocalAppDatabase(): Promise<LocalAppDatabase> {
  return openDatabaseSync(DATABASE_NAME);
}

async function hydrateLocalAppDatabaseWithRetry(
  openDatabase: () => Promise<LocalAppDatabase>,
  legacyStorageSource: LegacyLocalAppStorageSource,
  localDataKeyStore: LocalDataKeyStore,
): Promise<LocalAppDatabase> {
  try {
    return await hydrateLocalAppDatabase(
      openDatabase,
      legacyStorageSource,
      localDataKeyStore,
    );
  } catch (error) {
    if (!isRetryableNativeSQLiteOpenError(error)) {
      throw error;
    }

    return hydrateLocalAppDatabase(
      openDatabase,
      legacyStorageSource,
      localDataKeyStore,
    );
  }
}

async function hydrateLocalAppDatabase(
  openDatabase: () => Promise<LocalAppDatabase>,
  legacyStorageSource: LegacyLocalAppStorageSource,
  localDataKeyStore: LocalDataKeyStore,
): Promise<LocalAppDatabase> {
  const database = createSerializedLocalAppDatabase(await openDatabase());

  await withStorageOperationLabel("sqlite/hydrate/schema", () =>
    ensureLocalAppSchema(database),
  );
  const localDataKey = await withStorageOperationLabel(
    "sqlite/hydrate/localDataKey",
    () => resolveLocalDataKey(database, localDataKeyStore),
  );
  await withStorageOperationLabel("sqlite/hydrate/legacyMigration", () =>
    maybeMigrateLegacyLocalAppData(database, legacyStorageSource, localDataKey),
  );
  await withStorageOperationLabel("sqlite/hydrate/plaintextMigration", () =>
    migratePlaintextLocalDataRows(database, localDataKey),
  );
  await withStorageOperationLabel("sqlite/hydrate/seedRows", () =>
    ensureSeedRows(database, localDataKey),
  );

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
  await withStorageOperationLabel("sqlite/schema/createTables", async () => {
    await runSchemaStatement(database, CREATE_BOOTSTRAP_STATE_TABLE);
    await runSchemaStatement(database, CREATE_PROFILE_SETTINGS_TABLE);
    await runSchemaStatement(database, CREATE_DAY_LOGS_TABLE);
    await runSchemaStatement(database, CREATE_SYNC_PREFERENCES_TABLE);
    await runSchemaStatement(database, CREATE_SYMPTOMS_TABLE);
    await runSchemaStatement(database, CREATE_SYMPTOMS_SLUG_INDEX);
  });
  await withStorageOperationLabel("sqlite/schema/migrateV1Profile", () =>
    migrateV1OnboardingProfile(database),
  );
  await withStorageOperationLabel("sqlite/schema/reconcileBootstrap", () =>
    reconcileBootstrapStateSchema(database),
  );
  await withStorageOperationLabel("sqlite/schema/reconcileProfile", () =>
    reconcileProfileSettingsSchema(database),
  );
  await withStorageOperationLabel("sqlite/schema/reconcileDayLogs", () =>
    reconcileDayLogsSchema(database),
  );
  await withStorageOperationLabel("sqlite/schema/reconcileSync", () =>
    reconcileSyncPreferencesSchema(database),
  );
  await withStorageOperationLabel("sqlite/schema/reconcileSymptoms", () =>
    reconcileSymptomsSchema(database),
  );
  await withStorageOperationLabel("sqlite/schema/setUserVersion", () =>
    runSchemaStatement(database, `PRAGMA user_version = ${DATABASE_VERSION};`),
  );
}

async function runSchemaStatement(
  database: LocalAppDatabase,
  source: string,
): Promise<void> {
  await database.runAsync(source);
}

async function migrateV1OnboardingProfile(
  database: LocalAppDatabase,
): Promise<void> {
  try {
    await runSchemaStatement(
      database,
      `INSERT OR IGNORE INTO profile_settings (
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
       SELECT
         1,
         last_period_start,
         cycle_length,
         period_length,
         auto_period_fill,
         irregular_cycle,
         0,
         age_group,
         usage_goal,
         0,
         'c',
         0,
         0,
         NULL,
         NULL,
         NULL
       FROM onboarding_profile
       WHERE id = 1;`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("no such table")
    ) {
      return;
    }

    throw error;
  }

  await runSchemaStatement(database, "DROP TABLE IF EXISTS onboarding_profile;");
}

async function migrateV4InterfacePreferences(
  database: LocalAppDatabase,
): Promise<void> {
  await execIgnoringDuplicateColumn(
    database,
    "ALTER TABLE profile_settings ADD COLUMN language_override TEXT;",
  );
  await execIgnoringDuplicateColumn(
    database,
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

async function reconcileBootstrapStateSchema(
  database: LocalAppDatabase,
): Promise<void> {
  await runSchemaStatement(database, CREATE_BOOTSTRAP_STATE_TABLE);
  await execIgnoringDuplicateColumn(
    database,
    ADD_BOOTSTRAP_INCOMPLETE_STEP_COLUMN,
  );
  await database.runAsync(
    `UPDATE bootstrap_state
     SET profile_version = ?
     WHERE id = 1 AND profile_version < ?;`,
    createDefaultBootstrapState().profileVersion,
    createDefaultBootstrapState().profileVersion,
  );
}

async function reconcileProfileSettingsSchema(
  database: LocalAppDatabase,
): Promise<void> {
  await runSchemaStatement(database, CREATE_PROFILE_SETTINGS_TABLE);
  await migrateV4InterfacePreferences(database);
  await migrateV7EncryptedLocalData(database);
}

async function reconcileDayLogsSchema(
  database: LocalAppDatabase,
): Promise<void> {
  await runSchemaStatement(database, CREATE_DAY_LOGS_TABLE);
  await migrateV7EncryptedLocalData(database);
}

async function reconcileSyncPreferencesSchema(
  database: LocalAppDatabase,
): Promise<void> {
  await runSchemaStatement(database, CREATE_SYNC_PREFERENCES_TABLE);
  await migrateV8SyncMetadata(database);
}

async function reconcileSymptomsSchema(
  database: LocalAppDatabase,
): Promise<void> {
  await runSchemaStatement(database, CREATE_SYMPTOMS_TABLE);
  await runSchemaStatement(database, CREATE_SYMPTOMS_SLUG_INDEX);
  await migrateV7EncryptedLocalData(database);
}

async function execIgnoringDuplicateColumn(
  database: LocalAppDatabase,
  source: string,
): Promise<void> {
  try {
    await runSchemaStatement(database, source);
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

  if (
    await withStorageOperationLabel("sqlite/localDataKey/hasEncryptedData", () =>
      hasEncryptedLocalData(database),
    )
  ) {
    await wipeLocalAppTables(database);
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

async function wipeLocalAppTables(database: LocalAppDatabase): Promise<void> {
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
  const profileRow = await withStorageOperationLabel(
    "sqlite/plaintextMigration/profile/select",
    () =>
      database.getFirstAsync<ProfileSettingsRow>(
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
      ),
  );

  if (profileRow && !profileRow.encrypted_payload) {
    await upsertProfileRecord(
      database,
      mapLegacyProfileSettingsRow(profileRow),
      localDataKey,
    );
  }

  const dayLogRows = await withStorageOperationLabel(
    "sqlite/plaintextMigration/dayLogs/select",
    () =>
      database.getAllAsync<DayLogRow>(
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
      ),
  );

  for (const row of dayLogRows) {
    if (row.encrypted_payload) {
      continue;
    }

    await upsertDayLogRecord(database, mapLegacyDayLogRow(row), localDataKey);
  }

  const symptomRows = await withStorageOperationLabel(
    "sqlite/plaintextMigration/symptoms/select",
    () =>
      database.getAllAsync<SymptomRow>(
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
      ),
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
  const hasCompletedOnboarding = state.hasCompletedOnboarding === true;

  await database.runAsync(
    `INSERT INTO bootstrap_state (
       id,
       has_completed_onboarding,
       profile_version,
       incomplete_onboarding_step
     )
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       has_completed_onboarding = excluded.has_completed_onboarding,
       profile_version = excluded.profile_version,
       incomplete_onboarding_step = excluded.incomplete_onboarding_step;`,
    hasCompletedOnboarding ? 1 : 0,
    state.profileVersion,
    persistBootstrapIncompleteOnboardingStep(
      state.incompleteOnboardingStep,
      hasCompletedOnboarding,
    ),
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
  const normalizedHasCompleted = Number(row.has_completed_onboarding);
  const normalizedProfileVersion = Number(row.profile_version);
  const normalizedIncompleteStep =
    row.incomplete_onboarding_step === null
      ? null
      : Number(row.incomplete_onboarding_step);
  const hasCompletedOnboarding = normalizedHasCompleted === 1;

  return {
    hasCompletedOnboarding,
    profileVersion:
      Number.isFinite(normalizedProfileVersion) && normalizedProfileVersion > 0
        ? normalizedProfileVersion
        : createDefaultBootstrapState().profileVersion,
    incompleteOnboardingStep: resolveBootstrapIncompleteOnboardingStep(
      Number.isFinite(normalizedIncompleteStep)
        ? normalizedIncompleteStep
        : null,
      hasCompletedOnboarding,
    ),
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
        dismissedCalendarPredictionNoticeKey: normalizeCalendarPredictionNoticeKey(
          record.dismissedCalendarPredictionNoticeKey,
        ) ?? null,
        dismissedOnboardingHelperNoticeKey: normalizeOnboardingHelperNoticeKey(
          record.dismissedOnboardingHelperNoticeKey,
        ) ?? null,
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
    dismissedCalendarPredictionNoticeKey:
      defaults.dismissedCalendarPredictionNoticeKey ?? null,
    dismissedOnboardingHelperNoticeKey:
      defaults.dismissedOnboardingHelperNoticeKey ?? null,
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
