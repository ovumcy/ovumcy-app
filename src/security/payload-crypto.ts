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

export function encryptPayload(
  keyHex: string,
  payload: Uint8Array,
): EncryptedPayloadEnvelope {
  const nonce = getRandomBytes(XCHACHA_NONCE_BYTE_LENGTH);
  const ciphertext = xchacha20poly1305(hexToBytes(keyHex), nonce).encrypt(
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
): Uint8Array {
  return xchacha20poly1305(
    hexToBytes(keyHex),
    hexToBytes(envelope.nonceHex),
  ).decrypt(hexToBytes(envelope.ciphertextHex));
}
