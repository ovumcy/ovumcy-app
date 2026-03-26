import React, { useCallback } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text, View } from "react-native";
import { usePathname } from "expo-router";

import { GuardedTabBarButton } from "./GuardedTabBarButton";
import {
  TabLeaveGuardProvider,
  useRegisterTabLeaveGuard,
} from "./TabLeaveGuardContext";

jest.mock("expo-router", () => ({
  usePathname: jest.fn(),
}));

jest.mock("@react-navigation/elements", () => {
  const mockReact = jest.requireActual("react") as typeof import("react");
  const { Pressable: MockPressable } = jest.requireActual(
    "react-native",
  ) as typeof import("react-native");
  const MockPlatformPressable = mockReact.forwardRef(
    (
      {
        children,
        ...props
      }: {
        children: React.ReactNode;
      },
      ref: React.ForwardedRef<View>,
    ) => mockReact.createElement(MockPressable, { ...props, ref }, children),
  );
  MockPlatformPressable.displayName = "MockPlatformPressable";

  return {
    PlatformPressable: MockPlatformPressable,
  };
});

const mockUsePathname = jest.mocked(usePathname);

function SettingsGuardRegistration({ allowLeave }: { allowLeave: boolean }) {
  const guard = useCallback(async () => allowLeave, [allowLeave]);

  useRegisterTabLeaveGuard("settings", guard);

  return null;
}

describe("GuardedTabBarButton", () => {
  beforeEach(() => {
    mockUsePathname.mockReset();
  });

  it("blocks tab navigation when the current settings screen rejects leaving", async () => {
    mockUsePathname.mockReturnValue("/settings");
    const onPress = jest.fn();

    render(
      <TabLeaveGuardProvider>
        <SettingsGuardRegistration allowLeave={false} />
        <GuardedTabBarButton onPress={onPress} targetRouteName="calendar" testID="guarded-tab">
          <Text>Calendar</Text>
        </GuardedTabBarButton>
      </TabLeaveGuardProvider>,
    );

    fireEvent.press(screen.getByTestId("guarded-tab"));

    await waitFor(() => expect(onPress).not.toHaveBeenCalled());
  });

  it("allows tab navigation after the current settings guard confirms leaving", async () => {
    mockUsePathname.mockReturnValue("/settings");
    const onPress = jest.fn();

    render(
      <TabLeaveGuardProvider>
        <SettingsGuardRegistration allowLeave />
        <GuardedTabBarButton onPress={onPress} targetRouteName="calendar" testID="guarded-tab">
          <Text>Calendar</Text>
        </GuardedTabBarButton>
      </TabLeaveGuardProvider>,
    );

    fireEvent.press(screen.getByTestId("guarded-tab"));

    await waitFor(() => expect(onPress).toHaveBeenCalledTimes(1));
  });

  it("does not consult the leave guard when the owner taps the already selected tab", async () => {
    mockUsePathname.mockReturnValue("/settings");
    const onPress = jest.fn();

    render(
      <TabLeaveGuardProvider>
        <SettingsGuardRegistration allowLeave={false} />
        <GuardedTabBarButton onPress={onPress} targetRouteName="settings" testID="guarded-tab">
          <Text>Settings</Text>
        </GuardedTabBarButton>
      </TabLeaveGuardProvider>,
    );

    fireEvent.press(screen.getByTestId("guarded-tab"));

    await waitFor(() => expect(onPress).toHaveBeenCalledTimes(1));
  });
});
