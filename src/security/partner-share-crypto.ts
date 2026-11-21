import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { fromByteArray, toByteArray } from "base64-js";

import {
  INITIAL_GENERATION,
  PARTNER_SHARE_SCHEMA_VERSION,
  type PartnerSharedProjectionEnvelope,
  type PartnerSharedProjectionPayload,
} from "../models/partner-share";
import {
  createRandomSecretHex,
  decryptPayload,
  encryptPayload,
  type EncryptedPayloadEnvelope,
} from "./payload-crypto";
import { isPartnerInviteSecretHex } from "./partner-invite-link";

const PARTNER_SHARE_INVITE_LABEL = "ovumcy-partner-share-v2";
const PARTNER_SHARE_AAD_VERSION = "ovumcy-partner-share-v1";

// Salt and info prefix for the per-grant rotation step (F4). The salt is a
// fixed context tag (an HKDF salt of `undefined` is legal but loses the
// explicit "this is the grant rotation step" domain separation); the info
// encodes the per-grant context that must match between owner and partner.
const PARTNER_SHARE_GRANT_SALT = utf8ToBytes("ovumcy-partner-share-grant-v1");

// Domain labels for the payload-digest subkey. The digest travels in the
// clear next to the ciphertext (the managed cloud stores it), so it is a keyed
// HMAC under a subkey of K_grant that differs from the AEAD key: the AEAD key
// is never reused as an HMAC key, and the server cannot confirm a guessed
// plaintext by hashing it.
const PARTNER_SHARE_DIGEST_SALT = utf8ToBytes("ovumcy-partner-share-digest-v1");
const PARTNER_SHARE_DIGEST_INFO = utf8ToBytes("ovumcy-partner-share-payload-digest-v1");

// Minimum length floor on the invite token. Confidentiality rests on the
// client-only invite secret, but the token is still the redemption
// credential bound into the key; 22 chars ≈ 128 bits of base64 entropy,
// matching the random-token output the cloud is expected to emit.
const PARTNER_SHARE_MIN_TOKEN_LENGTH = 22;

// HKDF over a 32-byte key emits 32-byte hex (64 chars). `deriveGrantSubkeyHex`
// accepts the invite-derived key as hex and validates it against this shape
// so that a corrupted secret-store entry surfaces as a thrown error rather
// than silently producing a different K_grant.
const PARTNER_SHARE_KEY_HEX_PATTERN = /^[0-9a-f]{64}$/;

// 32 bytes from the platform CSPRNG, generated on the owner device per invite.
export function createPartnerInviteSecretHex(): string {
  return createRandomSecretHex(32);
}

/**
 * K_invite. Rooted in the client-only invite secret, never in server-known
 * material alone: the managed cloud holds the token and every grant context
 * field, so a token-only key would be derivable server-side. The token is
 * bound into `info` so a secret cannot be replayed onto another invite.
 */
export function derivePartnerShareKeyHex(
  inviteToken: string,
  inviteSecretHex: string,
): string {
  const normalizedToken = inviteToken.trim();
  if (normalizedToken.length < PARTNER_SHARE_MIN_TOKEN_LENGTH) {
    throw new Error("invalid_partner_invite");
  }
  if (!isPartnerInviteSecretHex(inviteSecretHex)) {
    throw new Error("invalid_partner_invite");
  }

  return bytesToHex(
    hkdf(
      sha256,
      hexToBytes(inviteSecretHex),
      utf8ToBytes(PARTNER_SHARE_INVITE_LABEL),
      utf8ToBytes(`${PARTNER_SHARE_INVITE_LABEL}|${normalizedToken}`),
      32,
    ),
  );
}

