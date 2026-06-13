import { ed25519 } from "@noble/curves/ed25519.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { fromByteArray } from "base64-js";
import * as fc from "fast-check";

import { verifyEntitlementToken } from "./entitlement-token";

function base64UrlEncode(bytes: Uint8Array): string {
  return fromByteArray(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

// Entitlement keys are short snake_case identifiers; hex keeps them
// JSON-safe and non-empty without needing to escape anything.
const entitlementArb = fc
  .uint8Array({ minLength: 1, maxLength: 8 })
  .map((bytes) => `feat_${bytesToHex(bytes)}`);
const subArb = fc.uint8Array({ minLength: 1, maxLength: 16 }).map(bytesToHex);
// 32-byte seeds drive a deterministic Ed25519 keypair per run.
const seedArb = fc.uint8Array({ minLength: 32, maxLength: 32 });

type SignedToken = {
  token: string;
  publicKeyHex: string;
  kid: string;
  sub: string;
  entitlements: string[];
  exp: number;
};

function signToken(input: {
  seed: Uint8Array;
  kid: string;
  sub: string;
  entitlements: string[];
  exp: number;
}): SignedToken {
  const publicKey = ed25519.getPublicKey(input.seed);
  const header = { alg: "EdDSA", kid: input.kid, typ: "JWT" };
  const payload = {
    iss: "ovumcy-managed",
    aud: "ovumcy-app",
    sub: input.sub,
    iat: input.exp - 86_400,
    exp: input.exp,
    entitlements: input.entitlements,
  };
  const encodedHeader = base64UrlEncode(utf8(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(utf8(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = ed25519.sign(utf8(signingInput), input.seed);
  return {
    token: `${signingInput}.${base64UrlEncode(signature)}`,
    publicKeyHex: bytesToHex(publicKey),
    kid: input.kid,
    sub: input.sub,
    entitlements: input.entitlements,
    exp: input.exp,
  };
}

describe("verifyEntitlementToken (property)", () => {
  it("verifies any token signed by a freshly generated keypair", () => {
    fc.assert(
      fc.property(
        seedArb,
        subArb,
        fc.array(entitlementArb, { minLength: 0, maxLength: 6 }),
        (seed, sub, entitlements) => {
          const exp = 2_000_000_000;
          const signed = signToken({
            seed,
            kid: "rot-1",
            sub,
            entitlements,
            exp,
          });

          const result = verifyEntitlementToken(signed.token, {
            publicKeysByKid: { [signed.kid]: signed.publicKeyHex },
            now: exp - 1,
            expectedSub: sub,
          });

          expect(result).toEqual({ valid: true, entitlements, sub });
        },
      ),
    );
  });

  it("rejects any single-byte tamper of the signing-input (header.payload bytes)", () => {
    fc.assert(
      fc.property(
        seedArb,
        subArb,
        fc.array(entitlementArb, { minLength: 0, maxLength: 6 }),
        fc.nat(),
        (seed, sub, entitlements, tamperSeed) => {
          const exp = 2_000_000_000;
          const signed = signToken({
            seed,
            kid: "rot-1",
            sub,
            entitlements,
            exp,
          });

          const [header, payload, signature] = signed.token.split(".");
          const signingInput = `${header}.${payload}`;
          // Pick a deterministic position within the signing-input and mutate
          // it to a different base64url character — any such flip must break
          // verification.
          const position = tamperSeed % signingInput.length;
          const original = signingInput[position];
          // '.' is the only non-alphabet char; skip mutating the separator so
          // the token stays structurally a 3-segment JWS (we are testing the
          // signature, not the splitter).
          if (original === ".") {
            return;
          }
          const replacement = original === "A" ? "B" : "A";
          const mutated =
            signingInput.slice(0, position) +
            replacement +
            signingInput.slice(position + 1);
          const tamperedToken = `${mutated}.${signature}`;

          const result = verifyEntitlementToken(tamperedToken, {
            publicKeysByKid: { [signed.kid]: signed.publicKeyHex },
            now: exp - 1,
          });
          expect(result.valid).toBe(false);
        },
      ),
    );
  });

  it("rejects any single-byte tamper of the signature segment", () => {
    fc.assert(
      fc.property(
        seedArb,
        subArb,
        fc.array(entitlementArb, { minLength: 0, maxLength: 6 }),
        fc.nat(),
        (seed, sub, entitlements, tamperSeed) => {
          const exp = 2_000_000_000;
          const signed = signToken({
            seed,
            kid: "rot-1",
            sub,
            entitlements,
            exp,
          });

          const [header, payload, signature] = signed.token.split(".");
          if (!header || !payload || !signature) {
            throw new Error("signed token must have three segments");
          }
          // Tamper at the BYTE level: decode the signature, flip one byte, and
          // re-encode. A single base64url *character* change can be a no-op —
          // the last char of a 64-byte Ed25519 signature carries 4 ignored
          // bits, so flipping it re-decodes to the identical signature bytes
          // (a legitimately valid signature in non-canonical encoding, which
          // the verifier rightly still accepts). Mutating a decoded byte is a
          // real forgery attempt and must always be rejected.
          const sigBytes = Buffer.from(signature, "base64url");
          const position = tamperSeed % sigBytes.length;
          sigBytes[position] = (sigBytes[position] ?? 0) ^ 0xff;
          const mutatedSignature = Buffer.from(sigBytes).toString("base64url");
          const tamperedToken = `${header}.${payload}.${mutatedSignature}`;

          const result = verifyEntitlementToken(tamperedToken, {
            publicKeysByKid: { [signed.kid]: signed.publicKeyHex },
            now: exp - 1,
          });
          expect(result.valid).toBe(false);
        },
      ),
    );
  });
});
