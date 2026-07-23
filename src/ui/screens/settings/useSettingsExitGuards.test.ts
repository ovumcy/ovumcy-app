import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";

import { useSettingsExitGuards } from "./useSettingsExitGuards";

let mockGetParent: (() => unknown) | undefined;

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    getParent: () => mockGetParent?.(),
  }),
  usePreventRemove: jest.fn(),
}));

type TabPressCallback = (event: {
  preventDefault: () => void;
  target?: string;
}) => void;

function createTabNavigation(overrides: {
  currentRoute: { key: string; name: string };
  routes?: { key: string; name: string }[];
  onTabPress?: (callback: TabPressCallback) => void;
}) {
  const routes = overrides.routes ?? [overrides.currentRoute];
  return {
    addListener: jest.fn((eventName: string, callback: TabPressCallback) => {
      if (eventName === "tabPress") {
        overrides.onTabPress?.(callback);
      }
      return jest.fn();
    }),
    getState: () => ({
      index: routes.findIndex((route) => route.key === overrides.currentRoute.key),
      routes,
    }),
    navigate: jest.fn(),
  };
}

describe("useSettingsExitGuards: ancestor tab-navigator wiring", () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    mockGetParent = undefined;
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it("does not crash and wires no listener when there is no parent tab navigator", () => {
    const getParentSpy = jest.fn().mockReturnValue(undefined);
    mockGetParent = getParentSpy;
    const onConfirmLeave = jest.fn();

    expect(() =>
      renderHook(() =>
        useSettingsExitGuards({ enabled: true, onConfirmLeave }),
      ),
    ).not.toThrow();
    // The walk starts at the nearest ancestor and stops immediately once it
    // resolves to nothing — there is no tab bar to guard.
    expect(getParentSpy).toHaveBeenCalledTimes(1);
  });

  it("skips a malformed ancestor (missing the navigator API) but still wires the valid tab navigator beyond it", () => {
    const validTabNavigation = createTabNavigation({
      currentRoute: { key: "settings-key", name: "settings" },
    });
    const malformedAncestor = {
      // Not a real navigator: no addListener/getState/navigate, only a
      // getParent hop up to the real tab navigator.
      getParent: () => validTabNavigation,
    };
    mockGetParent = () => malformedAncestor;
    const onConfirmLeave = jest.fn();

    renderHook(() => useSettingsExitGuards({ enabled: true, onConfirmLeave }));

    expect(validTabNavigation.addListener).toHaveBeenCalledWith(
      "tabPress",
      expect.any(Function),
    );
  });

  it("does not intercept a tab-press that targets the already-active route", () => {
    let capturedCallback: TabPressCallback | undefined;
    const tabNavigation = createTabNavigation({
      currentRoute: { key: "settings-key", name: "settings" },
      onTabPress: (callback) => {
        capturedCallback = callback;
      },
    });
    mockGetParent = () => tabNavigation;
    const onConfirmLeave = jest.fn();

    renderHook(() => useSettingsExitGuards({ enabled: true, onConfirmLeave }));

    const preventDefault = jest.fn();
    act(() => {
      capturedCallback?.({ preventDefault, target: "settings-key" });
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(onConfirmLeave).not.toHaveBeenCalled();
    expect(tabNavigation.navigate).not.toHaveBeenCalled();
  });
});
