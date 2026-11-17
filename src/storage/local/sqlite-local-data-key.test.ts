import {
  buildLocalDataAad,
  encryptLocalDataRecord,
} from "../../security/local-data-crypto";
import type { LocalDataKeyStore } from "../../security/local-data-key-store";
import type { LocalAppDatabase } from "./sqlite-schema-migrations";
import {
  resolveLocalDataKey,
  wipeLocalAppTables,
} from "./sqlite-local-data-key";

// The key-mismatch auto-reset must be COMPLETE: a reset that wipes the earlier
// tables but leaves the pregnancy tables, the postpartum table, or the v16
// screening table holding stale ciphertext is not deterministic
// (a key mismatch must reset the local database deterministically). These
// tests pin the full ELEVEN-table list on both reset triggers — canary auth-tag
// failure and missing-key-with-encrypted-rows — without touching the canary row
// choice or key handling themselves.

const ALL_LOCAL_APP_TABLES = [
  "day_logs",
  "symptoms",
  "profile_settings",
  "bootstrap_state",
  "sync_preferences",
  "managed_billing_cache",
  "pregnancy_records",
  "kick_sessions",
  "contraction_sessions",
  "postpartum_records",
  "screening_responses",
] as const;

type EncryptedRowSeed = {
  table: string;
  payload: string;
  rowKey?: string;
};

