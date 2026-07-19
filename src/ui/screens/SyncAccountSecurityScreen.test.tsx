import { fireEvent, render, screen } from "@testing-library/react-native";

import { selectAccountSecurityCopy } from "../../i18n/account-security-copy";
import { selectTOTPCopy } from "../../i18n/totp-copy";
import { createSyncSecretsRecord } from "../../security/sync-crypto";
import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../../test/create-sync-secret-store-mock";
import * as syncAccountSessionService from "../../sync/sync-account-session-service";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "../../sync/sync-contract";
import { SyncAccountSecurityScreen } from "./SyncAccountSecurityScreen";

const copy = selectAccountSecurityCopy("en");
const totpCopy = selectTOTPCopy("en");

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    canGoBack: mockCanGoBack,
    replace: mockReplace,
  }),
}));

function connectedSecrets() {
  const { record } = createSyncSecretsRecord(
    "Pixel 7",
    new Date("2026-05-17T08:00:00.000Z"),
  );
  return {
    ...record,
    authSessionToken: "community-session-1",
    managedAuthSessionToken: "managed-session-1",
  };
}

function managedPreferences(): SyncPreferencesRecord {
  return {
    ...createDefaultSyncPreferencesRecord(),
    mode: "managed",
    deviceLabel: "Pixel 7",
    setupStatus: "connected",
  };
}

function renderScreen() {
  const storage = createLocalAppStorageMock({
    readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
  });
  const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
  return render(
    <AppPreferencesTestProvider languageOverride="en">
      <SyncAccountSecurityScreen storage={storage} syncSecretStore={syncSecretStore} />
    </AppPreferencesTestProvider>,
  );
}

describe("SyncAccountSecurityScreen", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReset();
    jest
      .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
      .mockResolvedValue(null);
  });

  it("shows a loading state before the security section has hydrated", async () => {
    renderScreen();

    // Title/description render in both the loading and loaded branches; the
    // back button and the section content only appear once loaded, so their
    // absence here is the loading-state signal.
    expect(screen.getByText(copy.title)).toBeTruthy();
    expect(screen.getByText(copy.subtitle)).toBeTruthy();
    expect(
      screen.queryByTestId("sync-account-security-back-button"),
    ).toBeNull();
    expect(screen.queryByTestId("account-security-change-submit")).toBeNull();

    await screen.findByTestId("account-security-change-submit");
  });

  it("renders the back button and the account security section once loaded", async () => {
    renderScreen();

    await screen.findByTestId("account-security-change-submit");

    expect(
      screen.getByTestId("sync-account-security-back-button"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("account-security-change-current-password").props
        .accessibilityLabel,
    ).toBe(copy.changePassword.currentPasswordLabel);
    expect(screen.getByText(totpCopy.section.title)).toBeTruthy();
  });

  it("goes back via router.back() when there is history to go back to", async () => {
    mockCanGoBack.mockReturnValue(true);
    renderScreen();
    await screen.findByTestId("sync-account-security-back-button");

    fireEvent.press(screen.getByTestId("sync-account-security-back-button"));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("replaces to /backup-sync when there is no history to go back to", async () => {
    mockCanGoBack.mockReturnValue(false);
    renderScreen();
    await screen.findByTestId("sync-account-security-back-button");

    fireEvent.press(screen.getByTestId("sync-account-security-back-button"));

    expect(mockReplace).toHaveBeenCalledWith("/backup-sync");
    expect(mockBack).not.toHaveBeenCalled();
  });
});
