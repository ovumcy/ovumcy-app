import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

import type {
  InterfaceLanguage,
  ProfileRecord,
  ResolvedTheme,
  ThemePreference,
} from "../../models/profile";
import {
  DEFAULT_RESOLVED_THEME,
  resolveScreenCaptureProtectionEnabled,
} from "../../models/profile";
import { appStorage } from "../../services/app-bootstrap-service";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import {
  resolveCopyLanguage,
  resolveDeviceLanguage,
} from "../../i18n/runtime";
import { darkColors, lightColors, type AppThemeColors } from "../theme/tokens";

// Collapse the stored tri-state preference to the theme the UI actually
// renders. "system" defers to the live OS color scheme (`useColorScheme`),
// falling back to the default when the OS reports null (unknown). "light"/
// "dark" pin the theme; a legacy `null` also lands on the default. This is the
// single place "system" is turned into a concrete palette.
function resolveTheme(
  themeOverride: ThemePreference | null,
  systemColorScheme: ResolvedTheme | null,
): ResolvedTheme {
  if (themeOverride === "system") {
    return systemColorScheme ?? DEFAULT_RESOLVED_THEME;
  }

  if (themeOverride === "dark") {
    return "dark";
  }

  return DEFAULT_RESOLVED_THEME;
}

type PreferenceOverrides = Pick<
  ProfileRecord,
  "languageOverride" | "themeOverride"
> & {
  screenCaptureProtectionEnabled: boolean;
};

type AppPreferencesContextValue = {
  clearPreferencePreview: () => void;
  colors: AppThemeColors;
  isReady: boolean;
  language: InterfaceLanguage;
  languageOverride: InterfaceLanguage | null;
  previewProfilePreferences: (profile: PreferenceOverrides) => void;
  refreshPreferences: () => Promise<void>;
  screenCaptureProtectionEnabled: boolean;
  syncProfilePreferences: (profile: PreferenceOverrides) => void;
  // The resolved theme the UI renders — always "light" or "dark", never
  // "system" (that stored value is collapsed via the live OS color scheme).
  theme: ResolvedTheme;
  themeOverride: ThemePreference | null;
};

type StaticAppPreferencesOverrides = {
  isReady?: boolean;
  languageOverride?: InterfaceLanguage | null;
  screenCaptureProtectionEnabled?: boolean;
  themeOverride?: ThemePreference | null;
  // Simulate the OS color scheme for the static (test) provider so a
  // themeOverride of "system" can resolve deterministically without the live
  // useColorScheme subscription. Defaults to null (OS unknown) → light.
  systemColorScheme?: ResolvedTheme | null;
};

export function createAppPreferencesContextValue(
  overrides: StaticAppPreferencesOverrides = {},
): AppPreferencesContextValue {
  const languageOverride = overrides.languageOverride ?? null;
  const themeOverride = overrides.themeOverride ?? null;
  const theme = resolveTheme(themeOverride, overrides.systemColorScheme ?? null);

  return {
    clearPreferencePreview: () => {},
    colors: theme === "dark" ? darkColors : lightColors,
    isReady: overrides.isReady ?? true,
    language: resolveCopyLanguage(languageOverride) ?? resolveDeviceLanguage(),
    languageOverride,
    previewProfilePreferences: () => {},
    refreshPreferences: async () => {},
    screenCaptureProtectionEnabled: resolveScreenCaptureProtectionEnabled(
      overrides.screenCaptureProtectionEnabled,
    ),
    syncProfilePreferences: () => {},
    theme,
    themeOverride,
  };
}

const defaultPreferencesContext = createAppPreferencesContextValue({
  isReady: false,
});

const AppPreferencesContext = createContext<AppPreferencesContextValue>(
  defaultPreferencesContext,
);

export function AppPreferencesContextProvider({
  children,
  value,
}: PropsWithChildren<{ value: AppPreferencesContextValue }>) {
  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

type AppPreferencesProviderProps = PropsWithChildren<{
  storage?: LocalAppStorage;
}>;

export function AppPreferencesProvider({
  children,
  storage = appStorage,
}: AppPreferencesProviderProps) {
  const [persistedOverrides, setPersistedOverrides] = useState<PreferenceOverrides>({
    languageOverride: null,
    themeOverride: null,
    screenCaptureProtectionEnabled: true,
  });
  const [previewOverrides, setPreviewOverrides] = useState<PreferenceOverrides | null>(
    null,
  );
  const [isReady, setIsReady] = useState(false);
  // Live OS color scheme. useColorScheme subscribes to Appearance change
  // events on native and to the prefers-color-scheme media query on
  // react-native-web, so a mid-session OS theme switch re-renders here and,
  // when the preference is "system", flips the resolved theme immediately.
  // React Native manages the listener lifecycle (add on mount, remove on
  // unmount) inside the hook, so there is nothing to clean up here.
  const rawColorScheme = useColorScheme();
  const systemColorScheme: ResolvedTheme | null =
    rawColorScheme === "dark" ? "dark" : rawColorScheme === "light" ? "light" : null;

  const refreshPreferences = useCallback(async () => {
    try {
      const profile = await storage.readProfileRecord();
      setPersistedOverrides({
        languageOverride: profile.languageOverride,
        themeOverride: profile.themeOverride,
        screenCaptureProtectionEnabled: resolveScreenCaptureProtectionEnabled(
          profile.screenCaptureProtectionEnabled,
        ),
      });
      setPreviewOverrides(null);
    } catch {
      setPersistedOverrides({
        languageOverride: null,
        themeOverride: null,
        screenCaptureProtectionEnabled: true,
      });
      setPreviewOverrides(null);
    } finally {
      setIsReady(true);
    }
  }, [storage]);

  useEffect(() => {
    void refreshPreferences();
  }, [refreshPreferences]);

  const value = useMemo<AppPreferencesContextValue>(() => {
    const effectiveOverrides = previewOverrides ?? persistedOverrides;
    const language =
      resolveCopyLanguage(effectiveOverrides.languageOverride) ?? resolveDeviceLanguage();
    const theme = resolveTheme(
      effectiveOverrides.themeOverride,
      systemColorScheme,
    );

    return {
      clearPreferencePreview: () => {
        setPreviewOverrides(null);
      },
      colors: theme === "dark" ? darkColors : lightColors,
      isReady,
      language,
      languageOverride: effectiveOverrides.languageOverride,
      previewProfilePreferences: (profile) => {
        setPreviewOverrides({
          languageOverride: profile.languageOverride,
          themeOverride: profile.themeOverride,
          screenCaptureProtectionEnabled: resolveScreenCaptureProtectionEnabled(
            profile.screenCaptureProtectionEnabled,
          ),
        });
      },
      refreshPreferences,
      screenCaptureProtectionEnabled:
        effectiveOverrides.screenCaptureProtectionEnabled,
      syncProfilePreferences: (profile) => {
        setPersistedOverrides({
          languageOverride: profile.languageOverride,
          themeOverride: profile.themeOverride,
          screenCaptureProtectionEnabled: resolveScreenCaptureProtectionEnabled(
            profile.screenCaptureProtectionEnabled,
          ),
        });
        setPreviewOverrides(null);
      },
      theme,
      themeOverride: effectiveOverrides.themeOverride,
    };
  }, [
    persistedOverrides,
    isReady,
    previewOverrides,
    refreshPreferences,
    systemColorScheme,
  ]);

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  return useContext(AppPreferencesContext);
}