/**
 * Per-grant subkey rotation step (F4). Both owner and partner discard the
 * invite-derived key K_invite immediately after deriving K_grant; a transient
 * observer of the invite token (clipboard, share-sheet, OS recents) therefore
 * cannot decrypt partner-share blobs uploaded after accept.
 *
 * Determinism is the contract: same (K_invite, grantID, ownerAccountID,
 * sourceInviteID) MUST produce the same K_grant on both sides. The three
 * context fields are server-emitted and immutable per grant; documented in
 * `docs/sync-trust-model.md` so the managed-cloud team treats them as
 * key-binding (any future re-numbering breaks decryption loudly, not silently).
 *
 * Throws `invalid_partner_invite` if the invite key has the wrong shape, and
 * `invalid_partner_grant_context` if any of the three context fields is
 * empty after trim — never silently fall through to a derivation with a
 * blank field, since that collapses distinct grants to the same K_grant.
 */
export function deriveGrantSubkeyHex(
  inviteKeyHex: string,
  context: {
    grantID: string;
    ownerAccountID: string;
    sourceInviteID: string;
  },
): string {
  if (!PARTNER_SHARE_KEY_HEX_PATTERN.test(inviteKeyHex)) {
    throw new Error("invalid_partner_invite");
  }
  const grantID = context.grantID.trim();
  const ownerAccountID = context.ownerAccountID.trim();
  const sourceInviteID = context.sourceInviteID.trim();
  if (
    grantID.length === 0 ||
    ownerAccountID.length === 0 ||
    sourceInviteID.length === 0
  ) {
    throw new Error("invalid_partner_grant_context");
  }

  return bytesToHex(
    hkdf(
      sha256,
      hexToBytes(inviteKeyHex),
      PARTNER_SHARE_GRANT_SALT,
      utf8ToBytes(`${grantID}|${ownerAccountID}|${sourceInviteID}`),
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

/**
 * Keyed digest of the plaintext payload: HMAC-SHA256 under a subkey derived
 * from the grant key with its own HKDF domain label. Same 64-hex shape as the
 * former plaintext SHA-256 so the server-side field is unchanged and opaque.
 */
function computePartnerSharePayloadDigestHex(
  keyHex: string,
  encodedPayload: Uint8Array,
): string {
  const digestKey = hkdf(
    sha256,
    hexToBytes(keyHex),
    PARTNER_SHARE_DIGEST_SALT,
    PARTNER_SHARE_DIGEST_INFO,
    32,
  );
  return bytesToHex(hmac(sha256, digestKey, encodedPayload));
}

function constantTimeEqualsHex(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function encryptPartnerSharedProjection(
  keyHex: string,
  payload: PartnerSharedProjectionPayload,
): PartnerSharedProjectionEnvelope {
  const encodedPayload = utf8ToBytes(JSON.stringify(payload));
  const checksumSHA256 = computePartnerSharePayloadDigestHex(keyHex, encodedPayload);
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
  // Rollout: an envelope written before the keyed digest carries the plain
  // SHA-256 of the payload. The AEAD tag above already authenticated the
  // plaintext, so accepting the legacy form leaks and weakens nothing; it is
  // dropped once no owner build older than the keyed digest can still be
  // served (docs/sync-trust-model.md, "Payload digest rollout").
  const keyedDigest = computePartnerSharePayloadDigestHex(keyHex, encodedPayload);
  const legacyDigest = bytesToHex(sha256(encodedPayload));
  const keyedMatches = constantTimeEqualsHex(keyedDigest, envelope.checksumSHA256);
  const legacyMatches = constantTimeEqualsHex(legacyDigest, envelope.checksumSHA256);
  if (!keyedMatches && !legacyMatches) {
    throw new Error("invalid_partner_projection");
  }

  const payload = JSON.parse(
    new TextDecoder().decode(encodedPayload),
  ) as PartnerSharedProjectionPayload;
  if (payload.schemaVersion !== PARTNER_SHARE_SCHEMA_VERSION) {
    throw new Error("invalid_partner_projection");
  }
  // F5 defense-in-depth: generation lives inside the AEAD-protected payload
  // so a malicious cloud cannot rewrite it, but an owner-side bug could
  // still emit a non-integer or sub-floor value. Reject at the crypto
  // boundary so the service-layer freshness check never compares against
  // garbage.
  if (
    !Number.isInteger(payload.generation) ||
    payload.generation < INITIAL_GENERATION
  ) {
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
