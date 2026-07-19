import type { SymptomID } from "../../../models/symptom";
import type { LoadedSettingsState } from "../../../services/settings-view-service";
import {
  buildMergedRowSymptomDraft,
  hasCompleteExportDates,
  removeRowMessage,
  removeRowSymptomDraft,
} from "./settings-screen-updaters";

function stateWithSymptom(
  overrides: Partial<LoadedSettingsState["symptomRecords"][number]> = {},
): LoadedSettingsState {
  return {
    symptomRecords: [
      {
        id: "cramps" as SymptomID,
        slug: "cramps",
        label: "Cramps",
        icon: "🩸",
        color: "#FF4444",
        isArchived: false,
        sortOrder: 0,
        isDefault: true,
        ...overrides,
      },
    ],
  } as unknown as LoadedSettingsState;
}

describe("buildMergedRowSymptomDraft", () => {
  it("seeds a fresh draft from the existing record when none is drafted yet", () => {
    const state = stateWithSymptom();

    const result = buildMergedRowSymptomDraft(
      state,
      {},
      "cramps" as SymptomID,
      { label: "Cramping" },
    );

    expect(result["cramps"]).toEqual({ label: "Cramping", icon: "🩸" });
  });

  it("falls back to blank label and the default sparkle icon for an unknown record", () => {
    const state = stateWithSymptom();

    const result = buildMergedRowSymptomDraft(
      state,
      {},
      "unknown-id" as SymptomID,
      { icon: "🔥" },
    );

    expect(result["unknown-id"]).toEqual({ label: "", icon: "🔥" });
  });

  it("merges partial updates onto an existing draft without discarding the other field", () => {
    const state = stateWithSymptom();
    const existingDrafts = {
      cramps: { label: "Custom label", icon: "⭐" },
    };

    const result = buildMergedRowSymptomDraft(
      state,
      existingDrafts,
      "cramps" as SymptomID,
      { icon: "🔥" },
    );

    expect(result["cramps"]).toEqual({ label: "Custom label", icon: "🔥" });
  });

  it("leaves drafts for other symptom rows untouched", () => {
    const state = stateWithSymptom();
    const existingDrafts = {
      "other-id": { label: "Other", icon: "✨" },
    };

    const result = buildMergedRowSymptomDraft(
      state,
      existingDrafts,
      "cramps" as SymptomID,
      { label: "Cramping" },
    );

    expect(result["other-id"]).toEqual({ label: "Other", icon: "✨" });
  });
});

describe("removeRowSymptomDraft", () => {
  it("removes only the targeted row's draft", () => {
    const drafts = {
      cramps: { label: "Cramping", icon: "🩸" },
      headache: { label: "Head pain", icon: "🤕" },
    };

    const result = removeRowSymptomDraft(drafts, "cramps" as SymptomID);

    expect(result).toEqual({
      headache: { label: "Head pain", icon: "🤕" },
    });
    // The original map is left untouched (pure update).
    expect(drafts["cramps"]).toBeDefined();
  });
});

describe("removeRowMessage", () => {
  it("removes only the targeted row's message", () => {
    const messages = { cramps: "Saved", headache: "Failed" };

    const result = removeRowMessage(messages, "cramps" as SymptomID);

    expect(result).toEqual({ headache: "Failed" });
  });
});

describe("hasCompleteExportDates", () => {
  it.each([
    ["both dates fully typed", "2026-03-01", "2026-03-17", true],
    ["from date still partial", "2026-03-0", "2026-03-17", false],
    ["to date empty", "2026-03-01", "", false],
    ["both empty", "", "", false],
  ])("%s -> %s", (_label, fromDate, toDate, expected) => {
    expect(
      hasCompleteExportDates({ preset: "custom", fromDate, toDate }),
    ).toBe(expected);
  });
});
