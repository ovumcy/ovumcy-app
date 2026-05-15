import { fireEvent, render, screen } from "@testing-library/react-native";

import { selectAccountSecurityCopy } from "../../../i18n/account-security-copy";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { SyncAccountSecuritySection } from "./SyncAccountSecuritySection";

const copy = selectAccountSecurityCopy("en");

function noop() {}

function baseProps() {
  return {
    copy,

    changeCurrentPassword: "",
    onChangeCurrentPasswordChange: noop,
    changeNewPassword: "",
    onChangeNewPasswordChange: noop,
    changeStatus: "idle" as const,
    changeErrorCode: null,
    onChangePassword: noop,

    forgotLogin: "",
    onForgotLoginChange: noop,
    forgotRecoveryCode: "",
    onForgotRecoveryCodeChange: noop,
    forgotNewPassword: "",
    onForgotNewPasswordChange: noop,
    forgotStage: "credentials" as const,
    forgotStatus: "idle" as const,
    forgotErrorCode: null,
    forgotResetTokenExpiresAt: "",
    onRequestReset: noop,
    onSubmitResetPassword: noop,
    onCancelForgot: noop,

    regeneratePassword: "",
    onRegeneratePasswordChange: noop,
    regenerateStatus: "idle" as const,
    regenerateErrorCode: null,
    onRegenerate: noop,

    revealedRecoveryCode: "",
    onAcknowledgeRecoveryCode: noop,
  };
}

describe("SyncAccountSecuritySection", () => {
  it("renders all three sections in their default state", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection {...baseProps()} />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("account-security-change-submit")).toBeTruthy();
    expect(screen.getByTestId("account-security-forgot-submit")).toBeTruthy();
    expect(screen.getByTestId("account-security-regenerate-submit")).toBeTruthy();
    expect(screen.queryByTestId("account-security-recovery-code-modal")).toBeNull();
    expect(screen.queryByTestId("account-security-forgot-cancel")).toBeNull();
  });

  it("submits the change-password form via the press handler", () => {
    const onChangePassword = jest.fn();
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          onChangePassword={onChangePassword}
        />
      </AppPreferencesTestProvider>,
    );

    fireEvent.press(screen.getByTestId("account-security-change-submit"));
    expect(onChangePassword).toHaveBeenCalledTimes(1);
  });

  it("maps change-password error codes to localized strings", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          changeErrorCode="invalid_current_password"
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByText(copy.errors.invalidCurrentPassword),
    ).toBeTruthy();
  });

  it("shows the success banner once change-password completes", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          changeStatus="success"
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByText(copy.changePassword.successMessage),
    ).toBeTruthy();
  });

  it("transitions the forgot-password section to the new-password stage", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          forgotStage="new_password"
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByText(copy.forgotPassword.stageTwoTitle)).toBeTruthy();
    expect(
      screen.getByTestId("account-security-forgot-reset-submit"),
    ).toBeTruthy();
    expect(screen.getByTestId("account-security-forgot-cancel")).toBeTruthy();
    expect(screen.queryByTestId("account-security-forgot-submit")).toBeNull();
  });

  it("shows the completed banner when the reset flow finishes", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          forgotStage="completed"
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByText(copy.forgotPassword.completedMessage),
    ).toBeTruthy();
  });

  it("maps invalid_recovery_credentials to the generic localized error", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          forgotErrorCode="invalid_recovery_credentials"
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByText(copy.errors.invalidRecoveryCredentials),
    ).toBeTruthy();
  });

  it("opens the reveal modal when a recovery code arrives and acknowledges it", () => {
    const onAcknowledgeRecoveryCode = jest.fn();
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          revealedRecoveryCode="abcd1234abcd1234abcd1234abcd1234"
          onAcknowledgeRecoveryCode={onAcknowledgeRecoveryCode}
        />
      </AppPreferencesTestProvider>,
    );

    const valueNode = screen.getByTestId("account-security-recovery-code-value");
    expect(valueNode.props.children).toBe(
      "abcd1234abcd1234abcd1234abcd1234",
    );
    expect(valueNode.props.selectable).toBe(true);

    fireEvent.press(
      screen.getByTestId("account-security-recovery-code-confirm"),
    );
    expect(onAcknowledgeRecoveryCode).toHaveBeenCalledTimes(1);
  });

  it("maps regenerate invalid_current_password to the localized error", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          regenerateErrorCode="invalid_current_password"
        />
      </AppPreferencesTestProvider>,
    );

    // Both change-password and regenerate carry the same code; we expect at
    // least one rendered banner with this copy.
    expect(
      screen.getAllByText(copy.errors.invalidCurrentPassword).length,
    ).toBeGreaterThan(0);
  });
});
