import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { MultiSelectChipGroup } from "./MultiSelectChipGroup";

describe("MultiSelectChipGroup", () => {
  it("switches compact chips to one column in a narrow card", () => {
    render(
      <MultiSelectChipGroup
        compact
        onToggle={() => {}}
        options={[
          { value: "stress", label: "Стресс", icon: "⚡" },
          { value: "medication_change", label: "Смена лекарств", icon: "💊" },
        ]}
        selectedValues={[]}
        testIDPrefix="factor"
      />,
    );

    fireEvent(screen.getByTestId("factor-group"), "layout", {
      nativeEvent: { layout: { height: 80, width: 300, x: 0, y: 0 } },
    });

    expect(
      StyleSheet.flatten(screen.getByTestId("factor-medication_change").props.style),
    ).toEqual(
      expect.objectContaining({
        flexBasis: "100%",
        flexGrow: 1,
        minWidth: 0,
      }),
    );
  });

  it("keeps two columns for compact chips when the card is wide enough", () => {
    render(
      <MultiSelectChipGroup
        compact
        onToggle={() => {}}
        options={[
          { value: "stress", label: "Стресс", icon: "⚡" },
          { value: "medication_change", label: "Смена лекарств", icon: "💊" },
        ]}
        selectedValues={[]}
        testIDPrefix="factor"
      />,
    );

    fireEvent(screen.getByTestId("factor-group"), "layout", {
      nativeEvent: { layout: { height: 80, width: 400, x: 0, y: 0 } },
    });

    expect(
      StyleSheet.flatten(screen.getByTestId("factor-medication_change").props.style),
    ).toEqual(
      expect.objectContaining({
        flexBasis: "48%",
        flexGrow: 1,
        minWidth: 0,
      }),
    );
  });

  it("names the group and announces each chip by its word, not its emoji", () => {
    render(
      <MultiSelectChipGroup
        groupLabel="Cycle factors"
        onToggle={() => {}}
        options={[
          { value: "stress", label: "Stress", icon: "⚡" },
          { value: "medication_change", label: "Medication change", icon: "💊" },
        ]}
        selectedValues={["stress"]}
        testIDPrefix="factor"
      />,
    );

    expect(screen.getByTestId("factor-group").props.accessibilityLabel).toBe(
      "Cycle factors",
    );
    expect(
      screen.getByRole("checkbox", { name: "Stress", checked: true }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", {
        name: "Medication change",
        checked: false,
      }),
    ).toBeTruthy();
  });
});
