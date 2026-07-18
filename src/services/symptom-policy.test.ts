import {
  createDefaultSymptomRecords,
  DEFAULT_CUSTOM_SYMPTOM_COLOR,
  type SymptomRecord,
} from "../models/symptom";
import {
  archiveCustomSymptomRecord,
  buildEntryPickerSymptoms,
  createCustomSymptomRecord,
  normalizeDayLogSymptomIDs,
  normalizeSymptomIconInput,
  normalizeSymptomLabelInput,
  resolveSymptomColorInput,
  restoreCustomSymptomRecord,
  sortSymptomRecords,
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

describe("sortSymptomRecords", () => {
  it("sorts two custom (non-default) records with different labels alphabetically", () => {
    const zeta: SymptomRecord = {
      id: "custom_zeta",
      slug: "zeta",
      label: "Zeta symptom",
      icon: "✨",
      color: "#E8799F",
      isArchived: false,
      sortOrder: 0,
      isDefault: false,
    };
    const alpha: SymptomRecord = {
      ...zeta,
      id: "custom_alpha",
      slug: "alpha",
      label: "Alpha symptom",
      sortOrder: 1,
    };

    expect(sortSymptomRecords([zeta, alpha]).map((record) => record.id)).toEqual([
      "custom_alpha",
      "custom_zeta",
    ]);
  });

  it("breaks a tie between two records with the same normalized label by sortOrder", () => {
    // Two custom records can end up sharing a label when one is archived (the
    // duplicate check only re-validates at create/update/restore time) -- the
    // sort must still be deterministic rather than relying on array order.
    const second: SymptomRecord = {
      id: "custom_second",
      slug: "old-symptom-2",
      label: "Old symptom",
      icon: "✨",
      color: "#E8799F",
      isArchived: true,
      sortOrder: 5,
      isDefault: false,
    };
    const first: SymptomRecord = {
      ...second,
      id: "custom_first",
      slug: "old-symptom-1",
      sortOrder: 2,
    };

    expect(sortSymptomRecords([second, first]).map((record) => record.id)).toEqual([
      "custom_first",
      "custom_second",
    ]);
  });
});

describe("normalizeDayLogSymptomIDs", () => {
  it("drops duplicate and blank/whitespace-only entries while preserving first-seen order", () => {
    expect(
      normalizeDayLogSymptomIDs(["cramps", "cramps", "  ", "headache", "cramps"]),
    ).toEqual(["cramps", "headache"]);
  });
});

describe("normalizeSymptomLabelInput", () => {
  it("rejects an empty (or whitespace-only) label", () => {
    expect(normalizeSymptomLabelInput("")).toEqual({
      ok: false,
      errorCode: "label_required",
    });
    expect(normalizeSymptomLabelInput("   ")).toEqual({
      ok: false,
      errorCode: "label_required",
    });
  });

  it("rejects a label longer than the max length (40 runes)", () => {
    expect(normalizeSymptomLabelInput("a".repeat(41))).toEqual({
      ok: false,
      errorCode: "label_too_long",
    });
  });

  it("rejects a label containing '<' or a control character", () => {
    expect(normalizeSymptomLabelInput("a<b")).toEqual({
      ok: false,
      errorCode: "label_invalid_characters",
    });
    expect(normalizeSymptomLabelInput("a\x01b")).toEqual({
      ok: false,
      errorCode: "label_invalid_characters",
    });
  });

  it("collapses internal whitespace and trims", () => {
    expect(normalizeSymptomLabelInput("  Jaw   pain  ")).toEqual({
      ok: true,
      value: "Jaw pain",
    });
  });
});

describe("resolveSymptomColorInput", () => {
  it("uppercases a valid hex color", () => {
    expect(resolveSymptomColorInput("#aabbcc", "#000000")).toEqual({
      ok: true,
      value: "#AABBCC",
    });
  });

  it("falls back to the (uppercased) fallback color when raw is empty", () => {
    expect(resolveSymptomColorInput("", "#123abc")).toEqual({
      ok: true,
      value: "#123ABC",
    });
  });

  it("falls back to the default custom symptom color when both raw and fallback are empty", () => {
    expect(resolveSymptomColorInput("", "")).toEqual({
      ok: true,
      value: DEFAULT_CUSTOM_SYMPTOM_COLOR,
    });
  });

  it("rejects a color that is not a 6-digit hex value", () => {
    expect(resolveSymptomColorInput("not-a-color", "#000000")).toEqual({
      ok: false,
      errorCode: "invalid_color",
    });
  });
});

describe("createCustomSymptomRecord additional validation and fallback paths", () => {
  it("propagates a label validation error (empty label) ahead of any icon/color check", () => {
    const result = createCustomSymptomRecord(createDefaultSymptomRecords(), {
      label: "",
      icon: "✨",
    });
    expect(result).toEqual({ ok: false, errorCode: "label_required" });
  });

  it("rejects an invalid custom color", () => {
    const result = createCustomSymptomRecord(createDefaultSymptomRecords(), {
      label: "Valid label",
      icon: "✨",
      color: "not-a-color",
    });
    expect(result).toEqual({ ok: false, errorCode: "invalid_color" });
  });

  it("rejects a label that duplicates an existing CUSTOM symptom, not just a built-in", () => {
    const created = createCustomSymptomRecord(createDefaultSymptomRecords(), {
      label: "First custom",
      icon: "✨",
    });
    if (!created.ok) {
      throw new Error("Expected the first custom symptom to be created");
    }

    const duplicate = createCustomSymptomRecord(
      [...createDefaultSymptomRecords(), created.record],
      { label: "  first CUSTOM  ", icon: "🔥" },
    );
    expect(duplicate).toEqual({ ok: false, errorCode: "duplicate_label" });
  });

  it("falls back to the generic slug when the label has no alphanumeric characters to slugify", () => {
    const result = createCustomSymptomRecord(createDefaultSymptomRecords(), {
      label: "🔥🔥",
      icon: "✨",
    });
    expect(result).toEqual({
      ok: true,
      record: expect.objectContaining({ label: "🔥🔥", slug: "custom-symptom" }),
    });
  });
});

describe("updateCustomSymptomRecord failure modes (previously only the happy path was tested)", () => {
  it("returns not_found for an unknown record id", () => {
    const result = updateCustomSymptomRecord(createDefaultSymptomRecords(), "missing_id", {
      label: "New label",
      icon: "✨",
    });
    expect(result).toEqual({ ok: false, errorCode: "not_found" });
  });

  it("returns builtin_edit_forbidden when targeting a built-in record", () => {
    const result = updateCustomSymptomRecord(createDefaultSymptomRecords(), "cramps", {
      label: "New label",
      icon: "✨",
    });
    expect(result).toEqual({ ok: false, errorCode: "builtin_edit_forbidden" });
  });

  it("propagates a label validation error", () => {
    const baseRecords = createDefaultSymptomRecords();
    const created = createCustomSymptomRecord(baseRecords, { label: "Jaw pain", icon: "✨" });
    if (!created.ok) {
      throw new Error("Expected the custom symptom to be created");
    }

    const result = updateCustomSymptomRecord(
      [...baseRecords, created.record],
      created.record.id,
      { label: "", icon: "✨" },
    );
    expect(result).toEqual({ ok: false, errorCode: "label_required" });
  });

  it("returns duplicate_label when renaming to another existing record's label", () => {
    const baseRecords = createDefaultSymptomRecords();
    const first = createCustomSymptomRecord(baseRecords, { label: "Jaw pain", icon: "✨" });
    const second = createCustomSymptomRecord(baseRecords, { label: "Neck pain", icon: "✨" });
    if (!first.ok || !second.ok) {
      throw new Error("Expected both custom symptoms to be created");
    }
    const allRecords = [...baseRecords, first.record, second.record];

    const result = updateCustomSymptomRecord(allRecords, second.record.id, {
      label: "Jaw pain",
      icon: "✨",
    });
    expect(result).toEqual({ ok: false, errorCode: "duplicate_label" });
  });

  it("propagates an icon validation error", () => {
    const baseRecords = createDefaultSymptomRecords();
    const created = createCustomSymptomRecord(baseRecords, { label: "Jaw pain", icon: "✨" });
    if (!created.ok) {
      throw new Error("Expected the custom symptom to be created");
    }

    const result = updateCustomSymptomRecord(
      [...baseRecords, created.record],
      created.record.id,
      { label: "Jaw pain", icon: "<script>" },
    );
    expect(result).toEqual({ ok: false, errorCode: "icon_invalid_characters" });
  });

  it("propagates a color validation error", () => {
    const baseRecords = createDefaultSymptomRecords();
    const created = createCustomSymptomRecord(baseRecords, { label: "Jaw pain", icon: "✨" });
    if (!created.ok) {
      throw new Error("Expected the custom symptom to be created");
    }

    const result = updateCustomSymptomRecord(
      [...baseRecords, created.record],
      created.record.id,
      { label: "Jaw pain", icon: "✨", color: "not-a-color" },
    );
    expect(result).toEqual({ ok: false, errorCode: "invalid_color" });
  });
});

describe("archiveCustomSymptomRecord failure and idempotent paths", () => {
  it("returns not_found for an unknown record id", () => {
    expect(archiveCustomSymptomRecord(createDefaultSymptomRecords(), "missing_id")).toEqual({
      ok: false,
      errorCode: "not_found",
    });
  });

  it("returns builtin_edit_forbidden when archiving a built-in record", () => {
    expect(archiveCustomSymptomRecord(createDefaultSymptomRecords(), "cramps")).toEqual({
      ok: false,
      errorCode: "builtin_edit_forbidden",
    });
  });

  it("is idempotent: archiving an already-archived record returns it unchanged", () => {
    const baseRecords = createDefaultSymptomRecords();
    const created = createCustomSymptomRecord(baseRecords, { label: "Jaw pain", icon: "✨" });
    if (!created.ok) {
      throw new Error("Expected the custom symptom to be created");
    }
    const archivedOnce = archiveCustomSymptomRecord(
      [...baseRecords, created.record],
      created.record.id,
    );
    if (!archivedOnce.ok) {
      throw new Error("Expected the first archive to succeed");
    }

    const archivedTwice = archiveCustomSymptomRecord(
      [...baseRecords, archivedOnce.record],
      archivedOnce.record.id,
    );
    expect(archivedTwice).toEqual({ ok: true, record: archivedOnce.record });
  });
});

describe("restoreCustomSymptomRecord failure and idempotent paths", () => {
  it("returns not_found for an unknown record id", () => {
    expect(restoreCustomSymptomRecord(createDefaultSymptomRecords(), "missing_id")).toEqual({
      ok: false,
      errorCode: "not_found",
    });
  });

  it("returns builtin_edit_forbidden when restoring a built-in record", () => {
    expect(restoreCustomSymptomRecord(createDefaultSymptomRecords(), "cramps")).toEqual({
      ok: false,
      errorCode: "builtin_edit_forbidden",
    });
  });

  it("is idempotent: restoring an already-active record returns it unchanged", () => {
    const baseRecords = createDefaultSymptomRecords();
    const created = createCustomSymptomRecord(baseRecords, { label: "Jaw pain", icon: "✨" });
    if (!created.ok) {
      throw new Error("Expected the custom symptom to be created");
    }

    const result = restoreCustomSymptomRecord(
      [...baseRecords, created.record],
      created.record.id,
    );
    expect(result).toEqual({ ok: true, record: created.record });
  });

  it("returns duplicate_label when another record already holds the archived record's label", () => {
    // Hand-built records array representing a data state where an archived
    // custom symptom and a different active one now share a label -- restore
    // must re-validate availability rather than blindly flip isArchived.
    const archived: SymptomRecord = {
      id: "custom_archived",
      slug: "jaw-pain",
      label: "Jaw pain",
      icon: "✨",
      color: "#E8799F",
      isArchived: true,
      sortOrder: 5,
      isDefault: false,
    };
    const collidingActive: SymptomRecord = {
      ...archived,
      id: "custom_active",
      slug: "jaw-pain-2",
      isArchived: false,
      sortOrder: 6,
    };
    const records = [...createDefaultSymptomRecords(), archived, collidingActive];

    expect(restoreCustomSymptomRecord(records, archived.id)).toEqual({
      ok: false,
      errorCode: "duplicate_label",
    });
  });
});
