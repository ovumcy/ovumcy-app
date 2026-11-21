import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

import {
  INITIAL_GENERATION,
  PARTNER_SHARE_SCHEMA_VERSION,
  type PartnerSharedProjectionPayload,
} from "../models/partner-share";

import {
  decryptPartnerSharedProjection,
  deriveGrantSubkeyHex,
  derivePartnerShareKeyHex,
  encryptPartnerSharedProjection,
} from "./partner-share-crypto";

const INVITE_SECRET_HEX = "11".repeat(32);

describe("derivePartnerShareKeyHex", () => {
  it("rejects tokens shorter than the entropy floor", () => {
    for (const token of ["", "ab", "a".repeat(21)]) {
      expect(() => derivePartnerShareKeyHex(token, INVITE_SECRET_HEX)).toThrow(
        "invalid_partner_invite",
      );
    }
  });

  it("rejects tokens that only become non-empty after trim and still fall under the floor", () => {
    for (const token of ["   ", `   ${"a".repeat(21)}   `]) {
      expect(() => derivePartnerShareKeyHex(token, INVITE_SECRET_HEX)).toThrow(
        "invalid_partner_invite",
      );
    }
  });

  it("refuses to derive without a well-formed invite secret", () => {
    const token = "a".repeat(22);
    for (const secret of [
      "",
      "11".repeat(31),
      "11".repeat(33),
      "AB".repeat(32),
      `${"11".repeat(31)}zz`,
      ` ${"11".repeat(32)}`,
    ]) {
      expect(() => derivePartnerShareKeyHex(token, secret)).toThrow(
        "invalid_partner_invite",
      );
    }
  });

  it("matches the documented key schedule (HKDF-SHA256 over the invite secret, token-bound info)", () => {
    expect(derivePartnerShareKeyHex("a".repeat(22), INVITE_SECRET_HEX)).toBe(
      "cf22bc2ded2168f72f2525a250a4f7a18dad71d837f4a4684c70e4042267ab19",
    );
  });

  it("derives a deterministic 32-byte hex key", () => {
    const token = "a".repeat(22);
    const first = derivePartnerShareKeyHex(token, INVITE_SECRET_HEX);
    const second = derivePartnerShareKeyHex(token, INVITE_SECRET_HEX);

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces distinct keys for distinct tokens under the same secret", () => {
    const first = derivePartnerShareKeyHex("a".repeat(22), INVITE_SECRET_HEX);
    const second = derivePartnerShareKeyHex(
      `${"a".repeat(21)}b`,
      INVITE_SECRET_HEX,
    );

    expect(first).not.toBe(second);
  });

  it("the token alone does not determine the key: a different secret yields a different key", () => {
    const token = "a".repeat(22);
    expect(derivePartnerShareKeyHex(token, INVITE_SECRET_HEX)).not.toBe(
      derivePartnerShareKeyHex(token, "22".repeat(32)),
    );
  });
});

