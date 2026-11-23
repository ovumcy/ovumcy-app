import type { InterfaceLanguage } from "../models/profile";
import { SUPPORTED_INTERFACE_LANGUAGES } from "../models/profile";
import { selectManagedRecoveryRotationCopy } from "./managed-recovery-rotation-copy";
import { selectRecoveryKeyStepUpCopy } from "./recovery-key-stepup-copy";

describe("managed-recovery-rotation-copy", () => {
  it("resolves non-empty rotation copy for every supported locale", () => {
    for (const language of SUPPORTED_INTERFACE_LANGUAGES) {
      const copy = selectManagedRecoveryRotationCopy(language);
      for (const value of [
        copy.actionLabel,
        copy.noFloorHint,
        copy.confirmPrompt,
        copy.confirmAccept,
        copy.deviceAuthPrompt,
        copy.rotatedStatus,
        copy.stepUp.title,
        copy.stepUp.explanation,
        copy.stepUp.errors.rotationUnconfirmed ?? "",
        copy.stepUp.errors.rotationFailed ?? "",
      ]) {
        expect(value.length).toBeGreaterThan(0);
      }
      expect(copy.stepUp.passwordLabel).toBe(
        selectRecoveryKeyStepUpCopy(language).passwordLabel,
      );
    }
  });

  it("falls back to English for an unknown language tag", () => {
    expect(selectManagedRecoveryRotationCopy("xx" as InterfaceLanguage)).toEqual(
      selectManagedRecoveryRotationCopy("en"),
    );
  });
});
