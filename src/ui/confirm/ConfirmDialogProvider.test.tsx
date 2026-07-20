import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Modal } from "react-native";

import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";

import {
  __resetConfirmationListenerForTesting,
  type ConfirmationOutcome,
  requestConfirmation,
  requestConfirmationOutcome,
} from "./confirmation-bridge";
import { ConfirmDialogProvider } from "./ConfirmDialogProvider";

function renderProvider() {
  return render(
    <AppPreferencesTestProvider>
      <ConfirmDialogProvider>{null}</ConfirmDialogProvider>
    </AppPreferencesTestProvider>,
  );
}

function getModal() {
  return screen.UNSAFE_getByType(Modal);
}

describe("ConfirmDialogProvider", () => {
  beforeEach(() => {
    __resetConfirmationListenerForTesting();
  });

  it("keeps the modal hidden until a confirmation is requested", () => {
    renderProvider();
    expect(getModal().props.visible).toBe(false);
  });

  it("shows the modal with the requested copy when a confirmation is requested", () => {
    renderProvider();

    act(() => {
      void requestConfirmation("Discard changes?", "Discard", "Keep");
    });

    expect(getModal().props.visible).toBe(true);
    expect(screen.getByTestId("confirm-dialog-message").props.children).toBe(
      "Discard changes?",
    );
    expect(screen.getByText("Discard")).toBeTruthy();
    expect(screen.getByText("Keep")).toBeTruthy();
  });

  it("resolves true and hides the modal when the accept button is pressed", async () => {
    renderProvider();
    let promise!: Promise<boolean>;
    act(() => {
      promise = requestConfirmation("ok?", "Yes", "No");
    });

    act(() => {
      fireEvent.press(screen.getByTestId("confirm-dialog-accept"));
    });

    await expect(promise).resolves.toBe(true);
    expect(getModal().props.visible).toBe(false);
  });

  it("resolves false and hides the modal when the cancel button is pressed", async () => {
    renderProvider();
    let promise!: Promise<boolean>;
    act(() => {
      promise = requestConfirmation("ok?", "Yes", "No");
    });

    act(() => {
      fireEvent.press(screen.getByTestId("confirm-dialog-cancel"));
    });

    await expect(promise).resolves.toBe(false);
    expect(getModal().props.visible).toBe(false);
  });

  it("resolves false when the backdrop is pressed", async () => {
    renderProvider();
    let promise!: Promise<boolean>;
    act(() => {
      promise = requestConfirmation("ok?", "Yes", "No");
    });

    act(() => {
      fireEvent.press(screen.getByTestId("confirm-dialog-backdrop"));
    });

    await expect(promise).resolves.toBe(false);
    expect(getModal().props.visible).toBe(false);
  });

  it("resolves false when the system dismisses the modal via onRequestClose", async () => {
    renderProvider();
    let promise!: Promise<boolean>;
    act(() => {
      promise = requestConfirmation("ok?", "Yes", "No");
    });

    act(() => {
      getModal().props.onRequestClose();
    });

    await expect(promise).resolves.toBe(false);
    expect(getModal().props.visible).toBe(false);
  });

  it("resolves a concurrent request to the safe dismiss outcome without disturbing the visible dialog", async () => {
    renderProvider();
    let firstPromise!: Promise<boolean>;
    let secondPromise!: Promise<ConfirmationOutcome>;

    act(() => {
      firstPromise = requestConfirmation("first?", "Yes", "No");
    });
    act(() => {
      secondPromise = requestConfirmationOutcome("second?", "Yes2", "No2");
    });

    // The second concurrent request must settle deterministically (dismiss)
    // rather than dangle forever — a hung promise would block whatever awaits
    // it. "dismiss" is the safe, non-destructive keep-editing answer.
    await expect(secondPromise).resolves.toBe("dismiss");

    // The already-visible first dialog is untouched by the concurrent request.
    expect(screen.getByTestId("confirm-dialog-message").props.children).toBe(
      "first?",
    );
    expect(getModal().props.visible).toBe(true);

    act(() => {
      fireEvent.press(screen.getByTestId("confirm-dialog-accept"));
    });
    await expect(firstPromise).resolves.toBe(true);
    expect(getModal().props.visible).toBe(false);
  });

  it("accepts a fresh confirmation after a concurrent request was auto-dismissed", async () => {
    renderProvider();
    let firstPromise!: Promise<boolean>;

    act(() => {
      firstPromise = requestConfirmation("first?", "Yes", "No");
    });
    act(() => {
      // Concurrent request is auto-dismissed; it must not leave isPending stuck.
      void requestConfirmation("second?", "Yes2", "No2");
    });

    act(() => {
      fireEvent.press(screen.getByTestId("confirm-dialog-accept"));
    });
    await expect(firstPromise).resolves.toBe(true);

    // A brand-new confirmation after the first fully resolved still works.
    let thirdPromise!: Promise<boolean>;
    act(() => {
      thirdPromise = requestConfirmation("third?", "Yes3", "No3");
    });
    expect(getModal().props.visible).toBe(true);
    expect(screen.getByTestId("confirm-dialog-message").props.children).toBe(
      "third?",
    );
    act(() => {
      fireEvent.press(screen.getByTestId("confirm-dialog-cancel"));
    });
    await expect(thirdPromise).resolves.toBe(false);
  });

  it("renders a neutral button and resolves dismiss for three-way prompts", async () => {
    renderProvider();
    let promise!: Promise<ConfirmationOutcome>;
    act(() => {
      promise = requestConfirmationOutcome(
        "Leave with unsaved changes?",
        "Save and leave",
        "Discard changes",
        "Keep editing",
      );
    });

    expect(screen.getByText("Keep editing")).toBeTruthy();

    act(() => {
      fireEvent.press(screen.getByTestId("confirm-dialog-neutral"));
    });

    await expect(promise).resolves.toBe("dismiss");
    expect(getModal().props.visible).toBe(false);
  });

  it("resolves dismiss when a three-way prompt is dismissed via the backdrop", async () => {
    renderProvider();
    let promise!: Promise<ConfirmationOutcome>;
    act(() => {
      promise = requestConfirmationOutcome("Leave?", "Save", "Discard", "Keep");
    });

    act(() => {
      fireEvent.press(screen.getByTestId("confirm-dialog-backdrop"));
    });

    await expect(promise).resolves.toBe("dismiss");
  });

  it("resolves accept and reject from the explicit buttons of a three-way prompt", async () => {
    renderProvider();
    let acceptPromise!: Promise<ConfirmationOutcome>;
    act(() => {
      acceptPromise = requestConfirmationOutcome("Leave?", "Save", "Discard", "Keep");
    });
    act(() => {
      fireEvent.press(screen.getByTestId("confirm-dialog-accept"));
    });
    await expect(acceptPromise).resolves.toBe("accept");

    let rejectPromise!: Promise<ConfirmationOutcome>;
    act(() => {
      rejectPromise = requestConfirmationOutcome("Leave?", "Save", "Discard", "Keep");
    });
    act(() => {
      fireEvent.press(screen.getByTestId("confirm-dialog-cancel"));
    });
    await expect(rejectPromise).resolves.toBe("reject");
  });

  it("ignores stray button presses after the request has already resolved", async () => {
    renderProvider();
    let promise!: Promise<boolean>;
    act(() => {
      promise = requestConfirmation("ok?", "Yes", "No");
    });

    act(() => {
      fireEvent.press(screen.getByTestId("confirm-dialog-accept"));
    });
    await expect(promise).resolves.toBe(true);

    expect(() => {
      act(() => {
        getModal().props.onRequestClose();
      });
    }).not.toThrow();
  });
});
