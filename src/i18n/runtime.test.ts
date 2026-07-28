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
    expect(resolveCopyLanguage("it-IT")).toBe("it");
  });

  it("falls back to English for unsupported languages", () => {
    expect(resolveCopyLanguage("ja-JP")).toBe("en");
    expect(resolveCopyLanguage(null)).toBe("en");
  });

  it("exposes labels for every supported interface language", () => {
    expect(APP_LANGUAGE_LABELS).toEqual({
      en: "English",
      ru: "Русский",
      es: "Español",
      de: "Deutsch",
      fr: "Français",
      it: "Italiano",
    });
  });

  it("returns German and French catalogs through copy getters", () => {
    expect(getStatsCopy("en").title).toBe("Insights");
    expect(getOnboardingCopy("de").progress.step1).toBe("Schritt 1 von 2");
    expect(getSettingsCopy("fr").title).toBe("Réglages");
    expect(getShellCopy("de").tabs.stats).toBe("Einblicke");
    expect(getStatsCopy("fr").title).toBe("Analyses");
    expect(getStatsCopy("es").title).toBe("Análisis");
    expect(getStatsCopy("it").title).toBe("Analisi");
    expect(getShellCopy("es").tabs.stats).toBe("Análisis");
    expect(getShellCopy("it").tabs.stats).toBe("Statistiche");
    expect(getSettingsCopy("it").title).toBe("Impostazioni");
    expect(getSettingsCopy("ru").reminders.localOnlyHint).toBe(
      "Напоминания устройства остаются только на этом устройстве. Данные о здоровье не отправляются на сервер.",
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
