import { getDeviceCopy } from "../i18n/device-copy";
import { createDefaultProfileRecord } from "../models/profile";
import { createDefaultSymptomRecords } from "../models/symptom";
import { createDefaultSyncPreferencesRecord } from "../sync/sync-contract";
import {
  buildSettingsViewData,
  createEmptySettingsManagedPremiumAccess,
  createLoadedSettingsState,
} from "./settings-view-service";
import {
  buildBackupSyncDeviceListView,
  buildBackupSyncDirtyState,
  buildBackupSyncSetupPresentation,
  resolveBackupSyncConnectedStatusMessage,
  resolveBackupSyncDeviceErrorMessage,
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
      resolveBackupSyncErrorMessage("recovery_phrase_required", viewData.account),
    ).toBe(viewData.account.errors.recoveryPhraseRequired);
    expect(
      resolveBackupSyncErrorMessage("recovery_package_not_found", viewData.account),
    ).toBe(viewData.account.errors.recoveryPackageNotFound);
    expect(
      resolveBackupSyncErrorMessage("sync_not_allowed", viewData.account),
    ).toBe(viewData.account.syncBlockedNoPlan);
    expect(
      resolveBackupSyncErrorMessage("password_too_short", viewData.account),
    ).toBe(viewData.account.errors.passwordTooShort);
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
        recoverySupported: true,
        pushSupported: false,
        portalSupported: false,
        advancedCloudInsights: false,
        maxDevices: 5,
        maxBlobBytes: 1024,
      },
      {
        ...createEmptySettingsManagedPremiumAccess(),
        planStatus: "inactive",
      },
    );

    expect(
      resolveBackupSyncConnectedStatusMessage(state, viewData.account),
    ).toBe(viewData.account.status.connectedNoPlan);
  });

  it("keeps the no-plan managed status when sync entitlement is true but billing plan is inactive", () => {
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
        recoverySupported: true,
        pushSupported: false,
        portalSupported: false,
        advancedCloudInsights: false,
        maxDevices: 5,
        maxBlobBytes: 1024,
      },
      {
        ...createEmptySettingsManagedPremiumAccess(),
        planStatus: "inactive",
      },
    );

    expect(
      resolveBackupSyncConnectedStatusMessage(state, viewData.account),
    ).toBe(viewData.account.status.connectedNoPlan);
  });

  it("builds sync setup presentation with preformatted last sync and self-hosted step numbering", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");
    const presentation = buildBackupSyncSetupPresentation({
      hasStoredSyncSecrets: true,
      hasSyncSession: true,
      isAuthenticating: false,
      isPreparing: false,
      isRecovering: false,
      isRestoring: false,
      isSyncing: false,
      locale: "en",
      managedPlanStatus: "unknown",
      notSetLabel: "Not set",
      preferences: {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        lastSyncedAt: "2026-03-20T08:10:00.000Z",
      },
      syncCapabilities: null,
      viewData: viewData.account,
    });

    expect(presentation.shouldShowEndpointSummary).toBe(true);
    expect(presentation.endpointSummary).toBe("192.168.1.20:8080");
    expect(presentation.syncStepTitle).toBe("3. Sync this backup");
    expect(presentation.lastSyncValue).not.toBe("2026-03-20T08:10:00.000Z");
  });

  it("builds device list items with formatted last-seen and a current-device flag", () => {
    const copy = getDeviceCopy("en");
    const items = buildBackupSyncDeviceListView(
      [
        {
          deviceID: "device-1",
          deviceLabel: "Pixel 7",
          createdAt: "2026-03-19T08:00:00.000Z",
          lastSeenAt: "2026-03-20T08:10:00.000Z",
        },
        {
          deviceID: "device-2",
          deviceLabel: "   ",
          createdAt: "2026-03-20T09:00:00.000Z",
          lastSeenAt: "2026-03-20T09:30:00.000Z",
        },
      ],
      "device-1",
      "en",
      copy,
    );

    expect(items).toHaveLength(2);
    expect(items[0]).toEqual(
      expect.objectContaining({
        deviceID: "device-1",
        label: "Pixel 7",
        isCurrentDevice: true,
      }),
    );
    // Raw timestamps never leak into the rendered line.
    expect(items[0]?.lastSeenText).not.toBe("2026-03-20T08:10:00.000Z");
    expect(items[0]?.lastSeenText.length).toBeGreaterThan(0);
    // A blank user-chosen label falls back to neutral copy instead of an
    // empty row title.
    expect(items[1]).toEqual(
      expect.objectContaining({
        deviceID: "device-2",
        label: copy.fallbackDeviceLabel,
        isCurrentDevice: false,
      }),
    );
  });

  it("maps device management error codes through device copy", () => {
    const copy = getDeviceCopy("en");

    expect(resolveBackupSyncDeviceErrorMessage("not_connected", copy)).toBe(
      copy.errors.notConnected,
    );
    expect(resolveBackupSyncDeviceErrorMessage("unauthorized", copy)).toBe(
      copy.errors.notConnected,
    );
    expect(resolveBackupSyncDeviceErrorMessage("sync_not_allowed", copy)).toBe(
      copy.errors.syncNotAllowed,
    );
    expect(resolveBackupSyncDeviceErrorMessage("device_not_found", copy)).toBe(
      copy.errors.deviceNotFound,
    );
    expect(resolveBackupSyncDeviceErrorMessage("network_failed", copy)).toBe(
      copy.errors.networkFailed,
    );
    expect(resolveBackupSyncDeviceErrorMessage("generic", copy)).toBe(
      copy.errors.generic,
    );
  });
});
