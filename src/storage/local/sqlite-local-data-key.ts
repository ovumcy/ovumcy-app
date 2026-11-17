// Encrypted-local-data key resolution: canary-decrypt a singleton row against the
// SecureStore key, and on an authentication failure wipe and reseed
// deterministically rather than propagating a key/data mismatch (security
// invariant, see SECURITY.md).

import {
  buildLocalDataAad,
  checkLocalDataKey,
  createLocalDataKeyHex,
  isWellFormedLocalDataKeyHex,
} from "../../security/local-data-crypto";
import type { LocalDataKeyStore } from "../../security/local-data-key-store";
import {
  type LocalAppDatabase,
  withStorageOperationLabel,
} from "./sqlite-schema-migrations";

export async function resolveLocalDataKey(
  database: LocalAppDatabase,
  localDataKeyStore: LocalDataKeyStore,
): Promise<string> {
  const existingKey = await localDataKeyStore.readLocalDataKey();
  if (existingKey) {
    // Verify the stored key actually authenticates existing data.
    // SecureStore can desynchronize from on-disk encrypted rows on
    // Android Auto Backup restore (DB restored but key regenerated)
    // or after a buggy key rotation. A key that no longer authenticates the
    // rows resets the local database deterministically instead of crashing
    // (see the local-data encryption section of SECURITY.md). Only an AEAD
    // failure on a well-formed envelope, or a stored key that cannot be a key,
    // counts: a SQLite read error propagates and an unparseable envelope is
    // skipped, so neither wipes anything.
    const keyMatches = await withStorageOperationLabel(
      "sqlite/localDataKey/canaryDecrypt",
      () => canaryAuthenticatesKey(database, existingKey),
    );
    if (keyMatches) {
      return existingKey;
    }
    // The replacement key is written only after the wipe commits: a kill
    // before the commit rolls the wipe back and the next boot re-detects the
    // mismatch with the old key still in place.
    await wipeLocalAppTables(database);
    const replacementKey = createLocalDataKeyHex();
    await localDataKeyStore.writeLocalDataKey(replacementKey);
    return replacementKey;
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

async function canaryAuthenticatesKey(
  database: LocalAppDatabase,
  keyHex: string,
): Promise<boolean> {
  if (!isWellFormedLocalDataKeyHex(keyHex)) {
    return false;
  }
  // Any well-formed envelope that authenticates proves the key; only when at
  // least one fails and none authenticates is it a mismatch. A single
  // tampered or corrupt row therefore never wipes the rest — its own read
  // falls back or fails closed. With no well-formed envelope at all (fresh
  // install, or every candidate unparseable) the key is kept.
  const candidates: { aadTable: string; sql: string; rowKey: (row: CanaryRow) => string }[] = [
    {
      aadTable: "bootstrap_state",
      sql: "SELECT encrypted_payload FROM bootstrap_state WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
      rowKey: () => "1",
    },
    {
      aadTable: "profile_settings",
      sql: "SELECT encrypted_payload FROM profile_settings WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
      rowKey: () => "1",
    },
    {
      aadTable: "day_log",
      sql: "SELECT day AS row_key, encrypted_payload FROM day_logs WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
      rowKey: (row) => String(row.row_key),
    },
    {
      aadTable: "symptom",
      sql: "SELECT id AS row_key, encrypted_payload FROM symptoms WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
      rowKey: (row) => String(row.row_key),
    },
  ];

  let sawMismatch = false;
  for (const candidate of candidates) {
    const row = await database.getFirstAsync<CanaryRow>(candidate.sql);
    if (!row?.encrypted_payload) {
      continue;
    }
    const check = checkLocalDataKey(
      keyHex,
      row.encrypted_payload,
      buildLocalDataAad(candidate.aadTable, candidate.rowKey(row)),
    );
    if (check === "authenticated") {
      return true;
    }
    if (check === "mismatch") {
      sawMismatch = true;
    }
  }

  return !sawMismatch;
}

type CanaryRow = { encrypted_payload: string | null; row_key?: string };

async function hasEncryptedLocalData(database: LocalAppDatabase): Promise<boolean> {
  const [
    bootstrapRow,
    profileRow,
    dayLogRow,
    syncPreferencesRow,
    symptomRow,
    managedBillingCacheRow,
    pregnancyRecordRow,
    kickSessionRow,
    contractionSessionRow,
    postpartumRecordRow,
    screeningResponseRow,
  ] =
    await Promise.all([
      database.getFirstAsync<{ encrypted_payload: string | null }>(
        "SELECT encrypted_payload FROM bootstrap_state WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
      ),
    database.getFirstAsync<{ encrypted_payload: string | null }>(
      "SELECT encrypted_payload FROM profile_settings WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    ),
    database.getFirstAsync<{ encrypted_payload: string | null }>(
      "SELECT encrypted_payload FROM day_logs WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    ),
    database.getFirstAsync<{ encrypted_payload: string | null }>(
      "SELECT encrypted_payload FROM sync_preferences WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    ),
    database.getFirstAsync<{ encrypted_payload: string | null }>(
      "SELECT encrypted_payload FROM symptoms WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    ),
    database.getFirstAsync<{ encrypted_payload: string | null }>(
      "SELECT encrypted_payload FROM managed_billing_cache WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    ),
    database.getFirstAsync<{ encrypted_payload: string | null }>(
      "SELECT encrypted_payload FROM pregnancy_records WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    ),
    database.getFirstAsync<{ encrypted_payload: string | null }>(
      "SELECT encrypted_payload FROM kick_sessions WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    ),
    database.getFirstAsync<{ encrypted_payload: string | null }>(
      "SELECT encrypted_payload FROM contraction_sessions WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    ),
    database.getFirstAsync<{ encrypted_payload: string | null }>(
      "SELECT encrypted_payload FROM postpartum_records WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    ),
    database.getFirstAsync<{ encrypted_payload: string | null }>(
      "SELECT encrypted_payload FROM screening_responses WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    ),
  ]);

  return Boolean(
    bootstrapRow?.encrypted_payload ||
      profileRow?.encrypted_payload ||
      dayLogRow?.encrypted_payload ||
      syncPreferencesRow?.encrypted_payload ||
      symptomRow?.encrypted_payload ||
      managedBillingCacheRow?.encrypted_payload ||
      pregnancyRecordRow?.encrypted_payload ||
      kickSessionRow?.encrypted_payload ||
      contractionSessionRow?.encrypted_payload ||
      postpartumRecordRow?.encrypted_payload ||
      screeningResponseRow?.encrypted_payload,
  );
}

const LOCAL_APP_TABLES = [
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

// One transaction: a kill mid-wipe rolls back to the pre-wipe state instead
// of leaving some tables emptied and others holding stale ciphertext.
export async function wipeLocalAppTables(
  database: LocalAppDatabase,
  onRollbackFailed?: () => void,
): Promise<void> {
  await database.execAsync("BEGIN IMMEDIATE;");
  try {
    for (const table of LOCAL_APP_TABLES) {
      await database.runAsync(`DELETE FROM ${table};`);
    }
    await database.execAsync("COMMIT;");
  } catch (error) {
    try {
      await database.execAsync("ROLLBACK;");
    } catch {
      // The DELETE failure is the one worth reporting; the caller learns the
      // connection may still be inside the transaction.
      onRollbackFailed?.();
    }
    throw error;
  }
}
