import { SUPPORTED_INTERFACE_LANGUAGES } from "../models/profile";
import { getDeviceCopy } from "./device-copy";

describe("device-copy", () => {
  it("names the device in every removal prompt for every supported locale", () => {
    for (const language of SUPPORTED_INTERFACE_LANGUAGES) {
      const copy = getDeviceCopy(language);
      for (const prompt of [
        copy.removeDevicePrompt,
        copy.removeCurrentDevicePrompt,
        copy.removeSelfHostedDevicePrompt,
        copy.removeCurrentSelfHostedDevicePrompt,
      ]) {
        expect(prompt("Old tablet")).toContain("Old tablet");
      }
      expect(copy.statusRemovedSignedOut.length).toBeGreaterThan(0);
      expect(copy.removeStepUpExplanation.length).toBeGreaterThan(0);
    }
  });

  it("words the self-hosted prompts apart from the managed ones", () => {
    for (const language of SUPPORTED_INTERFACE_LANGUAGES) {
      const copy = getDeviceCopy(language);
      expect(copy.removeSelfHostedDevicePrompt("X")).not.toBe(
        copy.removeDevicePrompt("X"),
      );
      expect(copy.removeCurrentSelfHostedDevicePrompt("X")).not.toBe(
        copy.removeCurrentDevicePrompt("X"),
      );
    }
  });
});
