import { render, screen } from "@testing-library/react-native";
import { Dimensions, Text } from "react-native";

import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { ScreenScaffold } from "./ScreenScaffold";

describe("ScreenScaffold", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("exposes the screen title as a header so a screen reader can identify the screen", () => {
    render(
      <AppPreferencesTestProvider>
        <ScreenScaffold
          description="Preparing your local month view."
          title="Loading calendar"
        >
          <Text>Body</Text>
        </ScreenScaffold>
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByRole("header", { name: "Loading calendar" }),
    ).toBeTruthy();
  });

  it("renders the eyebrow without turning it into a second header", () => {
    render(
      <AppPreferencesTestProvider>
        <ScreenScaffold
          description="Preparing your local history summary."
          eyebrow="Insights"
          title="Loading insights"
        >
          <Text>Body</Text>
        </ScreenScaffold>
      </AppPreferencesTestProvider>,
    );

    expect(screen.getAllByRole("header")).toHaveLength(1);
    expect(screen.getByText("Insights")).toBeTruthy();
  });

  it("keeps the header on the wide layout, where the compact type scale is dropped", () => {
    jest.spyOn(Dimensions, "get").mockReturnValue({
      fontScale: 1,
      height: 900,
      scale: 2,
      width: 1024,
    });

    render(
      <AppPreferencesTestProvider>
        <ScreenScaffold description="Subtitle" title="Backup & sync">
          <Text>Body</Text>
        </ScreenScaffold>
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByRole("header", { name: "Backup & sync" })).toBeTruthy();
  });
});
