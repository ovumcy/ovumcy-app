import { openDatabaseSync } from "expo-sqlite";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import {
  createEmptyDayLogRecord,
  type DayLogRecord,
} from "../../models/day-log";
import type { OnboardingRecord } from "../../models/onboarding";
import {
  buildLocalDataAad,
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
import {
  normalizeAgeGroup,
  normalizeTemperatureUnit,
} from "../../services/profile-settings-policy";
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
  ManagedBillingCacheRecord,
} from "./storage-contract";
import {
  createDefaultBootstrapState,
  createDefaultManagedBillingCacheRecord,
  normalizeManagedBillingCacheRecord,
  persistBootstrapIncompleteOnboardingStep,
  resolveBootstrapIncompleteOnboardingStep,
} from "./storage-contract";
import {
  collectErrorMessages,
  ensureLocalAppSchema,
  type LocalAppDatabase,
  withStorageOperationLabel,
} from "./sqlite-schema-migrations";
import {
  resolveLocalDataKey,
  wipeLocalAppTables,
} from "./sqlite-local-data-key";

export type { LocalAppDatabase } from "./sqlite-schema-migrations";

const DATABASE_NAME = "ovumcy-local.db";

type BootstrapStateRow = {
  has_completed_onboarding: number;
  profile_version: number;
  incomplete_onboarding_step: number | null;
  encrypted_payload: string | null;
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
  encrypted_payload: string | null;
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
  lh_test: string;
  pregnancy_test: string;
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

type ManagedBillingCacheRow = {
  encrypted_payload: string | null;
};

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
    const localDataKey = await getLocalDataKey(database);
    const row = await withStorageOperationLabel(
      "sqlite/readBootstrapState/select",
      () =>
        database.getFirstAsync<BootstrapStateRow>(
          `SELECT
            has_completed_onboarding,
            profile_version,
            incomplete_onboarding_step,
            encrypted_payload
           FROM bootstrap_state
           WHERE id = 1;`,
        ),
    );

    return row
      ? mapBootstrapStateRow(row, localDataKey)
      : createDefaultBootstrapState();
  }

  async function writeBootstrapStateInternal(
    state: LocalBootstrapState,
  ): Promise<void> {
    const database = await getHydratedDatabase();
    const localDataKey = await getLocalDataKey(database);
    await withStorageOperationLabel("sqlite/writeBootstrapState/upsert", () =>
      upsertBootstrapState(database, state, localDataKey),
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
    const localDataKey = await getLocalDataKey(database);
    const row = await database.getFirstAsync<SyncPreferencesRow>(
      `SELECT
        mode,
        endpoint_input,
        normalized_endpoint,
        device_label,
        setup_status,
        prepared_at,
        last_remote_generation,
        last_synced_at,
        encrypted_payload
       FROM sync_preferences
       WHERE id = 1;`,
    );

    return row
      ? mapSyncPreferencesRow(row, localDataKey)
      : createDefaultSyncPreferencesRecord();
  }

  async function writeSyncPreferencesRecordInternal(
    record: SyncPreferencesRecord,
  ): Promise<void> {
    const database = await getHydratedDatabase();
    const localDataKey = await getLocalDataKey(database);
    await upsertSyncPreferencesRecord(database, record, localDataKey);
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
    const lookupKey = buildOpaqueLookupKey(localDataKey, "day_log", date);
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
        lh_test,
        pregnancy_test,
        cycle_factor_keys,
        symptom_ids,
        notes,
        encrypted_payload
       FROM day_logs
       WHERE day = ?;`,
      lookupKey,
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
    const localDataKey = await getLocalDataKey(database);
    await database.runAsync(
      "DELETE FROM day_logs WHERE day = ?;",
      buildOpaqueLookupKey(localDataKey, "day_log", date),
    );
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
        lh_test,
        pregnancy_test,
        cycle_factor_keys,
        symptom_ids,
        notes,
        encrypted_payload
       FROM day_logs;`,
    );

    return rows
      .map((row) => mapDayLogRow(row, localDataKey))
      .filter((record) => record.date >= from && record.date <= to)
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  async function readDayLogSummaryInternal(
    from?: DayLogRecord["date"],
    to?: DayLogRecord["date"],
  ): Promise<LocalDayLogSummary> {
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
        lh_test,
        pregnancy_test,
        cycle_factor_keys,
        symptom_ids,
        notes,
        encrypted_payload
       FROM day_logs;`,
    );

    return mapDayLogSummaryRecords(
      rows
        .map((row) => mapDayLogRow(row, localDataKey))
        .filter((record) => {
          if (from && record.date < from) {
            return false;
          }
          if (to && record.date > to) {
            return false;
          }
          return true;
        }),
    );
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
       ORDER BY id ASC;`,
    );

    return rows.length > 0
      ? rows
          .map((row) => mapSymptomRow(row, localDataKey))
          .sort((left, right) => {
            if (left.sortOrder !== right.sortOrder) {
              return left.sortOrder - right.sortOrder;
            }
            return left.id.localeCompare(right.id, "en", { sensitivity: "base" });
          })
      : createDefaultSymptomRecords();
  }

  async function writeSymptomRecordInternal(record: SymptomRecord): Promise<void> {
    const database = await getHydratedDatabase();
    await upsertSymptomRecord(database, record, await getLocalDataKey(database));
  }

  async function readManagedBillingCacheRecordInternal(): Promise<ManagedBillingCacheRecord> {
    const database = await getHydratedDatabase();
    const localDataKey = await getLocalDataKey(database);
    const row = await withStorageOperationLabel(
      "sqlite/readManagedBillingCache/select",
      () =>
        database.getFirstAsync<ManagedBillingCacheRow>(
          `SELECT encrypted_payload
           FROM managed_billing_cache
           WHERE id = 1;`,
        ),
    );

    return row
      ? mapManagedBillingCacheRow(row, localDataKey)
      : createDefaultManagedBillingCacheRecord();
  }

  async function writeManagedBillingCacheRecordInternal(
    record: ManagedBillingCacheRecord,
  ): Promise<void> {
    const database = await getHydratedDatabase();
    const localDataKey = await getLocalDataKey(database);
    await withStorageOperationLabel("sqlite/writeManagedBillingCache/upsert", () =>
      upsertManagedBillingCacheRecord(database, record, localDataKey),
    );
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
    readManagedBillingCacheRecord() {
      return enqueueStorageOperation(() => readManagedBillingCacheRecordInternal());
    },
    writeManagedBillingCacheRecord(record) {
      return enqueueStorageOperation(() =>
        writeManagedBillingCacheRecordInternal(record),
      );
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

  await upsertBootstrapState(database, bootstrapState, localDataKey);
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

  const bootstrapRow = await withStorageOperationLabel(
    "sqlite/plaintextMigration/bootstrap/select",
    () =>
      database.getFirstAsync<BootstrapStateRow>(
        `SELECT
          has_completed_onboarding,
          profile_version,
          incomplete_onboarding_step,
          encrypted_payload
         FROM bootstrap_state
         WHERE id = 1;`,
      ),
  );

  if (bootstrapRow) {
    const bootstrapState = bootstrapRow.encrypted_payload
      ? mapBootstrapStateRow(bootstrapRow, localDataKey)
      : mapLegacyBootstrapStateRow(bootstrapRow);
    await upsertBootstrapState(database, bootstrapState, localDataKey);
  }

  const syncPreferencesRow = await withStorageOperationLabel(
    "sqlite/plaintextMigration/syncPreferences/select",
    () =>
      database.getFirstAsync<SyncPreferencesRow>(
        `SELECT
          mode,
          endpoint_input,
          normalized_endpoint,
          device_label,
          setup_status,
          prepared_at,
          last_remote_generation,
          last_synced_at,
          encrypted_payload
         FROM sync_preferences
         WHERE id = 1;`,
      ),
  );

  if (syncPreferencesRow) {
    const syncPreferences = syncPreferencesRow.encrypted_payload
      ? mapSyncPreferencesRow(syncPreferencesRow, localDataKey)
      : mapLegacySyncPreferencesRow(syncPreferencesRow);
    await upsertSyncPreferencesRecord(database, syncPreferences, localDataKey);
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
          lh_test,
          cycle_factor_keys,
          symptom_ids,
          notes,
          encrypted_payload
         FROM day_logs
         ORDER BY day ASC;`,
      ),
  );

  for (const row of dayLogRows) {
    const record = row.encrypted_payload
      ? mapDayLogRow(row, localDataKey)
      : mapLegacyDayLogRow(row);
    const nextLookupKey = buildOpaqueLookupKey(
      localDataKey,
      "day_log",
      record.date,
    );
    await upsertDayLogRecord(database, record, localDataKey);
    if (row.day !== nextLookupKey) {
      await database.runAsync("DELETE FROM day_logs WHERE day = ?;", row.day);
    }
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
    const record = row.encrypted_payload
      ? mapSymptomRow(row, localDataKey)
      : mapLegacySymptomRow(row);
    const nextLookupKey = buildOpaqueLookupKey(
      localDataKey,
      "symptom",
      record.id,
    );
    await upsertSymptomRecord(database, record, localDataKey);
    if (row.id !== nextLookupKey) {
      await database.runAsync("DELETE FROM symptoms WHERE id = ?;", row.id);
    }
  }
}

async function ensureSeedRows(
  database: LocalAppDatabase,
  localDataKey: string,
): Promise<void> {
  const [
    bootstrapCount,
    profileCount,
    syncPreferencesCount,
    symptomCount,
    managedBillingCacheCount,
  ] = await Promise.all([
    readRowCount(database, "bootstrap_state"),
    readRowCount(database, "profile_settings"),
    readRowCount(database, "sync_preferences"),
    readRowCount(database, "symptoms"),
    readRowCount(database, "managed_billing_cache"),
  ]);

  if (bootstrapCount === 0) {
    await upsertBootstrapState(
      database,
      createDefaultBootstrapState(),
      localDataKey,
    );
  }

  if (profileCount === 0) {
    await upsertProfileRecord(database, createDefaultProfileRecord(), localDataKey);
  }

  if (syncPreferencesCount === 0) {
    await upsertSyncPreferencesRecord(
      database,
      createDefaultSyncPreferencesRecord(),
      localDataKey,
    );
  }

  if (symptomCount === 0) {
    for (const record of createDefaultSymptomRecords()) {
      await upsertSymptomRecord(database, record, localDataKey);
    }
  }

  if (managedBillingCacheCount === 0) {
    await upsertManagedBillingCacheRecord(
      database,
      createDefaultManagedBillingCacheRecord(),
      localDataKey,
    );
  }
}

async function readRowCount(
  database: LocalAppDatabase,
  tableName:
    | "bootstrap_state"
    | "profile_settings"
    | "day_logs"
    | "sync_preferences"
    | "symptoms"
    | "managed_billing_cache",
): Promise<number> {
  const row = await database.getFirstAsync<CountRow>(
    `SELECT COUNT(*) AS count FROM ${tableName};`,
  );

  return row?.count ?? 0;
}

async function upsertBootstrapState(
  database: LocalAppDatabase,
  state: LocalBootstrapState,
  localDataKey: string,
): Promise<void> {
  // Plaintext columns hold factory defaults by design; the real state lives in
  // the encrypted payload below and is what reads use (see mapBootstrapStateRow).
  const defaults = createDefaultBootstrapState();

  await database.runAsync(
    `INSERT INTO bootstrap_state (
       id,
       has_completed_onboarding,
       profile_version,
       incomplete_onboarding_step,
       encrypted_payload
     )
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       has_completed_onboarding = excluded.has_completed_onboarding,
       profile_version = excluded.profile_version,
       incomplete_onboarding_step = excluded.incomplete_onboarding_step,
       encrypted_payload = excluded.encrypted_payload;`,
    defaults.hasCompletedOnboarding ? 1 : 0,
    defaults.profileVersion,
    persistBootstrapIncompleteOnboardingStep(
      defaults.incompleteOnboardingStep,
      defaults.hasCompletedOnboarding,
    ),
    encryptLocalDataRecord(
      localDataKey,
      state,
      buildLocalDataAad("bootstrap_state", "1"),
    ),
  );
}

async function upsertProfileRecord(
  database: LocalAppDatabase,
  record: ProfileRecord,
  localDataKey: string,
): Promise<void> {
  // The plaintext shadow columns are intentionally written with factory
  // defaults, not this record's values — the real values live only in the
  // encrypted payload below. Reads prefer encrypted_payload, so this is safe;
  // populate these columns from `record` only if a path ever reads them directly.
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
    encryptLocalDataRecord(
      localDataKey,
      record,
      buildLocalDataAad("profile_settings", "1"),
    ),
  );
}

async function upsertSyncPreferencesRecord(
  database: LocalAppDatabase,
  record: SyncPreferencesRecord,
  localDataKey: string,
): Promise<void> {
  const defaults = createDefaultSyncPreferencesRecord();
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
       last_synced_at,
       encrypted_payload
     )
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       mode = excluded.mode,
       endpoint_input = excluded.endpoint_input,
       normalized_endpoint = excluded.normalized_endpoint,
       device_label = excluded.device_label,
       setup_status = excluded.setup_status,
       prepared_at = excluded.prepared_at,
       last_remote_generation = excluded.last_remote_generation,
       last_synced_at = excluded.last_synced_at,
       encrypted_payload = excluded.encrypted_payload;`,
    normalizeSyncMode(defaults.mode),
    defaults.endpointInput,
    defaults.normalizedEndpoint,
    defaults.deviceLabel,
    normalizeSyncSetupStatus(defaults.setupStatus),
    defaults.preparedAt,
    defaults.lastRemoteGeneration,
    defaults.lastSyncedAt,
    encryptLocalDataRecord(
      localDataKey,
      record,
      buildLocalDataAad("sync_preferences", "1"),
    ),
  );
}

async function upsertDayLogRecord(
  database: LocalAppDatabase,
  record: DayLogRecord,
  localDataKey: string,
): Promise<void> {
  const normalized = sanitizeDayLogRecord(record);
  const defaults = createEmptyDayLogRecord(normalized.date);
  const lookupKey = buildOpaqueLookupKey(localDataKey, "day_log", normalized.date);

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
       lh_test,
       pregnancy_test,
       cycle_factor_keys,
       symptom_ids,
       notes,
       encrypted_payload
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       is_period = excluded.is_period,
       cycle_start = excluded.cycle_start,
       is_uncertain = excluded.is_uncertain,
       flow = excluded.flow,
       mood = excluded.mood,
       sex_activity = excluded.sex_activity,
       bbt = excluded.bbt,
       cervical_mucus = excluded.cervical_mucus,
       lh_test = excluded.lh_test,
       pregnancy_test = excluded.pregnancy_test,
       cycle_factor_keys = excluded.cycle_factor_keys,
       symptom_ids = excluded.symptom_ids,
       notes = excluded.notes,
       encrypted_payload = excluded.encrypted_payload;`,
    lookupKey,
    defaults.isPeriod ? 1 : 0,
    defaults.cycleStart ? 1 : 0,
    defaults.isUncertain ? 1 : 0,
    defaults.flow,
    defaults.mood,
    defaults.sexActivity,
    defaults.bbt,
    defaults.cervicalMucus,
    defaults.lhTest,
    defaults.pregnancyTest,
    JSON.stringify(defaults.cycleFactorKeys),
    JSON.stringify(defaults.symptomIDs),
    defaults.notes,
    encryptLocalDataRecord(
      localDataKey,
      normalized,
      buildLocalDataAad("day_log", lookupKey),
    ),
  );
}

async function upsertSymptomRecord(
  database: LocalAppDatabase,
  record: SymptomRecord,
  localDataKey: string,
): Promise<void> {
  const lookupKey = buildOpaqueLookupKey(localDataKey, "symptom", record.id);
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
    lookupKey,
    lookupKey,
    "",
    "",
    "#000000",
    0,
    0,
    0,
    encryptLocalDataRecord(
      localDataKey,
      record,
      buildLocalDataAad("symptom", lookupKey),
    ),
  );
}

async function upsertManagedBillingCacheRecord(
  database: LocalAppDatabase,
  record: ManagedBillingCacheRecord,
  localDataKey: string,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO managed_billing_cache (
       id,
       encrypted_payload
     )
     VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET
       encrypted_payload = excluded.encrypted_payload;`,
    encryptLocalDataRecord(
      localDataKey,
      normalizeManagedBillingCacheRecord(record),
      buildLocalDataAad("managed_billing_cache", "1"),
    ),
  );
}

