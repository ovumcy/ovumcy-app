import { createDefaultProfileRecord } from "../models/profile";
import { createDefaultSymptomRecords } from "../models/symptom";
import { createDefaultSyncPreferencesRecord } from "../sync/sync-contract";
import {
  buildSettingsDirtyState,
  buildSettingsFlowPresentationState,
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
    ]);
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