// Minimal fake for the key-resolution path: it only needs to answer the
// "first non-empty encrypted_payload in <table>" probes (canary +
// hasEncryptedLocalData) and record which tables get a DELETE.
function createKeyResolutionFakeDatabase(seed?: {
  encryptedRows?: EncryptedRowSeed[];
  failReadsWith?: Error;
  failDeleteOf?: string;
  failRollback?: boolean;
}) {
  const encryptedRows = [...(seed?.encryptedRows ?? [])];
  const deletedTables: string[] = [];
  const statements: string[] = [];

  const database: LocalAppDatabase = {
    async execAsync(source: string) {
      statements.push(source);
      if (source === "ROLLBACK;" && seed?.failRollback) {
        throw new Error("cannot rollback");
      }
      return undefined;
    },
    async getFirstAsync<T>(source: string): Promise<T | null> {
      if (seed?.failReadsWith) {
        throw seed.failReadsWith;
      }
      if (source.includes("encrypted_payload IS NOT NULL")) {
        const tableName = /FROM (\w+)/.exec(source)?.[1] ?? "";
        const row = encryptedRows.find((entry) => entry.table === tableName);
        return row
          ? ({ encrypted_payload: row.payload, row_key: row.rowKey } as T)
          : null;
      }
      return null;
    },
    async getAllAsync<T>(): Promise<T[]> {
      return [];
    },
    async runAsync(source: string) {
      statements.push(source);
      const tableName = /DELETE FROM (\w+);/.exec(source)?.[1];
      if (tableName && tableName === seed?.failDeleteOf) {
        throw new Error("disk I/O error");
      }
      if (tableName) {
        deletedTables.push(tableName);
        for (let index = encryptedRows.length - 1; index >= 0; index -= 1) {
          if (encryptedRows[index]?.table === tableName) {
            encryptedRows.splice(index, 1);
          }
        }
      }
      return { changes: 1 };
    },
  };

  return { database, deletedTables, encryptedRows, statements };
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

describe("sqlite-local-data-key", () => {
  it("wipes every local table (including pregnancy, postpartum, and screening) via wipeLocalAppTables", async () => {
    const fake = createKeyResolutionFakeDatabase();

    await wipeLocalAppTables(fake.database);

    expect([...fake.deletedTables].sort()).toEqual(
      [...ALL_LOCAL_APP_TABLES].sort(),
    );
    // Pin the exact count so a table silently dropped from wipeLocalAppTables
    // (or added without joining the reset) fails here.
    expect(fake.deletedTables).toHaveLength(11);
  });

  it("wipes the pregnancy, postpartum, and screening tables when the stored key no longer authenticates the canary row", async () => {
    // Same trigger as the SecureStore-desync regression in
    // sqlite-app-storage.test.ts: canary payload encrypted under key A, store
    // returns key B → auth-tag failure → deterministic wipe + fresh key.
    const rightKey = "a".repeat(64);
    const wrongKeyStore = createFakeLocalDataKeyStore("b".repeat(64));
    const fake = createKeyResolutionFakeDatabase({
      encryptedRows: [
        {
          table: "bootstrap_state",
          payload: encryptLocalDataRecord(
            rightKey,
            { hasCompletedOnboarding: true },
            buildLocalDataAad("bootstrap_state", "1"),
          ),
        },
        { table: "pregnancy_records", payload: "stale-pregnancy-ciphertext" },
        { table: "kick_sessions", payload: "stale-kick-ciphertext" },
        { table: "contraction_sessions", payload: "stale-contraction-ciphertext" },
        { table: "postpartum_records", payload: "stale-postpartum-ciphertext" },
        { table: "screening_responses", payload: "stale-screening-ciphertext" },
      ],
    });

    const resolvedKey = await resolveLocalDataKey(fake.database, wrongKeyStore);

    expect(fake.deletedTables).toEqual(
      expect.arrayContaining([
        "pregnancy_records",
        "kick_sessions",
        "contraction_sessions",
        "postpartum_records",
        "screening_responses",
      ]),
    );
    expect(fake.encryptedRows).toHaveLength(0);
    expect(wrongKeyStore.writeLocalDataKey).toHaveBeenCalledTimes(1);
    expect(resolvedKey).not.toBe("b".repeat(64));
  });

  it("wipes before minting a fresh key when the only encrypted rows on-device are screening data", async () => {
    // Correctness edge: no key in SecureStore, and the ONLY encrypted rows live
    // in the v16 screening table (the most sensitive class). hasEncryptedLocalData
    // must count it, otherwise a fresh key would be minted over stale
    // undecryptable ciphertext, silently orphaning those rows instead of
    // resetting deterministically.
    const emptyKeyStore = createFakeLocalDataKeyStore(null);
    const fake = createKeyResolutionFakeDatabase({
      encryptedRows: [
        { table: "screening_responses", payload: "orphaned-screening-ciphertext" },
      ],
    });

    const resolvedKey = await resolveLocalDataKey(fake.database, emptyKeyStore);

    expect(fake.deletedTables).toEqual(
      expect.arrayContaining([
        "pregnancy_records",
        "kick_sessions",
        "contraction_sessions",
        "postpartum_records",
        "screening_responses",
      ]),
    );
    expect(fake.encryptedRows).toHaveLength(0);
    expect(emptyKeyStore.writeLocalDataKey).toHaveBeenCalledTimes(1);
    expect(typeof resolvedKey).toBe("string");
    expect(resolvedKey).toHaveLength(64);
  });
  describe("canary narrowing", () => {
    const rightKey = "a".repeat(64);
    const bootstrapAad = buildLocalDataAad("bootstrap_state", "1");
    const profileAad = buildLocalDataAad("profile_settings", "1");

    it("keeps the key and wipes nothing when the bootstrap canary is unparseable but the profile canary authenticates", async () => {
      const keyStore = createFakeLocalDataKeyStore(rightKey);
      const fake = createKeyResolutionFakeDatabase({
        encryptedRows: [
          { table: "bootstrap_state", payload: "{truncated" },
          {
            table: "profile_settings",
            payload: encryptLocalDataRecord(rightKey, { cycleLength: 28 }, profileAad),
          },
          { table: "day_logs", payload: "day-log-ciphertext" },
        ],
      });

      await expect(resolveLocalDataKey(fake.database, keyStore)).resolves.toBe(rightKey);
      expect(fake.deletedTables).toEqual([]);
      expect(keyStore.writeLocalDataKey).not.toHaveBeenCalled();
    });

    it("keeps the key and wipes nothing when one canary row was tampered but another authenticates", async () => {
      const keyStore = createFakeLocalDataKeyStore(rightKey);
      const profilePayload = encryptLocalDataRecord(rightKey, { cycleLength: 28 }, profileAad);
      const fake = createKeyResolutionFakeDatabase({
        encryptedRows: [
          // Profile ciphertext copied into the bootstrap row: well-formed, wrong AAD.
          { table: "bootstrap_state", payload: profilePayload },
          { table: "profile_settings", payload: profilePayload },
        ],
      });

      await expect(resolveLocalDataKey(fake.database, keyStore)).resolves.toBe(rightKey);
      expect(fake.deletedTables).toEqual([]);
      expect(keyStore.writeLocalDataKey).not.toHaveBeenCalled();
    });

    it.each([
      ["day log", "day_logs", "day_log", "opaque-day-key"],
      ["symptom", "symptoms", "symptom", "opaque-symptom-key"],
    ])(
      "keeps the key when both singletons fail but a %s row authenticates under its own row key",
      async (_label, table, aadTable, rowKey) => {
        const keyStore = createFakeLocalDataKeyStore(rightKey);
        const foreignPayload = encryptLocalDataRecord("b".repeat(64), { x: 1 }, bootstrapAad);
        const fake = createKeyResolutionFakeDatabase({
          encryptedRows: [
            { table: "bootstrap_state", payload: foreignPayload },
            { table: "profile_settings", payload: foreignPayload },
            {
              table,
              rowKey,
              payload: encryptLocalDataRecord(
                rightKey,
                { ok: true },
                buildLocalDataAad(aadTable, rowKey),
              ),
            },
          ],
        });

        await expect(resolveLocalDataKey(fake.database, keyStore)).resolves.toBe(rightKey);
        expect(fake.deletedTables).toEqual([]);
      },
    );

    it("resets when a list row authenticates only under a different row key", async () => {
      const keyStore = createFakeLocalDataKeyStore(rightKey);
      const fake = createKeyResolutionFakeDatabase({
        encryptedRows: [
          {
            table: "day_logs",
            rowKey: "opaque-day-key",
            payload: encryptLocalDataRecord(
              rightKey,
              { ok: true },
              buildLocalDataAad("day_log", "another-day-key"),
            ),
          },
        ],
      });

      await resolveLocalDataKey(fake.database, keyStore);

      expect(fake.deletedTables).toHaveLength(ALL_LOCAL_APP_TABLES.length);
    });

    it("still resets when the bootstrap canary is unparseable and the profile canary fails authentication", async () => {
      const keyStore = createFakeLocalDataKeyStore("b".repeat(64));
      const fake = createKeyResolutionFakeDatabase({
        encryptedRows: [
          { table: "bootstrap_state", payload: "{truncated" },
          {
            table: "profile_settings",
            payload: encryptLocalDataRecord(rightKey, { cycleLength: 28 }, profileAad),
          },
        ],
      });

      const resolvedKey = await resolveLocalDataKey(fake.database, keyStore);

      expect(fake.deletedTables).toHaveLength(ALL_LOCAL_APP_TABLES.length);
      expect(resolvedKey).not.toBe("b".repeat(64));
      expect(keyStore.writeLocalDataKey).toHaveBeenCalledWith(resolvedKey);
    });

    it("keeps the key when every canary envelope is unparseable (nothing to verify against)", async () => {
      const keyStore = createFakeLocalDataKeyStore(rightKey);
      const fake = createKeyResolutionFakeDatabase({
        encryptedRows: [
          { table: "bootstrap_state", payload: "not json" },
          { table: "profile_settings", payload: JSON.stringify({ algorithm: "x" }) },
        ],
      });

      await expect(resolveLocalDataKey(fake.database, keyStore)).resolves.toBe(rightKey);
      expect(fake.deletedTables).toEqual([]);
      expect(keyStore.writeLocalDataKey).not.toHaveBeenCalled();
    });

    it("propagates a SQLite read error from the canary probe without wiping or replacing the key", async () => {
      const keyStore = createFakeLocalDataKeyStore(rightKey);
      const fake = createKeyResolutionFakeDatabase({
        encryptedRows: [
          {
            table: "bootstrap_state",
            payload: encryptLocalDataRecord(rightKey, { ok: true }, bootstrapAad),
          },
        ],
        failReadsWith: new Error("database is locked"),
      });

      await expect(resolveLocalDataKey(fake.database, keyStore)).rejects.toThrow(
        /canaryDecrypt: database is locked/,
      );
      expect(fake.deletedTables).toEqual([]);
      expect(keyStore.writeLocalDataKey).not.toHaveBeenCalled();
    });

    it("resets when the stored key cannot be a 32-byte hex key", async () => {
      const keyStore = createFakeLocalDataKeyStore("corrupted");
      const fake = createKeyResolutionFakeDatabase();

      const resolvedKey = await resolveLocalDataKey(fake.database, keyStore);

      expect(fake.deletedTables).toHaveLength(ALL_LOCAL_APP_TABLES.length);
      expect(resolvedKey).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("atomic wipe", () => {
    it("runs every DELETE inside one BEGIN IMMEDIATE ... COMMIT", async () => {
      const fake = createKeyResolutionFakeDatabase();

      await wipeLocalAppTables(fake.database);

      expect(fake.statements[0]).toBe("BEGIN IMMEDIATE;");
      expect(fake.statements.at(-1)).toBe("COMMIT;");
      expect(fake.statements.slice(1, -1)).toHaveLength(ALL_LOCAL_APP_TABLES.length);
      expect(
        fake.statements.slice(1, -1).every((statement) => statement.startsWith("DELETE FROM")),
      ).toBe(true);
    });

    it("rolls back and keeps the old key when a DELETE fails mid-wipe", async () => {
      const oldKey = "b".repeat(64);
      const keyStore = createFakeLocalDataKeyStore(oldKey);
      const fake = createKeyResolutionFakeDatabase({
        encryptedRows: [
          {
            table: "bootstrap_state",
            payload: encryptLocalDataRecord(
              "a".repeat(64),
              { ok: true },
              buildLocalDataAad("bootstrap_state", "1"),
            ),
          },
        ],
        failDeleteOf: "pregnancy_records",
      });

      await expect(resolveLocalDataKey(fake.database, keyStore)).rejects.toThrow(
        "disk I/O error",
      );
      expect(fake.statements.at(-1)).toBe("ROLLBACK;");
      expect(fake.statements).not.toContain("COMMIT;");
      expect(keyStore.writeLocalDataKey).not.toHaveBeenCalled();
      expect(await keyStore.readLocalDataKey()).toBe(oldKey);
    });

    it("reports a failed ROLLBACK to the caller and still rethrows the DELETE failure", async () => {
      const fake = createKeyResolutionFakeDatabase({
        failDeleteOf: "symptoms",
        failRollback: true,
      });
      const onRollbackFailed = jest.fn();

      await expect(
        wipeLocalAppTables(fake.database, onRollbackFailed),
      ).rejects.toThrow("disk I/O error");
      expect(onRollbackFailed).toHaveBeenCalledTimes(1);
    });
  });
});
