import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { entropyToMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist as englishWordlist } from "@scure/bip39/wordlists/english.js";
import { getRandomBytes } from "expo-crypto";

import type {
  EncryptedSyncEnvelope,
  SyncDeviceIdentity,
  SyncSecretsRecord,
  WrappedSyncKeyMetadata,
} from "../sync/sync-contract";
import { decryptPayload, encryptPayload } from "./payload-crypto";

const DEVICE_ID_BYTE_LENGTH = 16;
const DEVICE_SECRET_BYTE_LENGTH = 32;
const MASTER_KEY_BYTE_LENGTH = 32;
const RECOVERY_ENTROPY_BYTE_LENGTH = 16;
const RECOVERY_MNEMONIC_WORD_COUNT = 12;
const XCHACHA_NONCE_BYTE_LENGTH = 24;

const RECOVERY_WRAP_INFO = utf8ToBytes("ovumcy-sync-wrap");
const RECOVERY_FINGERPRINT_INFO = utf8ToBytes("ovumcy-sync-fingerprint");
const RECOVERY_WRAP_AAD_VERSION = "ovumcy-sync-wrap-v1";
const SYNC_PAYLOAD_AAD_VERSION = "ovumcy-sync-v1";

export function createRecoveryPhrase(): string {
  return entropyToMnemonic(
    getRandomBytes(RECOVERY_ENTROPY_BYTE_LENGTH),
    englishWordlist,
  );
}

export function isValidRecoveryPhrase(value: string): boolean {
  return validateMnemonic(normalizeRecoveryPhrase(value), englishWordlist);
}

/**
 * Builds the AAD for a sync snapshot envelope. Both upload and restore
 * sides must construct the same string; the device identifier prevents
 * an attacker who somehow possessed the master key from re-using a
 * snapshot captured from a different device under the same account.
 */
export function buildSyncPayloadAad(deviceID: string): Uint8Array {
  return utf8ToBytes(`${SYNC_PAYLOAD_AAD_VERSION}|${deviceID}`);
}

export function createSyncSecretsRecord(
  deviceLabel: string,
  now: Date,
): {
  recoveryPhrase: string;
  record: SyncSecretsRecord;
} {
  const recoveryPhrase = createRecoveryPhrase();
  const masterKey = getRandomBytes(MASTER_KEY_BYTE_LENGTH);
  const deviceSecret = getRandomBytes(DEVICE_SECRET_BYTE_LENGTH);
  const wrappedKey = wrapMasterKeyWithRecoveryPhrase(
    recoveryPhrase,
    bytesToHex(masterKey),
  );

  return {
    recoveryPhrase,
    record: {
      device: createDeviceIdentity(deviceLabel, now),
      masterKeyHex: bytesToHex(masterKey),
      deviceSecretHex: bytesToHex(deviceSecret),
      wrappedKey,
      authSessionToken: null,
      managedAuthSessionToken: null,
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
    },
  };
}

export function createRecoveredSyncSecretsRecord(
  recoveryPhrase: string,
  wrappedKey: WrappedSyncKeyMetadata,
  deviceLabel: string,
  now: Date,
): SyncSecretsRecord {
  const masterKeyHex = unwrapMasterKeyWithRecoveryPhrase(recoveryPhrase, wrappedKey);

  return {
    device: createDeviceIdentity(deviceLabel, now),
    masterKeyHex,
    deviceSecretHex: bytesToHex(getRandomBytes(DEVICE_SECRET_BYTE_LENGTH)),
    wrappedKey,
    authSessionToken: null,
    managedAuthSessionToken: null,
    managedAuthSessionExpiresAt: null,
    managedRefreshToken: null,
    managedRefreshTokenExpiresAt: null,
  };
}

