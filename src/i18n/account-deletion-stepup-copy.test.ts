import type { InterfaceLanguage } from "../models/profile";
import { selectAccountDeletionStepUpCopy } from "./account-deletion-stepup-copy";
import { selectRecoveryKeyStepUpCopy } from "./recovery-key-stepup-copy";

describe("selectAccountDeletionStepUpCopy", () => {
  it.each(["en", "de", "fr", "ru", "es", "it"] as const)(
    "gives %s its own deletion title and keeps the shared field labels",
    (language) => {
      const copy = selectAccountDeletionStepUpCopy(language);
      const shared = selectRecoveryKeyStepUpCopy(language);

      expect(copy.title).not.toBe(shared.title);
      expect(copy.explanation).not.toBe(shared.explanation);
      expect(copy.passwordLabel).toBe(shared.passwordLabel);
      expect(copy.errors).toEqual(shared.errors);
    },
  );

  it("falls back to English for an unknown language", () => {
    expect(
      selectAccountDeletionStepUpCopy("xx" as InterfaceLanguage),
    ).toEqual(selectAccountDeletionStepUpCopy("en"));
  });
});