describe("deriveGrantSubkeyHex", () => {
  const inviteKeyHex = derivePartnerShareKeyHex("a".repeat(22), INVITE_SECRET_HEX);
  const baseContext = {
    grantID: "grant-1",
    ownerAccountID: "owner-1",
    sourceInviteID: "invite-1",
  };

  it("derives a deterministic 32-byte hex key for valid inputs", () => {
    const first = deriveGrantSubkeyHex(inviteKeyHex, baseContext);
    const second = deriveGrantSubkeyHex(inviteKeyHex, baseContext);

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rotates away from K_invite — K_grant must differ", () => {
    // The whole point of the rotation step is that an observer of the invite
    // token cannot decrypt anything uploaded after accept. Equal output would
    // mean the rotation is a no-op.
    expect(deriveGrantSubkeyHex(inviteKeyHex, baseContext)).not.toBe(
      inviteKeyHex,
    );
  });

  it("produces distinct keys when grantID, ownerAccountID, or sourceInviteID change", () => {
    const base = deriveGrantSubkeyHex(inviteKeyHex, baseContext);
    const otherGrant = deriveGrantSubkeyHex(inviteKeyHex, {
      ...baseContext,
      grantID: "grant-2",
    });
    const otherOwner = deriveGrantSubkeyHex(inviteKeyHex, {
      ...baseContext,
      ownerAccountID: "owner-2",
    });
    const otherInvite = deriveGrantSubkeyHex(inviteKeyHex, {
      ...baseContext,
      sourceInviteID: "invite-2",
    });

    expect(new Set([base, otherGrant, otherOwner, otherInvite]).size).toBe(4);
  });

  it("rejects an invite key that does not match the 32-byte hex shape", () => {
    expect(() => deriveGrantSubkeyHex("", baseContext)).toThrow(
      "invalid_partner_invite",
    );
    expect(() => deriveGrantSubkeyHex("zz".repeat(32), baseContext)).toThrow(
      "invalid_partner_invite",
    );
    expect(() => deriveGrantSubkeyHex("abc", baseContext)).toThrow(
      "invalid_partner_invite",
    );
  });

  it("rejects empty context fields rather than collapsing distinct grants to the same key", () => {
    expect(() =>
      deriveGrantSubkeyHex(inviteKeyHex, { ...baseContext, grantID: "" }),
    ).toThrow("invalid_partner_grant_context");
    expect(() =>
      deriveGrantSubkeyHex(inviteKeyHex, { ...baseContext, grantID: "   " }),
    ).toThrow("invalid_partner_grant_context");
    expect(() =>
      deriveGrantSubkeyHex(inviteKeyHex, {
        ...baseContext,
        ownerAccountID: "",
      }),
    ).toThrow("invalid_partner_grant_context");
    expect(() =>
      deriveGrantSubkeyHex(inviteKeyHex, {
        ...baseContext,
        sourceInviteID: "",
      }),
    ).toThrow("invalid_partner_grant_context");
  });
});

