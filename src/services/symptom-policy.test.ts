import {
  createDefaultSymptomRecords,
  type SymptomRecord,
} from "../models/symptom";
import {
  archiveCustomSymptomRecord,
  buildEntryPickerSymptoms,
  createCustomSymptomRecord,
  restoreCustomSymptomRecord,
  updateCustomSymptomRecord,
} from "./symptom-policy";

describe("symptom-policy", () => {
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
});
