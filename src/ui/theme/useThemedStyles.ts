import { useMemo } from "react";

import { useAppPreferences } from "../providers/AppPreferencesProvider";
import type { AppThemeColors } from "./tokens";

export function useThemedStyles<T>(build: (colors: AppThemeColors) => T): T {
  const { colors } = useAppPreferences();

  return useMemo(() => build(colors), [build, colors]);
}

export function useAppTheme() {
  return useAppPreferences();
}