describe("encryptPartnerSharedProjection / decryptPartnerSharedProjection", () => {
  const keyHex = derivePartnerShareKeyHex("a".repeat(22), INVITE_SECRET_HEX);

  function buildPayload(
    overrides: Partial<PartnerSharedProjectionPayload> = {},
  ): PartnerSharedProjectionPayload {
    return {
      schemaVersion: PARTNER_SHARE_SCHEMA_VERSION,
      generatedAt: "2026-05-22T00:00:00.000Z",
      generation: INITIAL_GENERATION,
      accessLevel: "summary",
      ownerAccountID: "owner-1",
      grantID: "grant-1",
      profile: {
        ageGroup: "",
        cycleLength: 28,
        hideNotes: false,
        hideSexChip: false,
        irregularCycle: false,
        lastPeriodStart: "2026-04-01",
        periodLength: 5,
        temperatureUnit: "c",
        trackBBT: false,
        trackCervicalMucus: false,
        unpredictableCycle: false,
      },
      dayLogs: [],
      symptomRecords: [],
      ...overrides,
    };
  }

  it("emits checksumSHA256 as exactly 64 lowercase hex characters, the form the projection PUT requires", () => {
    for (const generation of [1, 2, 3, 42, 1000]) {
      const envelope = encryptPartnerSharedProjection(keyHex, buildPayload({ generation }));
      expect(envelope.checksumSHA256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("does not emit a plain SHA-256 of the payload as the digest the server stores", () => {
    const payload = buildPayload();
    const envelope = encryptPartnerSharedProjection(keyHex, payload);
    const plainDigest = bytesToHex(sha256(utf8ToBytes(JSON.stringify(payload))));

    expect(envelope.checksumSHA256).not.toBe(plainDigest);
  });

  it("emits a digest that depends on the grant key", () => {
    const payload = buildPayload();
    const otherKeyHex = derivePartnerShareKeyHex("b".repeat(22), INVITE_SECRET_HEX);

    expect(encryptPartnerSharedProjection(keyHex, payload).checksumSHA256).toBe(
      encryptPartnerSharedProjection(keyHex, payload).checksumSHA256,
    );
    expect(encryptPartnerSharedProjection(keyHex, payload).checksumSHA256).not.toBe(
      encryptPartnerSharedProjection(otherKeyHex, payload).checksumSHA256,
    );
  });

  it("keys the digest with a subkey separate from the AEAD key", () => {
    const payload = buildPayload();
    const encodedPayload = utf8ToBytes(JSON.stringify(payload));
    const envelope = encryptPartnerSharedProjection(keyHex, payload);
    const aeadKeyedDigest = bytesToHex(hmac(sha256, hexToBytes(keyHex), encodedPayload));

    expect(envelope.checksumSHA256).not.toBe(aeadKeyedDigest);
  });

  it("accepts an envelope carrying the legacy plaintext SHA-256 digest (rollout)", () => {
    const payload = buildPayload();
    const envelope = encryptPartnerSharedProjection(keyHex, payload);
    const legacyDigest = bytesToHex(sha256(utf8ToBytes(JSON.stringify(payload))));

    const decrypted = decryptPartnerSharedProjection(keyHex, {
      ...envelope,
      checksumSHA256: legacyDigest,
    });

    expect(decrypted.grantID).toBe(payload.grantID);
  });

  it("rejects an envelope whose digest is neither the keyed nor the legacy digest", () => {
    const envelope = encryptPartnerSharedProjection(keyHex, buildPayload());

    for (const checksumSHA256 of ["0".repeat(64), "", envelope.checksumSHA256.slice(1)]) {
      expect(() =>
        decryptPartnerSharedProjection(keyHex, { ...envelope, checksumSHA256 }),
      ).toThrow("invalid_partner_projection");
    }
  });

  it("rejects a digest computed over another payload", () => {
    const envelope = encryptPartnerSharedProjection(keyHex, buildPayload());
    const other = encryptPartnerSharedProjection(keyHex, buildPayload({ generation: 9 }));

    expect(() =>
      decryptPartnerSharedProjection(keyHex, {
        ...envelope,
        checksumSHA256: other.checksumSHA256,
      }),
    ).toThrow("invalid_partner_projection");
  });

  it("keeps the AEAD bound to the grant context when the digest is valid", () => {
    const envelope = encryptPartnerSharedProjection(keyHex, buildPayload());

    expect(() =>
      decryptPartnerSharedProjection(keyHex, { ...envelope, accessLevel: "full" }),
    ).toThrow();
    expect(() =>
      decryptPartnerSharedProjection(keyHex, { ...envelope, grantID: "grant-2" }),
    ).toThrow();
  });

  it("preserves the generation counter across an encrypt/decrypt round-trip", () => {
    const payload = buildPayload({ generation: 7 });
    const envelope = encryptPartnerSharedProjection(keyHex, payload);
    const decrypted = decryptPartnerSharedProjection(keyHex, envelope);

    expect(decrypted.generation).toBe(7);
  });

  it("rejects a payload whose generation is below the floor (F5 defense-in-depth)", () => {
    for (const badGeneration of [0, -1, INITIAL_GENERATION - 1]) {
      const envelope = encryptPartnerSharedProjection(
        keyHex,
        buildPayload({ generation: badGeneration }),
      );
      expect(() => decryptPartnerSharedProjection(keyHex, envelope)).toThrow(
        "invalid_partner_projection",
      );
    }
  });

  it("rejects a payload whose generation is not an integer", () => {
    for (const badGeneration of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const envelope = encryptPartnerSharedProjection(
        keyHex,
        buildPayload({ generation: badGeneration }),
      );
      expect(() => decryptPartnerSharedProjection(keyHex, envelope)).toThrow(
        "invalid_partner_projection",
      );
    }
  });

  it("rejects a payload that is missing the generation field entirely", () => {
    const payload = buildPayload();
    const { generation: _generation, ...withoutGeneration } = payload;
    const envelope = encryptPartnerSharedProjection(
      keyHex,
      withoutGeneration as PartnerSharedProjectionPayload,
    );

    expect(() => decryptPartnerSharedProjection(keyHex, envelope)).toThrow(
      "invalid_partner_projection",
    );
  });
});
