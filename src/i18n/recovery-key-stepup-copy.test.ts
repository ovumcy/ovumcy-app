import type { InterfaceLanguage } from "../models/profile";
import { SUPPORTED_INTERFACE_LANGUAGES } from "../models/profile";
import { selectRecoveryKeyStepUpCopy } from "./recovery-key-stepup-copy";

describe("recovery-key-stepup-copy", () => {
  it("resolves non-empty copy for every supported locale", () => {
    for (const language of SUPPORTED_INTERFACE_LANGUAGES) {
      const copy = selectRecoveryKeyStepUpCopy(language);
      expect(copy.title.length).toBeGreaterThan(0);
      for (const message of Object.values(copy.errors)) {
        expect(message.length).toBeGreaterThan(0);
      }
    }
  });

  it("falls back to English for an unknown language tag", () => {
    expect(selectRecoveryKeyStepUpCopy("xx" as InterfaceLanguage)).toBe(
      selectRecoveryKeyStepUpCopy("en"),
    );
  });
});
