import { render, screen } from "@testing-library/react-native";

import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { FeatureCard } from "./FeatureCard";

describe("FeatureCard", () => {
  it("exposes its title as an accessibility header so screen readers can jump between sections", () => {
    render(
      <AppPreferencesTestProvider>
        <FeatureCard title="Cycle" testID="feature-card" />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByRole("header", { name: "Cycle" })).toBeTruthy();
  });

  it("adds no header role when the card carries only a description", () => {
    render(
      <AppPreferencesTestProvider>
        <FeatureCard description="A supporting line without a section title" />
      </AppPreferencesTestProvider>,
    );

    expect(screen.queryByRole("header")).toBeNull();
  });
});
