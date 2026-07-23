import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { AppState, Dimensions, Platform, Text, View } from "react-native";

import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { TAB_BAR_BASE_CONTENT_HEIGHT } from "../layout/tab-bar-metrics";
import { ProtectedTabsLayout } from "./ProtectedTabsLayout";

const mockReact = React;
const mockText = Text;
const mockView = View;

jest.mock("expo-router", () => {
  function Redirect({ href }: { href: string }) {
    return mockReact.createElement(
      mockText,
      { testID: "protected-tabs-redirect" },
      href,
    );
  }

  function Tabs({
    children,
    screenOptions,
  }: {
    children?: React.ReactNode;
    screenOptions?: { tabBarStyle?: { height?: number } };
  }) {
    return mockReact.createElement(
      mockView,
      {
        testID: "protected-tabs",
        // Surfaces the tab-bar geometry the layout computed so the font-scale
        // behaviour is assertable without a real navigator.
        accessibilityValue: { now: screenOptions?.tabBarStyle?.height ?? 0 },
      },
      children,
    );
  }

  Tabs.Screen = function MockTabsScreen({
    name,
    options,
  }: {
    name: string;
    options?: { title?: string; tabBarAccessibilityLabel?: string };
  }) {
    return mockReact.createElement(
      mockText,
      {
        testID: `protected-tab-${name}`,
        accessibilityLabel: options?.tabBarAccessibilityLabel,
      },
      options?.title ?? name,
    );
  };

  return {
    Redirect,
    Tabs,
    usePathname: () => "/dashboard",
  };
});

function createStorageMock(hasCompletedOnboarding: boolean) {
  return createLocalAppStorageMock({
    readBootstrapState: jest.fn().mockResolvedValue({
      hasCompletedOnboarding,
      profileVersion: 2,
      incompleteOnboardingStep: hasCompletedOnboarding ? null : 1,
    }),
  });
}

describe("ProtectedTabsLayout", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("redirects to onboarding while local setup is incomplete", async () => {
    render(<ProtectedTabsLayout storage={createStorageMock(false)} />);

    await waitFor(() =>
      expect(screen.getByTestId("protected-tabs-redirect")).toHaveTextContent(
        "/onboarding",
      ),
    );
  });

  it("renders protected tabs once onboarding is completed", async () => {
    render(<ProtectedTabsLayout storage={createStorageMock(true)} />);

    await waitFor(() => expect(screen.getByTestId("protected-tabs")).toBeTruthy());
    expect(screen.getByTestId("protected-tab-dashboard")).toBeTruthy();
    expect(screen.getByTestId("protected-tab-calendar")).toBeTruthy();
    expect(screen.getByTestId("protected-tab-stats")).toBeTruthy();
    expect(screen.getByTestId("protected-tab-settings")).toBeTruthy();
  });

  it("labels each tab with its title for screen readers (no leading separator)", async () => {
    render(<ProtectedTabsLayout storage={createStorageMock(true)} />);

    await waitFor(() => expect(screen.getByTestId("protected-tabs")).toBeTruthy());

    for (const name of ["dashboard", "calendar", "stats", "settings"]) {
      const tab = screen.getByTestId(`protected-tab-${name}`);
      expect(tab.props.accessibilityLabel).toBeTruthy();
      expect(tab.props.accessibilityLabel).toBe(tab.props.children);
    }
  });

  it("grows the tab band when the OS font scale enlarges the tab labels", async () => {
    // Android (and web) scale the tab label with the system font size; the band
    // is a constant 56pt otherwise, so the label would clip against the icon.
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", writable: true });
    jest.spyOn(Dimensions, "get").mockReturnValue({
      fontScale: 2,
      height: 844,
      scale: 3,
      width: 390,
    });

    try {
      render(<ProtectedTabsLayout storage={createStorageMock(true)} />);

      await waitFor(() =>
        expect(screen.getByTestId("protected-tabs")).toBeTruthy(),
      );

      const height = screen.getByTestId("protected-tabs").props
        .accessibilityValue.now as number;
      expect(height).toBeGreaterThan(TAB_BAR_BASE_CONTENT_HEIGHT);
    } finally {
      Object.defineProperty(Platform, "OS", {
        value: originalOS,
        writable: true,
      });
    }
  });

  it("keeps the tab band at its base height on iOS, where the label does not scale", async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "ios", writable: true });
    jest.spyOn(Dimensions, "get").mockReturnValue({
      fontScale: 2,
      height: 844,
      scale: 3,
      width: 390,
    });

    try {
      render(<ProtectedTabsLayout storage={createStorageMock(true)} />);

      await waitFor(() =>
        expect(screen.getByTestId("protected-tabs")).toBeTruthy(),
      );

      // 56pt band plus the minimum bottom padding the layout always applies.
      const height = screen.getByTestId("protected-tabs").props
        .accessibilityValue.now as number;
      expect(height).toBe(TAB_BAR_BASE_CONTENT_HEIGHT + 10);
    } finally {
      Object.defineProperty(Platform, "OS", {
        value: originalOS,
        writable: true,
      });
    }
  });

  it("refreshes managed partner projections on mount and app foreground", async () => {
    const refresh = jest.fn().mockResolvedValue({
      skipped: true,
      syncedCount: 0,
    });
    let appStateChangeHandler: ((state: string) => void) | null = null;
    jest.spyOn(AppState, "addEventListener").mockImplementation((_, handler) => {
      appStateChangeHandler = handler as (state: string) => void;
      return {
        remove: jest.fn(),
      } as ReturnType<typeof AppState.addEventListener>;
    });

    render(
      <ProtectedTabsLayout
        storage={createStorageMock(true)}
        managedPartnerShareRefresh={refresh}
        now={new Date("2026-04-06T10:00:00.000Z")}
      />,
    );

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    act(() => {
      appStateChangeHandler?.("active");
    });

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  });
});
