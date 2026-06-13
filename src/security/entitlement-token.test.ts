import { ed25519 } from "@noble/curves/ed25519.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { fromByteArray } from "base64-js";

import {
  EMBEDDED_ENTITLEMENT_PUBLIC_KEYS,
  resolveEmbeddedEntitlementPublicKeys,
  verifyEntitlementToken,
} from "./entitlement-token";

// Golden vector pinned to interoperate with the Go signer (same vector). A
// regression in either repo that changes the signing-input, base64url, or
// claim handling will break this test.
const GOLDEN_KID = "65b60673d6ed884b";
const GOLDEN_PUBLIC_KEY_HEX =
  "79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664";
const GOLDEN_TOKEN =
  "eyJhbGciOiJFZERTQSIsImtpZCI6IjY1YjYwNjczZDZlZDg4NGIiLCJ0eXAiOiJKV1QifQ" +
  ".eyJhdWQiOiJvdnVtY3ktYXBwIiwiZW50aXRsZW1lbnRzIjpbImRvY3Rvcl9wZGYiLCJhZHZhbmNlZF9pbnNpZ2h0cyJdLCJleHAiOjE3NTAwODY0MDAsImlhdCI6MTc1MDAwMDAwMCwiaXNzIjoib3Z1bWN5LW1hbmFnZWQiLCJzdWIiOiJhY2N0LXRlc3QtMDAwMSJ9" +
  ".aLxva7cu0mWgbcl5QJCnFQFvyC4z5j9GEEuSTnSDomqkC1xccZl3tBaw45_RwaTLlRVQS9qjgRaDO8Nq2w2zBw";

// now strictly before the golden exp (1750086400).
const GOLDEN_NOW = 1750000000;
const GOLDEN_KEYS = { [GOLDEN_KID]: GOLDEN_PUBLIC_KEY_HEX };

