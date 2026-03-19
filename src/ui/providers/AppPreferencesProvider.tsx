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
  ThemePreference,
} from "../../models/profile";
import { appStorage } from "../../services/app-bootstrap-service";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import {
  resolveCopyLanguage,
  resolveDeviceLanguage,
} from "../../i18n/runtime";
import { darkColors, lightColors, type AppThemeColors } from "../theme/tokens";

type PreferenceOverrides = Pick<
  ProfileRecord,
  "languageOverride" | "themeOverride"
>;

type AppPreferencesContextValue = {
  colors: AppThemeColors;
  isReady: boolean;
  language: InterfaceLanguage;
  languageOverride: InterfaceLanguage | null;
  refreshPreferences: () => Promise<void>;
  syncProfilePreferences: (profile: PreferenceOverrides) => void;
  theme: ThemePreference;
  themeOverride: ThemePreference | null;
};

const defaultPreferencesContext: AppPreferencesContextValue = {
  colors: lightColors,
  isReady: false,
  language: resolveDeviceLanguage(),
  languageOverride: null,
  refreshPreferences: async () => {},
  syncProfilePreferences: () => {},
  theme: "light",
  themeOverride: null,
};

const AppPreferencesContext = createContext<AppPreferencesContextValue>(
  defaultPreferencesContext,
);

type AppPreferencesProviderProps = PropsWithChildren<{
  storage?: LocalAppStorage;
}>;

export function AppPreferencesProvider({
  children,
  storage = appStorage,
}: AppPreferencesProviderProps) {
  const systemScheme = useColorScheme();
  const [overrides, setOverrides] = useState<PreferenceOverrides>({
    languageOverride: null,
    themeOverride: null,
  });
  const [isReady, setIsReady] = useState(false);

  const refreshPreferences = useCallback(async () => {
    try {
      const profile = await storage.readProfileRecord();
      setOverrides({
        languageOverride: profile.languageOverride,
        themeOverride: profile.themeOverride,
      });
    } catch {
      setOverrides({
        languageOverride: null,
        themeOverride: null,
      });
    } finally {
      setIsReady(true);
    }
  }, [storage]);

  useEffect(() => {
    void refreshPreferences();
  }, [refreshPreferences]);

  const value = useMemo<AppPreferencesContextValue>(() => {
    const language =
      resolveCopyLanguage(overrides.languageOverride) ?? resolveDeviceLanguage();
    const theme: ThemePreference =
      overrides.themeOverride ??
      (systemScheme === "dark" ? "dark" : "light");

    return {
      colors: theme === "dark" ? darkColors : lightColors,
      isReady,
      language,
      languageOverride: overrides.languageOverride,
      refreshPreferences,
      syncProfilePreferences: (profile) => {
        setOverrides({
          languageOverride: profile.languageOverride,
          themeOverride: profile.themeOverride,
        });
      },
      theme,
      themeOverride: overrides.themeOverride,
    };
  }, [
    isReady,
    overrides.languageOverride,
    overrides.themeOverride,
    refreshPreferences,
    systemScheme,
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
