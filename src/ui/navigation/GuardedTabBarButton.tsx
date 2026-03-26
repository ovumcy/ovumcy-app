import { PlatformPressable } from "@react-navigation/elements";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { usePathname } from "expo-router";
import { useCallback } from "react";

import { useTabLeaveGuard } from "./TabLeaveGuardContext";

type GuardedTabBarButtonProps = BottomTabBarButtonProps & {
  targetRouteName: string;
};

type TabBarButtonPressEvent = Parameters<
  NonNullable<BottomTabBarButtonProps["onPress"]>
>[0];

function resolveCurrentTabRouteName(pathname: string): string | null {
  const [firstSegment] = pathname.split("/").filter(Boolean);

  switch (firstSegment) {
    case "dashboard":
    case "calendar":
    case "stats":
    case "settings":
      return firstSegment;
    default:
      return null;
  }
}

export function GuardedTabBarButton({
  onPress,
  targetRouteName,
  ...props
}: GuardedTabBarButtonProps) {
  const pathname = usePathname();
  const currentRouteName = resolveCurrentTabRouteName(pathname);
  const tabLeaveGuard = useTabLeaveGuard();

  const handlePress = useCallback(
    (event: TabBarButtonPressEvent) => {
      void (async () => {
        if (currentRouteName !== targetRouteName) {
          const canLeave = await tabLeaveGuard?.confirmLeaveForRoute(
            currentRouteName,
          );
          if (canLeave === false) {
            return;
          }
        }

        onPress?.(event);
      })();
    },
    [currentRouteName, onPress, tabLeaveGuard, targetRouteName],
  );

  return <PlatformPressable {...props} onPress={handlePress} />;
}

export { resolveCurrentTabRouteName };
