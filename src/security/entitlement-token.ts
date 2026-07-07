import { ed25519 } from "@noble/curves/ed25519.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import { toByteArray } from "base64-js";

/**
 * Signed entitlement token verifier (consumer side).
 *
 * Implements the app half of the signed-entitlement contract with the managed
 * cloud service, which issues a compact JWT signed with EdDSA (Ed25519); this
 * module verifies the signature
 * against an embedded public-key map (keyed by `kid`) and validates the
 * minimal claim set, returning the unlocked `entitlements` on success.
 *
 * Honest non-DRM scope: verification raises the bar to "patch out the verifier
 * or reimplement the managed signer". A forked client can still bypass it. This
 * is not, and does not claim to be, DRM-grade protection — see the memo and the
 * Accepted-Residual note in SECURITY.md.
 *
 * Security properties enforced here (fail-closed in every branch):
 * - The Ed25519 signature is verified over the EXACT received ASCII
 *   signing-input (`<b64url-header>.<b64url-payload>`), not a re-serialization
 *   of the decoded JSON, so a tamper of any byte in the header/payload fails.
 * - Only `alg == "EdDSA"` is accepted; any other algorithm (incl. `none`) is
 *   rejected before any signature work.
 * - `kid` MUST be present in the supplied public-key map; an unknown/rotated
 *   `kid` is rejected (locked), never trusted.
 * - `iss`/`aud` must match the managed contract and `exp` (unix seconds) must be
 *   strictly in the future relative to the injected `now`.
 * - All parsing/decoding is wrapped: malformed, truncated, or garbage input
 *   returns `{ valid: false }` and never throws.
 */

export const ENTITLEMENT_TOKEN_ISSUER = "ovumcy-managed";
export const ENTITLEMENT_TOKEN_AUDIENCE = "ovumcy-app";

/**
 * EMBEDDED_ENTITLEMENT_PUBLIC_KEYS is a DOCUMENTED PLACEHOLDER.
 *
 * The operator MUST replace this with the real production Ed25519 public
 * key(s), keyed by `kid` (hex-encoded 32-byte raw public keys). Per the memo,
 * keep TWO active keys during a rotation (current + next): ship the app with
 * key N and N+1, let managed start signing with N+1, then retire N in a later
 * release — never a flag day.
 *
 * The value below is the GOLDEN-VECTOR TEST key. It is intentionally NOT a
 * production key; leaving it here only means a real production token (signed by
 * the as-yet-unprovisioned managed signer) will not verify until this map is
 * populated, which is the correct fail-closed default for rollout phase 1 (the
 * premium gate falls back to the billing-snapshot boolean when no token
 * verifies). Tests inject their own key via `opts.publicKeysByKid` and must NOT
 * depend on this constant.
 *
 * Optionally, an operator may supply the map at build time via the
 * `EXPO_PUBLIC_ENTITLEMENT_PUBKEYS` env var (JSON object of kid -> hex);
 * `resolveEmbeddedEntitlementPublicKeys()` reads it and falls back to this
 * constant when unset or malformed. A release guard pinned to that resolution
 * (`scripts/verify-entitlement-pubkeys.mjs`) fails production EAS builds and
 * web deploys that would leave this placeholder active.
 */
export const EMBEDDED_ENTITLEMENT_PUBLIC_KEYS: Readonly<Record<string, string>> =
  Object.freeze({
    // PLACEHOLDER (golden-vector test key) — replace with the production kid -> hex.
    "65b60673d6ed884b":
      "79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664",
  });

export type VerifyEntitlementTokenOptions = {
  /**
   * Map of `kid` -> Ed25519 public key (hex-encoded 32 raw bytes). The verifier
   * looks up the token header's `kid` here; a `kid` absent from this map is
   * rejected. Dependency-injected so tests pass the golden pubkey and the app
   * passes its embedded/production map.
   */
  publicKeysByKid: Record<string, string>;
  /** Current time in unix seconds. Injected so verification is deterministic. */
  now: number;
  /**
   * When set, the token's `sub` must equal this value. Used by the app to bind
   * a token to the active managed session and reject a token minted for another
   * account (replay across accounts). Omitted in pure verification tests.
   */
  expectedSub?: string;
};

export type VerifyEntitlementTokenResult =
  | { valid: true; entitlements: string[]; sub: string }
  | { valid: false; reason: string };

type EntitlementTokenHeader = {
  alg: string;
  kid?: unknown;
  typ?: unknown;
};

type EntitlementTokenPayload = {
  iss?: unknown;
  aud?: unknown;
  sub?: unknown;
  exp?: unknown;
  entitlements?: unknown;
};

/**
 * Resolves the embedded public-key map, preferring the build-time
 * `EXPO_PUBLIC_ENTITLEMENT_PUBKEYS` env var (JSON kid -> hex) when present and
 * well-formed, else the placeholder constant. Always returns a usable map so
 * callers never have to special-case the env path.
 */
