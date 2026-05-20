import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Modal } from "react-native";

import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";

import {
  __resetConfirmationListenerForTesting,
  requestConfirmation,
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

  it("resolves a still-pending request to false when a new one arrives", async () => {
    renderProvider();
    let firstPromise!: Promise<boolean>;
    let secondPromise!: Promise<boolean>;

    act(() => {
      firstPromise = requestConfirmation("first?", "Yes", "No");
    });
    act(() => {
      secondPromise = requestConfirmation("second?", "Yes", "No");
    });

    await expect(firstPromise).resolves.toBe(false);
    expect(screen.getByTestId("confirm-dialog-message").props.children).toBe(
      "second?",
    );
    expect(getModal().props.visible).toBe(true);

    act(() => {
      fireEvent.press(screen.getByTestId("confirm-dialog-accept"));
    });

    await expect(secondPromise).resolves.toBe(true);
    expect(getModal().props.visible).toBe(false);
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
