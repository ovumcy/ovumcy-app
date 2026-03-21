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

function ProtectedScreen({
  isDevelopment,
}: {
  isDevelopment?: boolean;
}) {
  useAppScreenProtection(
    true,
    isDevelopment === undefined ? undefined : { isDevelopment },
  );
  return <Text>protected</Text>;
}

describe("useAppScreenProtection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("skips privacy protection in development", () => {
    const view = render(<ProtectedScreen isDevelopment />);

    expect(preventScreenCaptureAsync).not.toHaveBeenCalled();
    expect(enableAppSwitcherProtectionAsync).not.toHaveBeenCalled();

    view.unmount();

    expect(allowScreenCaptureAsync).not.toHaveBeenCalled();
    expect(disableAppSwitcherProtectionAsync).not.toHaveBeenCalled();
  });

  it("enables privacy protection while the production app shell is mounted", () => {
    const view = render(<ProtectedScreen isDevelopment={false} />);

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
