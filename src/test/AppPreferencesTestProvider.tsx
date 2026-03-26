import type { PropsWithChildren } from "react";

import type {
  InterfaceLanguage,
  ThemePreference,
} from "../models/profile";
import {
  AppPreferencesContextProvider,
  createAppPreferencesContextValue,
} from "../ui/providers/AppPreferencesProvider";

type AppPreferencesTestProviderProps = PropsWithChildren<{
  isReady?: boolean;
  languageOverride?: InterfaceLanguage | null;
  screenCaptureProtectionEnabled?: boolean;
  themeOverride?: ThemePreference | null;
}>;

export function AppPreferencesTestProvider({
  children,
  ...overrides
}: AppPreferencesTestProviderProps) {
  return (
    <AppPreferencesContextProvider
      value={createAppPreferencesContextValue(overrides)}
    >
      {children}
    </AppPreferencesContextProvider>
  );
}
