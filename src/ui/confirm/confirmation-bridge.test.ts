import {
  __resetConfirmationListenerForTesting,
  type ConfirmationOutcome,
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
      request.resolve("accept");
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
      request.resolve("accept");
    });
    unregister();
    await expect(
      requestConfirmation("anything", "OK", "Cancel"),
    ).resolves.toBe(false);
  });

  it("auto-dismisses a concurrent request without delivering it, instead of leaving it pending", async () => {
    const delivered: string[] = [];
    let firstRequest: ConfirmationRequestForTest | null = null;
    registerConfirmationListener((request) => {
      delivered.push(request.message);
      if (firstRequest === null) {
        firstRequest = request;
      }
    });

    const first = requestConfirmation("first?", "OK", "Cancel");
    const second = requestConfirmation("second?", "OK", "Cancel");

    // The concurrent request is never delivered to the listener (the visible
    // dialog stays put), but it must settle deterministically to the safe
    // dismiss outcome (false) rather than dangle forever.
    await expect(second).resolves.toBe(false);
    expect(delivered).toEqual(["first?"]);

    firstRequest!.resolve("accept");
    await expect(first).resolves.toBe(true);
  });

  it("accepts a new request after the previous one is resolved", async () => {
    const delivered: ConfirmationRequestForTest[] = [];
    registerConfirmationListener((request) => {
      delivered.push(request);
    });

    const first = requestConfirmation("first?", "OK", "Cancel");
    delivered[0]!.resolve("accept");
    await expect(first).resolves.toBe(true);

    const second = requestConfirmation("second?", "OK", "Cancel");
    expect(delivered).toHaveLength(2);
    expect(delivered[1]!.message).toBe("second?");
    delivered[1]!.resolve("reject");
    await expect(second).resolves.toBe(false);
  });
});

type ConfirmationRequestForTest = {
  message: string;
  acceptLabel: string;
  cancelLabel: string;
  resolve: (outcome: ConfirmationOutcome) => void;
};
