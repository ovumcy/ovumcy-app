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

export type LocalDataKeyCheck = "authenticated" | "mismatch" | "malformed";

const LOCAL_DATA_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/i;
const XCHACHA_NONCE_HEX_PATTERN = /^[0-9a-f]{48}$/i;
// At least the 16-byte Poly1305 tag, whole bytes only.
const XCHACHA_CIPHERTEXT_HEX_PATTERN = /^(?:[0-9a-f]{2}){16,}$/i;

export function isWellFormedLocalDataKeyHex(keyHex: string): boolean {
  return LOCAL_DATA_KEY_HEX_PATTERN.test(keyHex);
}

function parseWellFormedEnvelope(
  rawValue: string,
): EncryptedLocalDataEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const { algorithm, nonceHex, ciphertextHex } = parsed as Record<string, unknown>;
  if (
    algorithm !== "xchacha20poly1305" ||
    typeof nonceHex !== "string" ||
    typeof ciphertextHex !== "string" ||
    !XCHACHA_NONCE_HEX_PATTERN.test(nonceHex) ||
    !XCHACHA_CIPHERTEXT_HEX_PATTERN.test(ciphertextHex)
  ) {
    return null;
  }
  return { algorithm, nonceHex, ciphertextHex };
}

/**
 * Classifies whether `keyHex` authenticates one stored row. Only an AEAD
 * failure on a well-formed key and a well-formed envelope is a key/data
 * mismatch; an envelope that does not even parse is "malformed" and says
 * nothing about the key. The plaintext is never parsed here.
 */
export function checkLocalDataKey(
  keyHex: string,
  rawValue: string,
  aad: Uint8Array,
): LocalDataKeyCheck {
  if (!isWellFormedLocalDataKeyHex(keyHex)) {
    return "mismatch";
  }
  const envelope = parseWellFormedEnvelope(rawValue);
  if (!envelope) {
    return "malformed";
  }
  try {
    decryptPayload(keyHex, envelope, aad);
    return "authenticated";
  } catch {
    return "mismatch";
  }
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