// base64url, no padding — matches the encoding the managed signer emits.
function base64UrlEncode(bytes: Uint8Array): string {
  return fromByteArray(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

// Mints a token signed with a freshly generated keypair for the negative/edge
// cases that must not depend on the golden private key (which we do not hold).
function mintToken(
  privateKey: Uint8Array,
  options: {
    header?: Record<string, unknown>;
    payload?: Record<string, unknown>;
  } = {},
): string {
  const header = {
    alg: "EdDSA",
    kid: "test-kid",
    typ: "JWT",
    ...options.header,
  };
  const payload = {
    iss: "ovumcy-managed",
    aud: "ovumcy-app",
    sub: "acct-local-0001",
    iat: 1_700_000_000,
    exp: 1_700_086_400,
    entitlements: ["doctor_pdf", "advanced_insights"],
    ...options.payload,
  };
  const encodedHeader = base64UrlEncode(utf8(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(utf8(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = ed25519.sign(utf8(signingInput), privateKey);
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

describe("verifyEntitlementToken — golden vector (Go-signer interop)", () => {
  it("accepts the golden token under the golden pubkey and returns its entitlements + sub", () => {
    const result = verifyEntitlementToken(GOLDEN_TOKEN, {
      publicKeysByKid: GOLDEN_KEYS,
      now: GOLDEN_NOW,
    });

    expect(result).toEqual({
      valid: true,
      entitlements: ["doctor_pdf", "advanced_insights"],
      sub: "acct-test-0001",
    });
  });

  it("accepts the golden token when expectedSub matches and rejects on sub mismatch (cross-account replay)", () => {
    expect(
      verifyEntitlementToken(GOLDEN_TOKEN, {
        publicKeysByKid: GOLDEN_KEYS,
        now: GOLDEN_NOW,
        expectedSub: "acct-test-0001",
      }).valid,
    ).toBe(true);

    const replayed = verifyEntitlementToken(GOLDEN_TOKEN, {
      publicKeysByKid: GOLDEN_KEYS,
      now: GOLDEN_NOW,
      expectedSub: "acct-other-9999",
    });
    expect(replayed).toEqual({ valid: false, reason: "sub_mismatch" });
  });
});

describe("verifyEntitlementToken — tamper / expiry / kid / alg rejection", () => {
  it("rejects when a single payload character is flipped (signature no longer matches)", () => {
    const [header, payload, signature] = GOLDEN_TOKEN.split(".");
    if (!header || !payload || !signature) {
      throw new Error("golden token must have three segments");
    }
    // Flip one character in the payload segment to a different base64url char.
    const flippedChar = payload[10] === "A" ? "B" : "A";
    const tamperedPayload =
      payload.slice(0, 10) + flippedChar + payload.slice(11);
    const tampered = `${header}.${tamperedPayload}.${signature}`;

    const result = verifyEntitlementToken(tampered, {
      publicKeysByKid: GOLDEN_KEYS,
      now: GOLDEN_NOW,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects an unknown / rotated-out kid (locked)", () => {
    const result = verifyEntitlementToken(GOLDEN_TOKEN, {
      // Golden kid not present in this map.
      publicKeysByKid: { "some-other-kid": GOLDEN_PUBLIC_KEY_HEX },
      now: GOLDEN_NOW,
    });
    expect(result).toEqual({ valid: false, reason: "unknown_kid" });
  });

  it("rejects an expired token (now >= exp), including exactly at exp", () => {
    expect(
      verifyEntitlementToken(GOLDEN_TOKEN, {
        publicKeysByKid: GOLDEN_KEYS,
        now: 1_750_086_400, // exactly exp
      }),
    ).toEqual({ valid: false, reason: "expired" });

    expect(
      verifyEntitlementToken(GOLDEN_TOKEN, {
        publicKeysByKid: GOLDEN_KEYS,
        now: 1_750_086_401, // past exp
      }),
    ).toEqual({ valid: false, reason: "expired" });
  });

  it("rejects a header whose alg is not EdDSA, even with a valid signature", () => {
    const privateKey = ed25519.utils.randomSecretKey();
    const publicKey = ed25519.getPublicKey(privateKey);
    // A genuinely-signed token but with alg=none in the header.
    const token = mintToken(privateKey, { header: { alg: "none" } });

    const result = verifyEntitlementToken(token, {
      publicKeysByKid: { "test-kid": bytesToHex(publicKey) },
      now: 1_700_000_000,
    });
    expect(result).toEqual({ valid: false, reason: "unsupported_alg" });
  });

  it("rejects a truncated signature without throwing", () => {
    const truncated = GOLDEN_TOKEN.slice(0, GOLDEN_TOKEN.length - 8);
    let result: ReturnType<typeof verifyEntitlementToken>;
    expect(() => {
      result = verifyEntitlementToken(truncated, {
        publicKeysByKid: GOLDEN_KEYS,
        now: GOLDEN_NOW,
      });
    }).not.toThrow();
    expect(result!.valid).toBe(false);
  });

  it("rejects garbage / structurally-invalid input without throwing", () => {
    const inputs = [
      "",
      "not-a-jwt",
      "only.two",
      "a.b.c.d",
      "%%%.%%%.%%%",
      `${GOLDEN_TOKEN}.extrasegment`,
    ];
    for (const input of inputs) {
      let result: ReturnType<typeof verifyEntitlementToken>;
      expect(() => {
        result = verifyEntitlementToken(input, {
          publicKeysByKid: GOLDEN_KEYS,
          now: GOLDEN_NOW,
        });
      }).not.toThrow();
      expect(result!.valid).toBe(false);
    }
  });

  it("rejects a token signed by the wrong key (signature does not verify under the mapped pubkey)", () => {
    const realKey = ed25519.utils.randomSecretKey();
    const attackerKey = ed25519.utils.randomSecretKey();
    const token = mintToken(attackerKey);

    const result = verifyEntitlementToken(token, {
      // kid maps to the REAL key, but the token was signed by the attacker key.
      publicKeysByKid: { "test-kid": bytesToHex(ed25519.getPublicKey(realKey)) },
      now: 1_700_000_000,
    });
    expect(result).toEqual({ valid: false, reason: "bad_signature" });
  });

  it("rejects a freshly-minted but expired token, and a non-string entitlements claim", () => {
    const privateKey = ed25519.utils.randomSecretKey();
    const publicKeyHex = bytesToHex(ed25519.getPublicKey(privateKey));

    const expired = mintToken(privateKey, { payload: { exp: 1_699_000_000 } });
    expect(
      verifyEntitlementToken(expired, {
        publicKeysByKid: { "test-kid": publicKeyHex },
        now: 1_700_000_000,
      }),
    ).toEqual({ valid: false, reason: "expired" });

    const badEntitlements = mintToken(privateKey, {
      payload: { entitlements: ["ok", 42] },
    });
    expect(
      verifyEntitlementToken(badEntitlements, {
        publicKeysByKid: { "test-kid": publicKeyHex },
        now: 1_700_000_000,
      }),
    ).toEqual({ valid: false, reason: "malformed_entitlements" });
  });

  it("rejects wrong issuer / audience even with a valid signature", () => {
    const privateKey = ed25519.utils.randomSecretKey();
    const publicKeyHex = bytesToHex(ed25519.getPublicKey(privateKey));

    const wrongIssuer = mintToken(privateKey, {
      payload: { iss: "evil-issuer" },
    });
    expect(
      verifyEntitlementToken(wrongIssuer, {
        publicKeysByKid: { "test-kid": publicKeyHex },
        now: 1_700_000_000,
      }),
    ).toEqual({ valid: false, reason: "bad_issuer" });

    const wrongAudience = mintToken(privateKey, {
      payload: { aud: "ovumcy-web" },
    });
    expect(
      verifyEntitlementToken(wrongAudience, {
        publicKeysByKid: { "test-kid": publicKeyHex },
        now: 1_700_000_000,
      }),
    ).toEqual({ valid: false, reason: "bad_audience" });
  });
});

describe("EMBEDDED_ENTITLEMENT_PUBLIC_KEYS / resolveEmbeddedEntitlementPublicKeys", () => {
  it("exposes a frozen placeholder map", () => {
    expect(Object.isFrozen(EMBEDDED_ENTITLEMENT_PUBLIC_KEYS)).toBe(true);
  });

  it("prefers EXPO_PUBLIC_ENTITLEMENT_PUBKEYS when set, else falls back to the embedded constant", () => {
    const previous = process.env.EXPO_PUBLIC_ENTITLEMENT_PUBKEYS;
    try {
      process.env.EXPO_PUBLIC_ENTITLEMENT_PUBKEYS = JSON.stringify({
        prodkid: "aa".repeat(32),
      });
      expect(resolveEmbeddedEntitlementPublicKeys()).toEqual({
        prodkid: "aa".repeat(32),
      });

      // Malformed JSON falls back to the embedded constant.
      process.env.EXPO_PUBLIC_ENTITLEMENT_PUBKEYS = "{not json";
      expect(resolveEmbeddedEntitlementPublicKeys()).toEqual({
        ...EMBEDDED_ENTITLEMENT_PUBLIC_KEYS,
      });

      delete process.env.EXPO_PUBLIC_ENTITLEMENT_PUBKEYS;
      expect(resolveEmbeddedEntitlementPublicKeys()).toEqual({
        ...EMBEDDED_ENTITLEMENT_PUBLIC_KEYS,
      });
    } finally {
      if (previous === undefined) {
        delete process.env.EXPO_PUBLIC_ENTITLEMENT_PUBKEYS;
      } else {
        process.env.EXPO_PUBLIC_ENTITLEMENT_PUBKEYS = previous;
      }
    }
  });
});
