import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  InterfaceLanguage,
  ProfileRecord,
  ThemePreference,
} from "../../models/profile";
import { resolveScreenCaptureProtectionEnabled } from "../../models/profile";
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
  theme: ThemePreference;
  themeOverride: ThemePreference | null;
};

const defaultPreferencesContext: AppPreferencesContextValue = {
  clearPreferencePreview: () => {},
  colors: lightColors,
  isReady: false,
  language: resolveDeviceLanguage(),
  languageOverride: null,
  previewProfilePreferences: () => {},
  refreshPreferences: async () => {},
  screenCaptureProtectionEnabled: true,
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
  const [persistedOverrides, setPersistedOverrides] = useState<PreferenceOverrides>({
    languageOverride: null,
    themeOverride: null,
    screenCaptureProtectionEnabled: true,
  });
  const [previewOverrides, setPreviewOverrides] = useState<PreferenceOverrides | null>(
    null,
  );
  const [isReady, setIsReady] = useState(false);

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
    const theme: ThemePreference =
      effectiveOverrides.themeOverride ?? "light";

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
