import { fireEvent, render, screen } from "@testing-library/react-native";

import { selectAboutCopy } from "../../i18n/about-copy";
import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { AboutScreen } from "./AboutScreen";

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

async function renderScreen(props: { appVersion?: string | null } = {}) {
  await render(
    <AppPreferencesTestProvider languageOverride="en">
      <AboutScreen {...props} />
    </AppPreferencesTestProvider>,
  );
}

describe("AboutScreen", () => {
  beforeEach(() => {
    mockBack.mockReset();
    mockReplace.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
  });

  it("shows the version, licence, font notice and the font licence text", async () => {
    await renderScreen({ appVersion: "1.0.0" });

    expect(screen.getByText(selectAboutCopy("en").title)).toBeTruthy();
    expect(screen.getByTestId("about-version-value")).toHaveTextContent("Ovumcy 1.0.0");
    expect(screen.getByTestId("about-section-license")).toBeTruthy();
    expect(screen.getByTestId("about-section-fonts")).toBeTruthy();
    expect(screen.getByTestId("about-section-components")).toBeTruthy();
    expect(screen.getByTestId("about-font-license")).toHaveTextContent(
      /Bitstream Vera Fonts Copyright/,
    );
  });

  it("reads the version from the app config by default", async () => {
    await renderScreen();

    expect(screen.getByTestId("about-version-value")).toBeTruthy();
  });

  it("goes back when there is history", async () => {
    await renderScreen({ appVersion: null });

    await fireEvent.press(screen.getByTestId("about-back-button"));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("returns home when opened without history", async () => {
    mockCanGoBack.mockReturnValue(false);
    await renderScreen({ appVersion: null });

    await fireEvent.press(screen.getByTestId("about-back-button"));

    expect(mockReplace).toHaveBeenCalledWith("/");
    expect(mockBack).not.toHaveBeenCalled();
  });
});
