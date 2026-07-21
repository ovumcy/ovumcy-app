import { selectPrivacyNoticeCopy } from "../i18n/privacy-copy";
import type { InterfaceLanguage } from "../models/profile";
import {
  buildPrivacyNoticeViewData,
  openPrivacyPolicy,
  PRIVACY_NOTICE_REVISION,
  PRIVACY_POLICY_URL,
} from "./privacy-notice-service";

const mockOpenURL = jest.fn();

jest.mock("expo-linking", () => ({
  openURL: (url: string) => mockOpenURL(url),
}));

const LANGUAGES: InterfaceLanguage[] = ["en", "ru", "es", "de", "fr", "it"];

describe("privacy-notice-service", () => {
  beforeEach(() => {
    mockOpenURL.mockReset();
    mockOpenURL.mockResolvedValue(true);
  });

  it("keeps the notice sections in a stable order", () => {
    const viewData = buildPrivacyNoticeViewData("en");

    expect(viewData.sections.map((section) => section.id)).toEqual([
      "on-device",
      "no-tracking",
      "leaves-device",
      "exports",
      "rights",
      "retention",
      "predictions",
      "contact",
    ]);
  });

  it("builds a complete, non-empty notice for every selectable language", () => {
    for (const language of LANGUAGES) {
      const viewData = buildPrivacyNoticeViewData(language);

      expect(viewData.title.trim()).not.toBe("");
      expect(viewData.subtitle.trim()).not.toBe("");
      expect(viewData.backLabel.trim()).not.toBe("");
      expect(viewData.sections).toHaveLength(8);
      for (const section of viewData.sections) {
        expect(section.title.trim()).not.toBe("");
        expect(section.body.trim()).not.toBe("");
      }
      expect(viewData.policyLink.actionLabel.trim()).not.toBe("");
      expect(viewData.policyLink.unavailable.trim()).not.toBe("");
    }
  });

  it("translates the notice instead of falling back to English", () => {
    expect(buildPrivacyNoticeViewData("ru").title).toBe(
      selectPrivacyNoticeCopy("ru").title,
    );
    expect(buildPrivacyNoticeViewData("ru").title).not.toBe(
      selectPrivacyNoticeCopy("en").title,
    );
  });

  it("stamps the notice with its revision", () => {
    expect(buildPrivacyNoticeViewData("en").revisionText).toContain(
      PRIVACY_NOTICE_REVISION,
    );
  });

  it("exposes only the canonical https policy address", () => {
    expect(PRIVACY_POLICY_URL).toBe("https://ovumcy.com/privacy");
    expect(buildPrivacyNoticeViewData("en").policyLink.url).toBe(
      PRIVACY_POLICY_URL,
    );
  });

  it("opens the policy through the platform browser", async () => {
    await expect(openPrivacyPolicy()).resolves.toBe(true);

    expect(mockOpenURL).toHaveBeenCalledTimes(1);
    expect(mockOpenURL).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
  });

  it("reports failure instead of throwing when the platform refuses", async () => {
    mockOpenURL.mockRejectedValue(new Error("no browser"));

    await expect(openPrivacyPolicy()).resolves.toBe(false);
  });
  it("falls back to English for a stored language the app no longer knows", () => {
    // languageOverride is read back from a persisted profile, so it can hold a
    // value written by a different app version. The notice must still render
    // rather than come back undefined.
    const viewData = buildPrivacyNoticeViewData(
      "kl" as unknown as InterfaceLanguage,
    );

    expect(viewData.title).toBe(selectPrivacyNoticeCopy("en").title);
    expect(viewData.sections).toHaveLength(8);
  });
});

