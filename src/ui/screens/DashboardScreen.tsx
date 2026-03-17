import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { appStorage } from "../../services/app-bootstrap-service";
import {
  loadDashboardViewData,
  type DashboardViewData,
} from "../../services/dashboard-view-service";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { colors } from "../theme/tokens";
import { DashboardOverviewScreen } from "./DashboardOverviewScreen";

type DashboardScreenProps = {
  storage?: LocalAppStorage;
  now?: Date;
};

export function DashboardScreen({
  storage = appStorage,
  now,
}: DashboardScreenProps) {
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [viewData, setViewData] = useState<DashboardViewData | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      void loadDashboardViewData(storage, effectiveNow).then((loadedViewData) => {
        if (!isMounted) {
          return;
        }

        setViewData(loadedViewData);
        setIsLoading(false);
      });

      return () => {
        isMounted = false;
      };
    }, [effectiveNow, storage]),
  );

  if (isLoading || !viewData) {
    return (
      <ScreenScaffold
        eyebrow="Today"
        title="Loading dashboard"
        description="Preparing your local cycle context."
      >
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  return <DashboardOverviewScreen viewData={viewData} />;
}
