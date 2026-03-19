import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { getShellCopy } from "../../i18n/shell-copy";
import { appStorage } from "../../services/app-bootstrap-service";
import {
  loadStatsScreenState,
  type LoadedStatsState,
} from "../../services/stats-view-service";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import { StatsOverviewScreen } from "./StatsOverviewScreen";

type StatsScreenProps = {
  storage?: LocalAppStorage;
  now?: Date;
};

export function StatsScreen({
  storage = appStorage,
  now,
}: StatsScreenProps) {
  const { colors, language } = useAppPreferences();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [state, setState] = useState<LoadedStatsState | null>(null);
  const shellCopy = getShellCopy(language);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      void loadStatsScreenState(storage, effectiveNow, language).then((loadedState) => {
        if (!isMounted) {
          return;
        }

        setState(loadedState);
        setIsLoading(false);
      });

      return () => {
        isMounted = false;
      };
    }, [effectiveNow, language, storage]),
  );

  if (isLoading || !state) {
    return (
      <ScreenScaffold
        eyebrow={shellCopy.tabs.stats}
        title={shellCopy.loading.statsTitle}
        description={shellCopy.loading.statsDescription}
      >
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  return <StatsOverviewScreen viewData={state.viewData} />;
}
