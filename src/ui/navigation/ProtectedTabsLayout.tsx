import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getShellCopy } from "../../i18n/shell-copy";
import {
  appStorage,
  readHasCompletedOnboarding,
} from "../../services/app-bootstrap-service";
import { refreshManagedPartnerSharedProjectionsOnAppActive } from "../../services/managed-partner-share-refresh-service";
import type { PartnerShareSecretStore } from "../../security/partner-share-secret-store";
import type { SyncSecretStore } from "../../security/sync-secret-store";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { partnerShareSecretStore as defaultPartnerShareSecretStore } from "../../sync/app-partner-share-service";
import { syncSecretStore as defaultSyncSecretStore } from "../../sync/app-sync-service";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import { GuardedTabBarButton } from "./GuardedTabBarButton";
import { TabLeaveGuardProvider } from "./TabLeaveGuardContext";

type ProtectedTabsLayoutProps = {
  managedPartnerShareRefresh?:
    | typeof refreshManagedPartnerSharedProjectionsOnAppActive
    | undefined;
  now?: Date | undefined;
  partnerShareSecretStore?: PartnerShareSecretStore | undefined;
  storage?: LocalAppStorage;
  syncSecretStore?: SyncSecretStore | undefined;
};

export function ProtectedTabsLayout({
  managedPartnerShareRefresh = refreshManagedPartnerSharedProjectionsOnAppActive,
  now,
  partnerShareSecretStore = defaultPartnerShareSecretStore,
  storage = appStorage,
  syncSecretStore = defaultSyncSecretStore,
}: ProtectedTabsLayoutProps) {
  const { colors, language } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<
    boolean | null
  >(null);
  const shellCopy = getShellCopy(language);
  const bottomInset = Platform.OS === "android"
    ? Math.max(insets.bottom, 10)
    : Math.max(insets.bottom, 8);
  const tabBarBottomPadding = Math.max(bottomInset, 10);
  const tabBarHeight = 56 + tabBarBottomPadding;
  const renderTabBarButton = (routeName: string) =>
    function renderGuardedTabBarButton(props: BottomTabBarButtonProps) {
      return <GuardedTabBarButton {...props} targetRouteName={routeName} />;
    };

  useEffect(() => {
    let isMounted = true;

    void readHasCompletedOnboarding(storage).then((completed) => {
      if (!isMounted) {
        return;
      }

      setHasCompletedOnboarding(completed);
    });

    return () => {
      isMounted = false;
    };
  }, [storage]);

  useEffect(() => {
    if (hasCompletedOnboarding !== true) {
      return;
    }

    let isMounted = true;
    let isRefreshing = false;

    const runPartnerRefresh = async () => {
      if (!isMounted || isRefreshing) {
        return;
      }

      isRefreshing = true;
      try {
        await managedPartnerShareRefresh(
          storage,
          syncSecretStore,
          partnerShareSecretStore,
          now ?? new Date(),
        );
      } catch {
        // Best-effort refresh: keep the main app usable even if the sync path fails.
      } finally {
        isRefreshing = false;
      }
    };

    void runPartnerRefresh();
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void runPartnerRefresh();
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [
    hasCompletedOnboarding,
    managedPartnerShareRefresh,
    now,
    partnerShareSecretStore,
    storage,
    syncSecretStore,
  ]);

  if (hasCompletedOnboarding === null) {
    return null;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <TabLeaveGuardProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: "transparent" },
          tabBarActiveTintColor: colors.accentStrong,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarHideOnKeyboard: true,
          tabBarIconStyle: {
            marginBottom: 0,
          },
          tabBarItemStyle: {
            minHeight: 44,
            paddingHorizontal: 4,
            paddingVertical: 2,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
            lineHeight: 13,
          },
          tabBarStyle: {
            backgroundColor: colors.headerBg,
            borderColor: colors.headerBorder,
            borderTopWidth: 1,
            height: tabBarHeight,
            paddingBottom: tabBarBottomPadding,
            paddingHorizontal: 8,
            paddingTop: 6,
            shadowColor: colors.shadowSoft,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: Platform.OS === "ios" ? 0.14 : 0,
            shadowRadius: 8,
            elevation: Platform.OS === "android" ? 10 : 0,
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: shellCopy.tabs.dashboard,
            tabBarButton: renderTabBarButton("dashboard"),
            tabBarIcon: ({ color, size }) => (
              <Feather color={color} name="sun" size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: shellCopy.tabs.calendar,
            tabBarButton: renderTabBarButton("calendar"),
            tabBarIcon: ({ color, size }) => (
              <Feather color={color} name="calendar" size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: shellCopy.tabs.stats,
            tabBarButton: renderTabBarButton("stats"),
            tabBarIcon: ({ color, size }) => (
              <Feather color={color} name="bar-chart-2" size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: shellCopy.tabs.settings,
            tabBarButton: renderTabBarButton("settings"),
            tabBarIcon: ({ color, size }) => (
              <Feather color={color} name="settings" size={size} />
            ),
          }}
        />
      </Tabs>
    </TabLeaveGuardProvider>
  );
}