export function resolveEmbeddedEntitlementPublicKeys(): Record<string, string> {
  const raw = process.env.EXPO_PUBLIC_ENTITLEMENT_PUBKEYS;
  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isStringRecord(parsed)) {
        return parsed;
      }
    } catch {
      // Fall through to the embedded constant on malformed JSON.
    }
  }
  return { ...EMBEDDED_ENTITLEMENT_PUBLIC_KEYS };
}

/**
 * Verifies a signed entitlement token. Pure and dependency-injected: callers
 * supply the public-key map and current time. Returns the entitlement set and
 * `sub` on success; otherwise a `{ valid: false, reason }` with a short,
 * non-sensitive reason code. Never throws on malformed input.
 */
export function verifyEntitlementToken(
  token: string,
  opts: VerifyEntitlementTokenOptions,
): VerifyEntitlementTokenResult {
  if (typeof token !== "string" || token.length === 0) {
    return { valid: false, reason: "empty_token" };
  }

  // A compact JWS has exactly three dot-separated segments. Splitting and
  // checking the count also rejects extra '.' separators.
  const segments = token.split(".");
  if (segments.length !== 3) {
    return { valid: false, reason: "malformed_token" };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return { valid: false, reason: "malformed_token" };
  }

  const header = decodeJsonSegment<EntitlementTokenHeader>(encodedHeader);
  if (!header || typeof header.alg !== "string") {
    return { valid: false, reason: "malformed_header" };
  }

  // Accept ONLY EdDSA. Reject "none" and every other alg before touching the
  // signature, so an attacker cannot downgrade the algorithm.
  if (header.alg !== "EdDSA") {
    return { valid: false, reason: "unsupported_alg" };
  }

  if (typeof header.kid !== "string" || header.kid.length === 0) {
    return { valid: false, reason: "missing_kid" };
  }

  const publicKeyHex = opts.publicKeysByKid[header.kid];
  if (typeof publicKeyHex !== "string" || publicKeyHex.length === 0) {
    // Unknown / rotated-out kid: locked, never trusted.
    return { valid: false, reason: "unknown_kid" };
  }

  let publicKey: Uint8Array;
  let signature: Uint8Array;
  try {
    publicKey = hexToBytes(publicKeyHex);
    signature = base64UrlDecode(encodedSignature);
  } catch {
    return { valid: false, reason: "malformed_signature" };
  }

  // Verify over the EXACT received signing-input bytes (the literal
  // "<header>.<payload>" substring), NOT a re-encode of the decoded JSON. This
  // is what makes a single-character payload tamper fail.
  const signingInput = utf8Bytes(`${encodedHeader}.${encodedPayload}`);

  let signatureOk = false;
  try {
    signatureOk = ed25519.verify(signature, signingInput, publicKey);
  } catch {
    // A malformed signature/key length throws inside noble; treat as invalid.
    return { valid: false, reason: "bad_signature" };
  }
  if (!signatureOk) {
    return { valid: false, reason: "bad_signature" };
  }

  // Signature is authentic. Now validate the claim set on the decoded payload.
  const payload = decodeJsonSegment<EntitlementTokenPayload>(encodedPayload);
  if (!payload) {
    return { valid: false, reason: "malformed_payload" };
  }

  if (payload.iss !== ENTITLEMENT_TOKEN_ISSUER) {
    return { valid: false, reason: "bad_issuer" };
  }
  if (payload.aud !== ENTITLEMENT_TOKEN_AUDIENCE) {
    return { valid: false, reason: "bad_audience" };
  }

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    return { valid: false, reason: "missing_sub" };
  }
  if (opts.expectedSub !== undefined && payload.sub !== opts.expectedSub) {
    // Token minted for another account replayed here: reject.
    return { valid: false, reason: "sub_mismatch" };
  }

  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    return { valid: false, reason: "missing_exp" };
  }
  if (!(payload.exp > opts.now)) {
    return { valid: false, reason: "expired" };
  }

  if (!isStringArray(payload.entitlements)) {
    return { valid: false, reason: "malformed_entitlements" };
  }

  return {
    valid: true,
    entitlements: [...payload.entitlements],
    sub: payload.sub,
  };
}

function decodeJsonSegment<T>(segment: string): T | null {
  try {
    const bytes = base64UrlDecode(segment);
    const text = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/**
 * base64url decode (RFC 7515, no padding). Rejects any character outside the
 * base64url alphabet by throwing, so a garbage signature segment is caught by
 * the caller's try/catch and reported as invalid rather than silently decoding
 * to wrong bytes. Decodes via `base64-js` (`toByteArray`), the same primitive
 * the sync/partner crypto already uses, which requires standard base64 with
 * padding — so we translate the alphabet and re-pad before decoding.
 */
function base64UrlDecode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) {
    throw new Error("invalid base64url");
  }
  // A base64 quantum is 4 chars; a remainder of 1 is never valid output.
  if (value.length % 4 === 1) {
    throw new Error("invalid base64url length");
  }
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingNeeded = (4 - (base64.length % 4)) % 4;
  return toByteArray(base64 + "=".repeat(paddingNeeded));
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}
