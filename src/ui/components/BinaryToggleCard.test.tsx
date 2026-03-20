import { render, screen, waitFor } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { createDefaultProfileRecord } from "../../models/profile";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { AppPreferencesProvider } from "../providers/AppPreferencesProvider";
import { darkColors } from "../theme/tokens";
import { BinaryToggleCard } from "./BinaryToggleCard";

describe("BinaryToggleCard", () => {
  it("uses dark-theme active colors instead of the light washed-out shell", async () => {
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue({
        ...createDefaultProfileRecord(),
        themeOverride: "dark",
      }),
    });

    render(
      <AppPreferencesProvider storage={storage}>
        <BinaryToggleCard
          description="Visible in new entries."
          label="Show BBT field"
          onValueChange={() => {}}
          stateText="Visible in dashboard"
          testID="binary-toggle-card"
          value
        />
      </AppPreferencesProvider>,
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
