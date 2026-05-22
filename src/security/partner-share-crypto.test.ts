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

describe("derivePartnerShareKeyHex", () => {
  it("rejects tokens shorter than the entropy floor", () => {
    expect(() => derivePartnerShareKeyHex("")).toThrow("invalid_partner_invite");
    expect(() => derivePartnerShareKeyHex("ab")).toThrow("invalid_partner_invite");
    // 21 chars — one below the 22-char floor.
    expect(() => derivePartnerShareKeyHex("a".repeat(21))).toThrow(
      "invalid_partner_invite",
    );
  });

  it("rejects tokens that only become non-empty after trim and still fall under the floor", () => {
    expect(() => derivePartnerShareKeyHex("   ")).toThrow("invalid_partner_invite");
    expect(() => derivePartnerShareKeyHex(`   ${"a".repeat(21)}   `)).toThrow(
      "invalid_partner_invite",
    );
  });

  it("derives a deterministic 32-byte hex key for tokens at or above the floor", () => {
    const token = "a".repeat(22);
    const first = derivePartnerShareKeyHex(token);
    const second = derivePartnerShareKeyHex(token);

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces distinct keys for distinct tokens", () => {
    const first = derivePartnerShareKeyHex("a".repeat(22));
    const second = derivePartnerShareKeyHex(`${"a".repeat(21)}b`);

    expect(first).not.toBe(second);
  });
});

describe("deriveGrantSubkeyHex", () => {
  const inviteKeyHex = derivePartnerShareKeyHex("a".repeat(22));
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
  const keyHex = derivePartnerShareKeyHex("a".repeat(22));

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
        usageGoal: "health",
      },
      dayLogs: [],
      symptomRecords: [],
      ...overrides,
    };
  }

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
