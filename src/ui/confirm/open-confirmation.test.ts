import {
  __resetConfirmationListenerForTesting,
  type ConfirmationRequest,
  registerConfirmationListener,
} from "./confirmation-bridge";
import { openConfirmation } from "./open-confirmation";

describe("openConfirmation", () => {
  beforeEach(() => {
    __resetConfirmationListenerForTesting();
  });

  it("forwards the message and all three labels, resolving true on accept", async () => {
    const seen: ConfirmationRequest[] = [];
    registerConfirmationListener((request) => {
      seen.push(request);
      request.resolve("accept");
    });

    await expect(openConfirmation("Eintrag löschen?", "Löschen", "Abbrechen")).resolves.toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      message: "Eintrag löschen?",
      acceptLabel: "Löschen",
      cancelLabel: "Abbrechen",
    });
  });

  it("resolves false when the cancel label is chosen", async () => {
    const seen: ConfirmationRequest[] = [];
    registerConfirmationListener((request) => {
      seen.push(request);
      request.resolve("reject");
    });

    await expect(
      openConfirmation("Discard changes?", "Discard", "Keep editing"),
    ).resolves.toBe(false);
    expect(seen[0]).toMatchObject({
      message: "Discard changes?",
      acceptLabel: "Discard",
      cancelLabel: "Keep editing",
    });
  });
});
