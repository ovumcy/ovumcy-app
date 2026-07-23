import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { ChoiceGroup } from "./ChoiceGroup";

describe("ChoiceGroup", () => {
  it("falls back to three columns for grid5 choices in a narrow card", () => {
    render(
      <ChoiceGroup
        compact
        contentAlign="center"
        layout="grid5"
        onSelect={() => {}}
        options={[
          { value: 1, label: "Ужасно" },
          { value: 2, label: "Плохо" },
          { value: 3, label: "Нормально" },
          { value: 4, label: "Хорошо" },
          { value: 5, label: "Отлично" },
        ]}
        selectedValue={3}
        testIDPrefix="mood"
      />,
    );

    fireEvent(screen.getByTestId("mood-group"), "layout", {
      nativeEvent: { layout: { height: 120, width: 300, x: 0, y: 0 } },
    });

    expect(StyleSheet.flatten(screen.getByTestId("mood-1").props.style)).toEqual(
      expect.objectContaining({
        flexBasis: "31%",
        flexGrow: 1,
        minWidth: 0,
      }),
    );
  });

  it("keeps five columns when the container is wide enough", () => {
    render(
      <ChoiceGroup
        compact
        contentAlign="center"
        layout="grid5"
        onSelect={() => {}}
        options={[
          { value: 1, label: "Ужасно" },
          { value: 2, label: "Плохо" },
          { value: 3, label: "Нормально" },
          { value: 4, label: "Хорошо" },
          { value: 5, label: "Отлично" },
        ]}
        selectedValue={3}
        testIDPrefix="mood"
      />,
    );

    fireEvent(screen.getByTestId("mood-group"), "layout", {
      nativeEvent: { layout: { height: 120, width: 480, x: 0, y: 0 } },
    });

    expect(StyleSheet.flatten(screen.getByTestId("mood-1").props.style)).toEqual(
      expect.objectContaining({
        flexBasis: "18%",
        flexGrow: 0,
        minWidth: 0,
      }),
    );
  });

  it("names the group with the field label so a radio announces what it answers", () => {
    render(
      <ChoiceGroup
        groupLabel="Prediction mode"
        onSelect={() => {}}
        options={[
          { value: "regular", label: "Regular" },
          { value: "irregular", label: "Unpredictable" },
        ]}
        selectedValue="regular"
        testIDPrefix="prediction-mode"
      />,
    );

    const group = screen.getByTestId("prediction-mode-group");
    expect(group.props.accessibilityRole).toBe("radiogroup");
    expect(group.props.accessibilityLabel).toBe("Prediction mode");

    expect(
      screen.getByRole("radio", { name: "Regular", checked: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: "Unpredictable", checked: false }),
    ).toBeTruthy();
  });

  it("leaves the group unnamed when no field label introduces it", () => {
    render(
      <ChoiceGroup
        onSelect={() => {}}
        options={[{ value: "a", label: "A" }]}
        testIDPrefix="unlabelled"
      />,
    );

    expect(
      screen.getByTestId("unlabelled-group").props.accessibilityLabel,
    ).toBeUndefined();
  });
});
