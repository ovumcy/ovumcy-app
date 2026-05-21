import {
  createRandomSecretHex,
  decryptPayload,
  encryptPayload,
  type EncryptedPayloadEnvelope,
} from "./payload-crypto";

export type EncryptedLocalDataEnvelope = EncryptedPayloadEnvelope;

const LOCAL_DATA_AAD_VERSION = "ovumcy-local-v1";

export function createLocalDataKeyHex(): string {
  return createRandomSecretHex(32);
}

/**
 * Builds the AAD bound to a single local-data row. Both encrypt and
 * decrypt sites must construct the identical context string — table name
 * plus the row key as stored in SQLite (`day` column for day_logs,
 * `id` for symptoms, the literal `"1"` for singleton tables) — otherwise
 * decryption fails with an auth-tag mismatch. This prevents swapping
 * ciphertext blobs between rows or across tables.
 */
export function buildLocalDataAad(tableName: string, rowKey: string): Uint8Array {
  return new TextEncoder().encode(
    `${LOCAL_DATA_AAD_VERSION}|${tableName}|${rowKey}`,
  );
}

export function encryptLocalDataRecord<T>(
  keyHex: string,
  value: T,
  aad: Uint8Array,
): string {
  const payload = new TextEncoder().encode(JSON.stringify(value));
  return JSON.stringify(encryptPayload(keyHex, payload, aad));
}

export function decryptLocalDataRecord<T>(
  keyHex: string,
  rawValue: string,
  aad: Uint8Array,
): T {
  const envelope = JSON.parse(rawValue) as EncryptedLocalDataEnvelope;
  const payload = decryptPayload(keyHex, envelope, aad);
  return JSON.parse(new TextDecoder().decode(payload)) as T;
}
