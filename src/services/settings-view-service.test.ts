import { createEmptyDayLogRecord } from "../models/day-log";
import type { ExportBackupEnvelope } from "../models/export";
import { createDefaultProfileRecord } from "../models/profile";
import { createDefaultSymptomRecords } from "../models/symptom";
import { createDefaultSyncPreferencesRecord } from "../sync/sync-contract";
import type { ImportOutcome } from "./import-service";
import {
  buildSettingsDirtyState,
  buildSettingsFlowPresentationState,
  buildSettingsHubNavigation,
  buildSettingsImportPreviewViewData,
  buildSettingsViewData,
  createLoadedSettingsState,
  revertLoadedSettingsDraftValues,
} from "./settings-view-service";

describe("settings view service", () => {
  it("exposes all supported interface languages in settings options", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");

    expect(viewData.interface.languageOptions).toEqual([
      { value: "en", label: "English" },
      { value: "ru", label: "Русский" },
      { value: "es", label: "Español" },
      { value: "de", label: "Deutsch" },
      { value: "fr", label: "Français" },
      { value: "it", label: "Italiano" },
    ]);
  });

  it("offers a Prefer-not-to-say age option first and localizes it per locale", () => {
    const en = buildSettingsViewData(new Date(2026, 2, 22), "en");
    expect(en.ageGroup.options).toEqual([
      { value: "", label: "Prefer not to say" },
      { value: "under_40", label: "Under 40" },
      { value: "age_40_45", label: "40-45" },
      { value: "age_45_plus", label: "45+" },
    ]);
    expect(
      buildSettingsViewData(new Date(2026, 2, 22), "ru").ageGroup.options[0],
    ).toEqual({ value: "", label: "Не указывать" });
    expect(
      buildSettingsViewData(new Date(2026, 2, 22), "fr").ageGroup.options[0],
    ).toEqual({ value: "", label: "Préfère ne pas répondre" });
    expect(
      buildSettingsViewData(new Date(2026, 2, 22), "de").ageGroup.options[0],
    ).toEqual({ value: "", label: "Keine Angabe" });
    expect(
      buildSettingsViewData(new Date(2026, 2, 22), "es").ageGroup.options[0],
    ).toEqual({ value: "", label: "Prefiero no decirlo" });
    expect(
      buildSettingsViewData(new Date(2026, 2, 22), "it").ageGroup.options[0],
    ).toEqual({ value: "", label: "Preferisco non indicarlo" });
  });

  it("offers Sunday and Monday as the first-day-of-week options, localized per locale", () => {
    const en = buildSettingsViewData(new Date(2026, 2, 22), "en");
    expect(en.interface.firstDayOfWeekLabel).toBe("First day of the week");
    expect(en.interface.firstDayOfWeekOptions).toEqual([
      { value: 0, label: "Sunday" },
      { value: 1, label: "Monday" },
    ]);
    expect(
      buildSettingsViewData(new Date(2026, 2, 22), "ru").interface
        .firstDayOfWeekOptions,
    ).toEqual([
      { value: 0, label: "Воскресенье" },
      { value: 1, label: "Понедельник" },
    ]);
    expect(
      buildSettingsViewData(new Date(2026, 2, 22), "de").interface
        .firstDayOfWeekLabel,
    ).toBe("Erster Tag der Woche");
  });

  it("offers light, dark, and system as the three theme options", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");

    expect(viewData.interface.themeOptions).toEqual([
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
      { value: "system", label: "System" },
    ]);
  });

  it("localizes the system theme option label per locale", () => {
    expect(
      buildSettingsViewData(new Date(2026, 2, 22), "ru").interface.themeOptions,
    ).toContainEqual({ value: "system", label: "Системная" });
    expect(
      buildSettingsViewData(new Date(2026, 2, 22), "de").interface.themeOptions,
    ).toContainEqual({ value: "system", label: "System" });
    expect(
      buildSettingsViewData(new Date(2026, 2, 22), "fr").interface.themeOptions,
    ).toContainEqual({ value: "system", label: "Système" });
    expect(
      buildSettingsViewData(new Date(2026, 2, 22), "es").interface.themeOptions,
    ).toContainEqual({ value: "system", label: "Sistema" });
    expect(
      buildSettingsViewData(new Date(2026, 2, 22), "it").interface.themeOptions,
    ).toContainEqual({ value: "system", label: "Sistema" });
  });

  it("builds localized interface copy for German and French", () => {
    expect(buildSettingsViewData(new Date(2026, 2, 22), "de").interface.title).toBe(
      "Oberfläche",
    );
    expect(buildSettingsViewData(new Date(2026, 2, 22), "fr").interface.title).toBe(
      "Interface",
    );
    expect(
      buildSettingsViewData(new Date(2026, 2, 22), "ru").interface
        .screenCaptureProtectionLabel,
    ).toBe("Защита скриншотов");
  });

  it("builds every hub navigation row from the section copy that already exists", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");

    const rows = buildSettingsHubNavigation(viewData);

    expect(rows.cycle).toEqual({
      key: "cycle",
      title: viewData.cycle.title,
      description: "",
    });
    expect(rows.symptoms).toEqual({
      key: "symptoms",
      title: viewData.symptoms.title,
      description: viewData.symptoms.subtitle,
    });
    expect(rows.tracking).toEqual({
      key: "tracking",
      title: viewData.tracking.title,
      description: viewData.tracking.subtitle,
    });
    expect(rows.reminders).toEqual({
      key: "reminders",
      title: viewData.reminders.title,
      description: viewData.reminders.subtitle,
    });
    expect(rows.interface).toEqual({
      key: "interface",
      title: viewData.interface.title,
      description: viewData.interface.subtitle,
    });
    // The data row names both halves of the combined export + import screen.
    expect(rows.data).toEqual({
      key: "data",
      title: viewData.export.title,
      description: viewData.import.title,
    });
    expect(rows.danger).toEqual({
      key: "danger",
      title: viewData.danger.title,
      description: viewData.danger.subtitle,
    });
  });

  it("localizes hub navigation rows through the same settings copy catalogs", () => {
    const rows = buildSettingsHubNavigation(
      buildSettingsViewData(new Date(2026, 2, 22), "ru"),
    );

    expect(rows.cycle.title).toBe("Параметры цикла");
    expect(rows.data.title).toBe("Экспорт данных");
    expect(rows.danger.title).toBe("Опасная зона");
  });

  it("builds export and symptom presentation state outside UI components", () => {
    const profile = createDefaultProfileRecord();
    const syncPreferences = createDefaultSyncPreferencesRecord();
    const state = createLoadedSettingsState(
      profile,
      syncPreferences,
      false,
      false,
      [
        ...createDefaultSymptomRecords(),
        {
          id: "jaw_pain",
          slug: "jaw-pain",
          label: "Jaw pain",
          icon: "🔥",
          color: "#E8799F",
          isArchived: true,
          isDefault: false,
          sortOrder: 99,
        },
      ],
      {
        values: {
          preset: "all",
          fromDate: "2026-03-01",
          toDate: "2026-03-10",
        },
        availableSummary: {
          totalEntries: 3,
          hasData: true,
          dateFrom: "2026-03-01",
          dateTo: "2026-03-10",
        },
        summary: {
          totalEntries: 3,
          hasData: true,
          dateFrom: "2026-03-01",
          dateTo: "2026-03-10",
        },
        bounds: {
          minDate: "2026-03-01",
          maxDate: "2026-03-10",
        },
      },
    );
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");

    const presentationState = buildSettingsFlowPresentationState(
      state,
      viewData,
      "en",
      new Date(2026, 2, 22),
      "web",
      "from",
    );

    expect(presentationState.exportSection.supportsNativeDatePicker).toBe(false);
    expect(presentationState.exportSection.summaryTotalLabel).toContain("3");
    expect(presentationState.exportSection.summaryRangeLabel).toContain("2026-03-01");
    expect(presentationState.symptomsState.archived).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "jaw_pain",
        }),
      ]),
    );
  });

  it("reverts dirty settings drafts back to persisted profile values", () => {
    const profile = createDefaultProfileRecord();
    const syncPreferences = createDefaultSyncPreferencesRecord();
    const state = createLoadedSettingsState(
      profile,
      syncPreferences,
      false,
      false,
      createDefaultSymptomRecords(),
      {
        values: {
          preset: "all",
          fromDate: "",
          toDate: "",
        },
        availableSummary: {
          totalEntries: 0,
          hasData: false,
          dateFrom: null,
          dateTo: null,
        },
        summary: {
          totalEntries: 0,
          hasData: false,
          dateFrom: null,
          dateTo: null,
        },
        bounds: {
          minDate: null,
          maxDate: null,
        },
      },
    );
    const dirtyState = {
      ...state,
      cycleValues: {
        ...state.cycleValues,
        cycleLength: 35,
      },
      trackingValues: {
        ...state.trackingValues,
        trackBBT: true,
      },
      interfaceValues: {
        ...state.interfaceValues,
        themeOverride: "dark" as const,
        screenCaptureProtectionEnabled: false,
      },
    };

    expect(buildSettingsDirtyState(dirtyState)).toEqual({
      isCycleDirty: true,
      isReminderDirty: false,
      isTrackingDirty: true,
      isInterfaceDirty: true,
      hasUnsavedSettingsChanges: true,
    });
    expect(revertLoadedSettingsDraftValues(dirtyState)).toEqual(state);
  });
});

