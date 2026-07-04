// Encrypted-local-data key resolution: canary-decrypt a singleton row against the
// SecureStore key, and on auth-tag failure wipe and reseed deterministically rather
// than propagating a key/data mismatch (security invariant, see SECURITY.md).

import {
  buildLocalDataAad,
  createLocalDataKeyHex,
  decryptLocalDataRecord,
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
    // or after a buggy key rotation. Per the SECURITY.md invariant
    // "the storage layer must reset the local database deterministically
    // rather than crashing", we attempt a canary decrypt on a singleton
    // row first and fall through to wipe-and-reseed on auth-tag failure.
    const canDecrypt = await withStorageOperationLabel(
      "sqlite/localDataKey/canaryDecrypt",
      () => canDecryptCanaryRow(database, existingKey),
    );
    if (canDecrypt) {
      return existingKey;
    }
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

async function canDecryptCanaryRow(
  database: LocalAppDatabase,
  keyHex: string,
): Promise<boolean> {
  // Try bootstrap_state first (always present once onboarding has touched
  // the DB), then profile_settings. If neither has encrypted content,
  // there's nothing to verify against → assume key is valid (fresh install).
  const candidates: { table: string; sql: string }[] = [
    {
      table: "bootstrap_state",
      sql: "SELECT encrypted_payload FROM bootstrap_state WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    },
    {
      table: "profile_settings",
      sql: "SELECT encrypted_payload FROM profile_settings WHERE encrypted_payload IS NOT NULL AND encrypted_payload != '' LIMIT 1;",
    },
  ];

  for (const candidate of candidates) {
    const row = await database.getFirstAsync<{ encrypted_payload: string | null }>(
      candidate.sql,
    );
    if (!row?.encrypted_payload) {
      continue;
    }
    try {
      decryptLocalDataRecord(
        keyHex,
        row.encrypted_payload,
        buildLocalDataAad(candidate.table, "1"),
      );
      return true;
    } catch {
      return false;
    }
  }

  return true;
}

async function hasEncryptedLocalData(database: LocalAppDatabase): Promise<boolean> {
  const [
    bootstrapRow,
    profileRow,
    dayLogRow,
    syncPreferencesRow,
    symptomRow,
    managedBillingCacheRow,
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
  ]);

  return Boolean(
    bootstrapRow?.encrypted_payload ||
      profileRow?.encrypted_payload ||
      dayLogRow?.encrypted_payload ||
      syncPreferencesRow?.encrypted_payload ||
      symptomRow?.encrypted_payload ||
      managedBillingCacheRow?.encrypted_payload,
  );
}

export async function wipeLocalAppTables(database: LocalAppDatabase): Promise<void> {
  await database.runAsync("DELETE FROM day_logs;");
  await database.runAsync("DELETE FROM symptoms;");
  await database.runAsync("DELETE FROM profile_settings;");
  await database.runAsync("DELETE FROM bootstrap_state;");
  await database.runAsync("DELETE FROM sync_preferences;");
  await database.runAsync("DELETE FROM managed_billing_cache;");
}
