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
  isGuestPartnerAccount,
  resolveBackupSyncConnectedStatusMessage,
  resolveBackupSyncDeviceErrorMessage,
  resolveBackupSyncErrorMessage,
  resolveGuestSessionExpiryNudgeDays,
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
    // guest_recovery_phrase_blocked (prepareSyncSetup's defense-in-depth
    // refusal for a guest session) has no dedicated copy: the UI already
    // hides the affordance that would produce this error for a guest, so it
    // deliberately reuses the generic "try again" message rather than adding
    // a new string across all six locales for a state a real guest should
    // never reach.
    expect(
      resolveBackupSyncErrorMessage(
        "guest_recovery_phrase_blocked",
        viewData.account,
      ),
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

  it("hides the local-step prepare/regenerate action for a guest session but not for a normal managed session (docs/sync-trust-model.md: guests never see a recovery phrase)", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");
    const basePresentationInput = {
      hasStoredSyncSecrets: true,
      hasSyncSession: true,
      isAuthenticating: false,
      isPreparing: false,
      isRecovering: false,
      isRestoring: false,
      isSyncing: false,
      locale: "en",
      managedPlanStatus: "unknown" as const,
      notSetLabel: "Not set",
      syncCapabilities: null,
      viewData: viewData.account,
    };

    const guestPresentation = buildBackupSyncSetupPresentation({
      ...basePresentationInput,
      preferences: {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        guestSessionExpiresAt: "2026-05-05T08:00:00.000Z",
      },
    });
    expect(guestPresentation.shouldShowPrepareAction).toBe(false);

    const ownerPresentation = buildBackupSyncSetupPresentation({
      ...basePresentationInput,
      preferences: {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        guestSessionExpiresAt: null,
      },
    });
    expect(ownerPresentation.shouldShowPrepareAction).toBe(true);
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

  describe("isGuestPartnerAccount", () => {
    it("is true only for a non-empty guestSessionExpiresAt string", () => {
      expect(
        isGuestPartnerAccount({
          ...createDefaultSyncPreferencesRecord(),
          guestSessionExpiresAt: "2026-05-05T08:00:00.000Z",
        }),
      ).toBe(true);
      expect(
        isGuestPartnerAccount({
          ...createDefaultSyncPreferencesRecord(),
          guestSessionExpiresAt: null,
        }),
      ).toBe(false);
      expect(isGuestPartnerAccount(createDefaultSyncPreferencesRecord())).toBe(
        false,
      );
      // A record that never passed through the storage-layer normalizers
      // (e.g. a hand-built fixture predating this field, or a partial mock
      // return value in a test) can carry `undefined` here — this must not
      // be misread as guest mode via a naive `!== null` check.
      expect(
        isGuestPartnerAccount({
          ...createDefaultSyncPreferencesRecord(),
          guestSessionExpiresAt: undefined as unknown as null,
        }),
      ).toBe(false);
      expect(
        isGuestPartnerAccount({
          ...createDefaultSyncPreferencesRecord(),
          guestSessionExpiresAt: "",
        }),
      ).toBe(false);
    });
  });

  describe("resolveGuestSessionExpiryNudgeDays", () => {
    it("returns null when there is no guest session", () => {
      expect(resolveGuestSessionExpiryNudgeDays(null, "2026-04-05T12:00:00.000Z")).toBeNull();
    });

    it("returns null for an unparseable timestamp on either side", () => {
      expect(
        resolveGuestSessionExpiryNudgeDays("not-a-date", "2026-04-05T12:00:00.000Z"),
      ).toBeNull();
      expect(
        resolveGuestSessionExpiryNudgeDays("2026-04-08T00:00:00.000Z", "not-a-date"),
      ).toBeNull();
    });

    it("returns null once the session has already expired", () => {
      expect(
        resolveGuestSessionExpiryNudgeDays(
          "2026-04-01T00:00:00.000Z",
          "2026-04-05T12:00:00.000Z",
        ),
      ).toBeNull();
    });

    it("rounds the remaining time up to whole days, within the 7-day window", () => {
      // 2.5 days remaining rounds up to 3.
      expect(
        resolveGuestSessionExpiryNudgeDays(
          "2026-04-08T00:00:00.000Z",
          "2026-04-05T12:00:00.000Z",
        ),
      ).toBe(3);
      // Exactly on the 7-day boundary still shows.
      expect(
        resolveGuestSessionExpiryNudgeDays(
          "2026-04-12T12:00:00.000Z",
          "2026-04-05T12:00:00.000Z",
        ),
      ).toBe(7);
    });

    it("returns null once expiry is further than 7 days out", () => {
      expect(
        resolveGuestSessionExpiryNudgeDays(
          "2026-04-13T00:00:00.000Z",
          "2026-04-05T12:00:00.000Z",
        ),
      ).toBeNull();
    });
  });
});
