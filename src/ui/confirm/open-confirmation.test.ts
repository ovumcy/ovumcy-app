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

  it("forwards message and labels, defaulting cancelLabel to 'Cancel'", async () => {
    const seen: ConfirmationRequest[] = [];
    registerConfirmationListener((request) => {
      seen.push(request);
      request.resolve("accept");
    });

    await expect(openConfirmation("Delete entry?", "Delete")).resolves.toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      message: "Delete entry?",
      acceptLabel: "Delete",
      cancelLabel: "Cancel",
    });
  });

  it("uses the explicit cancelLabel when provided", async () => {
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
