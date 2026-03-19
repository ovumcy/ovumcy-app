import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";

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
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<
    boolean | null
  >(null);
  const shellCopy = getShellCopy(language);

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
        tabBarActiveBackgroundColor: colors.accentSoft,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarItemStyle: {
          borderRadius: 12,
          marginHorizontal: 2,
          marginVertical: 2,
          paddingVertical: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
        tabBarStyle: {
          backgroundColor: colors.headerBg,
          borderColor: colors.headerBorder,
          borderRadius: 16,
          borderTopWidth: 1,
          bottom: 12,
          height: 70,
          left: 12,
          paddingBottom: 8,
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
