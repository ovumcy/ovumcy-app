import { getOnboardingCopy } from "./app-copy";
import { getSettingsCopy } from "./settings-copy";
import { APP_LANGUAGE_LABELS, resolveCopyLanguage } from "./runtime";

describe("runtime i18n helpers", () => {
  it("normalizes extended locale tags into supported interface languages", () => {
    expect(resolveCopyLanguage("de-DE")).toBe("de");
    expect(resolveCopyLanguage("fr_CA")).toBe("fr");
    expect(resolveCopyLanguage("es_MX")).toBe("es");
  });

  it("falls back to English for unsupported languages", () => {
    expect(resolveCopyLanguage("it-IT")).toBe("en");
    expect(resolveCopyLanguage(null)).toBe("en");
  });

  it("exposes labels for every supported interface language", () => {
    expect(APP_LANGUAGE_LABELS).toEqual({
      en: "English",
      ru: "Русский",
      es: "Español",
      de: "Deutsch",
      fr: "Français",
    });
  });

  it("returns German and French catalogs through copy getters", () => {
    expect(getOnboardingCopy("de").progress.step1).toBe("Schritt 1 von 2");
    expect(getSettingsCopy("fr").title).toBe("Réglages");
  });
});
