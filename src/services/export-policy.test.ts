import type { ExportPreset } from "../models/export";
import {
  applyExportPreset,
  clampDateToBounds,
  createDefaultExportRangeValues,
  resolveExportBounds,
  resolveExportPresetSelection,
  sanitizeExportDateInput,
  validateExportRangeValues,
} from "./export-policy";

describe("export-policy", () => {
  it("defaults to the full available range like the web settings export", () => {
    const now = new Date(2026, 2, 18);
    const bounds = resolveExportBounds(
      {
        totalEntries: 8,
        hasData: true,
        dateFrom: "2026-01-10",
        dateTo: "2026-03-16",
      },
      now,
    );

    expect(createDefaultExportRangeValues(
      {
        totalEntries: 8,
        hasData: true,
        dateFrom: "2026-01-10",
        dateTo: "2026-03-16",
      },
      now,
    )).toEqual({
      preset: "all",
      fromDate: "2026-01-10",
      toDate: "2026-03-18",
    });
    expect(bounds).toEqual({
      minDate: "2026-01-10",
      maxDate: "2026-03-18",
    });
  });

  it("matches the web 30-day preset window inclusively", () => {
    const range = applyExportPreset(
      "30",
      {
        minDate: "2026-01-10",
        maxDate: "2026-03-18",
      },
      new Date(2026, 2, 18),
    );

    expect(range).toEqual({
      preset: "30",
      fromDate: "2026-02-17",
      toDate: "2026-03-18",
    });
    expect(
      resolveExportPresetSelection(
        range,
        {
          minDate: "2026-01-10",
          maxDate: "2026-03-18",
        },
        new Date(2026, 2, 18),
      ),
    ).toBe("30");
  });

  it("rejects invalid export date ranges", () => {
    expect(
      validateExportRangeValues(
        {
          preset: "custom",
          fromDate: "2026-03-18",
          toDate: "2026-03-17",
        },
        {
          minDate: "2026-01-10",
          maxDate: "2026-03-18",
        },
      ),
    ).toEqual({
      ok: false,
      errorCode: "invalid_range",
    });

    expect(
      validateExportRangeValues(
        {
          preset: "custom",
          fromDate: "2026-03-19",
          toDate: "2026-03-18",
        },
        {
          minDate: "2026-01-10",
          maxDate: "2026-03-18",
        },
      ),
    ).toEqual({
      ok: false,
      errorCode: "invalid_from_date",
    });

    expect(
      validateExportRangeValues(
        {
          preset: "custom",
          fromDate: "2026-02-30",
          toDate: "2026-03-18",
        },
        {
          minDate: "2026-01-10",
          maxDate: "2026-03-18",
        },
      ),
    ).toEqual({
      ok: false,
      errorCode: "invalid_from_date",
    });
  });

  it("sanitizes free-text export dates into the canonical YYYY-MM-DD form", () => {
    expect(sanitizeExportDateInput("2026abc0310xyz")).toBe("2026-03-10");
    expect(sanitizeExportDateInput("2026-03-10oops")).toBe("2026-03-10");
    expect(sanitizeExportDateInput("202603")).toBe("2026-03");
  });

  it("clamps the custom preset to the full available bounds", () => {
    const range = applyExportPreset(
      "custom",
      { minDate: "2026-01-10", maxDate: "2026-03-18" },
      new Date(2026, 2, 18),
    );

    expect(range).toEqual({
      preset: "custom",
      fromDate: "2026-01-10",
      toDate: "2026-03-18",
    });
  });

  it("falls back to a custom range when the preset window is not a positive number", () => {
    const range = applyExportPreset(
      "not-a-number" as ExportPreset,
      { minDate: "2026-01-10", maxDate: "2026-03-18" },
      new Date(2026, 2, 18),
    );

    expect(range).toEqual({
      preset: "custom",
      fromDate: "2026-01-10",
      toDate: "2026-03-18",
    });
  });

  it("accepts a valid custom export range within bounds", () => {
    expect(
      validateExportRangeValues(
        { preset: "custom", fromDate: "2026-01-15", toDate: "2026-02-01" },
        { minDate: "2026-01-10", maxDate: "2026-03-18" },
      ),
    ).toEqual({
      ok: true,
      fromDate: "2026-01-15",
      toDate: "2026-02-01",
    });
  });

  it("rejects a malformed to-date", () => {
    expect(
      validateExportRangeValues(
        { preset: "custom", fromDate: "2026-01-15", toDate: "2026-02-30" },
        { minDate: "2026-01-10", maxDate: "2026-03-18" },
      ),
    ).toEqual({
      ok: false,
      errorCode: "invalid_to_date",
    });
  });

  it("rejects a to-date beyond the available upper bound", () => {
    expect(
      validateExportRangeValues(
        { preset: "custom", fromDate: "2026-01-15", toDate: "2026-04-01" },
        { minDate: "2026-01-10", maxDate: "2026-03-18" },
      ),
    ).toEqual({
      ok: false,
      errorCode: "invalid_to_date",
    });
  });

  it("clamps an out-of-bounds date and passes through a valid one", () => {
    const bounds = { minDate: "2026-01-10", maxDate: "2026-03-18" };

    expect(clampDateToBounds("2025-12-01", bounds)).toBe("2026-01-10");
    expect(clampDateToBounds("2026-04-01", bounds)).toBe("2026-03-18");
    expect(clampDateToBounds("2026-02-01", bounds)).toBe("2026-02-01");
  });

  it("returns null for an empty or malformed clamp input", () => {
    const bounds = { minDate: "2026-01-10", maxDate: "2026-03-18" };

    expect(clampDateToBounds("", bounds)).toBeNull();
    expect(clampDateToBounds("2026-02-30", bounds)).toBeNull();
  });
});
