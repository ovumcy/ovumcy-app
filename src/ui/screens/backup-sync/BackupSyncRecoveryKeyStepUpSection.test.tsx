import { fireEvent, render, screen } from "@testing-library/react-native";

import { selectManagedRecoveryRotationCopy } from "../../../i18n/managed-recovery-rotation-copy";
import { selectRecoveryKeyStepUpCopy } from "../../../i18n/recovery-key-stepup-copy";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { BackupSyncRecoveryKeyStepUpSection } from "./BackupSyncRecoveryKeyStepUpSection";
import type { RecoveryKeyStepUpPrompt } from "./useBackupSyncActions";

const copy = selectRecoveryKeyStepUpCopy("en");
const rotationCopy = selectManagedRecoveryRotationCopy("en").stepUp;

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
    ["rate_limited", copy.errors.rateLimited],
  ] as const)("shows the message for %s", async (errorCode, message) => {
    await renderSection({ codeRequired: true, errorCode });

    expect(screen.getByText(message)).toBeTruthy();
  });

  it.each([
    ["rotation_unconfirmed", rotationCopy.errors.rotationUnconfirmed],
    ["generic", rotationCopy.errors.rotationFailed],
    ["totp_not_configured", rotationCopy.errors.totpNotConfigured],
    ["sync_not_configured", rotationCopy.errors.syncNotConfigured],
    ["totp_fresh_code_required", rotationCopy.errors.totpFreshCodeRequired],
  ] as const)("shows no banner for %s when the copy has no rotation messages", async (errorCode, _message) => {
    await renderSection({ codeRequired: true, errorCode });

    expect(screen.queryByTestId("sync-recovery-key-stepup-error")).toBeNull();
  });

  it.each([true, false])("shows the rotation in-progress line only while busy (%s)", async (isBusy) => {
    await render(
      <AppPreferencesTestProvider>
        <BackupSyncRecoveryKeyStepUpSection
          copy={rotationCopy}
          isBusy={isBusy}
          onCancel={jest.fn()}
          onSubmit={jest.fn()}
          prompt={{ codeRequired: false, errorCode: null }}
          testIDPrefix="sync-recovery-rotation-stepup"
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.queryByText(rotationCopy.inProgressLabel!) !== null).toBe(isBusy);
  });

  it("shows no in-progress line for copy without one", async () => {
    await render(
      <AppPreferencesTestProvider>
        <BackupSyncRecoveryKeyStepUpSection
          copy={copy}
          isBusy
          onCancel={jest.fn()}
          onSubmit={jest.fn()}
          prompt={{ codeRequired: false, errorCode: null }}
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.queryByTestId("sync-recovery-key-stepup-in-progress")).toBeNull();
  });

  it.each([
    ["rotation_unconfirmed", rotationCopy.errors.rotationUnconfirmed],
    ["generic", rotationCopy.errors.rotationFailed],
    ["totp_not_configured", rotationCopy.errors.totpNotConfigured],
    ["sync_not_configured", rotationCopy.errors.syncNotConfigured],
    ["totp_fresh_code_required", rotationCopy.errors.totpFreshCodeRequired],
  ] as const)("shows the rotation message for %s", async (errorCode, message) => {
    await render(
      <AppPreferencesTestProvider>
        <BackupSyncRecoveryKeyStepUpSection
          copy={rotationCopy}
          isBusy={false}
          onCancel={jest.fn()}
          onSubmit={jest.fn()}
          prompt={{ codeRequired: true, errorCode }}
          testIDPrefix="sync-recovery-rotation-stepup"
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByText(message!)).toBeTruthy();
    expect(screen.getByTestId("sync-recovery-rotation-stepup-error")).toBeTruthy();
  });
});

describe("BackupSyncRecoveryKeyStepUpSection candidate phrase", () => {
  const candidate = "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima";

  async function renderCandidate(phrase: string) {
    const onSubmit = jest.fn();
    const view = await render(
      <AppPreferencesTestProvider>
        <BackupSyncRecoveryKeyStepUpSection
          copy={rotationCopy}
          isBusy={false}
          onCancel={jest.fn()}
          onSubmit={onSubmit}
          prompt={{ codeRequired: false, errorCode: null, candidatePhrase: phrase }}
          testIDPrefix="sync-recovery-rotation-stepup"
        />
      </AppPreferencesTestProvider>,
    );
    return { onSubmit, view };
  }

  function rotationConfirmDisabled() {
    return screen.getByTestId("sync-recovery-rotation-stepup-confirm").props
      .accessibilityState.disabled;
  }

  it("shows the candidate with the inactive-until-confirmed notice", async () => {
    await renderCandidate(candidate);

    expect(
      screen.getByTestId("sync-recovery-rotation-stepup-candidate-phrase").props.children,
    ).toBe(candidate);
    expect(screen.getByText(rotationCopy.candidate!.notice)).toBeTruthy();
  });

  it("keeps confirm disabled until the phrase is acknowledged as written down", async () => {
    const { onSubmit } = await renderCandidate(candidate);
    await fireEvent.changeText(
      screen.getByTestId("sync-recovery-rotation-stepup-password"),
      "pw",
    );
    expect(rotationConfirmDisabled()).toBe(true);

    await fireEvent.press(screen.getByTestId("sync-recovery-rotation-stepup-candidate-ack"));
    expect(rotationConfirmDisabled()).toBe(false);
    await fireEvent.press(screen.getByTestId("sync-recovery-rotation-stepup-candidate-ack"));
    expect(rotationConfirmDisabled()).toBe(true);
    await fireEvent.press(screen.getByTestId("sync-recovery-rotation-stepup-candidate-ack"));

    await fireEvent.press(screen.getByTestId("sync-recovery-rotation-stepup-confirm"));
    expect(onSubmit).toHaveBeenCalledWith({ currentPassword: "pw" });
  });

  it("asks again when a different candidate replaces the acknowledged one", async () => {
    const { view } = await renderCandidate(candidate);
    await fireEvent.press(screen.getByTestId("sync-recovery-rotation-stepup-candidate-ack"));

    await view.rerender(
      <AppPreferencesTestProvider>
        <BackupSyncRecoveryKeyStepUpSection
          copy={rotationCopy}
          isBusy={false}
          onCancel={jest.fn()}
          onSubmit={jest.fn()}
          prompt={{ codeRequired: false, errorCode: "generic", candidatePhrase: "another phrase" }}
          testIDPrefix="sync-recovery-rotation-stepup"
        />
      </AppPreferencesTestProvider>,
    );
    await fireEvent.changeText(
      screen.getByTestId("sync-recovery-rotation-stepup-password"),
      "pw",
    );

    expect(rotationConfirmDisabled()).toBe(true);
    expect(
      screen.getByTestId("sync-recovery-rotation-stepup-candidate-ack").props
        .accessibilityState.checked,
    ).toBe(false);
  });
});
