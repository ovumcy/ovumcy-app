import { isPasswordTooLong, SYNC_MAX_PASSWORD_BYTES, utf8ByteLength } from "./password-policy";
import { isSyncDeviceLabelLengthValid, isSyncLoginLengthValid } from "./sync-input-limits";

describe("sync input limits", () => {
  it("counts UTF-8 bytes, not characters", () => {
    expect(utf8ByteLength("ab")).toBe(2);
    expect(utf8ByteLength("жж")).toBe(4);
    expect(utf8ByteLength("🙂")).toBe(4);
  });

  it("accepts a login of 3 to 254 bytes after trimming", () => {
    expect(isSyncLoginLengthValid("ab")).toBe(false);
    expect(isSyncLoginLengthValid("  ab  ")).toBe(false);
    expect(isSyncLoginLengthValid("abc")).toBe(true);
    expect(isSyncLoginLengthValid("a".repeat(254))).toBe(true);
    expect(isSyncLoginLengthValid("a".repeat(255))).toBe(false);
    expect(isSyncLoginLengthValid("ж".repeat(128))).toBe(false);
  });

  it("accepts a device label of 2 to 64 bytes after trimming", () => {
    expect(isSyncDeviceLabelLengthValid("a")).toBe(false);
    expect(isSyncDeviceLabelLengthValid(" a ")).toBe(false);
    expect(isSyncDeviceLabelLengthValid("ж")).toBe(true);
    expect(isSyncDeviceLabelLengthValid("a".repeat(64))).toBe(true);
    expect(isSyncDeviceLabelLengthValid("a".repeat(65))).toBe(false);
    expect(isSyncDeviceLabelLengthValid("ж".repeat(33))).toBe(false);
  });

  it("refuses a password over 72 bytes, untrimmed", () => {
    expect(isPasswordTooLong("a".repeat(SYNC_MAX_PASSWORD_BYTES))).toBe(false);
    expect(isPasswordTooLong("a".repeat(SYNC_MAX_PASSWORD_BYTES + 1))).toBe(true);
    expect(isPasswordTooLong(`${"a".repeat(SYNC_MAX_PASSWORD_BYTES)} `)).toBe(true);
    expect(isPasswordTooLong("ж".repeat(37))).toBe(true);
  });
});
