import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import * as ReactNative from "react-native";

import type { ProfileRecord, ThemePreference } from "../../models/profile";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import {
  AppPreferencesProvider,
  useAppPreferences,
} from "./AppPreferencesProvider";

function ThemeProbe() {
  const { isReady, theme } = useAppPreferences();

  return <Text testID="app-theme-probe">{isReady ? theme : "loading"}</Text>;
}

function createProfileWithTheme(
  themeOverride: ThemePreference | null,
): ProfileRecord {
  return {
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
    themeOverride,
    screenCaptureProtectionEnabled: true,
  } as ProfileRecord;
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

  it("resolves the system preference to dark when the OS reports a dark scheme", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue(createProfileWithTheme("system")),
    });

    render(
      <AppPreferencesProvider storage={storage}>
        <ThemeProbe />
      </AppPreferencesProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("app-theme-probe").props.children).toBe("dark"),
    );
  });

  it("resolves the system preference to light when the OS reports a light scheme", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue(createProfileWithTheme("system")),
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

  it("falls back to light for the system preference when the OS reports null", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(null);
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue(createProfileWithTheme("system")),
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

  it("applies a live OS color-scheme change while the system preference is active", async () => {
    const useColorSchemeMock = jest
      .spyOn(ReactNative, "useColorScheme")
      .mockReturnValue("light");
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue(createProfileWithTheme("system")),
    });

    const { rerender } = render(
      <AppPreferencesProvider storage={storage}>
        <ThemeProbe />
      </AppPreferencesProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("app-theme-probe").props.children).toBe("light"),
    );

    // Simulate the OS flipping to dark: useColorScheme (Appearance on native,
    // matchMedia on web) re-renders with the new value and the resolved theme
    // must follow immediately without touching the stored preference.
    await act(async () => {
      useColorSchemeMock.mockReturnValue("dark");
      rerender(
        <AppPreferencesProvider storage={storage}>
          <ThemeProbe />
        </AppPreferencesProvider>,
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId("app-theme-probe").props.children).toBe("dark"),
    );
  });

  it("ignores the OS scheme when an explicit theme pins the palette", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    const storage = createLocalAppStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue(createProfileWithTheme("light")),
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
