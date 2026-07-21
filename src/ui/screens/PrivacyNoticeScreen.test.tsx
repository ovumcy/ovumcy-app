import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { selectPrivacyNoticeCopy } from "../../i18n/privacy-copy";
import { PRIVACY_POLICY_URL } from "../../services/privacy-notice-service";
import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { PrivacyNoticeScreen } from "./PrivacyNoticeScreen";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockCanGoBack = jest.fn();

const mockDefaultOpenPrivacyPolicy = jest.fn();

jest.mock("../../services/privacy-notice-service", () => ({
  ...jest.requireActual("../../services/privacy-notice-service"),
  openPrivacyPolicy: () => mockDefaultOpenPrivacyPolicy(),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
    canGoBack: mockCanGoBack,
    replace: mockReplace,
  }),
}));

const copy = selectPrivacyNoticeCopy("en");

function renderScreen(openPrivacyPolicy = jest.fn().mockResolvedValue(true)) {
  render(
    <AppPreferencesTestProvider languageOverride="en">
      <PrivacyNoticeScreen openPrivacyPolicy={openPrivacyPolicy} />
    </AppPreferencesTestProvider>,
  );

  return { openPrivacyPolicy };
}

describe("PrivacyNoticeScreen", () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
    mockDefaultOpenPrivacyPolicy.mockReset();
  });

  it("renders every notice section and the policy address", () => {
    renderScreen();

    expect(screen.getByText(copy.title)).toBeTruthy();
    expect(screen.getByTestId("privacy-notice-section-on-device")).toBeTruthy();
    expect(screen.getByTestId("privacy-notice-section-leaves-device")).toBeTruthy();
    expect(screen.getByTestId("privacy-notice-section-rights")).toBeTruthy();
    expect(screen.getByTestId("privacy-notice-section-retention")).toBeTruthy();
    expect(screen.getByTestId("privacy-notice-section-contact")).toBeTruthy();
    expect(screen.getByText(PRIVACY_POLICY_URL)).toBeTruthy();
    expect(screen.getByTestId("privacy-notice-revision")).toBeTruthy();
  });

  it("opens the hosted policy on request", async () => {
    const { openPrivacyPolicy } = renderScreen();

    fireEvent.press(screen.getByTestId("privacy-notice-open-policy-button"));

    await waitFor(() => {
      expect(openPrivacyPolicy).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId("privacy-notice-policy-link-error")).toBeNull();
  });

  it("keeps the address readable when the platform cannot open the link", async () => {
    renderScreen(jest.fn().mockResolvedValue(false));

    fireEvent.press(screen.getByTestId("privacy-notice-open-policy-button"));

    expect(
      await screen.findByTestId("privacy-notice-policy-link-error"),
    ).toBeTruthy();
    expect(screen.getByText(PRIVACY_POLICY_URL)).toBeTruthy();
  });

  it("returns to the previous screen", () => {
    renderScreen();

    fireEvent.press(screen.getByTestId("privacy-notice-back-button"));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("falls back to the app entry when there is nothing to go back to", () => {
    mockCanGoBack.mockReturnValue(false);
    renderScreen();

    fireEvent.press(screen.getByTestId("privacy-notice-back-button"));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
  it("falls back to the real policy opener when no override is injected", async () => {
    mockDefaultOpenPrivacyPolicy.mockResolvedValue(true);

    render(
      <AppPreferencesTestProvider languageOverride="en">
        <PrivacyNoticeScreen />
      </AppPreferencesTestProvider>,
    );

    fireEvent.press(screen.getByTestId("privacy-notice-open-policy-button"));

    // The injectable prop exists for tests; production renders the route with
    // no props at all, so the default has to be the wired-up opener.
    await waitFor(() => {
      expect(mockDefaultOpenPrivacyPolicy).toHaveBeenCalledTimes(1);
    });
  });
});

