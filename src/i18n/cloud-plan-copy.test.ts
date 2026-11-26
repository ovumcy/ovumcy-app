import type { InterfaceLanguage } from "../models/profile";
import { getCloudPlanCopy } from "./cloud-plan-copy";

const LANGUAGES: InterfaceLanguage[] = ["en", "ru", "es", "de", "fr", "it"];

describe("cloud plan copy", () => {
  it.each(LANGUAGES)("is complete in %s and inserts the store's price verbatim", (language) => {
    const copy = getCloudPlanCopy(language);

    for (const text of [
      copy.title,
      copy.freeTrialNote,
      copy.purchaseCompleted,
      copy.purchaseUnavailable,
    ]) {
      expect(text.trim()).not.toBe("");
    }
    expect(copy.monthlyLabel("RSD 470,00")).toContain("RSD 470,00");
    expect(copy.yearlyLabel("RSD 4.100,00")).toContain("RSD 4.100,00");
    expect(copy.monthlyLabel("X")).not.toBe(copy.yearlyLabel("X"));
    if (language !== "en") {
      expect(copy.title).not.toBe(getCloudPlanCopy("en").title);
    }
  });

  it("falls back to English for a language it has no copy for", () => {
    expect(getCloudPlanCopy("pt" as InterfaceLanguage)).toBe(getCloudPlanCopy("en"));
  });

  it("writes no price into any string", () => {
    for (const language of LANGUAGES) {
      const copy = getCloudPlanCopy(language);
      const all = [
        copy.title,
        copy.freeTrialNote,
        copy.purchaseCompleted,
        copy.purchaseUnavailable,
        copy.monthlyLabel(""),
        copy.yearlyLabel(""),
      ].join(" ");
      expect(all).not.toMatch(/\d|€|\$|EUR|USD/);
    }
  });
});
