import { fireEvent, render, screen } from "@testing-library/react-native";

import { selectRecoveryKeyStepUpCopy } from "../../../i18n/recovery-key-stepup-copy";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { BackupSyncRecoveryKeyStepUpSection } from "./BackupSyncRecoveryKeyStepUpSection";
import type { RecoveryKeyStepUpPrompt } from "./useBackupSyncActions";

const copy = selectRecoveryKeyStepUpCopy("en");

async function renderSection(
  prompt: RecoveryKeyStepUpPrompt,
  overrides: { isBusy?: boolean } = {},
) {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();
  await render(
    <AppPreferencesTestProvider>
      <BackupSyncRecoveryKeyStepUpSection
        copy={copy}
        isBusy={overrides.isBusy ?? false}
        onCancel={onCancel}
        onSubmit={onSubmit}
        prompt={prompt}
      />
    </AppPreferencesTestProvider>,
  );
  return { onSubmit, onCancel };
}

function confirmDisabled() {
  return screen.getByTestId("sync-recovery-key-stepup-confirm").props
    .accessibilityState.disabled;
}

describe("BackupSyncRecoveryKeyStepUpSection", () => {
  it("renders a secure password field and hides the code field when not required", async () => {
    await renderSection({ codeRequired: false, errorCode: null });

    expect(screen.getByText(copy.title)).toBeTruthy();
    expect(
      screen.getByTestId("sync-recovery-key-stepup-password").props
        .secureTextEntry,
    ).toBe(true);
    expect(screen.queryByTestId("sync-recovery-key-stepup-code")).toBeNull();
    expect(screen.queryByTestId("sync-recovery-key-stepup-error")).toBeNull();
  });

  it("shows the code field when required", async () => {
    await renderSection({ codeRequired: true, errorCode: null });

    expect(screen.getByTestId("sync-recovery-key-stepup-code")).toBeTruthy();
  });

  it("disables confirm while the password is empty", async () => {
    await renderSection({ codeRequired: false, errorCode: null });
    expect(confirmDisabled()).toBe(true);

    await fireEvent.changeText(
      screen.getByTestId("sync-recovery-key-stepup-password"),
      "pw",
    );
    expect(confirmDisabled()).toBe(false);
  });

  it("disables confirm on a partial code but allows an empty one", async () => {
    await renderSection({ codeRequired: true, errorCode: null });
    await fireEvent.changeText(
      screen.getByTestId("sync-recovery-key-stepup-password"),
      "pw",
    );
    expect(confirmDisabled()).toBe(false);

    await fireEvent.changeText(
      screen.getByTestId("sync-recovery-key-stepup-code"),
      "12345",
    );
    expect(confirmDisabled()).toBe(true);

    await fireEvent.changeText(
      screen.getByTestId("sync-recovery-key-stepup-code"),
      "123456",
    );
    expect(confirmDisabled()).toBe(false);
  });

  it("keeps confirm disabled while a sync is running", async () => {
    await renderSection(
      { codeRequired: false, errorCode: null },
      { isBusy: true },
    );
    await fireEvent.changeText(
      screen.getByTestId("sync-recovery-key-stepup-password"),
      "pw",
    );

    expect(confirmDisabled()).toBe(true);
  });

  it("submits password and code, then clears both fields", async () => {
    const { onSubmit } = await renderSection({
      codeRequired: true,
      errorCode: null,
    });
    await fireEvent.changeText(
      screen.getByTestId("sync-recovery-key-stepup-password"),
      "pw",
    );
    await fireEvent.changeText(
      screen.getByTestId("sync-recovery-key-stepup-code"),
      "123456",
    );

    await fireEvent.press(screen.getByTestId("sync-recovery-key-stepup-confirm"));

    expect(onSubmit).toHaveBeenCalledWith({
      currentPassword: "pw",
      code: "123456",
    });
    expect(
      screen.getByTestId("sync-recovery-key-stepup-password").props.value,
    ).toBe("");
    expect(
      screen.getByTestId("sync-recovery-key-stepup-code").props.value,
    ).toBe("");
  });

  it("submits without a code when none is required", async () => {
    const { onSubmit } = await renderSection({
      codeRequired: false,
      errorCode: null,
    });
    await fireEvent.changeText(
      screen.getByTestId("sync-recovery-key-stepup-password"),
      "pw",
    );

    await fireEvent.press(screen.getByTestId("sync-recovery-key-stepup-confirm"));

    expect(onSubmit).toHaveBeenCalledWith({ currentPassword: "pw" });
  });

  it("cancel clears the fields and calls onCancel", async () => {
    const { onCancel } = await renderSection({
      codeRequired: false,
      errorCode: null,
    });
    await fireEvent.changeText(
      screen.getByTestId("sync-recovery-key-stepup-password"),
      "pw",
    );

    await fireEvent.press(screen.getByTestId("sync-recovery-key-stepup-cancel"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId("sync-recovery-key-stepup-password").props.value,
    ).toBe("");
  });

  it.each([
    ["invalid_current_password", copy.errors.invalidCurrentPassword],
    ["totp_invalid_code", copy.errors.totpInvalidCode],
    ["totp_replayed", copy.errors.totpReplayed],
  ] as const)("shows the message for %s", async (errorCode, message) => {
    await renderSection({ codeRequired: true, errorCode });

    expect(screen.getByText(message)).toBeTruthy();
  });
});
