import { act, render, waitFor } from "@testing-library/react-native";

import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import type { ScreeningFlowScreenProps } from "./ScreeningFlowScreen";
import { ScreeningScreen } from "./ScreeningScreen";

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
}));

// The presentational flow screen is replaced with a prop recorder so the
// container's defensive answer gates can be exercised: the real Next/Finish
// buttons are disabled until an option is picked, so an unanswered advance
// can never reach the handlers through the composed UI. The regular screen
// tests keep covering the real composed UI.
let mockFlowProps: ScreeningFlowScreenProps | null = null;
jest.mock("./ScreeningFlowScreen", () => {
  const actual = jest.requireActual("./ScreeningFlowScreen") as object;
  return {
    ...actual,
    ScreeningFlowScreen: (props: unknown) => {
      mockFlowProps = props as ScreeningFlowScreenProps;
      return null;
    },
  };
});

async function flowReady(): Promise<ScreeningFlowScreenProps> {
  await waitFor(() => expect(mockFlowProps).not.toBeNull());
  return mockFlowProps!;
}

describe("ScreeningScreen handler guards", () => {
  beforeEach(() => {
    mockFlowProps = null;
  });

  it("ignores next while the current question has no answer picked", async () => {
    render(
      <AppPreferencesTestProvider languageOverride="en">
        <ScreeningScreen
          now={new Date("2026-07-20T10:00:00.000Z")}
          storage={createLocalAppStorageMock()}
        />
      </AppPreferencesTestProvider>,
    );
    const props = await flowReady();

    act(() => {
      props.onBegin();
    });
    expect(mockFlowProps?.stage).toBe("questions");
    expect(mockFlowProps?.questionNumber).toBe(1);

    act(() => {
      mockFlowProps!.onNext();
    });
    expect(mockFlowProps?.questionNumber).toBe(1);
  });

  it("refuses to finish while any item is unanswered and persists nothing", async () => {
    const storage = createLocalAppStorageMock();
    render(
      <AppPreferencesTestProvider languageOverride="en">
        <ScreeningScreen
          now={new Date("2026-07-20T10:00:00.000Z")}
          storage={storage}
        />
      </AppPreferencesTestProvider>,
    );
    const props = await flowReady();

    act(() => {
      props.onBegin();
    });
    await act(async () => {
      await mockFlowProps!.onFinish();
    });

    expect(mockFlowProps?.stage).toBe("questions");
    expect(mockFlowProps?.result).toBeNull();
    expect(storage.writeScreeningResponse).not.toHaveBeenCalled();
  });
});
