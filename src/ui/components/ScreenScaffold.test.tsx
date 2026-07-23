import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { ScreenScaffold } from "./ScreenScaffold";

describe("ScreenScaffold", () => {
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
});
