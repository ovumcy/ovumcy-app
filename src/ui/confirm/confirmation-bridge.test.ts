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

  it("does not deliver or auto-resolve a concurrent request while one is pending", async () => {
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

    let secondSettled = false;
    void second.then(() => {
      secondSettled = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(delivered).toEqual(["first?"]);
    expect(secondSettled).toBe(false);

    firstRequest!.resolve("accept");
    await expect(first).resolves.toBe(true);

    await Promise.resolve();
    expect(secondSettled).toBe(false);
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
