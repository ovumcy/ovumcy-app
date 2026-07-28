import { bytesToHex } from "@noble/hashes/utils.js";
import * as fc from "fast-check";

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

// Invite tokens are opaque strings well above the 22-char entropy floor; using
// hex-encoded bytes keeps them whitespace-free and non-empty after trim.
const tokenArb = fc.uint8Array({ minLength: 16, maxLength: 48 }).map(bytesToHex);
const idArb = fc.uint8Array({ minLength: 1, maxLength: 20 }).map(bytesToHex);
const accessLevelArb = fc.constantFrom("summary" as const, "full" as const);
const generationArb = fc.integer({ min: INITIAL_GENERATION, max: 1_000_000 });

describe("partner-share-crypto key derivation (property)", () => {
  it("derivePartnerShareKeyHex is deterministic and 64 lowercase hex chars", () => {
    fc.assert(
      fc.property(tokenArb, (token) => {
        const k = derivePartnerShareKeyHex(token);
        expect(k).toMatch(/^[0-9a-f]{64}$/);
        expect(derivePartnerShareKeyHex(token)).toBe(k);
      }),
    );
  });

  it("deriveGrantSubkeyHex is deterministic for a fixed context", () => {
    fc.assert(
      fc.property(
        tokenArb,
        idArb,
        idArb,
        idArb,
        (token, grantID, ownerAccountID, sourceInviteID) => {
          const k = derivePartnerShareKeyHex(token);
          const a = deriveGrantSubkeyHex(k, {
            grantID,
            ownerAccountID,
            sourceInviteID,
          });
          expect(a).toMatch(/^[0-9a-f]{64}$/);
          expect(
            deriveGrantSubkeyHex(k, { grantID, ownerAccountID, sourceInviteID }),
          ).toBe(a);
        },
      ),
    );
  });

  // The key-binding invariant the managed server must preserve: all three
  // context fields feed K_grant, so changing ANY of them yields a different
  // key. In particular source_invite_id — which the managed AcceptInvite fix
  // keeps immutable per grant — must alter the derived key, i.e. a server-side
  // re-key would silently orphan the partner's already-uploaded ciphertext.
  it("deriveGrantSubkeyHex changes when any single context field changes", () => {
    fc.assert(
      fc.property(
        tokenArb,
        idArb,
        idArb,
        idArb,
        idArb,
        (token, grantID, ownerAccountID, sourceInviteID, alt) => {
          fc.pre(
            alt !== grantID && alt !== ownerAccountID && alt !== sourceInviteID,
          );
          const k = derivePartnerShareKeyHex(token);
          const base = deriveGrantSubkeyHex(k, {
            grantID,
            ownerAccountID,
            sourceInviteID,
          });
          expect(
            deriveGrantSubkeyHex(k, {
              grantID,
              ownerAccountID,
              sourceInviteID: alt,
            }),
          ).not.toBe(base);
          expect(
            deriveGrantSubkeyHex(k, {
              grantID: alt,
              ownerAccountID,
              sourceInviteID,
            }),
          ).not.toBe(base);
          expect(
            deriveGrantSubkeyHex(k, {
              grantID,
              ownerAccountID: alt,
              sourceInviteID,
            }),
          ).not.toBe(base);
        },
      ),
    );
  });
});

function buildPayload(fields: {
  accessLevel: "summary" | "full";
  generation: number;
  grantID: string;
  ownerAccountID: string;
}): PartnerSharedProjectionPayload {
  return {
    schemaVersion: PARTNER_SHARE_SCHEMA_VERSION,
    generatedAt: "2026-05-22T00:00:00.000Z",
    generation: fields.generation,
    accessLevel: fields.accessLevel,
    ownerAccountID: fields.ownerAccountID,
    grantID: fields.grantID,
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
  };
}

describe("partner-share projection encryption (property)", () => {
  it("round-trips any projection under the grant key", () => {
    fc.assert(
      fc.property(
        tokenArb,
        idArb,
        idArb,
        accessLevelArb,
        generationArb,
        (token, grantID, ownerAccountID, accessLevel, generation) => {
          const keyHex = derivePartnerShareKeyHex(token);
          const payload = buildPayload({
            accessLevel,
            generation,
            grantID,
            ownerAccountID,
          });

          const envelope = encryptPartnerSharedProjection(keyHex, payload);

          expect(decryptPartnerSharedProjection(keyHex, envelope)).toEqual(payload);
        },
      ),
    );
  });

  it("does not open under a different grant key", () => {
    fc.assert(
      fc.property(
        tokenArb,
        tokenArb,
        idArb,
        idArb,
        accessLevelArb,
        (token, otherToken, grantID, ownerAccountID, accessLevel) => {
          const keyHex = derivePartnerShareKeyHex(token);
          const otherKeyHex = derivePartnerShareKeyHex(otherToken);
          fc.pre(keyHex !== otherKeyHex);
          const envelope = encryptPartnerSharedProjection(
            keyHex,
            buildPayload({
              accessLevel,
              generation: INITIAL_GENERATION,
              grantID,
              ownerAccountID,
            }),
          );

          expect(() =>
            decryptPartnerSharedProjection(otherKeyHex, envelope),
          ).toThrow();
        },
      ),
    );
  });

  // A managed cloud rewriting the outer header — re-pointing a blob at another
  // grant, or flipping accessLevel to widen what the partner is told it may
  // see — must never yield a readable projection. Two layers hold that: the
  // AAD binds grantID + accessLevel + schemaVersion, and the post-decrypt
  // equality check re-compares them against the inner payload. The property
  // pins the observable contract, so removing either layer alone still passes
  // and removing both fails.
  it("does not open when the envelope header is rewritten", () => {
    fc.assert(
      fc.property(
        tokenArb,
        idArb,
        idArb,
        idArb,
        accessLevelArb,
        (token, grantID, otherGrantID, ownerAccountID, accessLevel) => {
          fc.pre(grantID !== otherGrantID);
          const keyHex = derivePartnerShareKeyHex(token);
          const envelope = encryptPartnerSharedProjection(
            keyHex,
            buildPayload({
              accessLevel,
              generation: INITIAL_GENERATION,
              grantID,
              ownerAccountID,
            }),
          );

          expect(() =>
            decryptPartnerSharedProjection(keyHex, {
              ...envelope,
              grantID: otherGrantID,
            }),
          ).toThrow();
          expect(() =>
            decryptPartnerSharedProjection(keyHex, {
              ...envelope,
              accessLevel: accessLevel === "full" ? "summary" : "full",
            }),
          ).toThrow();
        },
      ),
    );
  });
});
