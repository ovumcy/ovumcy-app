import { render, waitFor } from "@testing-library/react-native";

import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { AppEntryScreen } from "./AppEntryScreen";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

function createStorageMock(
  hasCompletedOnboarding: boolean,
): LocalAppStorage {
  return {
    readBootstrapState: jest.fn().mockResolvedValue({
      hasCompletedOnboarding,
      profileVersion: 1,
    }),
    writeBootstrapState: jest.fn().mockResolvedValue(undefined),
    readOnboardingRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: null,
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: false,
      irregularCycle: false,
      ageGroup: "",
      usageGoal: "health",
    }),
    writeOnboardingRecord: jest.fn().mockResolvedValue(undefined),
  };
}

describe("AppEntryScreen", () => {
  beforeEach(() => {
    mockReplace.mockReset();
  });

  it("routes to onboarding when local setup is not completed", async () => {
    const storage = createStorageMock(false);

    render(<AppEntryScreen storage={storage} />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/onboarding"),
    );
  });

  it("routes to dashboard when onboarding is already completed", async () => {
    const storage = createStorageMock(true);

    render(<AppEntryScreen storage={storage} />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard"),
    );
  });
});
