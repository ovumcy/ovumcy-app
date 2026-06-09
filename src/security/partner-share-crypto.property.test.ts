import { bytesToHex } from "@noble/hashes/utils.js";
import fc from "fast-check";

import {
  deriveGrantSubkeyHex,
  derivePartnerShareKeyHex,
} from "./partner-share-crypto";

// Invite tokens are opaque strings well above the 22-char entropy floor; using
// hex-encoded bytes keeps them whitespace-free and non-empty after trim.
const tokenArb = fc.uint8Array({ minLength: 16, maxLength: 48 }).map(bytesToHex);
const idArb = fc.uint8Array({ minLength: 1, maxLength: 20 }).map(bytesToHex);

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
