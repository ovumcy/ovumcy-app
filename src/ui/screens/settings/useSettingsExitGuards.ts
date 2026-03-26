import { useFocusEffect } from "expo-router";
import { useEffect, useCallback } from "react";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { BackHandler, Platform } from "react-native";

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

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") {
        return undefined;
      }

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (!enabled) {
            return false;
          }

          void onConfirmLeave(() => {
            BackHandler.exitApp();
          });
          return true;
        },
      );

      return () => {
        subscription.remove();
      };
    }, [enabled, onConfirmLeave]),
  );
}
