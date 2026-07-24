import { act, render, waitFor } from "@testing-library/react-native";

import { createPregnancyRecord } from "../../../models/pregnancy";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import type { ContractionTimerFlowScreenProps } from "./ContractionTimerFlowScreen";
import { ContractionTimerScreen } from "./ContractionTimerScreen";

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));

// The presentational flow screen is replaced with a prop recorder so the
// container's in-flight-save guard can be exercised: the real toggle button
// is disabled while a save is pending, so a third press can never reach the
// handler through the composed UI. The regular screen tests keep covering the
// real composed UI.
let mockFlowProps: ContractionTimerFlowScreenProps | null = null;
jest.mock("./ContractionTimerFlowScreen", () => ({
  ContractionTimerFlowScreen: (props: unknown) => {
    mockFlowProps = props as ContractionTimerFlowScreenProps;
    return null;
  },
}));

function activeRecord() {
  return createPregnancyRecord({
    edd: "2026-10-08",
    eddBasis: "lmp",
    lmpDate: "2026-01-01",
    startedAt: "2026-03-01",
  });
}

describe("ContractionTimerScreen handler guards", () => {
  beforeEach(() => {
    mockFlowProps = null;
  });

  it("ignores a toggle while the previous stop is still saving", async () => {
    let resolveWrite: () => void = () => {};
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(activeRecord()),
      writeContractionSession: jest.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveWrite = resolve;
          }),
      ),
    });
    render(
      <AppPreferencesTestProvider languageOverride="en">
        <ContractionTimerScreen
          now={new Date("2026-07-20T10:00:00.000Z")}
          storage={storage}
        />
      </AppPreferencesTestProvider>,
    );
    await waitFor(() => expect(mockFlowProps).not.toBeNull());

    // Start a contraction, then stop it -- the stop hangs on the deferred
    // write, leaving the screen in its saving state.
    await act(async () => {
      void mockFlowProps!.onToggle();
    });
    await act(async () => {
      void mockFlowProps!.onToggle();
    });
    expect(mockFlowProps?.isSaving).toBe(true);

    // A press racing in while the save is pending is ignored: no new
    // contraction starts and no second write is issued.
    await act(async () => {
      void mockFlowProps!.onToggle();
    });
    expect(storage.writeContractionSession).toHaveBeenCalledTimes(1);
    expect(mockFlowProps?.isTiming).toBe(true);

    await act(async () => {
      resolveWrite();
    });
    expect(mockFlowProps?.isSaving).toBe(false);
    expect(mockFlowProps?.isTiming).toBe(false);
  });
});
