import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { fromByteArray, toByteArray } from "base64-js";

import {
  PARTNER_SHARE_SCHEMA_VERSION,
  type PartnerSharedProjectionEnvelope,
  type PartnerSharedProjectionPayload,
} from "../models/partner-share";
import {
  decryptPayload,
  encryptPayload,
  type EncryptedPayloadEnvelope,
} from "./payload-crypto";

const PARTNER_SHARE_INFO = utf8ToBytes("ovumcy-partner-share-v1");

export function derivePartnerShareKeyHex(inviteToken: string): string {
  const normalizedToken = inviteToken.trim();
  if (normalizedToken.length === 0) {
    throw new Error("invalid_partner_invite");
  }

  return bytesToHex(
    hkdf(
      sha256,
      utf8ToBytes(normalizedToken),
      undefined,
      PARTNER_SHARE_INFO,
      32,
    ),
  );
}

export function encryptPartnerSharedProjection(
  keyHex: string,
  payload: PartnerSharedProjectionPayload,
): PartnerSharedProjectionEnvelope {
  const encodedPayload = utf8ToBytes(JSON.stringify(payload));
  const checksumSHA256 = bytesToHex(sha256(encodedPayload));
  const encryptedEnvelope = encryptPayload(keyHex, encodedPayload);
  const encodedEnvelope = utf8ToBytes(JSON.stringify(encryptedEnvelope));

  return {
    accessLevel: payload.accessLevel,
    grantID: payload.grantID,
    generatedAt: payload.generatedAt,
    schemaVersion: PARTNER_SHARE_SCHEMA_VERSION,
    checksumSHA256,
    ciphertextBase64: fromByteArray(encodedEnvelope),
    ciphertextSize: encodedEnvelope.byteLength,
  };
}

export function decryptPartnerSharedProjection(
  keyHex: string,
  input: Pick<
    PartnerSharedProjectionEnvelope,
    "checksumSHA256" | "ciphertextBase64" | "schemaVersion"
  >,
): PartnerSharedProjectionPayload {
  if (input.schemaVersion !== PARTNER_SHARE_SCHEMA_VERSION) {
    throw new Error("invalid_partner_projection");
  }

  const encodedEnvelope = toByteArray(input.ciphertextBase64);
  const encryptedEnvelope = JSON.parse(
    new TextDecoder().decode(encodedEnvelope),
  ) as EncryptedPayloadEnvelope;
  const encodedPayload = decryptPayload(keyHex, encryptedEnvelope);
  const checksumSHA256 = bytesToHex(sha256(encodedPayload));
  if (checksumSHA256 !== input.checksumSHA256) {
    throw new Error("invalid_partner_projection");
  }

  const payload = JSON.parse(
    new TextDecoder().decode(encodedPayload),
  ) as PartnerSharedProjectionPayload;
  if (payload.schemaVersion !== PARTNER_SHARE_SCHEMA_VERSION) {
    throw new Error("invalid_partner_projection");
  }

  return payload;
}

export function exportEncryptedPayloadEnvelope(
  envelope: EncryptedPayloadEnvelope,
): Uint8Array {
  return utf8ToBytes(JSON.stringify(envelope));
}

export function importEncryptedPayloadEnvelope(
  encodedEnvelope: Uint8Array,
): EncryptedPayloadEnvelope {
  const parsed = JSON.parse(
    new TextDecoder().decode(encodedEnvelope),
  ) as EncryptedPayloadEnvelope;
  if (
    parsed.algorithm !== "xchacha20poly1305" ||
    typeof parsed.nonceHex !== "string" ||
    typeof parsed.ciphertextHex !== "string"
  ) {
    throw new Error("invalid_partner_projection");
  }

  hexToBytes(parsed.nonceHex);
  hexToBytes(parsed.ciphertextHex);
  return parsed;
}
