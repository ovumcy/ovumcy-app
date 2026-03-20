import {
  applyExportPreset,
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
});
