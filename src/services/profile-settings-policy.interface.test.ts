import { normalizeThemePreference } from "../models/profile";
import { sanitizeInterfaceSettingsValues } from "./profile-settings-policy";

// The theme preference is a device-local tri-state ("light" | "dark" |
// "system"). A legacy row predating "system", or a tampered/synced profile
// carrying an unrecognized value, must degrade to null so the provider's
// `?? DEFAULT_RESOLVED_THEME` lands on today's default (light) — never crash,
// never silently pin an unknown theme. `null` keeps meaning the default; it is
// not repurposed to mean "system".
describe("theme preference sanitization", () => {
  it("accepts every supported theme value verbatim", () => {
    expect(normalizeThemePreference("light")).toBe("light");
    expect(normalizeThemePreference("dark")).toBe("dark");
    expect(normalizeThemePreference("system")).toBe("system");
  });

  it("degrades unknown, empty, and nullish values to null (the light default)", () => {
    expect(normalizeThemePreference("auto")).toBeNull();
    expect(normalizeThemePreference("System")).toBeNull();
    expect(normalizeThemePreference("")).toBeNull();
    expect(normalizeThemePreference(null)).toBeNull();
    expect(normalizeThemePreference(undefined)).toBeNull();
  });

  it("round-trips the system preference through interface-settings sanitize", () => {
    expect(
      sanitizeInterfaceSettingsValues({
        languageOverride: "en",
        themeOverride: "system",
        screenCaptureProtectionEnabled: true,
      }),
    ).toEqual({
      languageOverride: "en",
      themeOverride: "system",
      screenCaptureProtectionEnabled: true,
    });
  });

  it("drops an unknown theme override to null when sanitizing interface settings", () => {
    expect(
      sanitizeInterfaceSettingsValues({
        languageOverride: null,
        // Simulate a legacy/synced profile carrying a value this build does
        // not recognize; it must not survive sanitize as-is.
        themeOverride: "midnight" as never,
        screenCaptureProtectionEnabled: false,
      }),
    ).toEqual({
      languageOverride: null,
      themeOverride: null,
      screenCaptureProtectionEnabled: false,
    });
  });
});
