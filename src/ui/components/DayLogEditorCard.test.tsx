import { fireEvent, render, screen } from "@testing-library/react-native";

import { createEmptyDayLogRecord } from "../../models/day-log";
import { createDefaultProfileRecord } from "../../models/profile";
import { createDefaultSymptomRecords } from "../../models/symptom";
import { buildDayLogEditorViewData } from "../../services/day-log-editor-service";
import { DayLogEditorCard } from "./DayLogEditorCard";

function renderBbtCard(bbt = 0, temperatureUnit: "c" | "f" = "c") {
  const profile = { ...createDefaultProfileRecord(), trackBBT: true, temperatureUnit };
  const viewData = buildDayLogEditorViewData(
    profile,
    "2026-05-31",
    createDefaultSymptomRecords(),
  );
  const onPatch = jest.fn();

  render(
    <DayLogEditorCard
      entryExists={false}
      isSaving={false}
      record={{ ...createEmptyDayLogRecord("2026-05-31"), bbt }}
      statusMessage=""
      viewData={viewData}
      onPatch={onPatch}
      onSave={jest.fn()}
    />,
  );

  return { onPatch };
}

function bbtInput() {
  return screen.getByTestId("day-log-bbt-input");
}

describe("DayLogEditorCard BBT input", () => {
  it("keeps the raw decimal text instead of reformatting it mid-edit", () => {
    const { onPatch } = renderBbtCard();

    fireEvent.changeText(bbtInput(), "36.5");

    expect(bbtInput().props.value).toBe("36.5");
    expect(onPatch).toHaveBeenLastCalledWith({ bbt: 36.5 });
  });

  it("preserves a trailing decimal point while typing", () => {
    const { onPatch } = renderBbtCard();

    fireEvent.changeText(bbtInput(), "36.");

    expect(bbtInput().props.value).toBe("36.");
    expect(onPatch).toHaveBeenLastCalledWith({ bbt: 36 });
  });

  it("shows the stored temperature formatted and clears it when emptied", () => {
    const { onPatch } = renderBbtCard(36.5);

    expect(bbtInput().props.value).toBe("36.50");

    fireEvent.changeText(bbtInput(), "");

    expect(bbtInput().props.value).toBe("");
    expect(onPatch).toHaveBeenLastCalledWith({ bbt: 0 });
  });

  it("drops letters and other non-numeric characters", () => {
    const { onPatch } = renderBbtCard();

    fireEvent.changeText(bbtInput(), "3a6.5b7c9");

    expect(bbtInput().props.value).toBe("36.57");
    expect(onPatch).toHaveBeenLastCalledWith({ bbt: 36.57 });
  });

  it("collapses extra decimal separators into a single one", () => {
    const { onPatch } = renderBbtCard();

    fireEvent.changeText(bbtInput(), "36.5.7");

    expect(bbtInput().props.value).toBe("36.57");
    expect(onPatch).toHaveBeenLastCalledWith({ bbt: 36.57 });
  });

  it("accepts a comma as the decimal separator", () => {
    const { onPatch } = renderBbtCard();

    fireEvent.changeText(bbtInput(), "36,72");

    expect(bbtInput().props.value).toBe("36.72");
    expect(onPatch).toHaveBeenLastCalledWith({ bbt: 36.72 });
  });

  it("stores a Fahrenheit reading as a canonical Celsius value", () => {
    const { onPatch } = renderBbtCard(0, "f");

    fireEvent.changeText(bbtInput(), "97.7");

    expect(bbtInput().props.value).toBe("97.7");
    expect(onPatch).toHaveBeenLastCalledWith({ bbt: 36.5 });
  });

  it("shows a stored Celsius value converted to Fahrenheit", () => {
    renderBbtCard(36.5, "f");

    expect(bbtInput().props.value).toBe("97.70");
  });
});
