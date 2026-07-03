// Schema DDL, database-version orchestration, and the ordered schema migrations
// for the local SQLite app storage. Isolated from the CRUD repositories so future
// storage changes stop touching the file where irreversible migration code lives.

import { createDefaultBootstrapState } from "./storage-contract";

const DATABASE_VERSION = 13;

const CREATE_BOOTSTRAP_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS bootstrap_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    has_completed_onboarding INTEGER NOT NULL DEFAULT 0,
    profile_version INTEGER NOT NULL DEFAULT 2,
    incomplete_onboarding_step INTEGER DEFAULT 1,
    encrypted_payload TEXT
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
    lh_test TEXT NOT NULL DEFAULT 'none',
    pregnancy_test TEXT NOT NULL DEFAULT 'none',
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
    normalized_endpoint TEXT NOT NULL DEFAULT 'https://sync.ovumcy.cloud',
    device_label TEXT NOT NULL DEFAULT '',
    setup_status TEXT NOT NULL DEFAULT 'not_configured',
    prepared_at TEXT,
    last_remote_generation INTEGER,
    last_synced_at TEXT,
    encrypted_payload TEXT
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

// v13: last-known-good managed billing snapshot + dismissed offer ids.
// The row is a singleton and carries no plaintext shadow columns: premium
// flags are account-adjacent sensitive state, so the whole record lives in
// the AEAD-protected payload only (security.md forbids plaintext premium-flag
// persistence).
const CREATE_MANAGED_BILLING_CACHE_TABLE = `
  CREATE TABLE IF NOT EXISTS managed_billing_cache (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    encrypted_payload TEXT
  );
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

const ADD_BOOTSTRAP_ENCRYPTED_PAYLOAD_COLUMN = `
  ALTER TABLE bootstrap_state ADD COLUMN encrypted_payload TEXT;
`;

const ADD_SYNC_ENCRYPTED_PAYLOAD_COLUMN = `
  ALTER TABLE sync_preferences ADD COLUMN encrypted_payload TEXT;
`;

const ADD_DAY_LOG_LH_TEST_COLUMN = `
  ALTER TABLE day_logs ADD COLUMN lh_test TEXT NOT NULL DEFAULT 'none';
`;

const ADD_DAY_LOG_PREGNANCY_TEST_COLUMN = `
  ALTER TABLE day_logs ADD COLUMN pregnancy_test TEXT NOT NULL DEFAULT 'none';
`;

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

export function collectErrorMessages(error: unknown): string[] {
  if (!(error instanceof Error)) {
    return [];
  }

  const messages = [error.message];

  if (error.cause instanceof Error) {
    messages.push(...collectErrorMessages(error.cause));
  }

  return messages;
}

export async function withStorageOperationLabel<T>(
  operation: string,
  task: () => Promise<T>,
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw createStorageOperationError(operation, error);
  }
}

export async function ensureLocalAppSchema(database: LocalAppDatabase): Promise<void> {
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
  await withStorageOperationLabel("sqlite/schema/reconcileManagedBillingCache", () =>
    migrateV13ManagedBillingCache(database),
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

async function migrateV11DayLogLHTest(
  database: LocalAppDatabase,
): Promise<void> {
  await execIgnoringDuplicateColumn(database, ADD_DAY_LOG_LH_TEST_COLUMN);
}

async function migrateV12DayLogPregnancyTest(
  database: LocalAppDatabase,
): Promise<void> {
  await execIgnoringDuplicateColumn(
    database,
    ADD_DAY_LOG_PREGNANCY_TEST_COLUMN,
  );
}

// v12 -> v13: adds the managed_billing_cache singleton table. CREATE TABLE IF
// NOT EXISTS keeps this idempotent for both fresh installs and re-runs, so it
// can double as the reconcile step like the other table migrations.
async function migrateV13ManagedBillingCache(
  database: LocalAppDatabase,
): Promise<void> {
  await runSchemaStatement(database, CREATE_MANAGED_BILLING_CACHE_TABLE);
}

async function reconcileBootstrapStateSchema(
  database: LocalAppDatabase,
): Promise<void> {
  await runSchemaStatement(database, CREATE_BOOTSTRAP_STATE_TABLE);
  await execIgnoringDuplicateColumn(
    database,
    ADD_BOOTSTRAP_INCOMPLETE_STEP_COLUMN,
  );
  await execIgnoringDuplicateColumn(
    database,
    ADD_BOOTSTRAP_ENCRYPTED_PAYLOAD_COLUMN,
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
  await migrateV11DayLogLHTest(database);
  await migrateV12DayLogPregnancyTest(database);
}

async function reconcileSyncPreferencesSchema(
  database: LocalAppDatabase,
): Promise<void> {
  await runSchemaStatement(database, CREATE_SYNC_PREFERENCES_TABLE);
  await migrateV8SyncMetadata(database);
  await execIgnoringDuplicateColumn(
    database,
    ADD_SYNC_ENCRYPTED_PAYLOAD_COLUMN,
  );
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
