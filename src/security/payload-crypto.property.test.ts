import { bytesToHex } from "@noble/hashes/utils.js";
import * as fc from "fast-check";

import { decryptPayload, encryptPayload } from "./payload-crypto";

// XChaCha20-Poly1305 requires a 32-byte key; the helpers take it as hex.
const keyHexArb = fc.uint8Array({ minLength: 32, maxLength: 32 }).map(bytesToHex);
const bytesArb = fc.uint8Array({ maxLength: 256 });

describe("payload-crypto (property)", () => {
  it("round-trips any payload under the same key and aad", () => {
    fc.assert(
      fc.property(keyHexArb, bytesArb, bytesArb, (keyHex, payload, aad) => {
        const got = decryptPayload(keyHex, encryptPayload(keyHex, payload, aad), aad);
        expect(bytesToHex(got)).toBe(bytesToHex(payload));
      }),
    );
  });

  it("does not open under a different aad (AAD binding)", () => {
    fc.assert(
      fc.property(
        keyHexArb,
        bytesArb,
        bytesArb,
        bytesArb,
        (keyHex, payload, aad, otherAad) => {
          fc.pre(bytesToHex(aad) !== bytesToHex(otherAad));
          const envelope = encryptPayload(keyHex, payload, aad);
          expect(() => decryptPayload(keyHex, envelope, otherAad)).toThrow();
        },
      ),
    );
  });

  it("does not open under a different key", () => {
    fc.assert(
      fc.property(
        keyHexArb,
        keyHexArb,
        bytesArb,
        bytesArb,
        (keyHex, otherKeyHex, payload, aad) => {
          fc.pre(keyHex !== otherKeyHex);
          const envelope = encryptPayload(keyHex, payload, aad);
          expect(() => decryptPayload(otherKeyHex, envelope, aad)).toThrow();
        },
      ),
    );
  });
});
