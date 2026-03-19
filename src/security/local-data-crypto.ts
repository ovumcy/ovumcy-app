import {
  createRandomSecretHex,
  decryptPayload,
  encryptPayload,
  type EncryptedPayloadEnvelope,
} from "./payload-crypto";

export type EncryptedLocalDataEnvelope = EncryptedPayloadEnvelope;

export function createLocalDataKeyHex(): string {
  return createRandomSecretHex(32);
}

export function encryptLocalDataRecord<T>(
  keyHex: string,
  value: T,
): string {
  const payload = new TextEncoder().encode(JSON.stringify(value));
  return JSON.stringify(encryptPayload(keyHex, payload));
}

export function decryptLocalDataRecord<T>(
  keyHex: string,
  rawValue: string,
): T {
  const envelope = JSON.parse(rawValue) as EncryptedLocalDataEnvelope;
  const payload = decryptPayload(keyHex, envelope);
  return JSON.parse(new TextDecoder().decode(payload)) as T;
}
