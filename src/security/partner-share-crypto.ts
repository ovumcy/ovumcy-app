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
const PARTNER_SHARE_AAD_VERSION = "ovumcy-partner-share-v1";

// Minimum length floor on the invite token. Even though the managed cloud
// is the party that mints the token, a compromised server could otherwise
// hand the owner a weak token (e.g. "ab"), derive the same partner-share
// key, and decrypt the supposedly opaque ciphertext. 22 chars ≈ 128 bits
// of base64 entropy; matches the random-token output the cloud is expected
// to emit. Stricter than the previous "non-empty after trim" check.
const PARTNER_SHARE_MIN_TOKEN_LENGTH = 22;

export function derivePartnerShareKeyHex(inviteToken: string): string {
  const normalizedToken = inviteToken.trim();
  if (normalizedToken.length < PARTNER_SHARE_MIN_TOKEN_LENGTH) {
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

/**
 * Builds the AAD bound to the projection's grant context. Only fields
 * that travel as sidecar metadata on BOTH upload and download are
 * eligible: grantID + accessLevel + schemaVersion. (`generatedAt` is
 * not in the server-returned projection shape, so it can't be authenticated
 * via AAD; it's still inner-payload verified after decrypt.) Binding
 * these prevents a malicious upstream from rewriting the outer header
 * (e.g. flipping accessLevel "full" → "summary" on a stored blob) without
 * invalidating the auth tag.
 */
function buildPartnerShareAad(
  grantID: string,
  accessLevel: string,
  schemaVersion: number,
): Uint8Array {
  return utf8ToBytes(
    `${PARTNER_SHARE_AAD_VERSION}|${grantID}|${accessLevel}|${schemaVersion}`,
  );
}

type DecryptablePartnerSharedEnvelope = Pick<
  PartnerSharedProjectionEnvelope,
  "grantID" | "accessLevel" | "schemaVersion" | "checksumSHA256" | "ciphertextBase64"
>;

export function encryptPartnerSharedProjection(
  keyHex: string,
  payload: PartnerSharedProjectionPayload,
): PartnerSharedProjectionEnvelope {
  const encodedPayload = utf8ToBytes(JSON.stringify(payload));
  const checksumSHA256 = bytesToHex(sha256(encodedPayload));
  const aad = buildPartnerShareAad(
    payload.grantID,
    payload.accessLevel,
    PARTNER_SHARE_SCHEMA_VERSION,
  );
  const encryptedEnvelope = encryptPayload(keyHex, encodedPayload, aad);
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
  envelope: DecryptablePartnerSharedEnvelope,
): PartnerSharedProjectionPayload {
  if (envelope.schemaVersion !== PARTNER_SHARE_SCHEMA_VERSION) {
    throw new Error("invalid_partner_projection");
  }

  const encodedEnvelope = toByteArray(envelope.ciphertextBase64);
  const encryptedEnvelope = JSON.parse(
    new TextDecoder().decode(encodedEnvelope),
  ) as EncryptedPayloadEnvelope;
  const aad = buildPartnerShareAad(
    envelope.grantID,
    envelope.accessLevel,
    envelope.schemaVersion,
  );
  const encodedPayload = decryptPayload(keyHex, encryptedEnvelope, aad);
  const checksumSHA256 = bytesToHex(sha256(encodedPayload));
  if (checksumSHA256 !== envelope.checksumSHA256) {
    throw new Error("invalid_partner_projection");
  }

  const payload = JSON.parse(
    new TextDecoder().decode(encodedPayload),
  ) as PartnerSharedProjectionPayload;
  if (payload.schemaVersion !== PARTNER_SHARE_SCHEMA_VERSION) {
    throw new Error("invalid_partner_projection");
  }
  // Inner payload must match the envelope on AAD-bound fields. AAD
  // already authenticates these, but the explicit equality check surfaces
  // a clear error rather than a silently mismatched UI render if a future
  // caller forgets to include a field in the AAD set.
  if (
    payload.grantID !== envelope.grantID ||
    payload.accessLevel !== envelope.accessLevel
  ) {
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
