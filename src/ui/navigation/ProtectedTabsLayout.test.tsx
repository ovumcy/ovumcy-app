import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Text, View } from "react-native";

import type { LocalAppStorage } from "../../storage/local/storage-contract";
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

  function Tabs({ children }: { children?: React.ReactNode }) {
    return mockReact.createElement(
      mockView,
      { testID: "protected-tabs" },
      children,
    );
  }

  Tabs.Screen = function MockTabsScreen({
    name,
    options,
  }: {
    name: string;
    options?: { title?: string };
  }) {
    return mockReact.createElement(
      mockText,
      { testID: `protected-tab-${name}` },
      options?.title ?? name,
    );
  };

  return {
    Redirect,
    Tabs,
  };
});

function createStorageMock(
  hasCompletedOnboarding: boolean,
): LocalAppStorage {
  return {
    readBootstrapState: jest.fn().mockResolvedValue({
      hasCompletedOnboarding,
      profileVersion: 2,
    }),
    writeBootstrapState: jest.fn().mockResolvedValue(undefined),
    readProfileRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: null,
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: false,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
    }),
    writeProfileRecord: jest.fn().mockResolvedValue(undefined),
    readOnboardingRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: null,
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      ageGroup: "",
      usageGoal: "health",
    }),
    writeOnboardingRecord: jest.fn().mockResolvedValue(undefined),
  };
}

describe("ProtectedTabsLayout", () => {
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
    expect(screen.getByTestId("protected-tab-dashboard")).toHaveTextContent("Today");
    expect(screen.getByTestId("protected-tab-calendar")).toHaveTextContent("Calendar");
    expect(screen.getByTestId("protected-tab-stats")).toHaveTextContent("Insights");
    expect(screen.getByTestId("protected-tab-settings")).toHaveTextContent("Settings");
  });
});
