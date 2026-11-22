import type { InterfaceLanguage } from "../models/profile";
import { SUPPORTED_INTERFACE_LANGUAGES } from "../models/profile";
import { selectAccountChangeRecoveryCopy } from "./account-change-recovery-copy";

describe("account-change-recovery-copy", () => {
  it("resolves non-empty copy for every supported locale", () => {
    for (const language of SUPPORTED_INTERFACE_LANGUAGES) {
      for (const value of Object.values(selectAccountChangeRecoveryCopy(language))) {
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back to English for an unknown language tag", () => {
    expect(selectAccountChangeRecoveryCopy("xx" as InterfaceLanguage)).toEqual(
      selectAccountChangeRecoveryCopy("en"),
    );
  });
});
