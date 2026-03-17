import { openDatabaseAsync } from "expo-sqlite";

import {
  createEmptyDayLogRecord,
  type DayLogRecord,
} from "../../models/day-log";
import type { OnboardingRecord } from "../../models/onboarding";
import {
  createDefaultProfileRecord,
  type ProfileRecord,
} from "../../models/profile";
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
const DATABASE_VERSION = 4;

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
    hide_sex_chip INTEGER NOT NULL DEFAULT 0
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
    notes TEXT NOT NULL DEFAULT ''
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
    sort_order INTEGER NOT NULL
  );
`;

const CREATE_SYMPTOMS_SLUG_INDEX = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_symptoms_slug
  ON symptoms(slug);
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
};

export interface LocalAppDatabase {
  execAsync(source: string): Promise<void>;
  getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]>;
  runAsync(source: string, ...params: unknown[]): Promise<unknown>;
}

type LegacyLocalAppStorageSource = {
  clear(): Promise<void>;
  hasData(): Promise<boolean>;
  readBootstrapState(): Promise<LocalBootstrapState>;
  readProfileRecord(): Promise<ProfileRecord>;
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
  async readProfileRecord() {
    return readAsyncStorageProfileRecord();
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

    async readProfileRecord(): Promise<ProfileRecord> {
      const database = await getHydratedDatabase();
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
          hide_sex_chip
         FROM profile_settings
         WHERE id = 1;`,
      );

      return row ? mapProfileSettingsRow(row) : createDefaultProfileRecord();
    },

    async writeProfileRecord(record: ProfileRecord): Promise<void> {
      const database = await getHydratedDatabase();
      await upsertProfileRecord(database, record);
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
          notes
         FROM day_logs
         WHERE day = ?;`,
        date,
      );

      return row ? mapDayLogRow(row) : createEmptyDayLogRecord(date);
    },

    async writeDayLogRecord(record: DayLogRecord): Promise<void> {
      const database = await getHydratedDatabase();
      await upsertDayLogRecord(database, record);
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
          notes
         FROM day_logs
         WHERE day >= ? AND day <= ?
         ORDER BY day ASC;`,
        from,
        to,
      );

      return rows.map((row) => mapDayLogRow(row));
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
      const rows = await database.getAllAsync<SymptomRow>(
        `SELECT
          id,
          slug,
          label,
          icon,
          color,
          is_default,
          is_archived,
          sort_order
         FROM symptoms
         ORDER BY sort_order ASC, label COLLATE NOCASE ASC, id ASC;`,
      );

      return rows.length > 0
        ? rows.map((row) => mapSymptomRow(row))
        : createDefaultSymptomRecords();
    },

    async writeSymptomRecord(record: SymptomRecord): Promise<void> {
      const database = await getHydratedDatabase();
      await upsertSymptomRecord(database, record);
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

  if (currentVersion === 0) {
    await database.execAsync(CREATE_BOOTSTRAP_STATE_TABLE);
    await database.execAsync(CREATE_PROFILE_SETTINGS_TABLE);
    await database.execAsync(CREATE_DAY_LOGS_TABLE);
    await database.execAsync(CREATE_SYMPTOMS_TABLE);
    await database.execAsync(CREATE_SYMPTOMS_SLUG_INDEX);
    await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
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
    await database.execAsync(CREATE_SYMPTOMS_TABLE);
    await database.execAsync(CREATE_SYMPTOMS_SLUG_INDEX);
    await database.execAsync(`PRAGMA user_version = 4;`);
    return;
  }

  if (currentVersion === 2) {
    await database.execAsync(CREATE_DAY_LOGS_TABLE);
    await database.execAsync(CREATE_SYMPTOMS_TABLE);
    await database.execAsync(CREATE_SYMPTOMS_SLUG_INDEX);
    await database.execAsync(`PRAGMA user_version = 4;`);
    return;
  }

  if (currentVersion === 3) {
    await database.execAsync(CREATE_SYMPTOMS_TABLE);
    await database.execAsync(CREATE_SYMPTOMS_SLUG_INDEX);
    await database.execAsync(`PRAGMA user_version = 4;`);
    return;
  }

  await database.execAsync(CREATE_BOOTSTRAP_STATE_TABLE);
  await database.execAsync(CREATE_PROFILE_SETTINGS_TABLE);
  await database.execAsync(CREATE_DAY_LOGS_TABLE);
  await database.execAsync(CREATE_SYMPTOMS_TABLE);
  await database.execAsync(CREATE_SYMPTOMS_SLUG_INDEX);
  await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
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

  await upsertProfileRecord(
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

async function maybeMigrateLegacyLocalAppData(
  database: LocalAppDatabase,
  legacyStorageSource: LegacyLocalAppStorageSource,
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
  await upsertProfileRecord(database, profileRecord);
  await legacyStorageSource.clear();
}

async function ensureSeedRows(database: LocalAppDatabase): Promise<void> {
  const [bootstrapCount, profileCount, symptomCount] = await Promise.all([
    readRowCount(database, "bootstrap_state"),
    readRowCount(database, "profile_settings"),
    readRowCount(database, "symptoms"),
  ]);

  if (bootstrapCount === 0) {
    await upsertBootstrapState(database, createDefaultBootstrapState());
  }

  if (profileCount === 0) {
    await upsertProfileRecord(database, createDefaultProfileRecord());
  }

  if (symptomCount === 0) {
    for (const record of createDefaultSymptomRecords()) {
      await upsertSymptomRecord(database, record);
    }
  }
}

async function readRowCount(
  database: LocalAppDatabase,
  tableName: "bootstrap_state" | "profile_settings" | "day_logs" | "symptoms",
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
       hide_sex_chip
     )
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
       hide_sex_chip = excluded.hide_sex_chip;`,
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
  );
}

async function upsertDayLogRecord(
  database: LocalAppDatabase,
  record: DayLogRecord,
): Promise<void> {
  const normalized = sanitizeDayLogRecord(record);

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
       notes
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
       notes = excluded.notes;`,
    normalized.date,
    normalized.isPeriod ? 1 : 0,
    normalized.cycleStart ? 1 : 0,
    normalized.isUncertain ? 1 : 0,
    normalized.flow,
    normalized.mood,
    normalized.sexActivity,
    normalized.bbt,
    normalized.cervicalMucus,
    JSON.stringify(normalized.cycleFactorKeys),
    JSON.stringify(normalized.symptomIDs),
    normalized.notes,
  );
}

async function upsertSymptomRecord(
  database: LocalAppDatabase,
  record: SymptomRecord,
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
       sort_order
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       slug = excluded.slug,
       label = excluded.label,
       icon = excluded.icon,
       color = excluded.color,
       is_default = excluded.is_default,
       is_archived = excluded.is_archived,
       sort_order = excluded.sort_order;`,
    record.id,
    record.slug,
    record.label,
    record.icon,
    record.color,
    record.isDefault ? 1 : 0,
    record.isArchived ? 1 : 0,
    record.sortOrder,
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

function mapProfileSettingsRow(row: ProfileSettingsRow): ProfileRecord {
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
  };
}

function mapDayLogRow(row: DayLogRow): DayLogRecord {
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

function mapSymptomRow(row: SymptomRow): SymptomRecord {
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
