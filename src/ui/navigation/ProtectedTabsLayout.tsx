import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getShellCopy } from "../../i18n/shell-copy";
import {
  appStorage,
  readHasCompletedOnboarding,
} from "../../services/app-bootstrap-service";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { useAppPreferences } from "../providers/AppPreferencesProvider";

type ProtectedTabsLayoutProps = {
  storage?: LocalAppStorage;
};

export function ProtectedTabsLayout({
  storage = appStorage,
}: ProtectedTabsLayoutProps) {
  const { colors, language } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<
    boolean | null
  >(null);
  const shellCopy = getShellCopy(language);
  const bottomInset = Platform.OS === "android"
    ? Math.max(insets.bottom, 18)
    : Math.max(insets.bottom, 8);
  const tabBarHeight = 66 + bottomInset;
  const tabBarBottom = 12 + bottomInset;
  const tabBarBottomPadding = Math.max(10, bottomInset);

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

  if (hasCompletedOnboarding === null) {
    return null;
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return (
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
          borderRadius: 12,
          marginHorizontal: 4,
          marginVertical: 2,
          minHeight: 50,
          paddingHorizontal: 4,
          paddingVertical: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          lineHeight: 13,
        },
        tabBarStyle: {
          backgroundColor: colors.headerBg,
          borderColor: colors.headerBorder,
          borderRadius: 16,
          borderTopWidth: 1,
          bottom: tabBarBottom,
          height: tabBarHeight,
          left: 12,
          paddingBottom: tabBarBottomPadding,
          paddingHorizontal: 6,
          paddingTop: 8,
          position: "absolute",
          right: 12,
          shadowColor: colors.shadowSoft,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.85,
          shadowRadius: 24,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: shellCopy.tabs.dashboard,
          tabBarIcon: ({ color, size }) => (
            <Feather color={color} name="sun" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: shellCopy.tabs.calendar,
          tabBarIcon: ({ color, size }) => (
            <Feather color={color} name="calendar" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: shellCopy.tabs.stats,
          tabBarIcon: ({ color, size }) => (
            <Feather color={color} name="bar-chart-2" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: shellCopy.tabs.settings,
          tabBarIcon: ({ color, size }) => (
            <Feather color={color} name="settings" size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
