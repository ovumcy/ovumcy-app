import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import * as ReactNative from "react-native";

import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import {
  AppPreferencesProvider,
  useAppPreferences,
} from "./AppPreferencesProvider";

function ThemeProbe() {
  const { isReady, theme } = useAppPreferences();

  return <Text testID="app-theme-probe">{isReady ? theme : "loading"}</Text>;
}

describe("AppPreferencesProvider", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("defaults null stored theme overrides to the explicit light theme contract", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue({
        lastPeriodStart: "2026-03-10",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
        trackBBT: false,
        temperatureUnit: "c",
        trackCervicalMucus: false,
        hideSexChip: false,
        languageOverride: "en",
        themeOverride: null,
        screenCaptureProtectionEnabled: true,
      }),
    });

    render(
      <AppPreferencesProvider storage={storage}>
        <ThemeProbe />
      </AppPreferencesProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("app-theme-probe").props.children).toBe("light"),
    );
  });
});
