import {
  createDefaultSymptomRecords,
  type SymptomRecord,
} from "../models/symptom";
import {
  archiveCustomSymptomRecord,
  buildEntryPickerSymptoms,
  createCustomSymptomRecord,
  normalizeSymptomIconInput,
  restoreCustomSymptomRecord,
  updateCustomSymptomRecord,
} from "./symptom-policy";

describe("normalizeSymptomIconInput", () => {
  it("rejects icon containing '<'", () => {
    expect(normalizeSymptomIconInput("<script>")).toEqual({
      ok: false,
      errorCode: "icon_invalid_characters",
    });
  });

  it("rejects icon containing '>'", () => {
    expect(normalizeSymptomIconInput(">")).toEqual({
      ok: false,
      errorCode: "icon_invalid_characters",
    });
  });

  it("rejects icon containing a control character", () => {
    expect(normalizeSymptomIconInput("🔥\x01")).toEqual({
      ok: false,
      errorCode: "icon_invalid_characters",
    });
  });

  it("rejects icon that exceeds the max length (> 16 runes)", () => {
    // 17 emoji — each counts as one rune
    expect(normalizeSymptomIconInput("🔥".repeat(17))).toEqual({
      ok: false,
      errorCode: "icon_too_long",
    });
  });

  it("accepts a normal emoji icon", () => {
    expect(normalizeSymptomIconInput("🔥")).toEqual({
      ok: true,
      value: "🔥",
    });
  });

  it("falls back to the default icon when input is empty", () => {
    expect(normalizeSymptomIconInput("")).toEqual({
      ok: true,
      value: "✨",
    });
  });

  it("falls back to the default icon when input is only whitespace", () => {
    expect(normalizeSymptomIconInput("   ")).toEqual({
      ok: true,
      value: "✨",
    });
  });
});

describe("symptom-policy", () => {
  it("rejects a custom symptom whose icon contains invalid characters", () => {
    const result = createCustomSymptomRecord(createDefaultSymptomRecords(), {
      label: "Test symptom",
      icon: "<script>",
    });

    expect(result).toEqual({
      ok: false,
      errorCode: "icon_invalid_characters",
    });
  });

  it("rejects custom symptom labels that duplicate built-ins case-insensitively", () => {
    const result = createCustomSymptomRecord(createDefaultSymptomRecords(), {
      label: "  cramps ",
      icon: "✨",
    });

    expect(result).toEqual({
      ok: false,
      errorCode: "duplicate_label",
    });
  });

  it("rejects custom symptom labels that duplicate localized built-ins", () => {
    const result = createCustomSymptomRecord(createDefaultSymptomRecords(), {
      label: "Спазмы",
      icon: "✨",
    });

    expect(result).toEqual({
      ok: false,
      errorCode: "duplicate_label",
    });
  });

  it("supports create, update, archive, and restore for custom symptoms", () => {
    const baseRecords = createDefaultSymptomRecords();
    const created = createCustomSymptomRecord(baseRecords, {
      label: "Jaw pain",
      icon: "🔥",
    });

    expect(created).toEqual({
      ok: true,
      record: expect.objectContaining({
        label: "Jaw pain",
        icon: "🔥",
        isArchived: false,
        isDefault: false,
      }),
    });
    if (!created.ok) {
      throw new Error("Expected a created custom symptom");
    }

    const updated = updateCustomSymptomRecord(
      [...baseRecords, created.record],
      created.record.id,
      {
        label: "Jaw tension",
        icon: "⚡",
      },
    );
    expect(updated).toEqual({
      ok: true,
      record: expect.objectContaining({
        id: created.record.id,
        label: "Jaw tension",
        icon: "⚡",
      }),
    });
    if (!updated.ok) {
      throw new Error("Expected an updated custom symptom");
    }

    const archived = archiveCustomSymptomRecord(
      [...baseRecords, updated.record],
      updated.record.id,
    );
    expect(archived).toEqual({
      ok: true,
      record: expect.objectContaining({
        id: updated.record.id,
        isArchived: true,
      }),
    });
    if (!archived.ok) {
      throw new Error("Expected an archived custom symptom");
    }

    const restored = restoreCustomSymptomRecord(
      [...baseRecords, archived.record],
      archived.record.id,
    );
    expect(restored).toEqual({
      ok: true,
      record: expect.objectContaining({
        id: archived.record.id,
        isArchived: false,
      }),
    });
  });

  it("keeps archived and hidden legacy symptoms out of the entry picker unless already selected", () => {
    const customSymptom: SymptomRecord = {
      id: "custom_jaw_pain",
      slug: "jaw-pain",
      label: "Jaw pain",
      icon: "🔥",
      color: "#E8799F",
      isArchived: false,
      sortOrder: 999,
      isDefault: false,
    };
    const archivedSymptom: SymptomRecord = {
      ...customSymptom,
      id: "custom_old",
      slug: "old-symptom",
      label: "Old symptom",
      isArchived: true,
      sortOrder: 1000,
    };

    const pickerWithoutSelection = buildEntryPickerSymptoms(
      [...createDefaultSymptomRecords(), customSymptom, archivedSymptom],
      [],
    );
    expect(pickerWithoutSelection.map((record) => record.id)).toContain("custom_jaw_pain");
    expect(pickerWithoutSelection.map((record) => record.id)).not.toContain("custom_old");
    expect(pickerWithoutSelection.map((record) => record.id)).not.toContain("fatigue");

    const pickerWithSelection = buildEntryPickerSymptoms(
      [...createDefaultSymptomRecords(), customSymptom, archivedSymptom],
      ["custom_old", "fatigue"],
    );
    expect(pickerWithSelection.map((record) => record.id)).toContain("custom_old");
    expect(pickerWithSelection.map((record) => record.id)).toContain("fatigue");
  });

  it("uses a calmer built-in order in the entry picker before deferring archived items", () => {
    const picker = buildEntryPickerSymptoms(createDefaultSymptomRecords(), []);

    expect(picker.slice(0, 6).map((record) => record.id)).toEqual([
      "cramps",
      "headache",
      "nausea",
      "bloating",
      "back_pain",
      "swelling",
    ]);
  });
});
