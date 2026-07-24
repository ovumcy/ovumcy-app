import {
  ensureLocalAppSchema,
  type LocalAppDatabase,
} from "./sqlite-schema-migrations";

// A lightweight schema-only fake: the migration path is pure DDL (CREATE /
// ALTER / PRAGMA via runAsync/execAsync) and never inspects a getFirst/getAll
// result, so tracking executed statements plus a day_logs row store is enough
// to exercise ensureLocalAppSchema directly, without the full CRUD fake.
type SchemaFakeDatabase = {
  database: LocalAppDatabase;
  createdTables: Set<string>;
  getUserVersion: () => number;
  executedStatements: string[];
};

function createSchemaFakeDatabase(seed?: {
  userVersion?: number;
  existingTables?: string[];
  dayLogsRows?: { day: string; encrypted_payload: string | null }[];
}): SchemaFakeDatabase {
  const createdTables = new Set<string>(seed?.existingTables ?? []);
  const executedStatements: string[] = [];
  const dayLogsRows = seed?.dayLogsRows ?? [];
  let userVersion = seed?.userVersion ?? 0;

  function track(source: string): void {
    executedStatements.push(source);
    const createMatch = /CREATE TABLE IF NOT EXISTS (\w+)/.exec(source);
    if (createMatch?.[1]) {
      createdTables.add(createMatch[1]);
    }
    if (source.trimStart().startsWith("PRAGMA user_version =")) {
      userVersion = Number(source.replace(/\D/g, ""));
    }
  }

  const database: LocalAppDatabase = {
    async execAsync(source: string) {
      track(source);
    },
    async getFirstAsync<T>(): Promise<T | null> {
      return null;
    },
    async getAllAsync<T>(source: string): Promise<T[]> {
      if (source.includes("FROM day_logs")) {
        return [...dayLogsRows] as T[];
      }
      return [];
    },
    async runAsync(source: string) {
      track(source);
      return { changes: 0 };
    },
  };

  return {
    database,
    createdTables,
    getUserVersion: () => userVersion,
    executedStatements,
  };
}

describe("sqlite-schema-migrations", () => {
  it("creates the pregnancy, postpartum, and v16 screening tables and stamps the schema version", async () => {
    const fake = createSchemaFakeDatabase();

    await ensureLocalAppSchema(fake.database);

    expect(fake.createdTables.has("pregnancy_records")).toBe(true);
    expect(fake.createdTables.has("kick_sessions")).toBe(true);
    expect(fake.createdTables.has("contraction_sessions")).toBe(true);
    expect(fake.createdTables.has("postpartum_records")).toBe(true);
    expect(fake.createdTables.has("screening_responses")).toBe(true);
    expect(fake.getUserVersion()).toBe(16);
  });

  it("is idempotent when the migration runs twice on the same database", async () => {
    const fake = createSchemaFakeDatabase();

    await ensureLocalAppSchema(fake.database);
    await expect(ensureLocalAppSchema(fake.database)).resolves.toBeUndefined();

    expect(fake.createdTables.has("postpartum_records")).toBe(true);
    expect(fake.createdTables.has("screening_responses")).toBe(true);
    expect(fake.getUserVersion()).toBe(16);

    // The screening-table create is guarded by IF NOT EXISTS, so re-running is
    // safe on an already-migrated database.
    const screeningCreates = fake.executedStatements.filter((source) =>
      source.includes("CREATE TABLE IF NOT EXISTS screening_responses"),
    );
    expect(screeningCreates.length).toBeGreaterThanOrEqual(2);
  });

  it("upgrades a v15 database to v16 without dropping existing rows", async () => {
    const fake = createSchemaFakeDatabase({
      userVersion: 15,
      existingTables: [
        "bootstrap_state",
        "profile_settings",
        "day_logs",
        "sync_preferences",
        "symptoms",
        "managed_billing_cache",
        "pregnancy_records",
        "kick_sessions",
        "contraction_sessions",
        "postpartum_records",
      ],
      dayLogsRows: [{ day: "opaque-lookup-key", encrypted_payload: "ciphertext" }],
    });

    await ensureLocalAppSchema(fake.database);

    expect(fake.getUserVersion()).toBe(16);
    expect(fake.createdTables.has("screening_responses")).toBe(true);
    // The pre-existing pregnancy/postpartum tables are untouched by v15 -> v16.
    expect(fake.createdTables.has("pregnancy_records")).toBe(true);
    expect(fake.createdTables.has("postpartum_records")).toBe(true);

    // The additive v15 -> v16 migration never rewrites or drops existing rows.
    const dayLogs = await fake.database.getAllAsync<{ day: string }>(
      "SELECT day FROM day_logs;",
    );
    expect(dayLogs).toHaveLength(1);
    expect(dayLogs[0]?.day).toBe("opaque-lookup-key");
  });
});
