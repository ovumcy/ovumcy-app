import { buildSettingsViewData } from "./settings-view-service";

describe("settings view service", () => {
  it("exposes all supported interface languages in settings options", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");

    expect(viewData.interface.languageOptions).toEqual([
      { value: "en", label: "English" },
      { value: "ru", label: "Русский" },
      { value: "es", label: "Español" },
      { value: "de", label: "Deutsch" },
      { value: "fr", label: "Français" },
    ]);
  });

  it("builds localized interface copy for German and French", () => {
    expect(buildSettingsViewData(new Date(2026, 2, 22), "de").interface.title).toBe(
      "Oberfläche",
    );
    expect(buildSettingsViewData(new Date(2026, 2, 22), "fr").interface.title).toBe(
      "Interface",
    );
  });
});
