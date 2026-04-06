import { getOnboardingCopy } from "./app-copy";
import { getPartnerCopy } from "./partner-copy";
import { getShellCopy } from "./shell-copy";
import { getStatsCopy } from "./stats-copy";
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
    expect(getStatsCopy("en").title).toBe("Insights");
    expect(getOnboardingCopy("de").progress.step1).toBe("Schritt 1 von 2");
    expect(getSettingsCopy("fr").title).toBe("Réglages");
    expect(getShellCopy("de").tabs.stats).toBe("Einblicke");
    expect(getStatsCopy("fr").title).toBe("Analyses");
    expect(getStatsCopy("es").title).toBe("Análisis");
    expect(getShellCopy("es").tabs.stats).toBe("Análisis");
    expect(getSettingsCopy("ru").reminders.emailDeliveryStateOn).toBe(
      "Email-напоминания Ovumcy Cloud будут синхронизироваться, когда это доступно.",
    );
    expect(getSettingsCopy("en").account.restoreAccept).toBe("Restore backup copy");
    expect(getPartnerCopy("ru").sharedViewLoadingSubtitle).toBe(
      "Общие данные партнёра расшифровываются прямо на этом устройстве.",
    );
    expect(getPartnerCopy("es").sharedViewSubtitle).toBe(
      "Esta vista de solo lectura solo está disponible mediante el acceso de pareja de Ovumcy Cloud.",
    );
  });
});
