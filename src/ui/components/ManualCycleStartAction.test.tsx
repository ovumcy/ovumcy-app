import { fireEvent, render, screen } from "@testing-library/react-native";

import type { ManualCycleStartViewData } from "../../services/manual-cycle-start-service";
import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { ManualCycleStartAction } from "./ManualCycleStartAction";

function createViewData(
  overrides?: Partial<ManualCycleStartViewData>,
): ManualCycleStartViewData {
  return {
    buttonLabel: "Mark new cycle start",
    isActive: true,
    prompts: [],
    notices: {},
    ...overrides,
  };
}

describe("ManualCycleStartAction", () => {
  it("announces the action as a button and forwards the press", () => {
    const onPress = jest.fn();

    render(
      <AppPreferencesTestProvider>
        <ManualCycleStartAction
          onPress={onPress}
          testID="manual-cycle-start"
          viewData={createViewData()}
        />
      </AppPreferencesTestProvider>,
    );

    const action = screen.getByTestId("manual-cycle-start");
    expect(action.props.accessibilityRole).toBe("button");
    expect(action.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );

    fireEvent.press(action);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("reports the disabled state instead of silently ignoring the press", () => {
    const onPress = jest.fn();

    render(
      <AppPreferencesTestProvider>
        <ManualCycleStartAction
          disabled
          onPress={onPress}
          testID="manual-cycle-start"
          viewData={createViewData()}
        />
      </AppPreferencesTestProvider>,
    );

    expect(
      screen.getByTestId("manual-cycle-start").props.accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: true }));
  });

  it("groups the qualifying notices into one announcement under the button", () => {
    render(
      <AppPreferencesTestProvider>
        <ManualCycleStartAction
          onPress={jest.fn()}
          viewData={createViewData({
            notices: {
              future: "That date is in the future.",
              suggestion: "Did you mean 12 March?",
              implantation: "Light bleeding this early can be implantation.",
            },
          })}
        />
      </AppPreferencesTestProvider>,
    );

    // The notices qualify the button above them, so they are announced as one
    // element in the order they are rendered rather than as three loose lines.
    expect(
      screen.getByLabelText(
        "That date is in the future. Did you mean 12 March? " +
          "Light bleeding this early can be implantation.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Did you mean 12 March?")).toBeTruthy();
  });

  it("renders no notice group when the action has nothing to qualify", () => {
    render(
      <AppPreferencesTestProvider>
        <ManualCycleStartAction
          onPress={jest.fn()}
          viewData={createViewData()}
        />
      </AppPreferencesTestProvider>,
    );

    expect(screen.queryByText("That date is in the future.")).toBeNull();
  });
});
