import { fireEvent, render, screen } from "@testing-library/react-native";

import { selectAccountSecurityCopy } from "../../../i18n/account-security-copy";
import { selectTOTPCopy } from "../../../i18n/totp-copy";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { SyncAccountSecuritySection } from "./SyncAccountSecuritySection";

const copy = selectAccountSecurityCopy("en");
const totpCopy = selectTOTPCopy("en");

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
    forgotSignedOut: false,
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

    totpCopy,
    twoFactorEnabled: null,
    totpMode: "enable" as const,
    onTOTPModeChange: noop,
    totpStage: "idle" as const,
    totpEnrollPassword: "",
    onTOTPEnrollPasswordChange: noop,
    totpEnrollment: null,
    totpVerifyCode: "",
    onTOTPVerifyCodeChange: noop,
    totpDisablePassword: "",
    onTOTPDisablePasswordChange: noop,
    totpDisableCode: "",
    onTOTPDisableCodeChange: noop,
    totpStatus: "idle" as const,
    totpErrorCode: null,
    onStartTOTPEnrollment: noop,
    onVerifyTOTPEnrollment: noop,
    onDisableTOTP: noop,
    onCancelTOTPEnrollment: noop,
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

  it("maps the client-side password_too_short code on change and reset flows", () => {
    const { rerender } = render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          changeErrorCode="password_too_short"
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByTestId("account-security-change-error-banner"),
    ).toBeTruthy();
    expect(screen.getByText(copy.errors.passwordTooShort)).toBeTruthy();

    rerender(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          forgotStage="new_password"
          forgotErrorCode="password_too_short"
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByTestId("account-security-forgot-error-banner"),
    ).toBeTruthy();
    expect(screen.getByText(copy.errors.passwordTooShort)).toBeTruthy();
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

  it("shows the success banner once TOTP enrollment completes", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          totpMode="enable"
          totpStage="completed"
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByTestId("account-security-totp-success-banner"),
    ).toBeTruthy();
    expect(screen.getByText(totpCopy.enroll.successMessage)).toBeTruthy();
  });

  it("shows the success banner once TOTP is disabled", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          totpMode="disable"
          totpStage="completed"
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByTestId("account-security-totp-success-banner"),
    ).toBeTruthy();
    expect(screen.getByText(totpCopy.disable.successMessage)).toBeTruthy();
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

  // FIX 7.1
  it("surfaces the signed-out notice after a reset when forgotSignedOut is set", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          forgotStage="completed"
          forgotSignedOut={true}
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByTestId("account-security-forgot-signed-out-banner"),
    ).toBeTruthy();
    expect(
      screen.getByText(copy.forgotPassword.signedOutMessage),
    ).toBeTruthy();
  });

  it("hides the signed-out notice when forgotSignedOut is false", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          forgotStage="completed"
          forgotSignedOut={false}
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.queryByTestId("account-security-forgot-signed-out-banner"),
    ).toBeNull();
  });

  // FIX 7.2
  it("shows the distinct rate-limited message and disables submit when a flow is rate-limited", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          changeErrorCode="rate_limited"
        />
      </AppPreferencesTestProvider>,
    );

    // Distinct wait copy, not the terse rateLimited string.
    expect(screen.getByText(copy.errors.rateLimitedRetry)).toBeTruthy();
    // Submit affordance is transiently disabled.
    expect(
      screen.getByTestId("account-security-change-submit").props
        .accessibilityState?.disabled,
    ).toBe(true);
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

  it("renders the TOTP enable form by default and dispatches start enrollment", () => {
    const onStartTOTPEnrollment = jest.fn();
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          onStartTOTPEnrollment={onStartTOTPEnrollment}
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("account-security-totp-tab-enable")).toBeTruthy();
    expect(screen.getByTestId("account-security-totp-enroll-password")).toBeTruthy();
    fireEvent.press(screen.getByTestId("account-security-totp-enroll-submit"));
    expect(onStartTOTPEnrollment).toHaveBeenCalledTimes(1);
  });

  it("surfaces the freshly generated TOTP secret in the enrolling stage", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          totpStage="enrolling"
          totpEnrollment={{
            secretBase32: "JBSWY3DPEHPK3PXP",
            provisioningURI:
              "otpauth://totp/Ovumcy:owner@example.com?secret=JBSWY3DPEHPK3PXP",
          }}
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByTestId("account-security-totp-secret-value").props.children,
    ).toBe("JBSWY3DPEHPK3PXP");
    expect(
      screen.getByTestId("account-security-totp-provisioning-uri").props
        .children,
    ).toBe("otpauth://totp/Ovumcy:owner@example.com?secret=JBSWY3DPEHPK3PXP");
    expect(screen.getByTestId("account-security-totp-verify-submit")).toBeTruthy();
  });

  it("renders the disable form when the disable tab is active", () => {
    const onDisableTOTP = jest.fn();
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          totpMode="disable"
          onDisableTOTP={onDisableTOTP}
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByTestId("account-security-totp-disable-password"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("account-security-totp-disable-code"),
    ).toBeTruthy();
    fireEvent.press(
      screen.getByTestId("account-security-totp-disable-submit"),
    );
    expect(onDisableTOTP).toHaveBeenCalledTimes(1);
  });

  it("maps totp_invalid_code to the localized banner copy", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection
          {...baseProps()}
          totpStage="enrolling"
          totpEnrollment={{
            secretBase32: "JBSWY3DPEHPK3PXP",
            provisioningURI: "otpauth://totp/Ovumcy:o@e.com?secret=JBSWY3DPEHPK3PXP",
          }}
          totpErrorCode="totp_invalid_code"
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByText(totpCopy.errors.totpInvalidCode),
    ).toBeTruthy();
  });

  it("shows the enabled 2FA status banner", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection {...baseProps()} twoFactorEnabled={true} />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByTestId("account-security-totp-current-status"),
    ).toBeTruthy();
    expect(screen.getByText(totpCopy.section.statusEnabled)).toBeTruthy();
  });

  it("shows the disabled 2FA status banner", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection {...baseProps()} twoFactorEnabled={false} />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByText(totpCopy.section.statusDisabled)).toBeTruthy();
  });

  it("hides the 2FA status banner when the state is unknown", () => {
    render(
      <AppPreferencesTestProvider>
        <SyncAccountSecuritySection {...baseProps()} twoFactorEnabled={null} />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.queryByTestId("account-security-totp-current-status"),
    ).toBeNull();
  });
});
