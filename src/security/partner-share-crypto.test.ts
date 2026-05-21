import { derivePartnerShareKeyHex } from "./partner-share-crypto";

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
