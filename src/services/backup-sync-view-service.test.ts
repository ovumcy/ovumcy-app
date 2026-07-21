import { getDeviceCopy } from "../i18n/device-copy";
import { createDefaultProfileRecord } from "../models/profile";
import { createDefaultSymptomRecords } from "../models/symptom";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "../sync/sync-contract";
import {
  buildSettingsViewData,
  createEmptySettingsManagedPremiumAccess,
  createLoadedSettingsState,
} from "./settings-view-service";
import {
  buildBackupSyncDeviceListView,
  buildBackupSyncDirtyState,
  buildBackupSyncSetupPresentation,
  formatBackupSyncLastSeen,
  isGuestPartnerAccount,
  resolveBackupSyncConnectedStatusMessage,
  resolveBackupSyncDeviceErrorMessage,
  resolveBackupSyncErrorMessage,
  resolveBackupSyncErrorPresentation,
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

  it("shows the self-hosted account-step hint before a sync session exists", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");
    const presentation = buildBackupSyncSetupPresentation({
      hasStoredSyncSecrets: true,
      hasSyncSession: false,
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
      },
      syncCapabilities: null,
      viewData: viewData.account,
    });

    // Self-hosted (isManaged: false) takes the accountStepHintSelfHosted arm
    // of the ternary — the managed arm is already covered elsewhere.
    expect(presentation.guidanceStepNumber).toBe(2);
    expect(presentation.guidanceMessage).toBe(
      viewData.account.accountStepHintSelfHosted,
    );
    expect(presentation.guidanceComplete).toBe(false);
  });

  it("falls back to a disconnect-only guidance state when the server reports sync disabled for an otherwise fully connected account", () => {
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
      },
      // Locally "connected" (secrets + session), but the server-reported
      // capability document has sync disabled — canShowSyncActions is false
      // even though every other guidance gate already passed.
      syncCapabilities: {
        mode: "self_hosted",
        syncEnabled: false,
        recoverySupported: true,
        pushSupported: false,
        portalSupported: false,
        advancedCloudInsights: false,
        maxDevices: 5,
        maxBlobBytes: 1024,
      },
      viewData: viewData.account,
    });

    expect(presentation.canShowSyncActions).toBe(false);
    expect(presentation.shouldShowDisconnectOnly).toBe(true);
    expect(presentation.guidanceComplete).toBe(false);
    expect(presentation.guidanceMessage).toBe(viewData.account.status.connected);
    expect(presentation.guidanceStepNumber).toBe(3);
  });

  it("falls back to the raw preference mode when it is not among the selectable mode options", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");
    const presentation = buildBackupSyncSetupPresentation({
      hasStoredSyncSecrets: false,
      hasSyncSession: false,
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
        // A legacy/unrecognized mode value (e.g. from a pre-migration cached
        // fixture) that does not match any option in viewData.modeOptions.
        mode: "legacy_direct" as unknown as SyncPreferencesRecord["mode"],
      },
      syncCapabilities: null,
      viewData: viewData.account,
    });

    expect(presentation.selectedModeLabel).toBe("legacy_direct");
  });

  it("resolves the managed plan message for both the active and inactive statuses", () => {
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
      notSetLabel: "Not set",
      preferences: {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed" as const,
      },
      syncCapabilities: null,
      viewData: viewData.account,
    };

    expect(
      buildBackupSyncSetupPresentation({
        ...basePresentationInput,
        managedPlanStatus: "active",
      }).planMessage,
    ).toBe(viewData.account.planActive);

    expect(
      buildBackupSyncSetupPresentation({
        ...basePresentationInput,
        managedPlanStatus: "inactive",
      }).planMessage,
    ).toBe(viewData.account.planInactive);
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

    expect(resolveBackupSyncDeviceErrorMessage("sync_not_prepared", copy)).toBe(
      copy.errors.notConnected,
    );
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

    it("withholds the countdown from a session that renews itself", () => {
      // Same inputs that produce "3 days left" above. A renewable guest holds
      // a refresh token whose expiry slides forward on every use, so this
      // date is one the device will never actually reach — naming it would
      // tell the owner their access dies on a day it does not.
      expect(
        resolveGuestSessionExpiryNudgeDays(
          "2026-04-08T00:00:00.000Z",
          "2026-04-05T12:00:00.000Z",
          true,
        ),
      ).toBeNull();
    });

    it("still counts down for a guest session that cannot renew", () => {
      // The case the nudge exists for: no refresh token, so this deadline is
      // real and the owner loses access permanently when it passes.
      expect(
        resolveGuestSessionExpiryNudgeDays(
          "2026-04-08T00:00:00.000Z",
          "2026-04-05T12:00:00.000Z",
          false,
        ),
      ).toBe(3);
    });
  });

  describe("formatBackupSyncLastSeen", () => {
    it("falls back to the never label for a null or empty value", () => {
      expect(formatBackupSyncLastSeen(null, "en", "Never")).toBe("Never");
      expect(formatBackupSyncLastSeen("", "en", "Never")).toBe("Never");
    });

    it("formats a real timestamp through the shared last-sync formatter", () => {
      const formatted = formatBackupSyncLastSeen(
        "2026-03-20T08:10:00.000Z",
        "en",
        "Never",
      );

      // Raw ISO timestamps never leak into the rendered line, and the never-
      // seen fallback must not be shown when a real value is present.
      expect(formatted).not.toBe("2026-03-20T08:10:00.000Z");
      expect(formatted).not.toBe("Never");
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  it("maps every remaining sync/account error code through shared account copy", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");
    const cases: [string, string][] = [
      ["login_required", viewData.account.errors.loginRequired],
      ["password_required", viewData.account.errors.passwordRequired],
      ["device_label_required", viewData.account.errors.deviceLabelRequired],
      ["endpoint_required", viewData.account.errors.endpointRequired],
      ["unsupported_scheme", viewData.account.errors.unsupportedScheme],
      ["insecure_public_http", viewData.account.errors.insecurePublicHttp],
      [
        "invalid_registration_input",
        viewData.account.errors.invalidRegistrationInput,
      ],
      ["registration_failed", viewData.account.errors.registrationFailed],
      ["invalid_credentials", viewData.account.errors.invalidCredentials],
      [
        "invalid_recovery_phrase",
        viewData.account.errors.invalidRecoveryPhrase,
      ],
      ["recovery_not_available", viewData.account.errors.recoveryNotAvailable],
      ["too_many_devices", viewData.account.errors.tooManyDevices],
      ["sync_not_prepared", viewData.account.errors.syncNotPrepared],
      ["not_connected", viewData.account.errors.notConnected],
      ["blob_not_found", viewData.account.errors.blobNotFound],
      ["invalid_payload", viewData.account.errors.invalidPayload],
      ["network_failed", viewData.account.errors.networkFailed],
      ["deviceAuthUnavailable", viewData.account.errors.deviceAuthUnavailable],
      [
        "device_auth_unavailable",
        viewData.account.errors.deviceAuthUnavailable,
      ],
      ["deviceAuthFailed", viewData.account.errors.deviceAuthFailed],
      ["device_auth_failed", viewData.account.errors.deviceAuthFailed],
      [
        "recovery_export_unavailable",
        viewData.account.errors.recoveryExportUnavailable,
      ],
      ["recovery_export_failed", viewData.account.errors.recoveryExportFailed],
      ["stale_generation", viewData.account.errors.syncFailed],
      [
        "billing_management_unavailable",
        viewData.account.errors.renewalUnavailable,
      ],
      [
        "billing_subscription_conflict",
        viewData.account.errors.renewalUpdateFailed,
      ],
      [
        "billing_provider_unavailable",
        viewData.account.errors.renewalUpdateFailed,
      ],
    ];

    for (const [errorCode, expected] of cases) {
      expect(resolveBackupSyncErrorMessage(errorCode, viewData.account)).toBe(
        expected,
      );
    }
  });

  describe("resolveBackupSyncErrorPresentation", () => {
    it("returns the empty presentation for a null or undefined error code", () => {
      const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");
      const empty = {
        accountMessage: "",
        deleteAccountMessage: "",
        deviceLabelMessage: "",
        endpointMessage: "",
        localMessage: "",
        loginMessage: "",
        passwordMessage: "",
        recoveryPhraseMessage: "",
        syncMessage: "",
      };

      expect(
        resolveBackupSyncErrorPresentation(null, "account", viewData.account),
      ).toEqual(empty);
      expect(
        resolveBackupSyncErrorPresentation(undefined, "sync", viewData.account),
      ).toEqual(empty);
    });

    it("reuses the mapped message in the delete-account banner only for the three connection-loss codes", () => {
      const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");

      for (const errorCode of [
        "not_connected",
        "unauthorized",
        "network_failed",
      ]) {
        const presentation = resolveBackupSyncErrorPresentation(
          errorCode,
          "delete_account",
          viewData.account,
        );
        expect(presentation.deleteAccountMessage).toBe(
          resolveBackupSyncErrorMessage(errorCode, viewData.account),
        );
      }
    });

    it("falls back to the generic delete-account failure message for any other code", () => {
      const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");

      const presentation = resolveBackupSyncErrorPresentation(
        "billing_provider_unavailable",
        "delete_account",
        viewData.account,
      );

      expect(presentation.deleteAccountMessage).toBe(
        viewData.account.errors.deleteAccountFailed,
      );
    });

    it("routes device-label, endpoint, login, password, and recovery-phrase codes to their dedicated fields", () => {
      const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");

      expect(
        resolveBackupSyncErrorPresentation(
          "device_label_required",
          "account",
          viewData.account,
        ).deviceLabelMessage,
      ).toBe(viewData.account.errors.deviceLabelRequired);

      for (const errorCode of [
        "endpoint_required",
        "invalid_endpoint",
        "unsupported_scheme",
        "insecure_public_http",
      ]) {
        expect(
          resolveBackupSyncErrorPresentation(errorCode, "account", viewData.account)
            .endpointMessage,
        ).toBe(resolveBackupSyncErrorMessage(errorCode, viewData.account));
      }

      expect(
        resolveBackupSyncErrorPresentation(
          "login_required",
          "account",
          viewData.account,
        ).loginMessage,
      ).toBe(viewData.account.errors.loginRequired);

      expect(
        resolveBackupSyncErrorPresentation(
          "password_required",
          "account",
          viewData.account,
        ).passwordMessage,
      ).toBe(viewData.account.errors.passwordRequired);

      for (const errorCode of [
        "recovery_phrase_required",
        "invalid_recovery_phrase",
      ]) {
        expect(
          resolveBackupSyncErrorPresentation(errorCode, "account", viewData.account)
            .recoveryPhraseMessage,
        ).toBe(resolveBackupSyncErrorMessage(errorCode, viewData.account));
      }
    });

    it("routes an unmapped code to the local/account/sync banner matching the caller's scope", () => {
      const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");
      const expected = resolveBackupSyncErrorMessage("generic", viewData.account);

      expect(
        resolveBackupSyncErrorPresentation("generic", "local", viewData.account)
          .localMessage,
      ).toBe(expected);
      expect(
        resolveBackupSyncErrorPresentation("generic", "account", viewData.account)
          .accountMessage,
      ).toBe(expected);
      expect(
        resolveBackupSyncErrorPresentation("generic", "sync", viewData.account)
          .syncMessage,
      ).toBe(expected);
      expect(
        resolveBackupSyncErrorPresentation("generic", null, viewData.account)
          .syncMessage,
      ).toBe(expected);
    });
  });
});
