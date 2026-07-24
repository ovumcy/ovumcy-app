import { fireEvent, render, screen } from "@testing-library/react-native";

import { createEmptyDayLogRecord, type DayLogRecord } from "../../models/day-log";
import { createDefaultProfileRecord, type ProfileRecord } from "../../models/profile";
import { createDefaultSymptomRecords } from "../../models/symptom";
import {
  buildDayLogEditorViewData,
  type DayLogEditorPremiumOptions,
} from "../../services/day-log-editor-service";
import { DayLogEditorCard, type DayLogEditorSectionKey } from "./DayLogEditorCard";

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

type RenderCardOptions = {
  cancelLabel?: string;
  date?: string;
  entryExists?: boolean;
  highlightedSection?: DayLogEditorSectionKey | null;
  isSaving?: boolean;
  onCancel?: () => void;
  bleedingSafetyHint?: string | null;
  onDelete?: () => void | Promise<void>;
  onPatch?: jest.Mock;
  onSave?: jest.Mock;
  onSectionLayout?: (key: DayLogEditorSectionKey, y: number) => void;
  premiumOptions?: DayLogEditorPremiumOptions;
  profileOverrides?: Partial<ProfileRecord>;
  record?: Partial<DayLogRecord>;
  showsSaveAction?: boolean;
  statusMessage?: string;
  statusTone?: "error" | "info" | "success";
  symptomRecords?: ReturnType<typeof createDefaultSymptomRecords>;
  variant?: "dashboard" | "calendar";
};

function buildCardElement(options: RenderCardOptions) {
  const date = options.date ?? "2026-05-31";
  const profile = { ...createDefaultProfileRecord(), ...options.profileOverrides };
  const symptomRecords = options.symptomRecords ?? createDefaultSymptomRecords();
  const record: DayLogRecord = {
    ...createEmptyDayLogRecord(date),
    ...options.record,
  };
  const viewData = buildDayLogEditorViewData(
    profile,
    date,
    symptomRecords,
    record.symptomIDs,
    "en",
    options.premiumOptions ?? {},
  );
  const onPatch = options.onPatch ?? jest.fn();
  const onSave = options.onSave ?? jest.fn();
  // exactOptionalPropertyTypes: only spread these when defined, since the
  // component's prop types don't widen to `| undefined`.
  const optionalHandlerProps = {
    ...(options.cancelLabel !== undefined ? { cancelLabel: options.cancelLabel } : {}),
    ...(options.onCancel !== undefined ? { onCancel: options.onCancel } : {}),
    ...(options.onDelete !== undefined ? { onDelete: options.onDelete } : {}),
    ...(options.onSectionLayout !== undefined
      ? { onSectionLayout: options.onSectionLayout }
      : {}),
  };

  const element = (
    <DayLogEditorCard
      {...optionalHandlerProps}
      bleedingSafetyHint={options.bleedingSafetyHint ?? null}
      entryExists={options.entryExists ?? false}
      highlightedSection={options.highlightedSection ?? null}
      isSaving={options.isSaving ?? false}
      onPatch={onPatch}
      onSave={onSave}
      record={record}
      showsSaveAction={options.showsSaveAction ?? true}
      statusMessage={options.statusMessage ?? ""}
      statusTone={options.statusTone}
      variant={options.variant ?? "dashboard"}
      viewData={viewData}
    />
  );

  return { element, onPatch, onSave, record, viewData };
}

function renderCard(options: RenderCardOptions = {}) {
  const built = buildCardElement(options);
  const utils = render(built.element);

  return {
    ...utils,
    onPatch: built.onPatch,
    onSave: built.onSave,
    record: built.record,
    viewData: built.viewData,
    rerenderWith(patch: RenderCardOptions) {
      const rebuilt = buildCardElement({
        ...options,
        ...patch,
        onPatch: built.onPatch,
        onSave: built.onSave,
      });
      utils.rerender(rebuilt.element);
      return { record: rebuilt.record, viewData: rebuilt.viewData };
    },
  };
}

