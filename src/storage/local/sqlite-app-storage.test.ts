import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createSQLiteAppStorage,
  type LocalAppDatabase,
} from "./sqlite-app-storage";
import type { LocalDataKeyStore } from "../../security/local-data-key-store";
import { createEmptyDayLogRecord } from "../../models/day-log";
import { createDefaultProfileRecord } from "../../models/profile";
import type {
  ContractionSession,
  KickCountSession,
  PregnancyRecord,
} from "../../models/pregnancy";
import type { PostpartumRecord } from "../../models/postpartum";
import type { ScreeningResponse } from "../../models/screening";
import {
  buildLocalDataAad,
  encryptLocalDataRecord,
} from "../../security/local-data-crypto";

type FakeDatabaseState = {
  bootstrapRow: {
    has_completed_onboarding: number;
    profile_version: number;
    incomplete_onboarding_step?: number | null;
    encrypted_payload?: string | null;
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
    lh_test?: string;
    pregnancy_test?: string;
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
    encrypted_payload?: string | null;
  } | null;
  // hasManagedBillingCacheTable models a pre-v13 database until the schema
  // reconcile runs CREATE TABLE for managed_billing_cache.
  hasManagedBillingCacheTable: boolean;
  managedBillingCacheRow: {
    encrypted_payload: string | null;
  } | null;
  // hasPregnancyTables models a pre-v14 database until the schema reconcile
  // runs CREATE TABLE for the three pregnancy-mode tables.
  hasPregnancyTables: boolean;
  pregnancyRecordsRows: {
    id: string;
    status: string;
    encrypted_payload: string | null;
  }[];
  kickSessionsRows: {
    id: string;
    day: string;
    encrypted_payload: string | null;
  }[];
  contractionSessionsRows: {
    id: string;
    day: string;
    encrypted_payload: string | null;
  }[];
  // hasPostpartumTable models a pre-v15 database until the schema reconcile
  // runs CREATE TABLE for postpartum_records.
  hasPostpartumTable: boolean;
  postpartumRecordsRows: {
    id: string;
    status: string;
    encrypted_payload: string | null;
  }[];
  // hasScreeningTable models a pre-v16 database until the schema reconcile runs
  // CREATE TABLE for screening_responses.
  hasScreeningTable: boolean;
  screeningResponsesRows: {
    id: string;
    day: string;
    encrypted_payload: string | null;
  }[];
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
      "encrypted_payload",
    ],
    syncPreferencesRow: null,
    hasManagedBillingCacheTable: false,
    managedBillingCacheRow: null,
    hasPregnancyTables: true,
    pregnancyRecordsRows: [],
    kickSessionsRows: [],
    contractionSessionsRows: [],
    hasPostpartumTable: true,
    postpartumRecordsRows: [],
    hasScreeningTable: true,
    screeningResponsesRows: [],
    userVersion: 0,
    ...state,
  };

  function requireManagedBillingCacheTable() {
    if (!databaseState.hasManagedBillingCacheTable) {
      throw new Error("no such table: managed_billing_cache");
    }
  }

  function requirePregnancyTables() {
    if (!databaseState.hasPregnancyTables) {
      throw new Error("no such table: pregnancy_records");
    }
  }

  function requirePostpartumTable() {
    if (!databaseState.hasPostpartumTable) {
      throw new Error("no such table: postpartum_records");
    }
  }

  function requireScreeningTable() {
    if (!databaseState.hasScreeningTable) {
      throw new Error("no such table: screening_responses");
    }
  }

  function applySchemaStatement(source: string) {
    if (source.startsWith("PRAGMA user_version =")) {
      databaseState.userVersion = Number(source.replace(/\D/g, ""));
    }

    if (source.includes("CREATE TABLE IF NOT EXISTS managed_billing_cache")) {
      databaseState.hasManagedBillingCacheTable = true;
    }

    if (source.includes("CREATE TABLE IF NOT EXISTS pregnancy_records")) {
      databaseState.hasPregnancyTables = true;
    }

    if (source.includes("CREATE TABLE IF NOT EXISTS postpartum_records")) {
      databaseState.hasPostpartumTable = true;
    }

    if (source.includes("CREATE TABLE IF NOT EXISTS screening_responses")) {
      databaseState.hasScreeningTable = true;
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

    if (source.includes("ALTER TABLE day_logs ADD COLUMN lh_test")) {
      databaseState.dayLogRows = databaseState.dayLogRows.map((row) => ({
        ...row,
        lh_test: row.lh_test ?? "none",
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
      source.includes("INSERT OR IGNORE INTO profile_settings") &&
      source.includes("FROM onboarding_profile") &&
      databaseState.onboardingRow &&
      !databaseState.profileRow
    ) {
      databaseState.profileRow = {
        last_period_start: databaseState.onboardingRow.last_period_start,
        cycle_length: databaseState.onboardingRow.cycle_length,
        period_length: databaseState.onboardingRow.period_length,
        auto_period_fill: databaseState.onboardingRow.auto_period_fill,
        irregular_cycle: databaseState.onboardingRow.irregular_cycle,
        unpredictable_cycle: 0,
        age_group: databaseState.onboardingRow.age_group,
        usage_goal: databaseState.onboardingRow.usage_goal,
        track_bbt: 0,
        temperature_unit: "c",
        track_cervical_mucus: 0,
        hide_sex_chip: 0,
        language_override: null,
        theme_override: null,
        encrypted_payload: null,
      };
    }

    if (
      source.includes(
        "ALTER TABLE bootstrap_state ADD COLUMN incomplete_onboarding_step",
      ) &&
      databaseState.bootstrapRow
    ) {
      databaseState.bootstrapRow.incomplete_onboarding_step ??= 1;
    }

    if (
      source.includes("ALTER TABLE bootstrap_state ADD COLUMN encrypted_payload") &&
      databaseState.bootstrapRow
    ) {
      databaseState.bootstrapRow.encrypted_payload ??= null;
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

    if (
      source.includes("ALTER TABLE sync_preferences ADD COLUMN encrypted_payload") &&
      !databaseState.syncPreferencesColumns.includes("encrypted_payload")
    ) {
      databaseState.syncPreferencesColumns.push("encrypted_payload");
      if (databaseState.syncPreferencesRow) {
        databaseState.syncPreferencesRow.encrypted_payload ??= null;
      }
    }
  }

  const database: LocalAppDatabase = {
    async execAsync(source: string) {
      applySchemaStatement(source);
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
      if (source.includes("COUNT(*) AS count FROM managed_billing_cache")) {
        requireManagedBillingCacheTable();
        return { count: databaseState.managedBillingCacheRow ? 1 : 0 } as T;
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
        source.includes("SELECT encrypted_payload FROM bootstrap_state") &&
        source.includes("encrypted_payload IS NOT NULL")
      ) {
        if (databaseState.bootstrapRow?.encrypted_payload) {
          return {
            encrypted_payload: databaseState.bootstrapRow.encrypted_payload,
          } as T;
        }
        return null;
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
        source.includes("SELECT encrypted_payload FROM sync_preferences") &&
        source.includes("encrypted_payload IS NOT NULL")
      ) {
        if (databaseState.syncPreferencesRow?.encrypted_payload) {
          return {
            encrypted_payload: databaseState.syncPreferencesRow.encrypted_payload,
          } as T;
        }
        return null;
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

      if (
        source.includes("SELECT encrypted_payload FROM managed_billing_cache") &&
        source.includes("encrypted_payload IS NOT NULL")
      ) {
        requireManagedBillingCacheTable();
        if (databaseState.managedBillingCacheRow?.encrypted_payload) {
          return {
            encrypted_payload:
              databaseState.managedBillingCacheRow.encrypted_payload,
          } as T;
        }
        return null;
      }

      if (source.includes("FROM managed_billing_cache")) {
        requireManagedBillingCacheTable();
        return (databaseState.managedBillingCacheRow as T) ?? null;
      }

      if (source.includes("FROM bootstrap_state")) {
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
      if (source === "PRAGMA table_info(bootstrap_state);") {
        return [
          { cid: 0, name: "id" },
          { cid: 1, name: "has_completed_onboarding" },
          { cid: 2, name: "profile_version" },
          ...(databaseState.bootstrapRow?.incomplete_onboarding_step !== undefined
            ? [{ cid: 3, name: "incomplete_onboarding_step" }]
            : []),
          { cid: 4, name: "encrypted_payload" },
        ] as T[];
      }
      if (source === "PRAGMA table_info(sync_preferences);") {
        return databaseState.syncPreferencesColumns.map((name, index) => ({
          cid: index,
          name,
        })) as T[];
      }
      if (source.includes("FROM day_logs")) {
        return [...databaseState.dayLogRows] as T[];
      }
      if (source.includes("FROM symptoms")) {
        return [...databaseState.symptomRows]
          .sort((left, right) => {
            return left.id.localeCompare(right.id, "en", { sensitivity: "base" });
          }) as T[];
      }

      if (source.includes("FROM pregnancy_records")) {
        requirePregnancyTables();
        let rows = [...databaseState.pregnancyRecordsRows];
        if (source.includes("WHERE status = 'active'")) {
          rows = rows.filter((row) => row.status === "active");
          if (source.includes("id != ?")) {
            const selfID = String(params[0]);
            rows = rows.filter((row) => row.id !== selfID);
          }
        }
        return rows as T[];
      }

      if (source.includes("FROM kick_sessions")) {
        requirePregnancyTables();
        return [...databaseState.kickSessionsRows] as T[];
      }

      if (source.includes("FROM contraction_sessions")) {
        requirePregnancyTables();
        return [...databaseState.contractionSessionsRows] as T[];
      }

      if (source.includes("FROM postpartum_records")) {
        requirePostpartumTable();
        let rows = [...databaseState.postpartumRecordsRows];
        if (source.includes("WHERE status = 'active'")) {
          rows = rows.filter((row) => row.status === "active");
          if (source.includes("id != ?")) {
            const selfID = String(params[0]);
            rows = rows.filter((row) => row.id !== selfID);
          }
        }
        return rows as T[];
      }

      if (source.includes("FROM screening_responses")) {
        requireScreeningTable();
        return [...databaseState.screeningResponsesRows] as T[];
      }

      return [];
    },

    async runAsync(source: string, ...params: unknown[]) {
      if (params.length === 0) {
        applySchemaStatement(source);
      }

      if (source.includes("INSERT INTO bootstrap_state")) {
        databaseState.bootstrapRow = {
          has_completed_onboarding: Number(params[0]),
          profile_version: Number(params[1]),
          incomplete_onboarding_step:
            typeof params[2] === "number" ? Number(params[2]) : null,
          encrypted_payload: (params[3] as string | null) ?? null,
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
          lh_test: String(params[9]),
          pregnancy_test: String(params[10]),
          cycle_factor_keys: String(params[11]),
          symptom_ids: String(params[12]),
          notes: String(params[13]),
          encrypted_payload: (params[14] as string | null) ?? null,
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
        if (source.includes("WHERE id =")) {
          const id = String(params[0]);
          databaseState.symptomRows = databaseState.symptomRows.filter(
            (row) => row.id !== id,
          );
          return { changes: 1 };
        }
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
          encrypted_payload: (params[8] as string | null) ?? null,
        };
      }
      if (source.includes("INSERT INTO managed_billing_cache")) {
        requireManagedBillingCacheTable();
        databaseState.managedBillingCacheRow = {
          encrypted_payload: (params[0] as string | null) ?? null,
        };
      }
      if (source.includes("DELETE FROM managed_billing_cache")) {
        requireManagedBillingCacheTable();
        databaseState.managedBillingCacheRow = null;
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

      if (source.includes("INSERT INTO pregnancy_records")) {
        requirePregnancyTables();
        const nextRow = {
          id: String(params[0]),
          status: String(params[1]),
          encrypted_payload: (params[2] as string | null) ?? null,
        };
        databaseState.pregnancyRecordsRows =
          databaseState.pregnancyRecordsRows.filter(
            (row) => row.id !== nextRow.id,
          );
        databaseState.pregnancyRecordsRows.push(nextRow);
      }
      if (source.includes("DELETE FROM pregnancy_records")) {
        requirePregnancyTables();
        databaseState.pregnancyRecordsRows = [];
      }

      if (source.includes("INSERT INTO kick_sessions")) {
        requirePregnancyTables();
        const nextRow = {
          id: String(params[0]),
          day: String(params[1]),
          encrypted_payload: (params[2] as string | null) ?? null,
        };
        databaseState.kickSessionsRows = databaseState.kickSessionsRows.filter(
          (row) => row.id !== nextRow.id,
        );
        databaseState.kickSessionsRows.push(nextRow);
      }
      if (source.includes("DELETE FROM kick_sessions")) {
        requirePregnancyTables();
        if (source.includes("WHERE id =")) {
          const id = String(params[0]);
          databaseState.kickSessionsRows =
            databaseState.kickSessionsRows.filter((row) => row.id !== id);
          return { changes: 1 };
        }
        databaseState.kickSessionsRows = [];
      }

      if (source.includes("INSERT INTO contraction_sessions")) {
        requirePregnancyTables();
        const nextRow = {
          id: String(params[0]),
          day: String(params[1]),
          encrypted_payload: (params[2] as string | null) ?? null,
        };
        databaseState.contractionSessionsRows =
          databaseState.contractionSessionsRows.filter(
            (row) => row.id !== nextRow.id,
          );
        databaseState.contractionSessionsRows.push(nextRow);
      }
      if (source.includes("DELETE FROM contraction_sessions")) {
        requirePregnancyTables();
        if (source.includes("WHERE id =")) {
          const id = String(params[0]);
          databaseState.contractionSessionsRows =
            databaseState.contractionSessionsRows.filter(
              (row) => row.id !== id,
            );
          return { changes: 1 };
        }
        databaseState.contractionSessionsRows = [];
      }

      if (source.includes("INSERT INTO postpartum_records")) {
        requirePostpartumTable();
        const nextRow = {
          id: String(params[0]),
          status: String(params[1]),
          encrypted_payload: (params[2] as string | null) ?? null,
        };
        databaseState.postpartumRecordsRows =
          databaseState.postpartumRecordsRows.filter(
            (row) => row.id !== nextRow.id,
          );
        databaseState.postpartumRecordsRows.push(nextRow);
      }
      if (source.includes("DELETE FROM postpartum_records")) {
        requirePostpartumTable();
        databaseState.postpartumRecordsRows = [];
      }

      if (source.includes("INSERT INTO screening_responses")) {
        requireScreeningTable();
        const nextRow = {
          id: String(params[0]),
          day: String(params[1]),
          encrypted_payload: (params[2] as string | null) ?? null,
        };
        databaseState.screeningResponsesRows =
          databaseState.screeningResponsesRows.filter(
            (row) => row.id !== nextRow.id,
          );
        databaseState.screeningResponsesRows.push(nextRow);
      }
      if (source.includes("DELETE FROM screening_responses")) {
        requireScreeningTable();
        databaseState.screeningResponsesRows = [];
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
        incompleteOnboardingStep: null,
      }),
      readProfileRecord: jest.fn().mockResolvedValue({
        lastPeriodStart: "2026-03-14",
        cycleLength: 31,
        periodLength: 6,
        autoPeriodFill: true,
        irregularCycle: true,
        unpredictableCycle: true,
        ageGroup: "age_45_plus",
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
      incompleteOnboardingStep: null,
    });
    await expect(storage.readProfileRecord()).resolves.toEqual({
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-03-14",
      cycleLength: 31,
      periodLength: 6,
      irregularCycle: true,
      unpredictableCycle: true,
      ageGroup: "age_45_plus",
      usageGoal: "trying_to_conceive",
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
    });
    expect(legacyStorageSource.clear).toHaveBeenCalledTimes(1);
  });

  it("keeps legacy plaintext intact when the encrypted migration write fails", async () => {
    // Provable-safety guard for the plaintext purge (see #57): the legacy
    // AsyncStorage residue must only be cleared AFTER the encrypted copy is
    // durably written. If the encrypted profile upsert fails mid-migration,
    // `clear()` must never run, so the plaintext source stays available for a
    // retry on the next launch rather than being deleted with no encrypted
    // replacement.
    const legacyStorageSource = {
      clear: jest.fn().mockResolvedValue(undefined),
      hasData: jest.fn().mockResolvedValue(true),
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: true,
        profileVersion: 3,
        incompleteOnboardingStep: null,
      }),
      readProfileRecord: jest.fn().mockResolvedValue({
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-03-14",
      }),
    };

    const { database } = createInspectableFakeDatabase();
    const failingDatabase: LocalAppDatabase = {
      ...database,
      execAsync: (source) => database.execAsync(source),
      getFirstAsync: <T,>(source: string, ...params: unknown[]) =>
        database.getFirstAsync<T>(source, ...params),
      getAllAsync: <T,>(source: string, ...params: unknown[]) =>
        database.getAllAsync<T>(source, ...params),
      runAsync: (source: string, ...params: unknown[]) => {
        if (source.includes("INSERT INTO profile_settings")) {
          throw new Error("simulated encrypted-write failure");
        }
        return database.runAsync(source, ...params);
      },
    };

    const storage = createSQLiteAppStorage({
      legacyStorageSource,
      openDatabase: async () => failingDatabase,
    });

    await expect(storage.readProfileRecord()).rejects.toThrow(
      "simulated encrypted-write failure",
    );
    expect(legacyStorageSource.clear).not.toHaveBeenCalled();
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
      // Legacy AgeGroup buckets persisted in v1 rows normalize to empty on read.
      ageGroup: "",
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
      incompleteOnboardingStep: 1,
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

  it("migrates a v12 database by creating and seeding the managed billing cache table", async () => {
    // Simulates an existing install: user_version already 12, no
    // managed_billing_cache table on disk yet. Hydration must create the
    // table (v13), seed the default encrypted record, and bump the version to
    // the current schema version (now 15, through the additive v13 + v14 + v15
    // steps).
    const inspected = createInspectableFakeDatabase({
      hasManagedBillingCacheTable: false,
      userVersion: 12,
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

    await expect(storage.readManagedBillingCacheRecord()).resolves.toEqual({
      snapshot: null,
      dismissedOfferIDs: [],
    });
    expect(inspected.state.hasManagedBillingCacheTable).toBe(true);
    expect(inspected.state.userVersion).toBe(16);
    expect(inspected.state.managedBillingCacheRow?.encrypted_payload).toEqual(
      expect.any(String),
    );
  });

  it("round-trips the managed billing cache record through the encrypted payload only", async () => {
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

    const record = {
      snapshot: {
        hasActivePlan: true,
        premiumFeatures: {
          advancedFertility: true,
          advancedInsights: false,
          doctorPDF: true,
          extendedReports: false,
          partnerAccess: false,
          reminders: true,
        },
        fetchedAt: "2026-07-01T10:00:00.000Z",
      },
      dismissedOfferIDs: ["offer-1", "offer-2"],
    };
    await storage.writeManagedBillingCacheRecord(record);

    await expect(storage.readManagedBillingCacheRecord()).resolves.toEqual(record);
    const storedPayload =
      inspected.state.managedBillingCacheRow?.encrypted_payload ?? "";
    // Premium flags and offer ids must never sit in plaintext columns or a
    // readable payload (security.md invariant for derived premium flags).
    expect(storedPayload).toEqual(expect.any(String));
    expect(storedPayload).not.toContain("hasActivePlan");
    expect(storedPayload).not.toContain("offer-1");
    expect(storedPayload).not.toContain("2026-07-01");
  });

  it("wipes the managed billing cache on destructive local reset and reseeds the default", async () => {
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

    await storage.writeManagedBillingCacheRecord({
      snapshot: {
        hasActivePlan: true,
        premiumFeatures: {
          advancedFertility: false,
          advancedInsights: false,
          doctorPDF: true,
          extendedReports: false,
          partnerAccess: false,
          reminders: false,
        },
        fetchedAt: "2026-07-01T10:00:00.000Z",
      },
      dismissedOfferIDs: ["offer-1"],
    });

    await storage.clearAllLocalData();

    await expect(storage.readManagedBillingCacheRecord()).resolves.toEqual({
      snapshot: null,
      dismissedOfferIDs: [],
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
      incompleteOnboardingStep: null,
    });
    await storage.writeProfileRecord({
      lastPeriodStart: "2026-03-15",
      cycleLength: 30,
      periodLength: 6,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "under_40",
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
      incompleteOnboardingStep: null,
    });
    await expect(storage.readProfileRecord()).resolves.toEqual({
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-03-15",
      cycleLength: 30,
      periodLength: 6,
      ageGroup: "under_40",
      usageGoal: "avoid_pregnancy",
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
    });
  });

  it("round-trips the system theme preference through the encrypted profile row", async () => {
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => createFakeDatabase(),
    });

    await storage.writeProfileRecord({
      ...createDefaultProfileRecord(),
      themeOverride: "system",
    });

    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({ themeOverride: "system" }),
    );
  });

  it("round-trips the Monday first-day-of-week preference through the encrypted profile row", async () => {
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => createFakeDatabase(),
    });

    await storage.writeProfileRecord({
      ...createDefaultProfileRecord(),
      firstDayOfWeek: 1,
    });

    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({ firstDayOfWeek: 1 }),
    );
  });

  it("degrades an unknown persisted theme override to null on read", async () => {
    // A legacy plaintext row (pre-encryption) or a forward-migrated profile can
    // carry a theme value this build does not know. It must sanitize to null
    // (→ the light default via the provider), never surface the raw value or
    // crash the profile read.
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () =>
        createFakeDatabase({
          profileRow: {
            last_period_start: "2026-03-15",
            cycle_length: 30,
            period_length: 6,
            auto_period_fill: 1,
            irregular_cycle: 0,
            unpredictable_cycle: 0,
            age_group: "under_40",
            usage_goal: "health",
            track_bbt: 0,
            temperature_unit: "c",
            track_cervical_mucus: 0,
            hide_sex_chip: 0,
            language_override: null,
            theme_override: "midnight",
            encrypted_payload: null,
          },
        }),
    });

    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({ themeOverride: null }),
    );
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
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: ["stress"],
      symptomIDs: ["cramps"],
      notes: "Localized journal note",
      weightKg: 65.436,
      // bpSystolic intentionally omitted — a lone BP reading must round-trip
      // without inventing its pair.
      bpDiastolic: 76.2,
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
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: ["stress"],
      symptomIDs: ["cramps"],
      notes: "Localized journal note",
      weightKg: 65.44,
      bpDiastolic: 76,
    });

    await expect(
      storage.listDayLogRecordsInRange("2026-03-01", "2026-03-31"),
    ).resolves.toEqual([
      expect.objectContaining({
        date: "2026-03-17",
        isPeriod: true,
        weightKg: 65.44,
        bpDiastolic: 76,
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
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    });
  });

  it("returns multiple day logs sorted by date and filters the summary to explicit bounds", async () => {
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => createFakeDatabase(),
    });

    // Write out of date order so the read path's own sort is what produces
    // ascending output, not insertion order.
    for (const date of ["2026-03-20", "2026-03-05", "2026-03-12"]) {
      await storage.writeDayLogRecord({
        date,
        isPeriod: true,
        cycleStart: false,
        isUncertain: false,
        flow: "light",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      });
    }

    await expect(
      storage.listDayLogRecordsInRange("2026-03-01", "2026-03-31"),
    ).resolves.toEqual([
      expect.objectContaining({ date: "2026-03-05" }),
      expect.objectContaining({ date: "2026-03-12" }),
      expect.objectContaining({ date: "2026-03-20" }),
    ]);

    // Explicit bounds narrower than the full written range exclude the
    // out-of-window entries from both the count and the from/to markers.
    await expect(
      storage.readDayLogSummary("2026-03-06", "2026-03-15"),
    ).resolves.toEqual({
      totalEntries: 1,
      hasData: true,
      dateFrom: "2026-03-12",
      dateTo: "2026-03-12",
    });

    // No bounds at all spans the full written range; the summary's own sort
    // (not insertion order) must produce the earliest/latest markers.
    await expect(storage.readDayLogSummary()).resolves.toEqual({
      totalEntries: 3,
      hasData: true,
      dateFrom: "2026-03-05",
      dateTo: "2026-03-20",
    });
  });

  it("breaks a tied symptom sort order alphabetically by id", async () => {
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => createFakeDatabase(),
    });

    for (const id of ["custom_zeta", "custom_alpha"]) {
      await storage.writeSymptomRecord({
        id,
        slug: id,
        label: id,
        icon: "✨",
        color: "#E8799F",
        isArchived: false,
        sortOrder: 999,
        isDefault: false,
      });
    }

    const records = await storage.listSymptomRecords();
    const customOrder = records
      .filter((record) => record.sortOrder === 999)
      .map((record) => record.id);

    expect(customOrder).toEqual(["custom_alpha", "custom_zeta"]);
  });

  it("wires the default legacy AsyncStorage source when none is injected", async () => {
    // Exercises the production defaultLegacyStorageSource wiring (not a test
    // double for it): a fresh SQLite storage created with no
    // legacyStorageSource override must still migrate real legacy
    // AsyncStorage data and clear it afterward.
    await AsyncStorage.clear();
    await AsyncStorage.setItem(
      "ovumcy/bootstrap-state",
      JSON.stringify({
        hasCompletedOnboarding: true,
        profileVersion: 2,
        incompleteOnboardingStep: null,
      }),
    );
    await AsyncStorage.setItem(
      "ovumcy/profile-record",
      JSON.stringify({
        lastPeriodStart: "2026-03-14",
        cycleLength: 30,
        periodLength: 6,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
        trackBBT: false,
        temperatureUnit: "c",
        trackCervicalMucus: false,
        hideSexChip: false,
        languageOverride: null,
        themeOverride: null,
      }),
    );

    const storage = createSQLiteAppStorage({
      openDatabase: async () => createFakeDatabase(),
    });

    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({ lastPeriodStart: "2026-03-14", cycleLength: 30 }),
    );
    // The default source clears the legacy plaintext keys after migrating.
    await expect(AsyncStorage.getItem("ovumcy/profile-record")).resolves.toBeNull();

    await AsyncStorage.clear();
  });

  it("loads a legacy encrypted day log payload predating pregnancy metrics with those fields left undefined", async () => {
    const localDataKey = "a".repeat(64);
    const legacyRowKey = "legacy-day-log-row";
    const legacyEncryptedPayload = encryptLocalDataRecord(
      localDataKey,
      {
        date: "2026-03-19",
        isPeriod: false,
        cycleStart: false,
        isUncertain: false,
        flow: "none",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "Pre-pregnancy-mode entry",
        // weightKg / bpSystolic / bpDiastolic intentionally absent from this
        // payload — it simulates an encrypted snapshot captured before this
        // feature existed.
      },
      buildLocalDataAad("day_log", legacyRowKey),
    );
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      localDataKeyStore: createFakeLocalDataKeyStore(localDataKey),
      openDatabase: async () =>
        createFakeDatabase({
          dayLogRows: [
            {
              day: legacyRowKey,
              is_period: 0,
              cycle_start: 0,
              is_uncertain: 0,
              flow: "none",
              mood: 0,
              sex_activity: "none",
              bbt: 0,
              cervical_mucus: "none",
              lh_test: "none",
              pregnancy_test: "none",
              cycle_factor_keys: "[]",
              symptom_ids: "[]",
              notes: "",
              encrypted_payload: legacyEncryptedPayload,
            },
          ],
        }),
    });

    const records = await storage.listDayLogRecordsInRange(
      "2026-03-01",
      "2026-03-31",
    );

    expect(records).toEqual([
      expect.objectContaining({
        date: "2026-03-19",
        notes: "Pre-pregnancy-mode entry",
      }),
    ]);
    expect(records[0]).not.toHaveProperty("weightKg");
    expect(records[0]).not.toHaveProperty("bpSystolic");
    expect(records[0]).not.toHaveProperty("bpDiastolic");
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
      ageGroup: "age_45_plus",
      usageGoal: "trying_to_conceive",
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
      languageOverride: "en",
      themeOverride: "dark",
    });
    await storage.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    });
    await storage.writeSyncPreferencesRecord({
      mode: "self_hosted",
      endpointInput: "192.168.1.20:8080",
      normalizedEndpoint: "http://192.168.1.20:8080",
      deviceLabel: "Pixel 7",
      setupStatus: "connected",
      preparedAt: "2026-03-17T10:00:00.000Z",
      lastRemoteGeneration: 123,
      lastSyncedAt: "2026-03-17T10:05:00.000Z",
      guestSessionExpiresAt: null,
      guestSessionRenewable: false,
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
      lhTest: "none",
      pregnancyTest: "none",
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

    expect(inspected.state.bootstrapRow?.encrypted_payload).toEqual(expect.any(String));
    expect(inspected.state.bootstrapRow?.has_completed_onboarding).toBe(0);
    expect(inspected.state.bootstrapRow?.incomplete_onboarding_step).toBe(1);

    expect(inspected.state.syncPreferencesRow?.encrypted_payload).toEqual(
      expect.any(String),
    );
    expect(inspected.state.syncPreferencesRow?.endpoint_input).toBe("");
    expect(inspected.state.syncPreferencesRow?.device_label).toBe("");
    expect(inspected.state.syncPreferencesRow?.setup_status).toBe(
      "not_configured",
    );

    expect(inspected.state.dayLogRows[0]?.encrypted_payload).toEqual(expect.any(String));
    expect(inspected.state.dayLogRows[0]?.encrypted_payload).not.toContain("Reset me");
    expect(inspected.state.dayLogRows[0]?.notes).toBe("");
    expect(inspected.state.dayLogRows[0]?.day).not.toBe("2026-03-17");

    expect(
      inspected.state.symptomRows.every((row) => row.is_default === 0),
    ).toBe(true);
    expect(
      inspected.state.symptomRows.every((row) => row.is_archived === 0),
    ).toBe(true);
    expect(
      inspected.state.symptomRows.every((row) => row.sort_order === 0),
    ).toBe(true);
    expect(
      inspected.state.symptomRows.some((row) => row.id === "custom_jaw_pain"),
    ).toBe(false);
    expect(
      inspected.state.symptomRows.some((row) => row.slug === "jaw-pain"),
    ).toBe(false);
    expect(
      inspected.state.symptomRows.every((row) => row.label === ""),
    ).toBe(true);
    expect(
      inspected.state.symptomRows.every(
        (row) => typeof row.encrypted_payload === "string",
      ),
    ).toBe(true);
    expect(
      inspected.state.symptomRows.every(
        (row) => !row.encrypted_payload?.includes("Jaw pain"),
      ),
    ).toBe(true);
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
      guestSessionExpiresAt: null,
      // A row written before this field existed reads back false: those guest
      // sessions had no renewal path, so the countdown they showed was right.
      guestSessionRenewable: false,
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
        encrypted_payload: encryptLocalDataRecord(
          "a".repeat(64),
          createDefaultProfileRecord(),
          buildLocalDataAad("profile_settings", "1"),
        ),
      },
      syncPreferencesRow: {
        mode: "managed",
        endpoint_input: "",
        normalized_endpoint: "https://sync.ovumcy.cloud",
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

  it("labels read-profile sqlite failures with a safe operation id", async () => {
    const inspected = createInspectableFakeDatabase({
      userVersion: 8,
    });
    const originalGetFirstAsync = inspected.database.getFirstAsync.bind(
      inspected.database,
    );
    let profileSelectCount = 0;
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      localDataKeyStore: createFakeLocalDataKeyStore(),
      openDatabase: async () => ({
        execAsync: inspected.database.execAsync,
        getAllAsync: inspected.database.getAllAsync,
        runAsync: inspected.database.runAsync,
        async getFirstAsync<T>(
          source: string,
          ...params: unknown[]
        ): Promise<T | null> {
          if (
            source.includes("FROM profile_settings") &&
            source.includes("WHERE id = 1;") &&
            ++profileSelectCount === 2
          ) {
            throw new Error("boom");
          }

          return originalGetFirstAsync<T>(source, ...params);
        },
      }),
    });

    await expect(storage.readProfileRecord()).rejects.toThrow(
      "sqlite/readProfileRecord/select: boom",
    );
  });

  it("normalizes string bootstrap row values returned by sqlite", async () => {
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () =>
        createFakeDatabase({
          userVersion: 9,
          bootstrapRow: {
            has_completed_onboarding: "1" as unknown as number,
            profile_version: "2" as unknown as number,
            incomplete_onboarding_step: "2" as unknown as number,
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
            normalized_endpoint: "https://sync.ovumcy.cloud",
            device_label: "",
            setup_status: "not_configured",
            prepared_at: null,
            last_remote_generation: null,
            last_synced_at: null,
          },
        }),
    });

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    });
  });

  it("hydrates sqlite without depending on PRAGMA user_version reads", async () => {
    const inspected = createInspectableFakeDatabase();
    const originalGetFirstAsync = inspected.database.getFirstAsync.bind(
      inspected.database,
    );
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => ({
        execAsync: inspected.database.execAsync,
        getAllAsync: inspected.database.getAllAsync,
        runAsync: inspected.database.runAsync,
        async getFirstAsync<T>(
          source: string,
          ...params: unknown[]
        ): Promise<T | null> {
          if (source === "PRAGMA user_version;") {
            throw new Error("boom");
          }

          return originalGetFirstAsync<T>(source, ...params);
        },
      }),
    });

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: false,
      profileVersion: 2,
      incompleteOnboardingStep: 1,
    });
  });

  it("labels the failing schema substep during sqlite hydrate", async () => {
    const inspected = createInspectableFakeDatabase();
    const originalRunAsync = inspected.database.runAsync.bind(inspected.database);
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => ({
        execAsync: inspected.database.execAsync,
        getAllAsync: inspected.database.getAllAsync,
        getFirstAsync: inspected.database.getFirstAsync,
        runAsync(source: string, ...params: unknown[]) {
          if (
            source.includes(
              "ALTER TABLE sync_preferences ADD COLUMN last_remote_generation",
            )
          ) {
            throw new Error("boom");
          }

          return originalRunAsync(source, ...params);
        },
      }),
    });

    await expect(storage.readBootstrapState()).rejects.toThrow(
      "sqlite/hydrate/schema: sqlite/schema/reconcileSync: boom",
    );
  });

  it("labels profile-write sqlite failures with a safe operation id", async () => {
    const inspected = createInspectableFakeDatabase({
      userVersion: 9,
      bootstrapRow: {
        has_completed_onboarding: 0,
        profile_version: 2,
        incomplete_onboarding_step: 1,
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
        encrypted_payload: encryptLocalDataRecord(
          "a".repeat(64),
          createDefaultProfileRecord(),
          buildLocalDataAad("profile_settings", "1"),
        ),
      },
      syncPreferencesRow: {
        mode: "managed",
        endpoint_input: "",
        normalized_endpoint: "https://sync.ovumcy.cloud",
        device_label: "",
        setup_status: "not_configured",
        prepared_at: null,
        last_remote_generation: null,
        last_synced_at: null,
      },
      symptomRows: [],
    });
    const originalRunAsync = inspected.database.runAsync.bind(inspected.database);
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      localDataKeyStore: createFakeLocalDataKeyStore("a".repeat(64)),
      openDatabase: async () => ({
        execAsync: inspected.database.execAsync,
        getFirstAsync: inspected.database.getFirstAsync,
        getAllAsync: inspected.database.getAllAsync,
        async runAsync(source: string, ...params: unknown[]) {
          if (source.includes("INSERT INTO profile_settings")) {
            throw new Error("boom");
          }

          return originalRunAsync(source, ...params);
        },
      }),
    });

    await expect(
      storage.writeProfileRecord({
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-03-17",
      }),
    ).rejects.toThrow("sqlite/writeProfileRecord/upsert: boom");
  });

  it("clears local data and reseeds canonical defaults", async () => {
    const legacyStorageSource = {
      clear: jest.fn().mockResolvedValue(undefined),
      hasData: jest.fn().mockResolvedValue(false),
      readBootstrapState: jest.fn(),
      readProfileRecord: jest.fn(),
    };
    const storage = createSQLiteAppStorage({
      legacyStorageSource,
      openDatabase: async () => createFakeDatabase(),
    });

    await storage.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    });
    await storage.writeProfileRecord({
      lastPeriodStart: "2026-03-15",
      cycleLength: 31,
      periodLength: 6,
      autoPeriodFill: false,
      irregularCycle: true,
      unpredictableCycle: true,
      ageGroup: "age_45_plus",
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
      lhTest: "none",
      pregnancyTest: "none",
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
      incompleteOnboardingStep: 1,
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
  });

  it("reseeds the native sqlite database without reopening it after clearing local data", async () => {
    let openDatabaseCallCount = 0;
    const closeAsync = jest.fn().mockResolvedValue(undefined);
    const legacyStorageSource = {
      clear: jest.fn().mockResolvedValue(undefined),
      hasData: jest.fn().mockResolvedValue(false),
      readBootstrapState: jest.fn(),
      readProfileRecord: jest.fn(),
    };
    const storage = createSQLiteAppStorage({
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
      ageGroup: "age_45_plus",
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

    expect(closeAsync).not.toHaveBeenCalled();
    expect(openDatabaseCallCount).toBe(1);
  });

  it("waits for local-data reset to finish before new reads observe the reseeded sqlite state", async () => {
    let releaseLegacyClear!: () => void;
    const legacyStorageSource = {
      clear: jest.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            releaseLegacyClear = resolve;
          }),
      ),
      hasData: jest.fn().mockResolvedValue(false),
      readBootstrapState: jest.fn(),
      readProfileRecord: jest.fn(),
    };
    let openDatabaseCallCount = 0;
    const storage = createSQLiteAppStorage({
      legacyStorageSource,
      openDatabase: async () => {
        openDatabaseCallCount += 1;
        return createFakeDatabase();
      },
    });

    await storage.writeProfileRecord({
      lastPeriodStart: "2026-03-15",
      cycleLength: 31,
      periodLength: 6,
      autoPeriodFill: false,
      irregularCycle: true,
      unpredictableCycle: true,
      ageGroup: "age_45_plus",
      usageGoal: "trying_to_conceive",
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
      languageOverride: null,
      themeOverride: null,
    });
    expect(openDatabaseCallCount).toBe(1);

    const clearPromise = storage.clearAllLocalData();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(legacyStorageSource.clear).toHaveBeenCalledTimes(1);

    const readProfilePromise = storage.readProfileRecord();

    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(openDatabaseCallCount).toBe(1);

    releaseLegacyClear();

    await clearPromise;
    await expect(readProfilePromise).resolves.toEqual(createDefaultProfileRecord());
    expect(openDatabaseCallCount).toBe(1);
  });

  it("waits for in-flight sqlite reads before wiping local data during reset", async () => {
    const legacyStorageSource = {
      clear: jest.fn().mockResolvedValue(undefined),
      hasData: jest.fn().mockResolvedValue(false),
      readBootstrapState: jest.fn(),
      readProfileRecord: jest.fn(),
    };
    const inspected = createInspectableFakeDatabase({
      userVersion: 8,
      bootstrapRow: {
        has_completed_onboarding: 1,
        profile_version: 2,
      },
      profileRow: {
        last_period_start: "2026-03-01",
        cycle_length: 28,
        period_length: 5,
        auto_period_fill: 1,
        irregular_cycle: 0,
        unpredictable_cycle: 0,
        age_group: "age_20_35",
        usage_goal: "health",
        track_bbt: 0,
        temperature_unit: "c",
        track_cervical_mucus: 0,
        hide_sex_chip: 0,
        language_override: null,
        theme_override: null,
        encrypted_payload: null,
      },
    });
    const originalGetFirstAsync = inspected.database.getFirstAsync.bind(
      inspected.database,
    );
    let didBlockProfileRead = false;
    let releaseProfileRead!: () => void;
    let resolveProfileReadStarted!: () => void;
    const profileReadStarted = new Promise<void>((resolve) => {
      resolveProfileReadStarted = resolve;
    });
    const storage = createSQLiteAppStorage({
      legacyStorageSource,
      localDataKeyStore: createFakeLocalDataKeyStore(),
      openDatabase: async () => ({
        execAsync: inspected.database.execAsync,
        getAllAsync: inspected.database.getAllAsync,
        runAsync: inspected.database.runAsync,
        async getFirstAsync<T>(
          source: string,
          ...params: unknown[]
        ): Promise<T | null> {
          if (
            !didBlockProfileRead &&
            source.includes("FROM profile_settings") &&
            source.includes("WHERE id = 1;")
          ) {
            didBlockProfileRead = true;
            resolveProfileReadStarted();
            await new Promise<void>((resolve) => {
              releaseProfileRead = resolve;
            });
          }

          return originalGetFirstAsync<T>(source, ...params);
        },
      }),
    });

    const readProfilePromise = storage.readProfileRecord();
    await profileReadStarted;

    const clearPromise = storage.clearAllLocalData();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(legacyStorageSource.clear).not.toHaveBeenCalled();

    releaseProfileRead();

    await expect(readProfilePromise).resolves.toEqual(
      expect.objectContaining({
        lastPeriodStart: "2026-03-01",
        cycleLength: 28,
        periodLength: 5,
      }),
    );
    await clearPromise;

    expect(legacyStorageSource.clear).toHaveBeenCalledTimes(1);
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
      ageGroup: "age_45_plus",
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
      incompleteOnboardingStep: 1,
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

  it("persists completed onboarding without writing a null bootstrap step", async () => {
    const inspected = createInspectableFakeDatabase({
      userVersion: 9,
      bootstrapRow: {
        has_completed_onboarding: 0,
        profile_version: 2,
        incomplete_onboarding_step: 2,
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
        normalized_endpoint: "https://sync.ovumcy.cloud",
        device_label: "",
        setup_status: "not_configured",
        prepared_at: null,
        last_remote_generation: null,
        last_synced_at: null,
      },
    });
    const originalRunAsync = inspected.database.runAsync.bind(inspected.database);
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      localDataKeyStore: createFakeLocalDataKeyStore("a".repeat(64)),
      openDatabase: async () => ({
        execAsync: inspected.database.execAsync,
        getFirstAsync: inspected.database.getFirstAsync,
        getAllAsync: inspected.database.getAllAsync,
        async runAsync(source: string, ...params: unknown[]) {
          if (
            source.includes("INSERT INTO bootstrap_state") &&
            params[2] === null
          ) {
            throw new Error(
              "NOT NULL constraint failed: bootstrap_state.incomplete_onboarding_step",
            );
          }

          return originalRunAsync(source, ...params);
        },
      }),
    });

    await expect(
      storage.writeBootstrapState({
        hasCompletedOnboarding: true,
        profileVersion: 2,
        incompleteOnboardingStep: null,
      }),
    ).resolves.toBeUndefined();

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    });
  });

  it("rejects decryption of a day_log row whose encrypted_payload was copied from a different row", async () => {
    // F1.a regression: AAD must bind each row's ciphertext to its lookup
    // key, so an attacker with write access to the SQLite file cannot
    // swap encrypted blobs between dates and have the app silently
    // misattribute the data.
    const inspected = createInspectableFakeDatabase();
    const keyStore = createFakeLocalDataKeyStore("a".repeat(64));
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      localDataKeyStore: keyStore,
      openDatabase: async () => inspected.database,
    });

    await storage.writeDayLogRecord({
      ...createEmptyDayLogRecord("2026-04-01"),
      notes: "morning entry",
    });
    await storage.writeDayLogRecord({
      ...createEmptyDayLogRecord("2026-04-02"),
      notes: "evening entry",
    });

    const rowA = inspected.state.dayLogRows[0];
    const rowB = inspected.state.dayLogRows[1];
    if (!rowA || !rowB) {
      throw new Error("expected two day_log rows persisted");
    }
    expect(rowA.day).not.toBe(rowB.day);
    // Manually splice row A's ciphertext into row B's slot (same key,
    // but the AAD-bound lookup key differs → AEAD tag must fail).
    rowB.encrypted_payload = rowA.encrypted_payload ?? null;

    await expect(storage.readDayLogRecord("2026-04-02")).rejects.toThrow();
  });

  it("wipes and reseeds the local database when SecureStore returns a key that no longer authenticates the on-disk data", async () => {
    // F2 regression: per SECURITY.md, a wrong-key state must trigger a
    // deterministic reset, not a crash.
    const inspected = createInspectableFakeDatabase();
    const storageWithRightKey = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      localDataKeyStore: createFakeLocalDataKeyStore("a".repeat(64)),
      openDatabase: async () => inspected.database,
    });
    await storageWithRightKey.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    });
    expect(inspected.state.bootstrapRow?.encrypted_payload).toBeTruthy();

    // Re-mount the SAME DB with a different key (simulates Android Auto
    // Backup restoring the SQLite file but SecureStore rotating the key,
    // or a key truncation during a buggy migration).
    const wrongKeyStore = createFakeLocalDataKeyStore("b".repeat(64));
    const storageWithWrongKey = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      localDataKeyStore: wrongKeyStore,
      openDatabase: async () => inspected.database,
    });

    // Must succeed by returning seedRows defaults (post-wipe), NOT crash
    // on auth-tag mismatch.
    await expect(storageWithWrongKey.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: false,
      profileVersion: 2,
      incompleteOnboardingStep: 1,
    });
    // The store should now hold a freshly minted key (not "b"*64) since
    // the canary failed and resolveLocalDataKey reseeded.
    expect(wrongKeyStore.writeLocalDataKey).toHaveBeenCalled();
  });

  it("round-trips the onboarding record through the canonical profile repository", async () => {
    // Onboarding reads/writes merge into the SAME canonical profile row, not
    // a second onboarding-only store (architecture.md: one canonical profile
    // repository shared by onboarding/settings/dashboard).
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => createFakeDatabase(),
    });

    await storage.writeOnboardingRecord({
      lastPeriodStart: "2026-04-01",
      cycleLength: 30,
      periodLength: 6,
      autoPeriodFill: true,
      irregularCycle: true,
      unpredictableCycle: false,
      ageGroup: "under_40",
      usageGoal: "avoid_pregnancy",
    });

    await expect(storage.readOnboardingRecord()).resolves.toEqual({
      lastPeriodStart: "2026-04-01",
      cycleLength: 30,
      periodLength: 6,
      autoPeriodFill: true,
      irregularCycle: true,
      unpredictableCycle: false,
      ageGroup: "under_40",
      usageGoal: "avoid_pregnancy",
    });
    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({
        lastPeriodStart: "2026-04-01",
        cycleLength: 30,
        periodLength: 6,
        ageGroup: "under_40",
        usageGoal: "avoid_pregnancy",
      }),
    );
  });

  it("resets the cached database and key so a retry re-hydrates from scratch when clearAllLocalData fails partway through", async () => {
    let openDatabaseCallCount = 0;
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => {
        openDatabaseCallCount += 1;
        const database = createFakeDatabase();
        return {
          ...database,
          async runAsync(source: string, ...params: unknown[]) {
            if (source === "DELETE FROM day_logs;" && params.length === 0) {
              throw new Error("simulated wipe failure");
            }
            return database.runAsync(source, ...params);
          },
        };
      },
    });

    await storage.readBootstrapState();
    expect(openDatabaseCallCount).toBe(1);

    await expect(storage.clearAllLocalData()).rejects.toThrow("simulated wipe failure");

    // A failed reset must not leave a poisoned cached connection behind: the
    // next operation re-opens the database rather than reusing a half-wiped
    // handle (security-constitution.md: deterministic reset, never a silent
    // partial state).
    await storage.readBootstrapState();
    expect(openDatabaseCallCount).toBe(2);
  });

  it("retries hydration once after a retryable native SQLite open error and succeeds on the second attempt", async () => {
    let openDatabaseCallCount = 0;
    let runAsyncCallCount = 0;
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () => {
        openDatabaseCallCount += 1;
        const database = createFakeDatabase();
        return {
          ...database,
          async runAsync(source: string, ...params: unknown[]) {
            runAsyncCallCount += 1;
            if (runAsyncCallCount === 1) {
              // Matches isRetryableNativeSQLiteOpenError's pattern: touches
              // NativeDatabase.execAsync AND indicates a rejected/invalid
              // handle.
              throw new Error("NativeDatabase.execAsync has been rejected");
            }
            return database.runAsync(source, ...params);
          },
        };
      },
    });

    await expect(storage.readBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: false,
      profileVersion: 2,
      incompleteOnboardingStep: 1,
    });
    // The first hydration attempt failed with a retryable native-handle
    // error; a fresh second attempt (a second openDatabase call) succeeded.
    expect(openDatabaseCallCount).toBe(2);
  });

  it("returns the default managed billing cache when the row exists but its encrypted payload is empty", async () => {
    // Defensive-degradation case distinct from "no row at all": a
    // migrated/partially-written row that carries no payload must still
    // degrade to the safe default instead of surfacing a null/undefined
    // snapshot shape.
    const inspected = createInspectableFakeDatabase({
      hasManagedBillingCacheTable: true,
      userVersion: 13,
      managedBillingCacheRow: { encrypted_payload: null },
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

    await expect(storage.readManagedBillingCacheRecord()).resolves.toEqual({
      snapshot: null,
      dismissedOfferIDs: [],
    });
  });

  it("migrates a legacy plaintext symptom row into the encrypted catalog during hydration", async () => {
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () =>
        createFakeDatabase({
          symptomRows: [
            {
              id: "legacy_glow",
              slug: "legacy-glow",
              label: "Legacy Glow",
              icon: "✨",
              color: "#123456",
              is_default: 0,
              is_archived: 0,
              sort_order: 42,
              encrypted_payload: null,
            },
          ],
        }),
    });

    // No built-in catalog is seeded alongside it: ensureSeedRows only seeds
    // defaults when the table is empty, and the migrated row already counts
    // as one row by the time seeding runs.
    await expect(storage.listSymptomRecords()).resolves.toEqual([
      {
        id: "legacy_glow",
        slug: "legacy-glow",
        label: "Legacy Glow",
        icon: "✨",
        color: "#123456",
        isDefault: false,
        isArchived: false,
        sortOrder: 42,
      },
    ]);
  });

  it("migrates legacy plaintext day-log rows into the encrypted table during hydration, tolerating malformed stored JSON arrays", async () => {
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      openDatabase: async () =>
        createFakeDatabase({
          dayLogRows: [
            {
              day: "2026-06-01",
              is_period: 1,
              cycle_start: 0,
              is_uncertain: 0,
              flow: "medium",
              mood: 3,
              sex_activity: "none",
              bbt: 0,
              cervical_mucus: "none",
              lh_test: "none",
              pregnancy_test: "none",
              // Valid JSON array: exercises the normal parse-and-filter path.
              cycle_factor_keys: '["stress"]',
              // Malformed (not valid JSON): must degrade to [] rather than throw.
              symptom_ids: "not-json",
              notes: "legacy plaintext note",
              encrypted_payload: null,
            },
            {
              day: "2026-06-02",
              is_period: 0,
              cycle_start: 0,
              is_uncertain: 0,
              flow: "none",
              mood: 0,
              sex_activity: "none",
              bbt: 0,
              cervical_mucus: "none",
              lh_test: "none",
              pregnancy_test: "none",
              // Valid JSON but not an array: must also degrade to [].
              cycle_factor_keys: "{}",
              symptom_ids: "[]",
              notes: "",
              encrypted_payload: null,
            },
          ],
        }),
    });

    await expect(storage.readDayLogRecord("2026-06-01")).resolves.toEqual({
      date: "2026-06-01",
      isPeriod: true,
      cycleStart: false,
      isUncertain: false,
      flow: "medium",
      mood: 3,
      sexActivity: "none",
      bbt: 0,
      cervicalMucus: "none",
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: ["stress"],
      symptomIDs: [],
      notes: "legacy plaintext note",
    });
    await expect(storage.readDayLogRecord("2026-06-02")).resolves.toEqual(
      expect.objectContaining({
        cycleFactorKeys: [],
        symptomIDs: [],
      }),
    );
  });

  function createPregnancyStorage(overrides?: Partial<FakeDatabaseState>) {
    const inspected = createInspectableFakeDatabase(overrides);
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      localDataKeyStore: createFakeLocalDataKeyStore("a".repeat(64)),
      openDatabase: async () => inspected.database,
    });
    return { storage, inspected };
  }

  function buildPregnancyRecord(
    overrides: Partial<PregnancyRecord> = {},
  ): PregnancyRecord {
    return {
      id: "pregnancy_1",
      status: "active",
      edd: "2026-08-15",
      eddBasis: "ultrasound",
      lmpDate: "2025-11-08",
      schedulePreset: "who2016",
      startedAt: "2025-11-10",
      endedAt: null,
      endReason: null,
      modeOfDelivery: null,
      ...overrides,
    };
  }

  function buildKickSession(
    overrides: Partial<KickCountSession> = {},
  ): KickCountSession {
    return {
      id: "kick_1",
      date: "2026-07-20",
      durationMinutes: 60,
      kickCount: 12,
      ...overrides,
    };
  }

  function buildContractionSession(
    overrides: Partial<ContractionSession> = {},
  ): ContractionSession {
    return {
      id: "contraction_1",
      date: "2026-08-10",
      startedAt: "2026-08-10T14:30:00.000Z",
      contractions: [
        { startedAt: "2026-08-10T14:30:00.000Z", durationSeconds: 45 },
        { startedAt: "2026-08-10T14:35:00.000Z", durationSeconds: 50 },
      ],
      ...overrides,
    };
  }

  it("round-trips pregnancy records, kick sessions, and contraction sessions", async () => {
    const { storage } = createPregnancyStorage();

    const pregnancy = buildPregnancyRecord();
    await storage.writePregnancyRecord(pregnancy);

    await expect(storage.readActivePregnancy()).resolves.toEqual(pregnancy);
    await expect(storage.listPregnancyRecords()).resolves.toEqual([pregnancy]);

    await storage.writeKickSession(
      buildKickSession({ id: "kick_a", date: "2026-07-10", kickCount: 8 }),
    );
    await storage.writeKickSession(
      buildKickSession({ id: "kick_b", date: "2026-07-20", kickCount: 12 }),
    );

    await expect(storage.listKickSessions()).resolves.toEqual([
      expect.objectContaining({ id: "kick_a", date: "2026-07-10" }),
      expect.objectContaining({ id: "kick_b", date: "2026-07-20" }),
    ]);
    await expect(
      storage.listKickSessions("2026-07-15", "2026-07-31"),
    ).resolves.toEqual([expect.objectContaining({ id: "kick_b" })]);

    const contraction = buildContractionSession();
    await storage.writeContractionSession(contraction);
    await expect(
      storage.listContractionSessions("2026-08-01", "2026-08-31"),
    ).resolves.toEqual([contraction]);
    await expect(
      storage.listContractionSessions("2026-09-01", "2026-09-30"),
    ).resolves.toEqual([]);

    await storage.deleteKickSession("kick_a");
    await expect(storage.listKickSessions()).resolves.toEqual([
      expect.objectContaining({ id: "kick_b" }),
    ]);

    await storage.deleteContractionSession("contraction_1");
    await expect(storage.listContractionSessions()).resolves.toEqual([]);
  });

  it("stores pregnancy data in encrypted payloads, never plaintext EDD or end-reason strings", async () => {
    const { storage, inspected } = createPregnancyStorage();

    const ended = buildPregnancyRecord({
      id: "pregnancy_ended",
      status: "ended",
      edd: "2026-08-15",
      endedAt: "2026-08-18",
      endReason: "birth",
      modeOfDelivery: "vaginal",
    });
    await storage.writePregnancyRecord(ended);
    await storage.writeContractionSession(
      buildContractionSession({ id: "contraction_x", date: "2026-08-10" }),
    );

    const pregnancyRow = inspected.state.pregnancyRecordsRows[0];
    expect(pregnancyRow?.encrypted_payload).toEqual(expect.any(String));
    // Sensitive fields live only in the AEAD payload; the only plaintext is the
    // coarse status enum used for the at-most-one-active selection query.
    expect(pregnancyRow?.encrypted_payload).not.toContain("2026-08-15");
    expect(pregnancyRow?.encrypted_payload).not.toContain("birth");
    expect(pregnancyRow?.encrypted_payload).not.toContain("vaginal");
    expect(pregnancyRow?.status).toBe("ended");

    const contractionRow = inspected.state.contractionSessionsRows[0];
    expect(contractionRow?.encrypted_payload).toEqual(expect.any(String));
    // The precise contraction timestamp is encrypted; only the coarse `day`
    // is plaintext for range selection.
    expect(JSON.stringify(contractionRow)).not.toContain("T14:30:00");
    expect(contractionRow?.day).toBe("2026-08-10");

    // The values are recoverable via the repo — proving encryption, not omission.
    await expect(storage.listPregnancyRecords()).resolves.toEqual([ended]);
  });

  it("drops a pregnancy row whose ciphertext was copied from a different pregnancy id (AAD fail-closed)", async () => {
    // Mirrors the day_log AAD test, but the pregnancy read path is defensive:
    // rather than throwing, a row that fails AAD-authenticated decryption is
    // skipped, so a swapped/foreign blob is never surfaced or misattributed.
    const { storage, inspected } = createPregnancyStorage();

    await storage.writePregnancyRecord(
      buildPregnancyRecord({
        id: "pregnancy_a",
        status: "ended",
        edd: "2026-08-01",
        endedAt: "2026-08-01",
        endReason: "birth",
      }),
    );
    await storage.writePregnancyRecord(
      buildPregnancyRecord({
        id: "pregnancy_b",
        status: "ended",
        edd: "2026-09-01",
        endedAt: "2026-09-01",
        endReason: "loss",
      }),
    );

    const rowA = inspected.state.pregnancyRecordsRows.find(
      (row) => row.id === "pregnancy_a",
    );
    const rowB = inspected.state.pregnancyRecordsRows.find(
      (row) => row.id === "pregnancy_b",
    );
    if (!rowA || !rowB) {
      throw new Error("expected two pregnancy rows persisted");
    }
    // Splice A's ciphertext into B's row. AAD binds ("pregnancy_records", id),
    // so decrypting it under B's id fails the auth tag.
    rowB.encrypted_payload = rowA.encrypted_payload ?? null;

    const records = await storage.listPregnancyRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe("pregnancy_a");
    expect(records.some((record) => record.id === "pregnancy_b")).toBe(false);
  });

  it("drops a contraction row holding a kick-session ciphertext (cross-table AAD binding)", async () => {
    const { storage, inspected } = createPregnancyStorage();

    await storage.writeKickSession(
      buildKickSession({ id: "shared_id", date: "2026-07-20" }),
    );
    await storage.writeContractionSession(
      buildContractionSession({ id: "shared_id", date: "2026-07-20" }),
    );

    const kickRow = inspected.state.kickSessionsRows[0];
    const contractionRow = inspected.state.contractionSessionsRows[0];
    if (!kickRow || !contractionRow) {
      throw new Error("expected kick + contraction rows persisted");
    }
    // Same id, but AAD binds the table name too, so decrypting a kick payload
    // as a contraction fails the auth tag and the row is dropped.
    contractionRow.encrypted_payload = kickRow.encrypted_payload ?? null;

    await expect(storage.listContractionSessions()).resolves.toEqual([]);
    await expect(storage.listKickSessions()).resolves.toEqual([
      expect.objectContaining({ id: "shared_id" }),
    ]);
  });

  it("enforces the at-most-one-active pregnancy invariant", async () => {
    const { storage } = createPregnancyStorage();

    await storage.writePregnancyRecord(
      buildPregnancyRecord({ id: "pregnancy_1", status: "active" }),
    );
    await expect(storage.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({ id: "pregnancy_1" }),
    );

    // A second, different active record is rejected.
    await expect(
      storage.writePregnancyRecord(
        buildPregnancyRecord({ id: "pregnancy_2", status: "active" }),
      ),
    ).rejects.toThrow("another pregnancy is already active");

    // Updating the SAME active record still succeeds.
    await expect(
      storage.writePregnancyRecord(
        buildPregnancyRecord({
          id: "pregnancy_1",
          status: "active",
          edd: "2026-09-01",
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(storage.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({ id: "pregnancy_1", edd: "2026-09-01" }),
    );

    // Ending the current pregnancy, then starting a new one, succeeds.
    await storage.writePregnancyRecord(
      buildPregnancyRecord({
        id: "pregnancy_1",
        status: "ended",
        endedAt: "2026-09-02",
        endReason: "birth",
      }),
    );
    await expect(
      storage.writePregnancyRecord(
        buildPregnancyRecord({ id: "pregnancy_3", status: "active" }),
      ),
    ).resolves.toBeUndefined();
    await expect(storage.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({ id: "pregnancy_3" }),
    );
    await expect(storage.listPregnancyRecords()).resolves.toHaveLength(2);
  });

  it("wipes the pregnancy tables on destructive local reset and leaves them empty and usable", async () => {
    const { storage } = createPregnancyStorage();

    await storage.writePregnancyRecord(
      buildPregnancyRecord({ id: "pregnancy_1", status: "active" }),
    );
    await storage.writeKickSession(buildKickSession({ id: "kick_1" }));
    await storage.writeContractionSession(
      buildContractionSession({ id: "contraction_1" }),
    );

    await storage.clearAllLocalData();

    await expect(storage.readActivePregnancy()).resolves.toBeNull();
    await expect(storage.listPregnancyRecords()).resolves.toEqual([]);
    await expect(storage.listKickSessions()).resolves.toEqual([]);
    await expect(storage.listContractionSessions()).resolves.toEqual([]);

    // Tables remain usable after reset (same connection, no reopen).
    await storage.writePregnancyRecord(
      buildPregnancyRecord({ id: "pregnancy_after", status: "active" }),
    );
    await expect(storage.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({ id: "pregnancy_after" }),
    );
  });

  it("deleteAllPregnancyData clears every pregnancy table but leaves other tables intact", async () => {
    const { storage } = createPregnancyStorage();

    // A day log stands in for the health data outside the pregnancy tables.
    await storage.writeDayLogRecord({
      ...createEmptyDayLogRecord("2026-03-17"),
      isPeriod: true,
      cycleStart: true,
    });
    await storage.writePregnancyRecord(
      buildPregnancyRecord({ id: "pregnancy_1", status: "active" }),
    );
    await storage.writePregnancyRecord(
      buildPregnancyRecord({
        id: "pregnancy_ended",
        status: "ended",
        endedAt: "2026-05-01",
        endReason: "loss",
      }),
    );
    await storage.writeKickSession(buildKickSession({ id: "kick_1" }));
    await storage.writeContractionSession(
      buildContractionSession({ id: "contraction_1" }),
    );

    await storage.deleteAllPregnancyData();

    // All three pregnancy tables are empty.
    await expect(storage.readActivePregnancy()).resolves.toBeNull();
    await expect(storage.listPregnancyRecords()).resolves.toEqual([]);
    await expect(storage.listKickSessions()).resolves.toEqual([]);
    await expect(storage.listContractionSessions()).resolves.toEqual([]);

    // Data outside the pregnancy tables is untouched.
    await expect(storage.readDayLogRecord("2026-03-17")).resolves.toEqual(
      expect.objectContaining({ date: "2026-03-17", isPeriod: true }),
    );

    // Tables remain usable afterward (same connection, no reopen).
    await storage.writePregnancyRecord(
      buildPregnancyRecord({ id: "pregnancy_after", status: "active" }),
    );
    await expect(storage.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({ id: "pregnancy_after" }),
    );
  });

  it("upgrades a v13 database through v14/v15/v16, creating the pregnancy, postpartum, and screening tables with existing data intact", async () => {
    const localDataKey = "a".repeat(64);
    const inspected = createInspectableFakeDatabase({
      userVersion: 13,
      hasManagedBillingCacheTable: true,
      hasPregnancyTables: false,
      hasPostpartumTable: false,
      hasScreeningTable: false,
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
        encrypted_payload: encryptLocalDataRecord(
          localDataKey,
          { ...createDefaultProfileRecord(), lastPeriodStart: "2026-03-15" },
          buildLocalDataAad("profile_settings", "1"),
        ),
      },
    });
    const storage = createSQLiteAppStorage({
      legacyStorageSource: {
        clear: jest.fn().mockResolvedValue(undefined),
        hasData: jest.fn().mockResolvedValue(false),
        readBootstrapState: jest.fn(),
        readProfileRecord: jest.fn(),
      },
      localDataKeyStore: createFakeLocalDataKeyStore(localDataKey),
      openDatabase: async () => inspected.database,
    });

    // Existing encrypted profile data survives the additive v13 -> v16 upgrade.
    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({ lastPeriodStart: "2026-03-15" }),
    );
    expect(inspected.state.hasPregnancyTables).toBe(true);
    expect(inspected.state.hasPostpartumTable).toBe(true);
    expect(inspected.state.hasScreeningTable).toBe(true);
    expect(inspected.state.userVersion).toBe(16);

    // The freshly created pregnancy repos are usable post-upgrade.
    await storage.writePregnancyRecord(
      buildPregnancyRecord({ id: "pregnancy_new", status: "active" }),
    );
    await expect(storage.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({ id: "pregnancy_new" }),
    );

    // The freshly created postpartum repo is usable post-upgrade too.
    await storage.writePostpartumRecord(buildPostpartumRecord({ id: "postpartum_new" }));
    await expect(storage.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({ id: "postpartum_new" }),
    );
  });

  function buildPostpartumRecord(
    overrides: Partial<PostpartumRecord> = {},
  ): PostpartumRecord {
    return {
      id: "postpartum_1",
      status: "active",
      startedAt: "2026-06-01",
      modeOfDelivery: "cesarean",
      endedAt: null,
      endReason: null,
      ...overrides,
    };
  }

  it("round-trips postpartum records and stores outcome fields only in the encrypted payload", async () => {
    const { storage, inspected } = createPregnancyStorage();

    const ended = buildPostpartumRecord({
      id: "postpartum_ended",
      status: "ended",
      startedAt: "2026-06-01",
      modeOfDelivery: "cesarean",
      endedAt: "2026-07-20",
      endReason: "cycle_returned",
    });
    await storage.writePostpartumRecord(ended);

    // Recoverable via the repo (proving encryption, not omission).
    await expect(storage.listPostpartumRecords()).resolves.toEqual([ended]);

    const row = inspected.state.postpartumRecordsRows[0];
    expect(row?.encrypted_payload).toEqual(expect.any(String));
    // Sensitive fields live only in the AEAD payload; only the coarse status
    // enum is plaintext for the at-most-one-active selection.
    expect(row?.encrypted_payload).not.toContain("2026-06-01");
    expect(row?.encrypted_payload).not.toContain("cesarean");
    expect(row?.encrypted_payload).not.toContain("cycle_returned");
    expect(row?.status).toBe("ended");
  });

  it("drops a postpartum row whose ciphertext was copied from a different postpartum id (AAD fail-closed)", async () => {
    const { storage, inspected } = createPregnancyStorage();

    await storage.writePostpartumRecord(
      buildPostpartumRecord({ id: "postpartum_a", status: "ended", endedAt: "2026-06-20", endReason: "manual" }),
    );
    await storage.writePostpartumRecord(
      buildPostpartumRecord({ id: "postpartum_b", status: "ended", endedAt: "2026-07-20", endReason: "manual" }),
    );

    const rowA = inspected.state.postpartumRecordsRows.find(
      (row) => row.id === "postpartum_a",
    );
    const rowB = inspected.state.postpartumRecordsRows.find(
      (row) => row.id === "postpartum_b",
    );
    if (!rowA || !rowB) {
      throw new Error("expected two postpartum rows persisted");
    }
    // AAD binds ("postpartum_records", id); decrypting A's blob under B's id
    // fails the auth tag, so the swapped row is dropped rather than surfaced.
    rowB.encrypted_payload = rowA.encrypted_payload ?? null;

    const records = await storage.listPostpartumRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe("postpartum_a");
  });

  it("enforces the at-most-one-active postpartum invariant", async () => {
    const { storage } = createPregnancyStorage();

    await storage.writePostpartumRecord(
      buildPostpartumRecord({ id: "postpartum_1", status: "active" }),
    );
    await expect(storage.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({ id: "postpartum_1" }),
    );

    // A second, different active record is rejected.
    await expect(
      storage.writePostpartumRecord(
        buildPostpartumRecord({ id: "postpartum_2", status: "active" }),
      ),
    ).rejects.toThrow("another postpartum is already active");

    // Updating the SAME active record still succeeds.
    await expect(
      storage.writePostpartumRecord(
        buildPostpartumRecord({ id: "postpartum_1", status: "active", modeOfDelivery: "vaginal" }),
      ),
    ).resolves.toBeUndefined();

    // Ending it, then starting a new one, succeeds.
    await storage.writePostpartumRecord(
      buildPostpartumRecord({ id: "postpartum_1", status: "ended", endedAt: "2026-07-01", endReason: "manual" }),
    );
    await expect(
      storage.writePostpartumRecord(
        buildPostpartumRecord({ id: "postpartum_3", status: "active" }),
      ),
    ).resolves.toBeUndefined();
    await expect(storage.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({ id: "postpartum_3" }),
    );
    await expect(storage.listPostpartumRecords()).resolves.toHaveLength(2);
  });

  it("wipes the postpartum table on destructive local reset and leaves it usable", async () => {
    const { storage } = createPregnancyStorage();

    await storage.writePostpartumRecord(
      buildPostpartumRecord({ id: "postpartum_1", status: "active" }),
    );

    await storage.clearAllLocalData();

    await expect(storage.readActivePostpartum()).resolves.toBeNull();
    await expect(storage.listPostpartumRecords()).resolves.toEqual([]);

    // Usable after reset (same connection, no reopen).
    await storage.writePostpartumRecord(
      buildPostpartumRecord({ id: "postpartum_after", status: "active" }),
    );
    await expect(storage.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({ id: "postpartum_after" }),
    );
  });

  it("deleteAllPostpartumData clears the postpartum table but leaves pregnancy + other data intact", async () => {
    const { storage } = createPregnancyStorage();

    await storage.writeDayLogRecord({
      ...createEmptyDayLogRecord("2026-03-17"),
      isPeriod: true,
      cycleStart: true,
    });
    await storage.writePregnancyRecord(
      buildPregnancyRecord({ id: "pregnancy_ended", status: "ended", endedAt: "2026-06-01", endReason: "birth" }),
    );
    await storage.writePostpartumRecord(
      buildPostpartumRecord({ id: "postpartum_1", status: "active" }),
    );

    await storage.deleteAllPostpartumData();

    // Postpartum is empty.
    await expect(storage.readActivePostpartum()).resolves.toBeNull();
    await expect(storage.listPostpartumRecords()).resolves.toEqual([]);

    // Pregnancy + day-log data outside the postpartum table are untouched.
    await expect(storage.listPregnancyRecords()).resolves.toHaveLength(1);
    await expect(storage.readDayLogRecord("2026-03-17")).resolves.toEqual(
      expect.objectContaining({ date: "2026-03-17", isPeriod: true }),
    );
  });

  function buildScreeningResponse(
    overrides: Partial<ScreeningResponse> = {},
  ): ScreeningResponse {
    return {
      id: "screening_1",
      date: "2026-07-01",
      instrument: "epds",
      answers: [1, 2, 0, 3, 1, 0, 2, 1, 0, 0],
      score: 10,
      selfHarmFlag: false,
      ...overrides,
    };
  }

  it("round-trips screening responses and stores answers/score only in the encrypted payload", async () => {
    const { storage, inspected } = createPregnancyStorage();

    // A response with a non-zero item 10 so both the answers and the derived
    // self-harm flag are on the line for the plaintext-leak check.
    const flagged = buildScreeningResponse({
      id: "screening_flagged",
      date: "2026-07-05",
      answers: [1, 2, 0, 3, 1, 0, 2, 1, 0, 2],
      score: 12,
      selfHarmFlag: true,
    });
    await storage.writeScreeningResponse(flagged);

    // Recoverable via the repo (proving encryption, not omission).
    await expect(storage.listScreeningResponses()).resolves.toEqual([flagged]);

    const row = inspected.state.screeningResponsesRows[0];
    expect(row?.encrypted_payload).toEqual(expect.any(String));
    // The per-item answers, the score, and the self-harm flag live ONLY in the
    // AEAD payload — the plaintext structure never leaks. The single plaintext
    // column is the coarse completion day, used for ordering / cadence.
    expect(JSON.stringify(row)).not.toContain("answers");
    expect(JSON.stringify(row)).not.toContain("selfHarmFlag");
    expect(JSON.stringify(row)).not.toContain("score");
    expect(row?.day).toBe("2026-07-05");
  });

  it("recomputes a persisted score that disagrees with the stored answers on read", async () => {
    const { storage } = createPregnancyStorage();

    // A caller (or a drifted older write) hands a wrong stored score/flag; the
    // write sanitizes and the read corrects — history integrity beats stored
    // values. answers sum to 10 with item 10 non-zero.
    await storage.writeScreeningResponse(
      buildScreeningResponse({
        id: "screening_drifted",
        answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
        score: 0,
        selfHarmFlag: false,
      }),
    );

    const [stored] = await storage.listScreeningResponses();
    expect(stored?.score).toBe(3);
    expect(stored?.selfHarmFlag).toBe(true);
  });

  it("drops a screening row whose ciphertext was copied from a different id (AAD fail-closed)", async () => {
    const { storage, inspected } = createPregnancyStorage();

    await storage.writeScreeningResponse(
      buildScreeningResponse({ id: "screening_a", date: "2026-06-01" }),
    );
    await storage.writeScreeningResponse(
      buildScreeningResponse({ id: "screening_b", date: "2026-07-01" }),
    );

    const rowA = inspected.state.screeningResponsesRows.find(
      (row) => row.id === "screening_a",
    );
    const rowB = inspected.state.screeningResponsesRows.find(
      (row) => row.id === "screening_b",
    );
    if (!rowA || !rowB) {
      throw new Error("expected two screening rows persisted");
    }
    // AAD binds ("screening_responses", id); decrypting A's blob under B's id
    // fails the auth tag, so the swapped row is dropped rather than surfaced.
    rowB.encrypted_payload = rowA.encrypted_payload ?? null;

    const responses = await storage.listScreeningResponses();
    expect(responses).toHaveLength(1);
    expect(responses[0]?.id).toBe("screening_a");
  });

  it("wipes the screening table on destructive local reset and leaves it usable", async () => {
    const { storage } = createPregnancyStorage();

    await storage.writeScreeningResponse(buildScreeningResponse());

    await storage.clearAllLocalData();

    await expect(storage.listScreeningResponses()).resolves.toEqual([]);

    // Usable after reset (same connection, no reopen).
    await storage.writeScreeningResponse(
      buildScreeningResponse({ id: "screening_after" }),
    );
    await expect(storage.listScreeningResponses()).resolves.toEqual([
      expect.objectContaining({ id: "screening_after" }),
    ]);
  });

  it("deleteAllScreeningData clears screening but leaves postpartum + other data intact (separate sensitive classes)", async () => {
    const { storage } = createPregnancyStorage();

    await storage.writeDayLogRecord({
      ...createEmptyDayLogRecord("2026-03-17"),
      isPeriod: true,
      cycleStart: true,
    });
    await storage.writePostpartumRecord(
      buildPostpartumRecord({ id: "postpartum_1", status: "active" }),
    );
    await storage.writeScreeningResponse(buildScreeningResponse());

    await storage.deleteAllScreeningData();

    // Screening is empty...
    await expect(storage.listScreeningResponses()).resolves.toEqual([]);
    // ...but the postpartum record and day-log data are untouched — screening
    // is deleted only via its own explicit action.
    await expect(storage.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({ id: "postpartum_1" }),
    );
    await expect(storage.readDayLogRecord("2026-03-17")).resolves.toEqual(
      expect.objectContaining({ date: "2026-03-17", isPeriod: true }),
    );
  });

  it("deleteAllPostpartumData does NOT delete screening data (screening is a separate class)", async () => {
    const { storage } = createPregnancyStorage();

    await storage.writePostpartumRecord(
      buildPostpartumRecord({ id: "postpartum_1", status: "active" }),
    );
    await storage.writeScreeningResponse(buildScreeningResponse());

    await storage.deleteAllPostpartumData();

    // Postpartum is gone, but the screening response survives — the two
    // sensitive classes are never coupled.
    await expect(storage.readActivePostpartum()).resolves.toBeNull();
    await expect(storage.listScreeningResponses()).resolves.toEqual([
      expect.objectContaining({ id: "screening_1" }),
    ]);
  });

  it("allows a new active record once the previous one has ended", async () => {
    const { storage } = createPregnancyStorage();

    await storage.writePregnancyRecord(
      buildPregnancyRecord({
        id: "pregnancy_old",
        status: "ended",
        startedAt: "2025-01-05",
        endedAt: "2025-09-20",
        endReason: "birth",
      }),
    );
    await storage.writePregnancyRecord(
      buildPregnancyRecord({ id: "pregnancy_new", status: "active" }),
    );
    await expect(storage.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({ id: "pregnancy_new" }),
    );

    await storage.writePostpartumRecord(
      buildPostpartumRecord({
        id: "postpartum_old",
        status: "ended",
        startedAt: "2025-09-20",
        endedAt: "2025-12-01",
        endReason: "cycle_returned",
      }),
    );
    await storage.writePostpartumRecord(
      buildPostpartumRecord({ id: "postpartum_new", status: "active" }),
    );
    await expect(storage.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({ id: "postpartum_new" }),
    );
  });

  it("rejects a write that fails sanitize on every pregnancy-data class", async () => {
    const { storage, inspected } = createPregnancyStorage();

    await expect(
      storage.writePregnancyRecord(buildPregnancyRecord({ id: "  " })),
    ).rejects.toThrow("writePregnancyRecord: record failed sanitize");
    await expect(
      storage.writeKickSession(buildKickSession({ date: "not-a-date" })),
    ).rejects.toThrow("writeKickSession: session failed sanitize");
    await expect(
      storage.writeContractionSession(buildContractionSession({ id: "" })),
    ).rejects.toThrow("writeContractionSession: session failed sanitize");
    await expect(
      storage.writePostpartumRecord(
        buildPostpartumRecord({ startedAt: "not-a-date" }),
      ),
    ).rejects.toThrow("writePostpartumRecord: record failed sanitize");
    await expect(
      storage.writeScreeningResponse(
        buildScreeningResponse({
          answers: [1] as unknown as ScreeningResponse["answers"],
        }),
      ),
    ).rejects.toThrow("writeScreeningResponse: response failed sanitize");

    // Nothing reached any table.
    expect(inspected.state.pregnancyRecordsRows).toHaveLength(0);
    expect(inspected.state.kickSessionsRows).toHaveLength(0);
    expect(inspected.state.contractionSessionsRows).toHaveLength(0);
    expect(inspected.state.postpartumRecordsRows).toHaveLength(0);
    expect(inspected.state.screeningResponsesRows).toHaveLength(0);
  });

  it("skips rows whose encrypted payload is missing instead of surfacing partial data", async () => {
    const { storage, inspected } = createPregnancyStorage();

    await storage.writePregnancyRecord(
      buildPregnancyRecord({
        id: "pregnancy_ok",
        status: "ended",
        endedAt: "2026-08-01",
        endReason: "birth",
      }),
    );
    // A writer with database-file access can leave a row with a NULL payload;
    // every decode path must drop it rather than surface partial data.
    inspected.state.pregnancyRecordsRows.push({
      id: "pregnancy_null",
      status: "active",
      encrypted_payload: null,
    });
    inspected.state.kickSessionsRows.push({
      id: "kick_null",
      day: "2026-07-01",
      encrypted_payload: null,
    });
    // Not just NULL: a corrupted ciphertext must fail decryption and be
    // dropped the same way.
    inspected.state.kickSessionsRows.push({
      id: "kick_garbage",
      day: "2026-07-02",
      encrypted_payload: "not-a-ciphertext",
    });
    inspected.state.contractionSessionsRows.push({
      id: "contraction_null",
      day: "2026-07-01",
      encrypted_payload: null,
    });
    inspected.state.postpartumRecordsRows.push({
      id: "postpartum_null",
      status: "active",
      encrypted_payload: null,
    });
    inspected.state.screeningResponsesRows.push({
      id: "screening_null",
      day: "2026-07-01",
      encrypted_payload: null,
    });

    await expect(storage.listPregnancyRecords()).resolves.toEqual([
      expect.objectContaining({ id: "pregnancy_ok" }),
    ]);
    // The NULL-payload row claims to be active; the read must not trust the
    // plaintext status column alone.
    await expect(storage.readActivePregnancy()).resolves.toBeNull();
    await expect(storage.listKickSessions()).resolves.toEqual([]);
    await expect(storage.listContractionSessions()).resolves.toEqual([]);
    await expect(storage.listPostpartumRecords()).resolves.toEqual([]);
    await expect(storage.readActivePostpartum()).resolves.toBeNull();
    await expect(storage.listScreeningResponses()).resolves.toEqual([]);

    // A stale undecodable "active" row must not block starting a new record:
    // the write-path conflict check ignores rows that fail to decode.
    await storage.writePregnancyRecord(
      buildPregnancyRecord({ id: "pregnancy_fresh", status: "active" }),
    );
    await expect(storage.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({ id: "pregnancy_fresh" }),
    );
    await storage.writePostpartumRecord(
      buildPostpartumRecord({ id: "postpartum_fresh", status: "active" }),
    );
    await expect(storage.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({ id: "postpartum_fresh" }),
    );
  });

  it("orders every list by its date field with id as the tie-breaker", async () => {
    const { storage } = createPregnancyStorage();

    await storage.writePregnancyRecord(
      buildPregnancyRecord({
        id: "pregnancy_b",
        status: "ended",
        startedAt: "2026-01-05",
        endedAt: "2026-08-01",
        endReason: "birth",
      }),
    );
    await storage.writePregnancyRecord(
      buildPregnancyRecord({
        id: "pregnancy_a",
        status: "ended",
        startedAt: "2026-01-05",
        endedAt: "2026-08-01",
        endReason: "birth",
      }),
    );
    await storage.writePregnancyRecord(
      buildPregnancyRecord({
        id: "pregnancy_c",
        status: "ended",
        startedAt: "2025-03-01",
        endedAt: "2025-11-20",
        endReason: "birth",
      }),
    );
    await expect(storage.listPregnancyRecords()).resolves.toEqual([
      expect.objectContaining({ id: "pregnancy_c" }),
      expect.objectContaining({ id: "pregnancy_a" }),
      expect.objectContaining({ id: "pregnancy_b" }),
    ]);

    await storage.writeKickSession(
      buildKickSession({ id: "kick_b", date: "2026-07-10" }),
    );
    await storage.writeKickSession(
      buildKickSession({ id: "kick_a", date: "2026-07-10" }),
    );
    await expect(storage.listKickSessions()).resolves.toEqual([
      expect.objectContaining({ id: "kick_a" }),
      expect.objectContaining({ id: "kick_b" }),
    ]);
    // Upper range bound filters out later days.
    await expect(
      storage.listKickSessions(undefined, "2026-07-05"),
    ).resolves.toEqual([]);

    await storage.writeContractionSession(
      buildContractionSession({ id: "contraction_b", date: "2026-08-10" }),
    );
    await storage.writeContractionSession(
      buildContractionSession({ id: "contraction_a", date: "2026-08-10" }),
    );
    await expect(storage.listContractionSessions()).resolves.toEqual([
      expect.objectContaining({ id: "contraction_a" }),
      expect.objectContaining({ id: "contraction_b" }),
    ]);

    await storage.writePostpartumRecord(
      buildPostpartumRecord({
        id: "postpartum_b",
        status: "ended",
        startedAt: "2026-06-01",
        endedAt: "2026-07-15",
        endReason: "cycle_returned",
      }),
    );
    await storage.writePostpartumRecord(
      buildPostpartumRecord({
        id: "postpartum_a",
        status: "ended",
        startedAt: "2026-06-01",
        endedAt: "2026-07-15",
        endReason: "cycle_returned",
      }),
    );
    await storage.writePostpartumRecord(
      buildPostpartumRecord({
        id: "postpartum_c",
        status: "ended",
        startedAt: "2025-01-10",
        endedAt: "2025-03-01",
        endReason: "cycle_returned",
      }),
    );
    await expect(storage.listPostpartumRecords()).resolves.toEqual([
      expect.objectContaining({ id: "postpartum_c" }),
      expect.objectContaining({ id: "postpartum_a" }),
      expect.objectContaining({ id: "postpartum_b" }),
    ]);

    await storage.writeScreeningResponse(
      buildScreeningResponse({ id: "screening_b", date: "2026-07-01" }),
    );
    await storage.writeScreeningResponse(
      buildScreeningResponse({ id: "screening_a", date: "2026-07-01" }),
    );
    await storage.writeScreeningResponse(
      buildScreeningResponse({ id: "screening_c", date: "2026-06-01" }),
    );
    await expect(storage.listScreeningResponses()).resolves.toEqual([
      expect.objectContaining({ id: "screening_c" }),
      expect.objectContaining({ id: "screening_a" }),
      expect.objectContaining({ id: "screening_b" }),
    ]);
  });
});
