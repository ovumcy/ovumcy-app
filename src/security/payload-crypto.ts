import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { getRandomBytes } from "expo-crypto";

const XCHACHA_NONCE_BYTE_LENGTH = 24;

export type EncryptedPayloadEnvelope = {
  algorithm: "xchacha20poly1305";
  nonceHex: string;
  ciphertextHex: string;
};

export function createRandomSecretHex(byteLength = 32): string {
  return bytesToHex(getRandomBytes(byteLength));
}

/**
 * AEAD encryption with mandatory associated data (AAD).
 *
 * The AAD is authenticated but not confidential: it binds the ciphertext
 * to a specific context (table row, grant id, sync snapshot version, …),
 * so an attacker with database write access cannot swap ciphertext blobs
 * between rows or contexts without invalidating the auth tag. Every caller
 * must compute a context-specific AAD; passing an empty Uint8Array is
 * legal cryptographically but defeats the purpose, so we make it required
 * to force the choice.
 */
export function encryptPayload(
  keyHex: string,
  payload: Uint8Array,
  aad: Uint8Array,
): EncryptedPayloadEnvelope {
  const nonce = getRandomBytes(XCHACHA_NONCE_BYTE_LENGTH);
  const ciphertext = xchacha20poly1305(hexToBytes(keyHex), nonce, aad).encrypt(
    payload,
  );

  return {
    algorithm: "xchacha20poly1305",
    nonceHex: bytesToHex(nonce),
    ciphertextHex: bytesToHex(ciphertext),
  };
}

export function decryptPayload(
  keyHex: string,
  envelope: EncryptedPayloadEnvelope,
  aad: Uint8Array,
): Uint8Array {
  return xchacha20poly1305(
    hexToBytes(keyHex),
    hexToBytes(envelope.nonceHex),
    aad,
  ).decrypt(hexToBytes(envelope.ciphertextHex));
}
