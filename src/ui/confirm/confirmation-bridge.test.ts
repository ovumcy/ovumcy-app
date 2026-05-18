import {
  __resetConfirmationListenerForTesting,
  registerConfirmationListener,
  requestConfirmation,
} from "./confirmation-bridge";

describe("confirmation-bridge", () => {
  beforeEach(() => {
    __resetConfirmationListenerForTesting();
  });

  it("resolves to false when no listener has registered", async () => {
    await expect(
      requestConfirmation("message", "OK", "Cancel"),
    ).resolves.toBe(false);
  });

  it("forwards requests to the registered listener and resolves with the listener's choice", async () => {
    const seen: { message: string; acceptLabel: string; cancelLabel: string }[] = [];
    registerConfirmationListener((request) => {
      seen.push({
        acceptLabel: request.acceptLabel,
        cancelLabel: request.cancelLabel,
        message: request.message,
      });
      request.resolve(true);
    });

    await expect(
      requestConfirmation("Discard changes?", "Discard", "Keep"),
    ).resolves.toBe(true);
    expect(seen).toEqual([
      { acceptLabel: "Discard", cancelLabel: "Keep", message: "Discard changes?" },
    ]);
  });

  it("falls back to false after the listener unregisters", async () => {
    const unregister = registerConfirmationListener((request) => {
      request.resolve(true);
    });
    unregister();
    await expect(
      requestConfirmation("anything", "OK", "Cancel"),
    ).resolves.toBe(false);
  });
});
