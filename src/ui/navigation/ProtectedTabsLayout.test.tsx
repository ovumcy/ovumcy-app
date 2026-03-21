import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Text, View } from "react-native";

import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
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
});
