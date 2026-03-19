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

const DEVICE_ID_BYTE_LENGTH = 16;
const DEVICE_SECRET_BYTE_LENGTH = 32;
const MASTER_KEY_BYTE_LENGTH = 32;
const RECOVERY_ENTROPY_BYTE_LENGTH = 16;
const XCHACHA_NONCE_BYTE_LENGTH = 24;

const RECOVERY_WRAP_INFO = utf8ToBytes("ovumcy-sync-wrap");
const RECOVERY_FINGERPRINT_INFO = utf8ToBytes("ovumcy-sync-fingerprint");

export function createRecoveryPhrase(): string {
  return entropyToMnemonic(
    getRandomBytes(RECOVERY_ENTROPY_BYTE_LENGTH),
    englishWordlist,
  );
}

export function isValidRecoveryPhrase(value: string): boolean {
  return validateMnemonic(normalizeRecoveryPhrase(value), englishWordlist);
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
    },
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
  const wrappedMasterKey = xchacha20poly1305(wrappingKey, wrapNonce).encrypt(
    hexToBytes(masterKeyHex),
  );

  return {
    algorithm: "xchacha20poly1305",
    kdf: "bip39_seed_hkdf_sha256",
    mnemonicWordCount: 12,
    wrapNonceHex: bytesToHex(wrapNonce),
    wrappedMasterKeyHex: bytesToHex(wrappedMasterKey),
    phraseFingerprintHex: buildRecoveryPhraseFingerprint(normalizedPhrase),
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

  const wrappingKey = deriveRecoveryWrappingKey(normalizedPhrase);
  const masterKey = xchacha20poly1305(
    wrappingKey,
    hexToBytes(wrappedKey.wrapNonceHex),
  ).decrypt(hexToBytes(wrappedKey.wrappedMasterKeyHex));

  return bytesToHex(masterKey);
}

export function encryptSyncPayload(
  masterKeyHex: string,
  payload: Uint8Array,
): EncryptedSyncEnvelope {
  const nonce = getRandomBytes(XCHACHA_NONCE_BYTE_LENGTH);
  const ciphertext = xchacha20poly1305(hexToBytes(masterKeyHex), nonce).encrypt(
    payload,
  );

  return {
    algorithm: "xchacha20poly1305",
    nonceHex: bytesToHex(nonce),
    ciphertextHex: bytesToHex(ciphertext),
  };
}

export function decryptSyncPayload(
  masterKeyHex: string,
  envelope: EncryptedSyncEnvelope,
): Uint8Array {
  return xchacha20poly1305(
    hexToBytes(masterKeyHex),
    hexToBytes(envelope.nonceHex),
  ).decrypt(hexToBytes(envelope.ciphertextHex));
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

function normalizeRecoveryPhrase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .join(" ");
}
