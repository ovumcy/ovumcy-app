import { SYNC_MIN_PASSWORD_LENGTH, isPasswordTooShort } from "./password-policy";

describe("password-policy", () => {
  it("pins the shared server minimum to 12 characters", () => {
    expect(SYNC_MIN_PASSWORD_LENGTH).toBe(12);
  });

  it("flags passwords shorter than the minimum", () => {
    expect(isPasswordTooShort("")).toBe(true);
    expect(isPasswordTooShort("short")).toBe(true);
    // Exactly one below the boundary.
    expect(isPasswordTooShort("12345678901")).toBe(true);
  });

  it("accepts passwords at or above the minimum", () => {
    // Exactly the boundary.
    expect(isPasswordTooShort("123456789012")).toBe(false);
    expect(isPasswordTooShort("correct horse battery staple")).toBe(false);
  });

  it("trims surrounding whitespace before counting, matching the server", () => {
    // 12 real characters wrapped in spaces still passes; padding does not count.
    expect(isPasswordTooShort("  123456789012  ")).toBe(false);
    // 8 characters padded to 12 with spaces is still too short.
    expect(isPasswordTooShort("  abcdefgh  ")).toBe(true);
  });

  it("counts Unicode code points, not UTF-16 units", () => {
    // 12 code points made of astral characters must not be undercounted by a
    // naive .length (each is a surrogate pair, so .length would report 24).
    expect(isPasswordTooShort("😀😀😀😀😀😀😀😀😀😀😀😀")).toBe(false);
    expect(isPasswordTooShort("😀😀😀😀😀😀😀😀😀😀😀")).toBe(true);
  });
});
