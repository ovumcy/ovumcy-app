import { render } from "@testing-library/react-native";
import { Platform, Text } from "react-native";

import {
  allowScreenCaptureAsync,
  disableAppSwitcherProtectionAsync,
  enableAppSwitcherProtectionAsync,
  preventScreenCaptureAsync,
} from "expo-screen-capture";
import { useAppScreenProtection } from "./app-screen-protection";

jest.mock("expo-screen-capture", () => ({
  allowScreenCaptureAsync: jest.fn().mockResolvedValue(undefined),
  disableAppSwitcherProtectionAsync: jest.fn().mockResolvedValue(undefined),
  enableAppSwitcherProtectionAsync: jest.fn().mockResolvedValue(undefined),
  preventScreenCaptureAsync: jest.fn().mockResolvedValue(undefined),
}));

function ProtectedScreen() {
  useAppScreenProtection();
  return <Text>protected</Text>;
}

describe("useAppScreenProtection", () => {
  it("enables privacy protection while the app shell is mounted", () => {
    const view = render(<ProtectedScreen />);

    expect(preventScreenCaptureAsync).toHaveBeenCalledWith(
      "ovumcy.app-screen-protection",
    );

    if (Platform.OS === "ios") {
      expect(enableAppSwitcherProtectionAsync).toHaveBeenCalledWith(0.7);
    }

    view.unmount();

    expect(allowScreenCaptureAsync).toHaveBeenCalledWith(
      "ovumcy.app-screen-protection",
    );

    if (Platform.OS === "ios") {
      expect(disableAppSwitcherProtectionAsync).toHaveBeenCalledTimes(1);
    }
  });
});
