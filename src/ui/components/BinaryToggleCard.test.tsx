import { render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { darkColors } from "../theme/tokens";
import { BinaryToggleCard } from "./BinaryToggleCard";

describe("BinaryToggleCard", () => {
  it("uses dark-theme active colors instead of the light washed-out shell", async () => {
    render(
      <AppPreferencesTestProvider themeOverride="dark">
        <BinaryToggleCard
          description="Visible in new entries."
          label="Show BBT field"
          onValueChange={() => {}}
          stateText="Visible in dashboard"
          testID="binary-toggle-card"
          value
        />
      </AppPreferencesTestProvider>,
    );

    const shell = await screen.findByTestId("binary-toggle-card");

    await waitFor(() => {
      const shellStyle = StyleSheet.flatten(shell.props.style);
      const badgeStyle = StyleSheet.flatten(
        screen.getByText("Visible in dashboard").props.style,
      );

      expect(shellStyle.backgroundColor).toBe(darkColors.toggleCardActiveBg);
      expect(shellStyle.borderColor).toBe(darkColors.toggleCardActiveBorder);
      expect(badgeStyle.backgroundColor).toBe(darkColors.toggleCardBadgeBg);
      expect(badgeStyle.color).toBe(darkColors.toggleCardBadgeText);
    });
  });
});
