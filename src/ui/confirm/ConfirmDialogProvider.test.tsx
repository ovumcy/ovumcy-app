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

  it("ignores a concurrent request without disturbing the visible dialog or auto-resolving anything", async () => {
    renderProvider();
    let firstPromise!: Promise<boolean>;
    let secondPromise!: Promise<boolean>;
    let secondSettled = false;

    act(() => {
      firstPromise = requestConfirmation("first?", "Yes", "No");
    });
    act(() => {
      secondPromise = requestConfirmation("second?", "Yes2", "No2");
    });
    void secondPromise.then(() => {
      secondSettled = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(secondSettled).toBe(false);
    expect(screen.getByTestId("confirm-dialog-message").props.children).toBe(
      "first?",
    );
    expect(getModal().props.visible).toBe(true);

    act(() => {
      fireEvent.press(screen.getByTestId("confirm-dialog-accept"));
    });
    await expect(firstPromise).resolves.toBe(true);

    await Promise.resolve();
    expect(secondSettled).toBe(false);
    expect(getModal().props.visible).toBe(false);
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
