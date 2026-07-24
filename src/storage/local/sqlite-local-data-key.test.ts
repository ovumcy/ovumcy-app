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
// (security-detail.md's "reset the local database deterministically"). These
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
};

// Minimal fake for the key-resolution path: it only needs to answer the
// "first non-empty encrypted_payload in <table>" probes (canary +
// hasEncryptedLocalData) and record which tables get a DELETE.
function createKeyResolutionFakeDatabase(seed?: {
  encryptedRows?: EncryptedRowSeed[];
}) {
  const encryptedRows = [...(seed?.encryptedRows ?? [])];
  const deletedTables: string[] = [];

  const database: LocalAppDatabase = {
    async execAsync() {
      return undefined;
    },
    async getFirstAsync<T>(source: string): Promise<T | null> {
      if (source.includes("encrypted_payload IS NOT NULL")) {
        const tableName = /FROM (\w+)/.exec(source)?.[1] ?? "";
        const row = encryptedRows.find((entry) => entry.table === tableName);
        return row ? ({ encrypted_payload: row.payload } as T) : null;
      }
      return null;
    },
    async getAllAsync<T>(): Promise<T[]> {
      return [];
    },
    async runAsync(source: string) {
      const tableName = /DELETE FROM (\w+);/.exec(source)?.[1];
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

  return { database, deletedTables, encryptedRows };
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
});
