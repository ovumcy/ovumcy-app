import { createDefaultProfileRecord } from "../models/profile";
import { createDefaultSymptomRecords } from "../models/symptom";
import { createDefaultSyncPreferencesRecord } from "../sync/sync-contract";
import {
  buildSettingsViewData,
  createLoadedSettingsState,
} from "./settings-view-service";
import {
  buildBackupSyncDirtyState,
  resolveBackupSyncConnectedStatusMessage,
  resolveBackupSyncErrorMessage,
  revertBackupSyncDraftState,
} from "./backup-sync-view-service";

describe("backup sync view service", () => {
  it("maps sync error codes through shared account copy", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");

    expect(
      resolveBackupSyncErrorMessage("invalid_endpoint", viewData.account),
    ).toBe(viewData.account.errors.invalidEndpoint);
    expect(
      resolveBackupSyncErrorMessage("unauthorized", viewData.account),
    ).toBe(viewData.account.errors.notConnected);
    expect(
      resolveBackupSyncErrorMessage("unknown_code", viewData.account),
    ).toBe(viewData.account.errors.saveFailed);
  });

  it("detects and reverts unsaved sync preference drafts", () => {
    const preferences = createDefaultSyncPreferencesRecord();
    const state = createLoadedSettingsState(
      createDefaultProfileRecord(),
      preferences,
      true,
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
      {
        ...preferences,
        deviceLabel: "Draft device",
      },
      null,
    );

    expect(buildBackupSyncDirtyState(state)).toBe(true);
    expect(revertBackupSyncDraftState(state).syncPreferences).toEqual(
      state.savedSyncPreferences,
    );
  });

  it("uses the no-plan connected status for managed accounts without premium", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");
    const preferences = createDefaultSyncPreferencesRecord();
    const state = createLoadedSettingsState(
      createDefaultProfileRecord(),
      preferences,
      true,
      true,
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
      preferences,
      {
        mode: "managed",
        syncEnabled: true,
        premiumActive: false,
        recoverySupported: true,
        pushSupported: false,
        portalSupported: false,
        advancedCloudInsights: false,
        maxDevices: 5,
        maxBlobBytes: 1024,
      },
    );

    expect(
      resolveBackupSyncConnectedStatusMessage(state, viewData.account),
    ).toBe(viewData.account.status.connectedNoPlan);
  });
});
