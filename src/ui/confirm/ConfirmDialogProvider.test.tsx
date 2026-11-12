import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";

import {
  __resetConfirmationListenerForTesting,
  type ConfirmationOutcome,
  requestConfirmation,
  requestConfirmationOutcome,
} from "./confirmation-bridge";
import { ConfirmDialogProvider } from "./ConfirmDialogProvider";

async function renderProvider() {
  return await render(
    <AppPreferencesTestProvider>
      <ConfirmDialogProvider>{null}</ConfirmDialogProvider>
    </AppPreferencesTestProvider>,
  );
}

function findModal() {
  return screen.container
    .queryAll((node) => node.type === "Modal")
    .find((node) => node.props.visible !== false);
}

// The RN Modal mock renders nothing while `visible` is false, so a hidden
// modal has no host element in the tree.
function isModalVisible() {
  return findModal() !== undefined;
}

function getModal() {
  const modal = findModal();
  if (!modal) {
    throw new Error("Modal not found");
  }
  return modal;
}

describe("ConfirmDialogProvider", () => {
  beforeEach(() => {
    __resetConfirmationListenerForTesting();
  });

  it("keeps the modal hidden until a confirmation is requested", async () => {
    await renderProvider();
    expect(isModalVisible()).toBe(false);
  });

  it("shows the modal with the requested copy when a confirmation is requested", async () => {
    await renderProvider();

    await act(() => {
      void requestConfirmation("Discard changes?", "Discard", "Keep");
    });

    expect(isModalVisible()).toBe(true);
    expect(screen.getByTestId("confirm-dialog-message").props.children).toBe(
      "Discard changes?",
    );
    expect(screen.getByText("Discard")).toBeTruthy();
    expect(screen.getByText("Keep")).toBeTruthy();
  });

  it("resolves true and hides the modal when the accept button is pressed", async () => {
    await renderProvider();
    let promise!: Promise<boolean>;
    await act(() => {
      promise = requestConfirmation("ok?", "Yes", "No");
    });

    await act(async () => {
      await fireEvent.press(screen.getByTestId("confirm-dialog-accept"));
    });

    await expect(promise).resolves.toBe(true);
    expect(isModalVisible()).toBe(false);
  });

  it("resolves false and hides the modal when the cancel button is pressed", async () => {
    await renderProvider();
    let promise!: Promise<boolean>;
    await act(() => {
      promise = requestConfirmation("ok?", "Yes", "No");
    });

    await act(async () => {
      await fireEvent.press(screen.getByTestId("confirm-dialog-cancel"));
    });

    await expect(promise).resolves.toBe(false);
    expect(isModalVisible()).toBe(false);
  });

  it("resolves false when the backdrop is pressed", async () => {
    await renderProvider();
    let promise!: Promise<boolean>;
    await act(() => {
      promise = requestConfirmation("ok?", "Yes", "No");
    });

    await act(async () => {
      await fireEvent.press(screen.getByTestId("confirm-dialog-backdrop"));
    });

    await expect(promise).resolves.toBe(false);
    expect(isModalVisible()).toBe(false);
  });

  it("resolves false when the system dismisses the modal via onRequestClose", async () => {
    await renderProvider();
    let promise!: Promise<boolean>;
    await act(() => {
      promise = requestConfirmation("ok?", "Yes", "No");
    });

    await act(() => {
      getModal().props.onRequestClose();
    });

    await expect(promise).resolves.toBe(false);
    expect(isModalVisible()).toBe(false);
  });

  it("resolves a concurrent request to the safe dismiss outcome without disturbing the visible dialog", async () => {
    await renderProvider();
    let firstPromise!: Promise<boolean>;
    let secondPromise!: Promise<ConfirmationOutcome>;

    await act(() => {
      firstPromise = requestConfirmation("first?", "Yes", "No");
    });
    await act(() => {
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
    expect(isModalVisible()).toBe(true);

    await act(async () => {
      await fireEvent.press(screen.getByTestId("confirm-dialog-accept"));
    });
    await expect(firstPromise).resolves.toBe(true);
    expect(isModalVisible()).toBe(false);
  });

  it("accepts a fresh confirmation after a concurrent request was auto-dismissed", async () => {
    await renderProvider();
    let firstPromise!: Promise<boolean>;

    await act(() => {
      firstPromise = requestConfirmation("first?", "Yes", "No");
    });
    await act(() => {
      // Concurrent request is auto-dismissed; it must not leave isPending stuck.
      void requestConfirmation("second?", "Yes2", "No2");
    });

    await act(async () => {
      await fireEvent.press(screen.getByTestId("confirm-dialog-accept"));
    });
    await expect(firstPromise).resolves.toBe(true);

    // A brand-new confirmation after the first fully resolved still works.
    let thirdPromise!: Promise<boolean>;
    await act(() => {
      thirdPromise = requestConfirmation("third?", "Yes3", "No3");
    });
    expect(isModalVisible()).toBe(true);
    expect(screen.getByTestId("confirm-dialog-message").props.children).toBe(
      "third?",
    );
    await act(async () => {
      await fireEvent.press(screen.getByTestId("confirm-dialog-cancel"));
    });
    await expect(thirdPromise).resolves.toBe(false);
  });

  it("renders a neutral button and resolves dismiss for three-way prompts", async () => {
    await renderProvider();
    let promise!: Promise<ConfirmationOutcome>;
    await act(() => {
      promise = requestConfirmationOutcome(
        "Leave with unsaved changes?",
        "Save and leave",
        "Discard changes",
        "Keep editing",
      );
    });

    expect(screen.getByText("Keep editing")).toBeTruthy();

    await act(async () => {
      await fireEvent.press(screen.getByTestId("confirm-dialog-neutral"));
    });

    await expect(promise).resolves.toBe("dismiss");
    expect(isModalVisible()).toBe(false);
  });

  it("resolves dismiss when a three-way prompt is dismissed via the backdrop", async () => {
    await renderProvider();
    let promise!: Promise<ConfirmationOutcome>;
    await act(() => {
      promise = requestConfirmationOutcome("Leave?", "Save", "Discard", "Keep");
    });

    await act(async () => {
      await fireEvent.press(screen.getByTestId("confirm-dialog-backdrop"));
    });

    await expect(promise).resolves.toBe("dismiss");
  });

  it("resolves accept and reject from the explicit buttons of a three-way prompt", async () => {
    await renderProvider();
    let acceptPromise!: Promise<ConfirmationOutcome>;
    await act(() => {
      acceptPromise = requestConfirmationOutcome("Leave?", "Save", "Discard", "Keep");
    });
    await act(async () => {
      await fireEvent.press(screen.getByTestId("confirm-dialog-accept"));
    });
    await expect(acceptPromise).resolves.toBe("accept");

    let rejectPromise!: Promise<ConfirmationOutcome>;
    await act(() => {
      rejectPromise = requestConfirmationOutcome("Leave?", "Save", "Discard", "Keep");
    });
    await act(async () => {
      await fireEvent.press(screen.getByTestId("confirm-dialog-cancel"));
    });
    await expect(rejectPromise).resolves.toBe("reject");
  });

  it("ignores stray button presses after the request has already resolved", async () => {
    await renderProvider();
    let promise!: Promise<boolean>;
    await act(() => {
      promise = requestConfirmation("ok?", "Yes", "No");
    });

    const staleOnRequestClose = getModal().props.onRequestClose;
    await act(async () => {
      await fireEvent.press(screen.getByTestId("confirm-dialog-accept"));
    });
    await expect(promise).resolves.toBe(true);

    await act(() => {
      staleOnRequestClose();
    });
  });
});