// The section wrapper (onLayout + highlight style) is DayLogEditorCard's own
// <View> around a ChoiceGroup/MultiSelectChipGroup. Reaching it from the
// group's root testID climbs past react-test-renderer's host/composite View
// pair for that root element, then the ChoiceGroup/MultiSelectChipGroup
// composite instance itself (verified empirically: query -> View -> View ->
// ChoiceGroup/MultiSelectChipGroup -> DayLogEditorCard's section View).
function sectionWrapperOf(testID: string) {
  let node = screen.getByTestId(testID);
  for (let hop = 0; hop < 3; hop += 1) {
    const parent = node.parent;
    if (!parent) {
      throw new Error(`Expected an ancestor ${3 - hop} level(s) up from testID "${testID}"`);
    }
    node = parent;
  }
  return node;
}

function flattenStyle(style: unknown): unknown[] {
  return Array.isArray(style) ? style.flat(Infinity) : [style];
}

describe("DayLogEditorCard field interactions", () => {
  it("toggles the period flag", () => {
    const { onPatch } = renderCard();

    expect(screen.queryByTestId("day-log-flow-group")).toBeNull();
    fireEvent.press(screen.getByTestId("day-log-period-toggle"));

    expect(onPatch).toHaveBeenLastCalledWith({ isPeriod: true });
  });

  it("edits the flow once the day is marked as a period day", () => {
    const { onPatch } = renderCard({ record: { isPeriod: true } });

    fireEvent.press(screen.getByTestId("day-log-flow-medium"));

    expect(onPatch).toHaveBeenLastCalledWith({ flow: "medium" });
  });

  it("selects a mood rating and clears it when the same rating is pressed again", () => {
    const { onPatch, rerenderWith } = renderCard();

    fireEvent.press(screen.getByTestId("day-log-mood-3"));
    expect(onPatch).toHaveBeenLastCalledWith({ mood: 3 });

    rerenderWith({ record: { mood: 3 } });
    fireEvent.press(screen.getByTestId("day-log-mood-3"));
    expect(onPatch).toHaveBeenLastCalledWith({ mood: 0 });
  });

  it("adds and removes a symptom selection", () => {
    const { onPatch, rerenderWith } = renderCard();

    fireEvent.press(screen.getByTestId("day-log-symptom-cramps"));
    expect(onPatch).toHaveBeenLastCalledWith({ symptomIDs: ["cramps"] });

    rerenderWith({ record: { symptomIDs: ["cramps"] } });
    fireEvent.press(screen.getByTestId("day-log-symptom-cramps"));
    expect(onPatch).toHaveBeenLastCalledWith({ symptomIDs: [] });
  });

  it("expands the symptom picker to show every option and collapses it back", () => {
    renderCard();
    const toggle = () => screen.getByTestId("day-log-more-symptoms-button");

    // Default symptom records yield 12 entry-picker options; only the first
    // six are visible until expanded.
    expect(screen.queryByTestId("day-log-symptom-breast_tenderness")).toBeNull();
    expect(toggle().props.accessibilityLabel).toBe("More symptoms (6)");
    expect(toggle().props.accessibilityState).toEqual(
      expect.objectContaining({ expanded: false }),
    );

    fireEvent.press(toggle());
    expect(screen.getByTestId("day-log-symptom-breast_tenderness")).toBeTruthy();
    expect(toggle().props.accessibilityLabel).toBe("Fewer symptoms");
    expect(toggle().props.accessibilityState).toEqual(
      expect.objectContaining({ expanded: true }),
    );

    fireEvent.press(toggle());
    expect(screen.queryByTestId("day-log-symptom-breast_tenderness")).toBeNull();
    expect(toggle().props.accessibilityLabel).toBe("More symptoms (6)");
  });

  it("hides the show-more control when six or fewer symptom options are available", () => {
    renderCard({ symptomRecords: createDefaultSymptomRecords().slice(0, 6) });

    expect(screen.queryByTestId("day-log-more-symptoms-button")).toBeNull();
  });

  it("auto-collapses an expanded symptom picker once the option list shrinks to six or fewer", () => {
    const { rerenderWith } = renderCard();
    fireEvent.press(screen.getByTestId("day-log-more-symptoms-button"));
    expect(screen.getByTestId("day-log-symptom-breast_tenderness")).toBeTruthy();

    // slice(0, 5) covers cramps/headache/mood_swings/bloating/fatigue; after
    // the hidden-builtin filter that leaves only cramps/headache/bloating
    // (3 options) — well under six, and it drops breast_tenderness entirely
    // rather than just re-including it unhidden.
    rerenderWith({ symptomRecords: createDefaultSymptomRecords().slice(0, 5) });

    expect(screen.queryByTestId("day-log-more-symptoms-button")).toBeNull();
    expect(screen.queryByTestId("day-log-symptom-breast_tenderness")).toBeNull();
  });

  it("keeps an already-selected symptom visible even while the picker is collapsed", () => {
    renderCard({ record: { symptomIDs: ["food_cravings"] } });

    // food_cravings sits beyond the first six in the entry-picker order, but
    // stays pinned visible because it is already selected on this record.
    expect(screen.getByTestId("day-log-symptom-food_cravings")).toBeTruthy();
    expect(screen.queryByTestId("day-log-symptom-breast_tenderness")).toBeNull();
    expect(screen.getByTestId("day-log-more-symptoms-button").props.accessibilityLabel).toBe(
      "More symptoms (5)",
    );
  });

  it("adds and removes a cycle factor tag", () => {
    const { onPatch, rerenderWith } = renderCard();

    fireEvent.press(screen.getByTestId("day-log-factor-travel"));
    expect(onPatch).toHaveBeenLastCalledWith({ cycleFactorKeys: ["travel"] });

    rerenderWith({ record: { cycleFactorKeys: ["travel"] } });
    fireEvent.press(screen.getByTestId("day-log-factor-travel"));
    expect(onPatch).toHaveBeenLastCalledWith({ cycleFactorKeys: [] });
  });

  it("hides the cycle factors section when hideCycleFactors is enabled", () => {
    renderCard({ profileOverrides: { hideCycleFactors: true } });

    expect(screen.queryByTestId("day-log-factor-group")).toBeNull();
  });

  it("edits intimacy when the section is visible", () => {
    const { onPatch } = renderCard();

    fireEvent.press(screen.getByTestId("day-log-sex-protected"));

    expect(onPatch).toHaveBeenLastCalledWith({ sexActivity: "protected" });
  });

  it("hides the intimacy section when hideSexChip is enabled", () => {
    renderCard({ profileOverrides: { hideSexChip: true } });

    expect(screen.queryByTestId("day-log-sex-group")).toBeNull();
  });

  it("hides BBT, cervical mucus, and LH-test by default while always showing the pregnancy-test section", () => {
    renderCard();

    expect(screen.queryByTestId("day-log-bbt-input")).toBeNull();
    expect(screen.queryByTestId("day-log-cervical-group")).toBeNull();
    expect(screen.queryByTestId("day-log-lh-group")).toBeNull();
    expect(screen.getByTestId("day-log-pregnancy-group")).toBeTruthy();
  });

  it("edits cervical mucus and LH test once tracking is enabled", () => {
    const { onPatch } = renderCard({
      profileOverrides: { trackCervicalMucus: true },
      premiumOptions: { showLHTests: true },
    });

    fireEvent.press(screen.getByTestId("day-log-cervical-eggwhite"));
    expect(onPatch).toHaveBeenLastCalledWith({ cervicalMucus: "eggwhite" });

    fireEvent.press(screen.getByTestId("day-log-lh-peak"));
    expect(onPatch).toHaveBeenLastCalledWith({ lhTest: "peak" });
  });

  it("edits the pregnancy test field", () => {
    const { onPatch } = renderCard();

    fireEvent.press(screen.getByTestId("day-log-pregnancy-positive"));

    expect(onPatch).toHaveBeenLastCalledWith({ pregnancyTest: "positive" });
  });

  it("edits notes when the section is visible", () => {
    const { onPatch } = renderCard();

    fireEvent.changeText(screen.getByTestId("day-log-notes-input"), "Felt tired today");

    expect(onPatch).toHaveBeenLastCalledWith({ notes: "Felt tired today" });
  });

  it("hides notes when hideNotes is enabled", () => {
    renderCard({ profileOverrides: { hideNotes: true } });

    expect(screen.queryByTestId("day-log-notes-input")).toBeNull();
  });

  it("reformats the BBT text to the canonical stored value on blur", () => {
    const { onPatch } = renderCard({
      profileOverrides: { trackBBT: true },
      record: { bbt: 36.5 },
    });
    const input = screen.getByTestId("day-log-bbt-input");

    fireEvent.changeText(input, "9");
    expect(input.props.value).toBe("9");
    expect(onPatch).toHaveBeenLastCalledWith({ bbt: 9 });

    fireEvent(input, "blur");
    expect(input.props.value).toBe("36.50");
  });

  it("discards an uncommitted BBT edit when the day changes", () => {
    const { rerenderWith } = renderCard({
      date: "2026-05-31",
      profileOverrides: { trackBBT: true },
      record: { bbt: 36.5 },
    });
    const input = () => screen.getByTestId("day-log-bbt-input");
    expect(input().props.value).toBe("36.50");

    fireEvent.changeText(input(), "37.2");
    expect(input().props.value).toBe("37.2");

    rerenderWith({ date: "2026-06-01", record: { bbt: 36.8 } });

    expect(input().props.value).toBe("36.80");
  });

  it("applies the highlighted style only to the matching section", () => {
    renderCard({ highlightedSection: "symptoms" });

    const highlighted = flattenStyle(sectionWrapperOf("day-log-symptom-group").props.style);
    const notHighlighted = flattenStyle(sectionWrapperOf("day-log-mood-group").props.style);

    expect(highlighted).toEqual(
      expect.arrayContaining([expect.objectContaining({ borderWidth: 1 })]),
    );
    expect(notHighlighted).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ borderWidth: 1 })]),
    );
  });

  it("reports the measured section offset through onSectionLayout", () => {
    const onSectionLayout = jest.fn();
    renderCard({ onSectionLayout });

    fireEvent(sectionWrapperOf("day-log-symptom-group"), "layout", {
      nativeEvent: { layout: { height: 40, width: 300, x: 0, y: 123 } },
    });

    expect(onSectionLayout).toHaveBeenCalledWith("symptoms", 123);
  });

  it("orders BBT relative to cervical mucus, LH test, and pregnancy test differently per variant", () => {
    const overrides: RenderCardOptions = {
      profileOverrides: { trackBBT: true, trackCervicalMucus: true },
      premiumOptions: { showLHTests: true },
    };

    const calendarTree = JSON.stringify(
      renderCard({ ...overrides, variant: "calendar" }).toJSON(),
    );
    expect(calendarTree.indexOf("day-log-bbt-input")).toBeGreaterThanOrEqual(0);
    expect(calendarTree.indexOf("day-log-bbt-input")).toBeLessThan(
      calendarTree.indexOf("day-log-cervical-group"),
    );
    expect(calendarTree.indexOf("day-log-cervical-group")).toBeLessThan(
      calendarTree.indexOf("day-log-lh-group"),
    );
    expect(calendarTree.indexOf("day-log-lh-group")).toBeLessThan(
      calendarTree.indexOf("day-log-pregnancy-group"),
    );

    const dashboardTree = JSON.stringify(
      renderCard({ ...overrides, variant: "dashboard" }).toJSON(),
    );
    expect(dashboardTree.indexOf("day-log-cervical-group")).toBeLessThan(
      dashboardTree.indexOf("day-log-lh-group"),
    );
    expect(dashboardTree.indexOf("day-log-lh-group")).toBeLessThan(
      dashboardTree.indexOf("day-log-pregnancy-group"),
    );
    expect(dashboardTree.indexOf("day-log-pregnancy-group")).toBeLessThan(
      dashboardTree.indexOf("day-log-bbt-input"),
    );
  });
});

