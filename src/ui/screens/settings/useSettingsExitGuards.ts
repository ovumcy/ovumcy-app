import { useEffect } from "react";
import { useNavigation, usePreventRemove } from "@react-navigation/native";

type ParentTabNavigation = {
  addListener: (
    eventName: "tabPress",
    callback: (event: { preventDefault: () => void; target?: string }) => void,
  ) => () => void;
  getState: () => {
    index: number;
    routes: {
      key: string;
      name: string;
      params?: Record<string, unknown> | undefined;
    }[];
  };
  navigate: (
    name: string,
    params?: Record<string, unknown> | undefined,
  ) => void;
  getParent?: () => ParentTabNavigation | undefined;
};

type NavigationParentLookup = {
  getParent?: () => unknown;
};

function asParentTabNavigation(value: unknown): ParentTabNavigation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    addListener?: unknown;
    getParent?: unknown;
    getState?: unknown;
    navigate?: unknown;
  };

  if (
    typeof candidate.addListener !== "function" ||
    typeof candidate.getState !== "function" ||
    typeof candidate.navigate !== "function"
  ) {
    return null;
  }

  return value as ParentTabNavigation;
}

function collectAncestorNavigations(
  navigation: NavigationParentLookup,
): ParentTabNavigation[] {
  const ancestors: ParentTabNavigation[] = [];
  let currentParent = navigation.getParent?.();

  while (currentParent) {
    const tabNavigation = asParentTabNavigation(currentParent);
    if (tabNavigation) {
      ancestors.push(tabNavigation);
    }

    currentParent = (currentParent as NavigationParentLookup).getParent?.();
  }

  return ancestors;
}

type UseSettingsExitGuardsOptions = {
  enabled: boolean;
  onConfirmLeave: (continueLeave: () => void) => Promise<void>;
};

// Guards a settings section screen's dirty state against every exit path:
// usePreventRemove covers route removal — including the Android hardware back
// and the native back gesture, which pop the section back to the hub — and the
// ancestor tabPress listeners cover switching tabs. The pre-split Android
// "confirm before exiting the app" BackHandler is gone with the single-screen
// layout: dirty state now only exists on pushed section screens, never at the
// tab root, so hardware back is always a route removal.
export function useSettingsExitGuards({
  enabled,
  onConfirmLeave,
}: UseSettingsExitGuardsOptions) {
  const navigation = useNavigation();

  usePreventRemove(enabled, ({ data }) => {
    void onConfirmLeave(() => {
      navigation.dispatch(data.action);
    });
  });

  useEffect(() => {
    const ancestorNavigations = collectAncestorNavigations(
      navigation as NavigationParentLookup,
    );
    if (ancestorNavigations.length === 0) {
      return;
    }

    const unsubscribeCallbacks = ancestorNavigations.map((parentNavigation) =>
      parentNavigation.addListener("tabPress", (event) => {
        const parentState = parentNavigation.getState();
        const currentRoute = parentState.routes[parentState.index];
        const targetRoute = parentState.routes.find(
          (route) => route.key === event.target || route.name === event.target,
        );

        if (!targetRoute || !currentRoute || targetRoute.key === currentRoute.key) {
          return;
        }

        event.preventDefault();
        void onConfirmLeave(() => {
          parentNavigation.navigate(targetRoute.name, targetRoute.params);
        });
      }),
    );

    return () => {
      unsubscribeCallbacks.forEach((unsubscribe) => {
        unsubscribe();
      });
    };
  }, [navigation, onConfirmLeave]);
}