export function wrapMasterKeyWithRecoveryPhrase(
  recoveryPhrase: string,
  masterKeyHex: string,
): WrappedSyncKeyMetadata {
  const normalizedPhrase = normalizeRecoveryPhrase(recoveryPhrase);
  if (!isValidRecoveryPhrase(normalizedPhrase)) {
    throw new Error("invalid_recovery_phrase");
  }

  const wrappingKey = deriveRecoveryWrappingKey(normalizedPhrase);
  const wrapNonce = getRandomBytes(XCHACHA_NONCE_BYTE_LENGTH);
  const phraseFingerprintHex = buildRecoveryPhraseFingerprint(normalizedPhrase);
  const aad = buildRecoveryWrapAad(
    phraseFingerprintHex,
    RECOVERY_MNEMONIC_WORD_COUNT,
  );
  const wrappedMasterKey = xchacha20poly1305(wrappingKey, wrapNonce, aad).encrypt(
    hexToBytes(masterKeyHex),
  );

  return {
    algorithm: "xchacha20poly1305",
    kdf: "bip39_seed_hkdf_sha256",
    mnemonicWordCount: RECOVERY_MNEMONIC_WORD_COUNT,
    wrapNonceHex: bytesToHex(wrapNonce),
    wrappedMasterKeyHex: bytesToHex(wrappedMasterKey),
    phraseFingerprintHex,
  };
}

export function unwrapMasterKeyWithRecoveryPhrase(
  recoveryPhrase: string,
  wrappedKey: WrappedSyncKeyMetadata,
): string {
  const normalizedPhrase = normalizeRecoveryPhrase(recoveryPhrase);
  if (!isValidRecoveryPhrase(normalizedPhrase)) {
    throw new Error("invalid_recovery_phrase");
  }
  validateWrappedSyncKeyMetadata(wrappedKey);
  if (
    buildRecoveryPhraseFingerprint(normalizedPhrase) !==
    wrappedKey.phraseFingerprintHex
  ) {
    throw new Error("invalid_recovery_phrase");
  }

  const wrappingKey = deriveRecoveryWrappingKey(normalizedPhrase);
  const aad = buildRecoveryWrapAad(
    wrappedKey.phraseFingerprintHex,
    wrappedKey.mnemonicWordCount,
  );
  const masterKey = xchacha20poly1305(
    wrappingKey,
    hexToBytes(wrappedKey.wrapNonceHex),
    aad,
  ).decrypt(hexToBytes(wrappedKey.wrappedMasterKeyHex));

  return bytesToHex(masterKey);
}

export function encryptSyncPayload(
  masterKeyHex: string,
  payload: Uint8Array,
  aad: Uint8Array,
): EncryptedSyncEnvelope {
  return encryptPayload(masterKeyHex, payload, aad);
}

export function decryptSyncPayload(
  masterKeyHex: string,
  envelope: EncryptedSyncEnvelope,
  aad: Uint8Array,
): Uint8Array {
  return decryptPayload(masterKeyHex, envelope, aad);
}

function createDeviceIdentity(deviceLabel: string, now: Date): SyncDeviceIdentity {
  return {
    deviceID: bytesToHex(getRandomBytes(DEVICE_ID_BYTE_LENGTH)),
    deviceLabel: deviceLabel.trim(),
    createdAt: now.toISOString(),
  };
}

function deriveRecoveryWrappingKey(recoveryPhrase: string): Uint8Array {
  return hkdf(
    sha256,
    mnemonicToSeedSync(recoveryPhrase),
    undefined,
    RECOVERY_WRAP_INFO,
    MASTER_KEY_BYTE_LENGTH,
  );
}

function buildRecoveryPhraseFingerprint(recoveryPhrase: string): string {
  return bytesToHex(
    hkdf(
      sha256,
      mnemonicToSeedSync(recoveryPhrase),
      undefined,
      RECOVERY_FINGERPRINT_INFO,
      8,
    ),
  );
}

function buildRecoveryWrapAad(
  phraseFingerprintHex: string,
  mnemonicWordCount: number,
): Uint8Array {
  return utf8ToBytes(
    `${RECOVERY_WRAP_AAD_VERSION}|${phraseFingerprintHex}|${mnemonicWordCount}`,
  );
}

function validateWrappedSyncKeyMetadata(
  wrappedKey: WrappedSyncKeyMetadata,
): void {
  if (
    wrappedKey.algorithm !== "xchacha20poly1305" ||
    wrappedKey.kdf !== "bip39_seed_hkdf_sha256" ||
    wrappedKey.mnemonicWordCount !== RECOVERY_MNEMONIC_WORD_COUNT
  ) {
    throw new Error("invalid_wrapped_key_metadata");
  }
}

function normalizeRecoveryPhrase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .join(" ");
}
