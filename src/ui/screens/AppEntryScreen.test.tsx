import { render, waitFor } from "@testing-library/react-native";

import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { AppEntryScreen } from "./AppEntryScreen";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

function createStorageMock(hasCompletedOnboarding: boolean) {
  return createLocalAppStorageMock({
    readBootstrapState: jest.fn().mockResolvedValue({
      hasCompletedOnboarding,
      profileVersion: 2,
      incompleteOnboardingStep: hasCompletedOnboarding ? null : 1,
    }),
  });
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
