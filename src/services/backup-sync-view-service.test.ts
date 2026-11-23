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
  shouldRotateManagedRecoveryPhrase,
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
        syncEnabled: false,
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

  it("reports a plain connected status when sync is allowed though the billing plan is inactive", () => {
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
    ).toBe(viewData.account.status.connected);
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

  it("rotates the phrase only for a connected, non-guest managed account with a floor", () => {
    const managed = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
      accountId: "acct-1",
      lastRemoteGeneration: 7,
    };
    const selfHosted = { ...managed, mode: "self_hosted" as const };
    const guest = { ...managed, guestSessionExpiresAt: "2026-05-05T08:00:00.000Z" };
    const connected = { hasStoredSyncSecrets: true, hasSyncSession: true };

    expect(shouldRotateManagedRecoveryPhrase({ ...connected, preferences: managed })).toBe(true);
    expect(shouldRotateManagedRecoveryPhrase({ ...connected, preferences: selfHosted })).toBe(false);
    expect(shouldRotateManagedRecoveryPhrase({ ...connected, preferences: guest })).toBe(false);
    expect(
      shouldRotateManagedRecoveryPhrase({
        hasStoredSyncSecrets: true,
        hasSyncSession: false,
        preferences: managed,
      }),
    ).toBe(false);
  });

  it("keeps the recovery action local on a managed device whose key never opened this account's backup", () => {
    const signedInWithoutRecovery = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
      accountId: "acct-1",
      lastRemoteGeneration: null,
    };

    expect(
      shouldRotateManagedRecoveryPhrase({
        hasStoredSyncSecrets: true,
        hasSyncSession: true,
        preferences: signedInWithoutRecovery,
      }),
    ).toBe(false);
  });

  it("labels the recovery action with the rotation label when one is given", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");
    const input = {
      hasStoredSyncSecrets: true,
      hasSyncSession: true,
      isAuthenticating: false,
      isPreparing: false,
      isRecovering: false,
      isRestoring: false,
      isSyncing: false,
      locale: "en",
      managedPlanStatus: "active" as const,
      notSetLabel: "Not set",
      preferences: createDefaultSyncPreferencesRecord(),
      syncCapabilities: null,
      viewData: viewData.account,
    };

    expect(
      buildBackupSyncSetupPresentation({
        ...input,
        managedRecoveryRotationLabel: "Change recovery phrase",
      }).actionLabel,
    ).toBe("Change recovery phrase");
    expect(buildBackupSyncSetupPresentation(input).actionLabel).toBe(
      viewData.account.regenerateLabel,
    );
  });

  it("explains a managed_recovery_key_overwrite upload refusal", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");
    expect(
      resolveBackupSyncErrorMessage("managed_recovery_key_overwrite", viewData.account),
    ).toBe(viewData.account.errors.recoveryKeyChangedElsewhere);
  });

  it("explains a self-hosted package another device replaced", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");
    expect(
      resolveBackupSyncErrorMessage("recovery_key_changed_elsewhere", viewData.account),
    ).toBe(viewData.account.errors.recoveryKeyReplacedOnServer);
    expect(viewData.account.errors.recoveryKeyReplacedOnServer).not.toBe(
      viewData.account.errors.recoveryKeyChangedElsewhere,
    );
  });

  it("asks to wait on rate_limited instead of the generic failure", () => {
    const viewData = buildSettingsViewData(new Date(2026, 2, 22), "ru");
    const message = resolveBackupSyncErrorMessage("rate_limited", viewData.account);
    expect(message).toBe(viewData.account.errors.rateLimited);
    expect(message).not.toBe(viewData.account.errors.saveFailed);
    expect(message).not.toBe(
      buildSettingsViewData(new Date(2026, 2, 22), "en").account.errors.rateLimited,
    );
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

  it("appends the server's wait time only to a rate-limited device error", () => {
    const copy = getDeviceCopy("en");
    const template = "Try again in %s s.";

    expect(
      resolveBackupSyncDeviceErrorMessage("rate_limited", copy, {
        retryAfterSeconds: 30,
        template,
      }),
    ).toBe(`${copy.errors.rateLimited} Try again in 30 s.`);
    expect(
      resolveBackupSyncDeviceErrorMessage("rate_limited", copy, {
        retryAfterSeconds: undefined,
        template,
      }),
    ).toBe(copy.errors.rateLimited);
    expect(
      resolveBackupSyncDeviceErrorMessage("network_failed", copy, {
        retryAfterSeconds: 30,
        template,
      }),
    ).toBe(copy.errors.networkFailed);
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
      ["restore_incomplete", viewData.account.errors.restoreIncomplete],
      ["not_connected", viewData.account.errors.notConnected],
      ["blob_not_found", viewData.account.errors.blobNotFound],
      ["remote_backup_changed", viewData.account.errors.remoteBackupChanged],
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
        "sync_purge_unavailable",
        viewData.account.errors.deleteAccountCleanupUnavailable,
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

    it("reuses the mapped message in the delete-account banner only for the connection-loss and purge-blocked codes", () => {
      const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");

      for (const errorCode of [
        "not_connected",
        "unauthorized",
        "network_failed",
        "sync_purge_unavailable",
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

    // ovumcy-managed answers DELETE /account with 503 sync_purge_unavailable
    // when it cannot confirm the sync-plane data would be erased too: the
    // deletion failed closed and the account is fully intact. The banner must
    // say exactly that (deferred, nothing lost, retry later) instead of the
    // generic "unable to delete" copy that reads like a real fault.
    it("gives sync_purge_unavailable its dedicated deletion-deferred copy in the delete-account banner", () => {
      const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");

      const presentation = resolveBackupSyncErrorPresentation(
        "sync_purge_unavailable",
        "delete_account",
        viewData.account,
      );

      expect(presentation.deleteAccountMessage).toBe(
        viewData.account.errors.deleteAccountCleanupUnavailable,
      );
      expect(presentation.deleteAccountMessage).not.toBe(
        viewData.account.errors.deleteAccountFailed,
      );
    });

    it("shows the server-erased copy, not the generic failure, when only the local wipe is incomplete", () => {
      for (const locale of ["en", "de", "fr", "ru", "es", "it"] as const) {
        const viewData = buildSettingsViewData(new Date(2026, 2, 22), locale);

        const presentation = resolveBackupSyncErrorPresentation(
          "server_erased_local_incomplete",
          "delete_account",
          viewData.account,
        );

        expect(presentation.deleteAccountMessage).toBe(
          viewData.account.errors.deleteAccountServerErased,
        );
        expect(presentation.deleteAccountMessage).not.toBe(
          viewData.account.errors.deleteAccountFailed,
        );
        expect(presentation.deleteAccountMessage.length).toBeGreaterThan(0);
      }
    });

    it("falls back to the generic delete-account failure message for any other code", () => {
      const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en");

      const presentation = resolveBackupSyncErrorPresentation(
        "stale_generation",
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

describe("backup sync limits, waits and refusals", () => {
  const account = buildSettingsViewData(new Date(2026, 2, 22), "en").account;

  it.each([
    ["registration_disabled", account.errors.registrationDisabled],
    ["login_invalid_length", account.errors.loginInvalidLength],
    ["password_too_long", account.errors.passwordTooLong],
    ["device_label_invalid_length", account.errors.deviceLabelInvalidLength],
    ["backup_too_large", account.errors.backupTooLarge],
    ["server_busy", account.errors.serverBusy],
  ])("gives %s its own message", (errorCode, expected) => {
    expect(resolveBackupSyncErrorMessage(errorCode, account)).toBe(expected);
    expect(expected).not.toBe(account.errors.saveFailed);
  });

  it("appends the server's wait to a busy or rate-limited sync answer", () => {
    expect(
      resolveBackupSyncErrorPresentation("server_busy", "sync", account, 30).syncMessage,
    ).toBe(`${account.errors.serverBusy} Try again in 30 s.`);
    expect(
      resolveBackupSyncErrorPresentation("rate_limited", "sync", account, 5).syncMessage,
    ).toBe(`${account.errors.rateLimited} Try again in 5 s.`);
    expect(
      resolveBackupSyncErrorPresentation("server_busy", "sync", account).syncMessage,
    ).toBe(account.errors.serverBusy);
    expect(
      resolveBackupSyncErrorPresentation("stale_generation", "sync", account, 30).syncMessage,
    ).toBe(resolveBackupSyncErrorMessage("stale_generation", account));
  });

  it("shows field-level length errors under their fields", () => {
    expect(
      resolveBackupSyncErrorPresentation("device_label_invalid_length", "account", account)
        .deviceLabelMessage,
    ).toBe(account.errors.deviceLabelInvalidLength);
    expect(
      resolveBackupSyncErrorPresentation("login_invalid_length", "account", account)
        .loginMessage,
    ).toBe(account.errors.loginInvalidLength);
  });

  it("names a rate limit in device management", () => {
    const copy = getDeviceCopy("en");
    expect(resolveBackupSyncDeviceErrorMessage("rate_limited", copy)).toBe(copy.errors.rateLimited);
  });
});

describe("managed sync gate from sync_allowed", () => {
  const viewData = buildSettingsViewData(new Date(2026, 2, 22), "en").account;
  const managedPreferences = {
    ...createDefaultSyncPreferencesRecord(),
    mode: "managed" as const,
  };
  const capabilities = (syncEnabled: boolean) => ({
    mode: "managed" as const,
    syncEnabled,
    recoverySupported: true,
    pushSupported: false,
    portalSupported: false,
    advancedCloudInsights: false,
    maxDevices: 5,
    maxBlobBytes: 1024,
  });
  const input = {
    hasStoredSyncSecrets: true,
    hasSyncSession: true,
    isAuthenticating: false,
    isPreparing: false,
    isRecovering: false,
    isRestoring: false,
    isSyncing: false,
    locale: "en",
    notSetLabel: "Not set",
    preferences: managedPreferences,
    viewData,
  };
  const loadedState = (
    syncCapabilities: ReturnType<typeof capabilities> | null,
    planStatus: "unknown" | "inactive" | "active",
  ) =>
    createLoadedSettingsState(
      createDefaultProfileRecord(),
      managedPreferences,
      true,
      true,
      createDefaultSymptomRecords(),
      {
        values: { preset: "all", fromDate: "", toDate: "" },
        availableSummary: { totalEntries: 0, hasData: false, dateFrom: null, dateTo: null },
        summary: { totalEntries: 0, hasData: false, dateFrom: null, dateTo: null },
        bounds: { minDate: null, maxDate: null },
      },
      managedPreferences,
      syncCapabilities,
      { ...createEmptySettingsManagedPremiumAccess(), planStatus },
    );

  it("locks managed sync actions when sync_allowed is false even with an active plan", () => {
    const presentation = buildBackupSyncSetupPresentation({
      ...input,
      managedPlanStatus: "active",
      syncCapabilities: capabilities(false),
    });

    expect(presentation.canShowSyncActions).toBe(false);
    expect(presentation.shouldShowDisconnectOnly).toBe(true);
    expect(presentation.managedSyncBlockedMessage).toBe(viewData.status.syncNotIncluded);
    expect(presentation.guidanceMessage).toBe(viewData.status.syncNotIncluded);
    expect(presentation.guidanceStepNumber).toBe(3);
  });

  it("locks managed sync actions while the capabilities are not loaded", () => {
    const presentation = buildBackupSyncSetupPresentation({
      ...input,
      managedPlanStatus: "active",
      syncCapabilities: null,
    });

    expect(presentation.canShowSyncActions).toBe(false);
    expect(presentation.managedSyncBlockedMessage).toBe(viewData.planCheckFailed);
  });

  it("unlocks managed sync actions from sync_allowed without an active plan", () => {
    const presentation = buildBackupSyncSetupPresentation({
      ...input,
      managedPlanStatus: "inactive",
      syncCapabilities: capabilities(true),
    });

    expect(presentation.canShowSyncActions).toBe(true);
    expect(presentation.managedSyncBlockedMessage).toBeNull();
    expect(presentation.guidanceComplete).toBe(true);
    expect(presentation.hasManagedPlan).toBe(false);
  });

  it("shows the plan copy only when the billing snapshot reports no active plan", () => {
    expect(
      buildBackupSyncSetupPresentation({
        ...input,
        managedPlanStatus: "inactive",
        syncCapabilities: capabilities(false),
      }).managedSyncBlockedMessage,
    ).toBe(viewData.syncBlockedNoPlan);
    expect(
      buildBackupSyncSetupPresentation({
        ...input,
        managedPlanStatus: "unknown",
        syncCapabilities: capabilities(false),
      }).managedSyncBlockedMessage,
    ).toBe(viewData.planCheckFailed);
  });

  it("names no managed lock for a self-hosted account or before sign-in", () => {
    const selfHosted = buildBackupSyncSetupPresentation({
      ...input,
      managedPlanStatus: "unknown",
      preferences: { ...managedPreferences, mode: "self_hosted" },
      syncCapabilities: null,
    });
    expect(selfHosted.canShowSyncActions).toBe(true);
    expect(selfHosted.managedSyncBlockedMessage).toBeNull();

    expect(
      buildBackupSyncSetupPresentation({
        ...input,
        hasSyncSession: false,
        managedPlanStatus: "unknown",
        syncCapabilities: null,
      }).managedSyncBlockedMessage,
    ).toBeNull();
  });

  it("reports sync_not_allowed under an active plan as sync not included", () => {
    const deviceCopy = getDeviceCopy("en");

    expect(resolveBackupSyncErrorMessage("sync_not_allowed", viewData, "active")).toBe(
      viewData.status.syncNotIncluded,
    );
    expect(resolveBackupSyncErrorMessage("sync_not_allowed", viewData, "inactive")).toBe(
      viewData.syncBlockedNoPlan,
    );
    expect(
      resolveBackupSyncErrorPresentation("sync_not_allowed", "sync", viewData, undefined, "active")
        .syncMessage,
    ).toBe(viewData.status.syncNotIncluded);
    expect(
      resolveBackupSyncDeviceErrorMessage("sync_not_allowed", deviceCopy, undefined, "active"),
    ).toBe(deviceCopy.errors.syncNotIncluded);
    expect(
      resolveBackupSyncDeviceErrorMessage("sync_not_allowed", deviceCopy, undefined, "inactive"),
    ).toBe(deviceCopy.errors.syncNotAllowed);
  });

  it("announces a managed connection from sync_allowed, not from the plan alone", () => {
    expect(
      resolveBackupSyncConnectedStatusMessage(loadedState(capabilities(false), "active"), viewData),
    ).toBe(viewData.status.syncNotIncluded);
    expect(
      resolveBackupSyncConnectedStatusMessage(loadedState(capabilities(true), "active"), viewData),
    ).toBe(viewData.status.connected);
    expect(
      resolveBackupSyncConnectedStatusMessage(loadedState(null, "inactive"), viewData),
    ).toBe(viewData.status.connectedNoPlan);
  });

  it("does not announce a managed connection while an unconfirmed gate stays locked", () => {
    expect(
      resolveBackupSyncConnectedStatusMessage(loadedState(null, "unknown"), viewData),
    ).toBe(viewData.planCheckFailed);
    expect(
      resolveBackupSyncConnectedStatusMessage(loadedState(null, "active"), viewData),
    ).toBe(viewData.planCheckFailed);
    expect(
      resolveBackupSyncConnectedStatusMessage(loadedState(capabilities(true), "unknown"), viewData),
    ).toBe(viewData.status.connected);
  });
});
