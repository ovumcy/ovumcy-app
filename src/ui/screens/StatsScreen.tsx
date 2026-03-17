import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { appStorage } from "../../services/app-bootstrap-service";
import {
  loadStatsScreenState,
  type LoadedStatsState,
} from "../../services/stats-view-service";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { colors } from "../theme/tokens";
import { StatsOverviewScreen } from "./StatsOverviewScreen";

type StatsScreenProps = {
  storage?: LocalAppStorage;
  now?: Date;
};

export function StatsScreen({
  storage = appStorage,
  now,
}: StatsScreenProps) {
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [state, setState] = useState<LoadedStatsState | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      void loadStatsScreenState(storage, effectiveNow).then((loadedState) => {
        if (!isMounted) {
          return;
        }

        setState(loadedState);
        setIsLoading(false);
      });

      return () => {
        isMounted = false;
      };
    }, [effectiveNow, storage]),
  );

  if (isLoading || !state) {
    return (
      <ScreenScaffold
        eyebrow="Insights"
        title="Loading insights"
        description="Preparing your local history summary."
      >
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  return <StatsOverviewScreen viewData={state.viewData} />;
}
