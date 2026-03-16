import { Feather } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";

import { appStorage } from "../../services/app-bootstrap-service";

type ProtectedTabsLayoutProps = {
  storage?: typeof appStorage;
};

export function ProtectedTabsLayout({
  storage = appStorage,
}: ProtectedTabsLayoutProps) {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    let isMounted = true;

    void storage.readBootstrapState().then((state) => {
      if (!isMounted) {
        return;
      }

      setHasCompletedOnboarding(state.hasCompletedOnboarding);
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
        tabBarActiveTintColor: "#166534",
        tabBarInactiveTintColor: "#64748b",
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <Feather color={color} name="sun" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, size }) => (
            <Feather color={color} name="calendar" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Insights",
          tabBarIcon: ({ color, size }) => (
            <Feather color={color} name="bar-chart-2" size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Feather color={color} name="settings" size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
