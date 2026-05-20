import { fireEvent, render, screen } from "@testing-library/react-native";

import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { PremiumLockCard } from "./PremiumLockCard";

describe("PremiumLockCard", () => {
  it("renders the eyebrow, title, description and CTA", () => {
    render(
      <AppPreferencesTestProvider>
        <PremiumLockCard
          ctaLabel="Open Ovumcy Cloud"
          description="Track LH tests, BBT thermal shifts and more."
          eyebrowLabel="Premium"
          onPress={() => {}}
          testID="lock"
          title="Advanced fertility"
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.getByTestId("lock-eyebrow").props.children).toBe("Premium");
    expect(screen.getByTestId("lock-title").props.children).toBe(
      "Advanced fertility",
    );
    expect(screen.getByTestId("lock-description").props.children).toBe(
      "Track LH tests, BBT thermal shifts and more.",
    );
    expect(screen.getByTestId("lock-cta").props.children).toBe(
      "Open Ovumcy Cloud",
    );
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    render(
      <AppPreferencesTestProvider>
        <PremiumLockCard
          ctaLabel="Open"
          description="d"
          eyebrowLabel="Premium"
          onPress={onPress}
          testID="lock"
          title="t"
        />
      </AppPreferencesTestProvider>,
    );

    fireEvent.press(screen.getByTestId("lock"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