function mapManagedBillingCacheRow(
  row: ManagedBillingCacheRow,
  localDataKey: string,
): ManagedBillingCacheRecord {
  if (!row.encrypted_payload) {
    return createDefaultManagedBillingCacheRecord();
  }

  return normalizeManagedBillingCacheRecord(
    decryptLocalDataRecord<ManagedBillingCacheRecord>(
      localDataKey,
      row.encrypted_payload,
      buildLocalDataAad("managed_billing_cache", "1"),
    ),
  );
}

function mapBootstrapStateRow(
  row: BootstrapStateRow,
  localDataKey: string,
): LocalBootstrapState {
  if (row.encrypted_payload) {
    return decryptLocalDataRecord<LocalBootstrapState>(
      localDataKey,
      row.encrypted_payload,
      buildLocalDataAad("bootstrap_state", "1"),
    );
  }

  return mapLegacyBootstrapStateRow(row);
}

function mapLegacyBootstrapStateRow(row: BootstrapStateRow): LocalBootstrapState {
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
      buildLocalDataAad("profile_settings", "1"),
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
        ageGroup: normalizeAgeGroup(record.ageGroup ?? ""),
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
    ageGroup: normalizeAgeGroup(row.age_group),
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

function mapSyncPreferencesRow(
  row: SyncPreferencesRow,
  localDataKey: string,
): SyncPreferencesRecord {
  if (row.encrypted_payload) {
    return mapNormalizedSyncPreferencesRecord(
      decryptLocalDataRecord<SyncPreferencesRecord>(
        localDataKey,
        row.encrypted_payload,
        buildLocalDataAad("sync_preferences", "1"),
      ),
    );
  }

  return mapLegacySyncPreferencesRow(row);
}

function mapLegacySyncPreferencesRow(
  row: SyncPreferencesRow,
): SyncPreferencesRecord {
  const defaults = createDefaultSyncPreferencesRecord();

  return mapNormalizedSyncPreferencesRecord({
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
  });
}

function mapDayLogRow(row: DayLogRow, localDataKey: string): DayLogRecord {
  if (row.encrypted_payload) {
    return sanitizeDayLogRecord(
      decryptLocalDataRecord<DayLogRecord>(
        localDataKey,
        row.encrypted_payload,
        buildLocalDataAad("day_log", row.day),
      ),
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
    lhTest: row.lh_test as DayLogRecord["lhTest"],
    pregnancyTest: (row.pregnancy_test ?? "none") as DayLogRecord["pregnancyTest"],
    cycleFactorKeys: cycleFactorKeys as DayLogRecord["cycleFactorKeys"],
    symptomIDs: symptomIDs as DayLogRecord["symptomIDs"],
    notes: row.notes,
  });
}

function mapSymptomRow(row: SymptomRow, localDataKey: string): SymptomRecord {
  if (row.encrypted_payload) {
    return decryptLocalDataRecord<SymptomRecord>(
      localDataKey,
      row.encrypted_payload,
      buildLocalDataAad("symptom", row.id),
    );
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

function mapNormalizedSyncPreferencesRecord(
  record: SyncPreferencesRecord,
): SyncPreferencesRecord {
  const defaults = createDefaultSyncPreferencesRecord();

  return {
    ...defaults,
    ...record,
    mode: normalizeSyncMode(record.mode),
    normalizedEndpoint:
      typeof record.normalizedEndpoint === "string" &&
      record.normalizedEndpoint.trim().length > 0
        ? record.normalizedEndpoint
        : defaults.normalizedEndpoint,
    setupStatus: normalizeSyncSetupStatus(record.setupStatus),
    lastRemoteGeneration:
      typeof record.lastRemoteGeneration === "number" &&
      Number.isFinite(record.lastRemoteGeneration)
        ? record.lastRemoteGeneration
        : null,
    lastSyncedAt: record.lastSyncedAt ?? null,
    preparedAt: record.preparedAt ?? null,
    guestSessionExpiresAt:
      typeof record.guestSessionExpiresAt === "string"
        ? record.guestSessionExpiresAt
        : null,
  };
}

function buildOpaqueLookupKey(
  localDataKey: string,
  namespace: "day_log" | "symptom",
  rawValue: string,
): string {
  return bytesToHex(
    sha256(utf8ToBytes(`${namespace}:${localDataKey}:${rawValue}`)),
  );
}

function mapDayLogSummaryRecords(
  records: readonly DayLogRecord[],
): LocalDayLogSummary {
  if (records.length === 0) {
    return {
      totalEntries: 0,
      hasData: false,
      dateFrom: null,
      dateTo: null,
    };
  }

  const sortedRecords = [...records].sort((left, right) =>
    left.date.localeCompare(right.date),
  );

  return {
    totalEntries: sortedRecords.length,
    hasData: true,
    dateFrom: sortedRecords[0]?.date ?? null,
    dateTo: sortedRecords[sortedRecords.length - 1]?.date ?? null,
  };
}
