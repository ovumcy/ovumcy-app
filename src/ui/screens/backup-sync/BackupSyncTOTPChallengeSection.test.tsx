import { fireEvent, render, screen } from "@testing-library/react-native";

import { selectTOTPCopy } from "../../../i18n/totp-copy";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { BackupSyncTOTPChallengeSection } from "./BackupSyncTOTPChallengeSection";

const copy = selectTOTPCopy("en");

function noop() {}

describe("BackupSyncTOTPChallengeSection", () => {
  it("renders the challenge title, code field, and action buttons", () => {
    render(
      <AppPreferencesTestProvider>
        <BackupSyncTOTPChallengeSection
          challengeExpiresAt="2026-05-17T10:05:00.000Z"
          code=""
          copy={copy}
          errorMessage=""
          onCancel={noop}
          onCodeChange={noop}
          onSubmit={noop}
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByText(copy.challenge.title)).toBeTruthy();
    expect(screen.getByTestId("backup-sync-totp-challenge-code")).toBeTruthy();
    expect(
      screen.getByTestId("backup-sync-totp-challenge-code").props
        .accessibilityLabel,
    ).toBe(copy.challenge.codeLabel);
    expect(screen.getByTestId("backup-sync-totp-challenge-submit")).toBeTruthy();
    expect(screen.getByTestId("backup-sync-totp-challenge-cancel")).toBeTruthy();
    expect(
      screen.queryByTestId("backup-sync-totp-challenge-error"),
    ).toBeNull();
  });

  it("propagates code changes and submit/cancel handlers", () => {
    const onCodeChange = jest.fn();
    const onSubmit = jest.fn();
    const onCancel = jest.fn();

    render(
      <AppPreferencesTestProvider>
        <BackupSyncTOTPChallengeSection
          challengeExpiresAt="2026-05-17T10:05:00.000Z"
          code="123"
          copy={copy}
          errorMessage=""
          onCancel={onCancel}
          onCodeChange={onCodeChange}
          onSubmit={onSubmit}
        />
      </AppPreferencesTestProvider>,
    );

    fireEvent.changeText(
      screen.getByTestId("backup-sync-totp-challenge-code"),
      "123456",
    );
    fireEvent.press(screen.getByTestId("backup-sync-totp-challenge-submit"));
    fireEvent.press(screen.getByTestId("backup-sync-totp-challenge-cancel"));

    expect(onCodeChange).toHaveBeenCalledWith("123456");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renders the localized error banner when an errorMessage is provided", () => {
    render(
      <AppPreferencesTestProvider>
        <BackupSyncTOTPChallengeSection
          challengeExpiresAt="2026-05-17T10:05:00.000Z"
          code=""
          copy={copy}
          errorMessage={copy.errors.totpInvalidCode}
          onCancel={noop}
          onCodeChange={noop}
          onSubmit={noop}
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByText(copy.errors.totpInvalidCode)).toBeTruthy();
  });
});