describe("DayLogEditorCard save/cancel/delete actions", () => {
  it("shows the delete action once an entry exists and fires onDelete", () => {
    const onDelete = jest.fn();
    renderCard({ entryExists: true, onDelete });

    fireEvent.press(screen.getByTestId("day-log-delete-button"));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("hides the delete action when the entry does not exist yet, even if onDelete is provided", () => {
    renderCard({ entryExists: false, onDelete: jest.fn() });

    expect(screen.queryByTestId("day-log-delete-button")).toBeNull();
  });

  it("shows only the cancel action, using the provided label, when showsSaveAction is false", () => {
    const onCancel = jest.fn();
    renderCard({ showsSaveAction: false, onCancel, cancelLabel: "Discard changes" });

    expect(screen.queryByTestId("day-log-save-button")).toBeNull();
    expect(screen.getByText("Discard changes")).toBeTruthy();

    fireEvent.press(screen.getByTestId("day-log-cancel-button"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("hides the entire action row when there is no save action and no cancel handler", () => {
    renderCard({ showsSaveAction: false });

    expect(screen.queryByTestId("day-log-save-button")).toBeNull();
    expect(screen.queryByTestId("day-log-cancel-button")).toBeNull();
  });

  it("disables save, cancel, and delete while a save is in flight", () => {
    // onCancel here intentionally omits cancelLabel, covering the "" fallback.
    renderCard({
      isSaving: true,
      entryExists: true,
      onCancel: jest.fn(),
      onDelete: jest.fn(),
    });

    expect(screen.getByTestId("day-log-save-button").props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
    expect(screen.getByTestId("day-log-cancel-button").props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
    expect(screen.getByTestId("day-log-delete-button").props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  it("shows the autosave status banner with the given message", () => {
    renderCard({ statusMessage: "Saving locally...", statusTone: "info" });

    expect(screen.getByTestId("day-log-status-banner")).toBeTruthy();
    expect(screen.getByText("Saving locally...")).toBeTruthy();
  });

  it("renders a bleeding safety hint under the flow field only when provided", () => {
    const { rerenderWith } = renderCard({
      record: { isPeriod: true, flow: "heavy" },
    });

    expect(screen.queryByTestId("day-log-bleeding-safety-hint")).toBeNull();

    rerenderWith({
      record: { isPeriod: true, flow: "heavy" },
      bleedingSafetyHint: "Guidance, not a diagnosis: see a clinician.",
    });

    expect(screen.getByTestId("day-log-bleeding-safety-hint")).toBeTruthy();
    expect(
      screen.getByText("Guidance, not a diagnosis: see a clinician."),
    ).toBeTruthy();
  });

  it("hides the bleeding safety hint when the day is not a period day", () => {
    renderCard({
      record: { isPeriod: false },
      bleedingSafetyHint: "Guidance, not a diagnosis: see a clinician.",
    });

    // Flow section (and its hint) only render for a period day.
    expect(screen.queryByTestId("day-log-bleeding-safety-hint")).toBeNull();
  });
});

function renderMetricsCard(
  recordOverrides: Partial<{
    weightKg: number;
    bpSystolic: number;
    bpDiastolic: number;
  }> = {},
  showPregnancyMetrics = true,
) {
  const profile = createDefaultProfileRecord();
  const viewData = buildDayLogEditorViewData(
    profile,
    "2026-05-31",
    createDefaultSymptomRecords(),
    [],
    "en",
    { showPregnancyMetrics },
  );
  const onPatch = jest.fn();

  render(
    <DayLogEditorCard
      entryExists={false}
      isSaving={false}
      record={{ ...createEmptyDayLogRecord("2026-05-31"), ...recordOverrides }}
      statusMessage=""
      viewData={viewData}
      onPatch={onPatch}
      onSave={jest.fn()}
    />,
  );

  return { onPatch };
}

describe("DayLogEditorCard pregnancy metrics", () => {
  it("hides weight and blood pressure inputs when the visibility flag is off (no active pregnancy)", () => {
    renderMetricsCard({}, false);

    expect(screen.queryByTestId("day-log-weight-input")).toBeNull();
    expect(screen.queryByTestId("day-log-bp-systolic-input")).toBeNull();
    expect(screen.queryByTestId("day-log-bp-diastolic-input")).toBeNull();
  });

  it("shows weight and blood pressure inputs when the visibility flag is on (active pregnancy)", () => {
    renderMetricsCard({}, true);

    expect(screen.getByTestId("day-log-weight-input")).toBeTruthy();
    expect(screen.getByTestId("day-log-bp-systolic-input")).toBeTruthy();
    expect(screen.getByTestId("day-log-bp-diastolic-input")).toBeTruthy();
  });

  it("patches a typed weight value", () => {
    const { onPatch } = renderMetricsCard({}, true);

    fireEvent.changeText(screen.getByTestId("day-log-weight-input"), "65.5");

    expect(screen.getByTestId("day-log-weight-input").props.value).toBe("65.5");
    expect(onPatch).toHaveBeenLastCalledWith({ weightKg: 65.5 });
  });

  it("patches typed systolic and diastolic values independently", () => {
    const { onPatch } = renderMetricsCard({}, true);

    fireEvent.changeText(screen.getByTestId("day-log-bp-systolic-input"), "120");
    expect(onPatch).toHaveBeenLastCalledWith({ bpSystolic: 120 });

    fireEvent.changeText(screen.getByTestId("day-log-bp-diastolic-input"), "80");
    expect(onPatch).toHaveBeenLastCalledWith({ bpDiastolic: 80 });
  });

  it("shows a stored weight and clears it to an absent-mapping zero-patch when emptied", () => {
    const { onPatch } = renderMetricsCard({ weightKg: 65.5 }, true);

    expect(screen.getByTestId("day-log-weight-input").props.value).toBe("65.5");

    fireEvent.changeText(screen.getByTestId("day-log-weight-input"), "");

    expect(screen.getByTestId("day-log-weight-input").props.value).toBe("");
    // 0 is not a legal weight (normalizeDayWeightKg's MIN is 30), so the
    // downstream sanitize step drops the key entirely -- this is how an
    // emptied field maps to "absent", not to a literal 0 kg reading.
    expect(onPatch).toHaveBeenLastCalledWith({ weightKg: 0 });
  });

  it("drops letters and extra separators from the weight input", () => {
    const { onPatch } = renderMetricsCard({}, true);

    fireEvent.changeText(screen.getByTestId("day-log-weight-input"), "6a5.5.7b");

    expect(screen.getByTestId("day-log-weight-input").props.value).toBe("65.57");
    expect(onPatch).toHaveBeenLastCalledWith({ weightKg: 65.57 });
  });

  it("drops non-digit characters from blood pressure inputs", () => {
    const { onPatch } = renderMetricsCard({}, true);

    fireEvent.changeText(screen.getByTestId("day-log-bp-systolic-input"), "1a2c0");

    expect(screen.getByTestId("day-log-bp-systolic-input").props.value).toBe("120");
    expect(onPatch).toHaveBeenLastCalledWith({ bpSystolic: 120 });
  });
});

describe("pregnancy metric edge input", () => {
  it("renders saved positive metrics and resets a cleared field on blur", () => {
    const { onPatch } = renderMetricsCard({
      weightKg: 65.4,
      bpSystolic: 118,
      bpDiastolic: 76,
    });

    const weight = screen.getByTestId("day-log-weight-input");
    expect(weight.props.value).toBe("65.4");

    // Clearing then leaving the field restores the saved value instead of
    // persisting an empty string.
    fireEvent.changeText(weight, "");
    fireEvent(weight, "blur");
    expect(screen.getByTestId("day-log-weight-input").props.value).toBe("65.4");
    fireEvent(screen.getByTestId("day-log-bp-systolic-input"), "blur");
    fireEvent(screen.getByTestId("day-log-bp-diastolic-input"), "blur");
    expect(onPatch).toHaveBeenCalled();
  });

  it("patches unparseable blood-pressure input as cleared (0), never NaN", () => {
    const { onPatch } = renderMetricsCard();

    fireEvent.changeText(screen.getByTestId("day-log-bp-systolic-input"), "abc");
    expect(onPatch).toHaveBeenLastCalledWith({ bpSystolic: 0 });
    fireEvent.changeText(screen.getByTestId("day-log-bp-diastolic-input"), "xyz");
    expect(onPatch).toHaveBeenLastCalledWith({ bpDiastolic: 0 });
  });
});

