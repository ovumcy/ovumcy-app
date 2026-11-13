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

function LanguageProbe() {
  const { isReady, language } = useAppPreferences();

  return <Text testID="app-language-probe">{isReady ? language : "loading"}</Text>;
}

function mockDeviceLocale(locale: string) {
  jest
    .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockReturnValue({ locale } as Intl.ResolvedDateTimeFormatOptions);
}

async function renderLanguageProbe(languageOverride: ProfileRecord["languageOverride"]) {
  const storage = createLocalAppStorageMock({
    readProfileRecord: jest.fn().mockResolvedValue({
      ...createProfileWithTheme(null),
      languageOverride,
    }),
  });

  await render(
    <AppPreferencesProvider storage={storage}>
      <LanguageProbe />
    </AppPreferencesProvider>,
  );

  await waitFor(() =>
    expect(screen.getByTestId("app-language-probe").props.children).not.toBe("loading"),
  );

  return screen.getByTestId("app-language-probe").props.children;
}

describe("AppPreferencesProvider", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("follows the device language when no language override is stored", async () => {
    mockDeviceLocale("ru-RU");

    expect(await renderLanguageProbe(null)).toBe("ru");
  });

  it("keeps an explicit language override over the device language", async () => {
    mockDeviceLocale("ru-RU");

    expect(await renderLanguageProbe("en")).toBe("en");
  });

  it("falls back to English when the device language is unsupported", async () => {
    mockDeviceLocale("ja-JP");

    expect(await renderLanguageProbe(null)).toBe("en");
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

    await render(
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

    await render(
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

    await render(
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

    await render(
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

    const { rerender } = await render(
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
      await rerender(
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

    await render(
      <AppPreferencesProvider storage={storage}>
        <ThemeProbe />
      </AppPreferencesProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("app-theme-probe").props.children).toBe("light"),
    );
  });
});