describe("buildSettingsImportPreviewViewData (import preview)", () => {
  function zeroImportOutcome(
    overrides: Partial<ImportOutcome> = {},
  ): ImportOutcome {
    return {
      dayLogsAdded: 0,
      dayLogsSkipped: 0,
      dayLogsRejected: 0,
      symptomsAdded: 0,
      profileRestored: false,
      pregnanciesAdded: 0,
      pregnanciesSkipped: 0,
      kickSessionsAdded: 0,
      kickSessionsSkipped: 0,
      contractionSessionsAdded: 0,
      contractionSessionsSkipped: 0,
      postpartumRecordsAdded: 0,
      postpartumRecordsSkipped: 0,
      screeningResponsesAdded: 0,
      screeningResponsesSkipped: 0,
      ...overrides,
    };
  }

  function previewEnvelope(
    overrides: Partial<ExportBackupEnvelope> = {},
  ): ExportBackupEnvelope {
    return {
      app: "ovumcy",
      formatVersion: 2,
      // Deliberately invalid: keeps the locale-formatted "created" line out of
      // detailLines so the assertions below can pin the full array exactly.
      exportedAt: "",
      preset: "all",
      range: { fromDate: null, toDate: null },
      summary: { totalEntries: 0, hasData: false, dateFrom: null, dateTo: null },
      profile: createDefaultProfileRecord(),
      symptoms: [],
      dayLogs: [],
      ...overrides,
    };
  }

  const importCopy = buildSettingsViewData(new Date(2026, 2, 22), "en").import;

  it("renders one preview row per pregnancy-mode collection with a positive count (v2 file)", () => {
    const preview = buildSettingsImportPreviewViewData(
      previewEnvelope({ dayLogs: [createEmptyDayLogRecord("2026-03-01")] }),
      zeroImportOutcome({
        dayLogsAdded: 1,
        pregnanciesAdded: 1,
        kickSessionsAdded: 2,
        contractionSessionsAdded: 3,
      }),
      importCopy,
      "en",
    );

    expect(preview.detailLines).toEqual([
      "Entries in backup: 1",
      "New days to add: 1",
      "New pregnancy records: 1",
      "New kick-count sessions: 2",
      "New contraction sessions: 3",
    ]);
    expect(preview.canConfirm).toBe(true);
    expect(preview.nothingNewLine).toBe("");
  });

  it("keeps a v1 file's preview exactly as before: no pregnancy-mode rows when the counts are zero", () => {
    const preview = buildSettingsImportPreviewViewData(
      previewEnvelope({
        formatVersion: 1,
        dayLogs: [
          createEmptyDayLogRecord("2026-03-01"),
          createEmptyDayLogRecord("2026-03-02"),
        ],
      }),
      zeroImportOutcome({ dayLogsAdded: 1, dayLogsSkipped: 1 }),
      importCopy,
      "en",
    );

    // Exact-array pin: the preview must be byte-identical to the pre-import-preview
    // output for a v1 outcome — no pregnancy/kick/contraction rows.
    expect(preview.detailLines).toEqual([
      "Entries in backup: 2",
      "New days to add: 1",
      "Days already on this device (kept unchanged): 1",
    ]);
    expect(preview.canConfirm).toBe(true);
  });

  it("lets a v2 backup whose only new content is pregnancy data be confirmed", () => {
    const preview = buildSettingsImportPreviewViewData(
      previewEnvelope(),
      zeroImportOutcome({ pregnanciesAdded: 1 }),
      importCopy,
      "en",
    );

    expect(preview.canConfirm).toBe(true);
    expect(preview.nothingNewLine).toBe("");
    expect(preview.detailLines).toContain("New pregnancy records: 1");
  });

  it("still reports nothing-new and blocks confirm when every count is zero", () => {
    const preview = buildSettingsImportPreviewViewData(
      previewEnvelope(),
      zeroImportOutcome(),
      importCopy,
      "en",
    );

    expect(preview.canConfirm).toBe(false);
    expect(preview.nothingNewLine).toBe(
      "Everything in this backup is already on this device.",
    );
  });

  it("renders one preview row per v3 collection with a positive count (v3 file)", () => {
    const preview = buildSettingsImportPreviewViewData(
      previewEnvelope({
        formatVersion: 3,
        dayLogs: [createEmptyDayLogRecord("2026-03-01")],
      }),
      zeroImportOutcome({
        dayLogsAdded: 1,
        postpartumRecordsAdded: 1,
        screeningResponsesAdded: 2,
      }),
      importCopy,
      "en",
    );

    expect(preview.detailLines).toEqual([
      "Entries in backup: 1",
      "New days to add: 1",
      "New postpartum records: 1",
      "New check-ins: 2",
    ]);
    expect(preview.canConfirm).toBe(true);
    expect(preview.nothingNewLine).toBe("");
  });

  it("keeps a v2 file's preview byte-identical: no postpartum/screening rows when those counts are zero", () => {
    const preview = buildSettingsImportPreviewViewData(
      previewEnvelope({
        formatVersion: 2,
        dayLogs: [createEmptyDayLogRecord("2026-03-01")],
      }),
      // A v2 outcome carries pregnancy-mode rows but zero Y7 counts.
      zeroImportOutcome({ dayLogsAdded: 1, pregnanciesAdded: 1 }),
      importCopy,
      "en",
    );

    // Exact-array pin: the preview must be byte-identical to the pre-Y7 output
    // for a v2 outcome — no postpartum/check-in rows.
    expect(preview.detailLines).toEqual([
      "Entries in backup: 1",
      "New days to add: 1",
      "New pregnancy records: 1",
    ]);
    expect(preview.canConfirm).toBe(true);
  });

  it("lets a v3 backup whose only new content is a screening check-in be confirmed", () => {
    const preview = buildSettingsImportPreviewViewData(
      previewEnvelope(),
      zeroImportOutcome({ screeningResponsesAdded: 1 }),
      importCopy,
      "en",
    );

    expect(preview.canConfirm).toBe(true);
    expect(preview.nothingNewLine).toBe("");
    expect(preview.detailLines).toContain("New check-ins: 1");
  });
});
