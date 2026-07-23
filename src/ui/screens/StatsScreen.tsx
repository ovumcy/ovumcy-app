import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { getShellCopy } from "../../i18n/shell-copy";
import { appStorage } from "../../services/app-bootstrap-service";
import { buildEntitlementTokenGate } from "../../services/entitlement-token-gate-service";
import { loadManagedPremiumFeatures } from "../../services/managed-premium-features-service";
import {
  loadStatsScreenState,
  type LoadedStatsState,
} from "../../services/stats-view-service";
import type { SyncSecretStore } from "../../security/sync-secret-store";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { syncSecretStore as defaultSyncSecretStore } from "../../sync/app-sync-service";
import { loadSyncSetupState } from "../../sync/sync-setup-service";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import { StatsOverviewScreen } from "./StatsOverviewScreen";

type StatsScreenProps = {
  storage?: LocalAppStorage;
  now?: Date;
  syncSecretStore?: SyncSecretStore;
};

export function StatsScreen({
  storage = appStorage,
  now,
  syncSecretStore = defaultSyncSecretStore,
}: StatsScreenProps) {
  const { colors, language } = useAppPreferences();
  const router = useRouter();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [state, setState] = useState<LoadedStatsState | null>(null);
  const shellCopy = getShellCopy(language);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      void (async () => {
        const syncState = await loadSyncSetupState(storage, syncSecretStore);
        const premiumFeatures =
          syncState.hasAuthSession && syncState.preferences.mode === "managed"
            ? await loadManagedPremiumFeatures(
                storage,
                syncSecretStore,
                syncState.preferences.mode,
                // Advanced insights are token-gated: a verified entitlement
                // token decides `advancedInsights`; absent/invalid, the billing
                // snapshot boolean stands unchanged.
                await buildEntitlementTokenGate(
                  syncSecretStore,
                  syncState.preferences.mode,
                  { nowSeconds: Math.floor(effectiveNow.getTime() / 1000) },
                ),
              )
            : {
                advancedFertility: false,
                advancedInsights: false,
                doctorPDF: false,
                extendedReports: false,
                partnerAccess: false,
                reminders: false,
              };
        const loadedState = await loadStatsScreenState(
          storage,
          effectiveNow,
          language,
          premiumFeatures,
        );
        if (!isMounted) {
          return;
        }

        setState(loadedState);
        setIsLoading(false);
      })();

      return () => {
        isMounted = false;
      };
    }, [effectiveNow, language, storage, syncSecretStore]),
  );

  if (isLoading || !state) {
    return (
      <ScreenScaffold
        eyebrow={shellCopy.tabs.stats}
        title={shellCopy.loading.statsTitle}
        description={shellCopy.loading.statsDescription}
      >
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator
            accessibilityLabel={shellCopy.loading.statsTitle}
            accessibilityRole="progressbar"
            color={colors.accent}
            size="large"
          />
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <StatsOverviewScreen
      onEmptyStateAction={(action) => {
        if (action === "open_logging") {
          router.push("/(tabs)/dashboard");
        }
      }}
      onPremiumCTAPress={() => {
        router.push("/backup-sync");
      }}
      viewData={state.viewData}
    />
  );
}
