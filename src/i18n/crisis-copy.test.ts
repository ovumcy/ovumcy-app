import { SUPPORTED_INTERFACE_LANGUAGES } from "../models/profile";
import { buildCrisisSupportViewData, getCrisisCopy } from "./crisis-copy";

describe("crisis-copy", () => {
  it("resolves calm, exclamation-free copy for every supported locale", () => {
    for (const language of SUPPORTED_INTERFACE_LANGUAGES) {
      const copy = getCrisisCopy(language);
      const strings = [
        copy.title,
        copy.guidance,
        copy.editAffordance,
        copy.privacyNote,
        copy.form.nameLabel,
        copy.form.namePlaceholder,
        copy.form.phoneLabel,
        copy.form.phonePlaceholder,
        copy.form.save,
        copy.form.cancel,
        copy.supportResources.rowLabel,
        copy.supportResources.expandLabel,
        copy.supportResources.collapseLabel,
        copy.contactLine("A", "B"),
      ];
      for (const value of strings) {
        expect(value.length).toBeGreaterThan(0);
        // Calm register: no exclamation marks anywhere, in any locale.
        expect(value).not.toContain("!");
      }
    }
  });

  it("falls back to English for an unknown language tag", () => {
    expect(getCrisisCopy("xx").title).toBe(getCrisisCopy("en").title);
  });

  describe("buildCrisisSupportViewData", () => {
    it("always carries the fixed guidance and hides the contact line when unset", () => {
      const view = buildCrisisSupportViewData("en");
      expect(view.guidance).toContain("immediate support");
      expect(view.contactDisplayLine).toBeNull();
    });

    it("formats the contact line only when BOTH name and phone are present", () => {
      expect(
        buildCrisisSupportViewData("en", "Mum", "555").contactDisplayLine,
      ).toBe("Your support contact: Mum — 555");
      expect(
        buildCrisisSupportViewData("en", "Mum", "").contactDisplayLine,
      ).toBeNull();
      expect(
        buildCrisisSupportViewData("en", "", "555").contactDisplayLine,
      ).toBeNull();
      // Whitespace-only is treated as unset.
      expect(
        buildCrisisSupportViewData("en", "  ", "  ").contactDisplayLine,
      ).toBeNull();
    });
  });
});
