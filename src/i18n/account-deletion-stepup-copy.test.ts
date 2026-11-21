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
    expect(
      selectAccountDeletionStepUpCopy("xx" as InterfaceLanguage, "self_hosted"),
    ).toEqual(selectAccountDeletionStepUpCopy("en", "self_hosted"));
  });

  it.each(["en", "de", "fr", "ru", "es", "it"] as const)(
    "names the sync server, not Ovumcy Cloud, for a self-hosted %s account",
    (language) => {
      const managed = selectAccountDeletionStepUpCopy(language, "managed");
      const selfHosted = selectAccountDeletionStepUpCopy(language, "self_hosted");

      expect(selfHosted.explanation).not.toBe(managed.explanation);
      expect(selfHosted.explanation).not.toContain("Ovumcy Cloud");
      expect(selfHosted.title).toBe(managed.title);
      expect(selfHosted.confirmLabel).toBe(managed.confirmLabel);
    },
  );
});
