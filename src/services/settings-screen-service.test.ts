import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultSyncPreferencesRecord } from "../sync/sync-contract";
import { createDefaultSymptomRecords } from "../models/symptom";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  archiveSettingsSymptom,
  createSettingsSymptom,
  prepareSettingsExportArtifact,
  refreshSettingsExportState,
  restoreSettingsSymptom,
  saveReminderSettings,
  saveCycleSettings,
  saveInterfaceSettings,
  saveTrackingSettings,
  updateSettingsSymptom,
} from "./settings-screen-service";
import { prepareBackupSyncSetup, saveBackupSyncDraft } from "./backup-sync-screen-service";
import { loadSettingsScreenState } from "./settings-state-service";
import { createLoadedSettingsState } from "./settings-view-service";

const originalFetch = global.fetch;

describe("settings services", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("loads canonical profile state and resolves the default age-group selection like the web app", async () => {
    const storage = createStorageMock();
    const secretStore = createSyncSecretStoreMock();

    await expect(
      loadSettingsScreenState(storage, secretStore, new Date(2026, 2, 18)),
    ).resolves.toEqual(
      expect.objectContaining({
        profile: expect.objectContaining({
          ageGroup: "",
          trackBBT: false,
        }),
        cycleValues: expect.objectContaining({
          ageGroup: "",
          autoPeriodFill: true,
        }),
        syncPreferences: expect.objectContaining({
          mode: "managed",
          setupStatus: "not_configured",
        }),
        hasStoredSyncSecrets: false,
        trackingValues: expect.objectContaining({
          temperatureUnit: "c",
        }),
        exportState: expect.objectContaining({
          values: expect.objectContaining({
            preset: "all",
          }),
        }),
        symptomRecords: expect.arrayContaining([
          expect.objectContaining({
            id: "cramps",
            isDefault: true,
          }),
        ]),
      }),
    );
  });

  it("loads managed cloud capabilities for a connected managed session", async () => {
    const storage = createStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
        preparedAt: "2026-03-19T08:15:00.000Z",
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });
    const secretStore = createSyncSecretStoreMock({
      device: {
        deviceID: "device-1",
        deviceLabel: "Pixel 7",
        createdAt: "2026-03-19T08:15:00.000Z",
      },
      masterKeyHex: "aa",
      deviceSecretHex: "bb",
      wrappedKey: {
        algorithm: "xchacha20poly1305",
        kdf: "bip39_seed_hkdf_sha256",
        mnemonicWordCount: 12,
        wrapNonceHex: "cc",
        wrappedMasterKeyHex: "dd",
        phraseFingerprintHex: "ee",
      },
      authSessionToken: null,
      managedAuthSessionToken: "managed-session-1",
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            account_id: "managed-account-1",
            email: "alice@example.com",
            session_expires_at: "2026-03-21T08:00:00.000Z",
            sync_entitlement: {
              sync_allowed: false,
              source: "manual",
              updated_at: "2026-03-20T08:05:00.000Z",
              effective_at: "2026-03-20T08:05:00.000Z",
              explanation: "plan inactive",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            has_active_plan: false,
            premium_features: {
              doctor_pdf: false,
              advanced_insights: false,
              reminders: false,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ) as typeof fetch;

    await expect(
      loadSettingsScreenState(storage, secretStore, new Date(2026, 2, 18)),
    ).resolves.toEqual(
      expect.objectContaining({
        hasSyncSession: true,
        managedPremiumAccess: {
          planStatus: "inactive",
          doctorPDF: false,
          reminders: false,
        },
        syncCapabilities: expect.objectContaining({
          mode: "managed",
          premiumActive: false,
        }),
      }),
    );
  });

  it("keeps managed plan status billing-owned when sync entitlement stays enabled without premium billing", async () => {
    const storage = createStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
        preparedAt: "2026-03-19T08:15:00.000Z",
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });
    const secretStore = createSyncSecretStoreMock({
      device: {
        deviceID: "device-1",
        deviceLabel: "Pixel 7",
        createdAt: "2026-03-19T08:15:00.000Z",
      },
      masterKeyHex: "aa",
      deviceSecretHex: "bb",
      wrappedKey: {
        algorithm: "xchacha20poly1305",
        kdf: "bip39_seed_hkdf_sha256",
        mnemonicWordCount: 12,
        wrapNonceHex: "cc",
        wrappedMasterKeyHex: "dd",
        phraseFingerprintHex: "ee",
      },
      authSessionToken: null,
      managedAuthSessionToken: "managed-session-1",
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            account_id: "managed-account-1",
            email: "alice@example.com",
            session_expires_at: "2026-03-21T08:00:00.000Z",
            sync_entitlement: {
              sync_allowed: true,
              source: "manual_admin",
              updated_at: "2026-03-20T08:05:00.000Z",
              effective_at: "2026-03-20T08:05:00.000Z",
              explanation: "support temporarily enabled sync",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            has_active_plan: false,
            premium_features: {
              doctor_pdf: false,
              advanced_insights: false,
              reminders: false,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ) as typeof fetch;

    await expect(
      loadSettingsScreenState(storage, secretStore, new Date(2026, 2, 18)),
    ).resolves.toEqual(
      expect.objectContaining({
        hasSyncSession: true,
        managedPremiumAccess: {
          planStatus: "inactive",
          doctorPDF: false,
          reminders: false,
        },
        syncCapabilities: expect.objectContaining({
          mode: "managed",
          premiumActive: true,
        }),
      }),
    );
  });

  it("loads managed cloud capabilities for a signed-in managed device before sync upload is used", async () => {
    const storage = createStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
        preparedAt: "2026-03-19T08:15:00.000Z",
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });
    const secretStore = createSyncSecretStoreMock({
      device: {
        deviceID: "device-1",
        deviceLabel: "Pixel 7",
        createdAt: "2026-03-19T08:15:00.000Z",
      },
      masterKeyHex: "aa",
      deviceSecretHex: "bb",
      wrappedKey: {
        algorithm: "xchacha20poly1305",
        kdf: "bip39_seed_hkdf_sha256",
        mnemonicWordCount: 12,
        wrapNonceHex: "cc",
        wrappedMasterKeyHex: "dd",
        phraseFingerprintHex: "ee",
      },
      authSessionToken: null,
      managedAuthSessionToken: "managed-session-1",
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            account_id: "managed-account-1",
            email: "alice@example.com",
            session_expires_at: "2026-03-21T08:00:00.000Z",
            sync_entitlement: {
              sync_allowed: true,
              source: "billing_subscription",
              updated_at: "2026-03-20T08:05:00.000Z",
              effective_at: "2026-03-20T08:05:00.000Z",
              explanation: "plan active",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            has_active_plan: true,
            premium_features: {
              doctor_pdf: true,
              advanced_insights: true,
              reminders: true,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ) as typeof fetch;

    await expect(
      loadSettingsScreenState(storage, secretStore, new Date(2026, 2, 18)),
    ).resolves.toEqual(
      expect.objectContaining({
        hasSyncSession: true,
        syncPreferences: expect.objectContaining({
          mode: "managed",
          setupStatus: "local_ready",
        }),
        managedPremiumAccess: {
          planStatus: "active",
          doctorPDF: true,
          reminders: true,
        },
        syncCapabilities: expect.objectContaining({
          mode: "managed",
          premiumActive: true,
        }),
      }),
    );
  });

  it("clears a stale sync session when the server reports unauthorized", async () => {
    const storage = createStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
        preparedAt: "2026-03-19T08:15:00.000Z",
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });
    const secretStore = createSyncSecretStoreMock({
      device: {
        deviceID: "device-1",
        deviceLabel: "Pixel 7",
        createdAt: "2026-03-19T08:15:00.000Z",
      },
      masterKeyHex: "aa",
      deviceSecretHex: "bb",
      wrappedKey: {
        algorithm: "xchacha20poly1305",
        kdf: "bip39_seed_hkdf_sha256",
        mnemonicWordCount: 12,
        wrapNonceHex: "cc",
        wrappedMasterKeyHex: "dd",
        phraseFingerprintHex: "ee",
      },
      authSessionToken: "expired-sync-session",
      managedAuthSessionToken: "expired-managed-session",
    });
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    await expect(
      loadSettingsScreenState(storage, secretStore, new Date(2026, 2, 18)),
    ).resolves.toEqual(
      expect.objectContaining({
        hasSyncSession: false,
        syncCapabilities: null,
        syncPreferences: expect.objectContaining({
          setupStatus: "local_ready",
        }),
      }),
    );
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        authSessionToken: null,
        managedAuthSessionToken: null,
      }),
    );
  });

  it("persists compatible cycle settings through the canonical profile repository", async () => {
    const storage = createStorageMock();

    const result = await saveCycleSettings(
      storage,
      createLoadedSettingsState(
        await storage.readProfileRecord(),
        createDefaultSyncPreferencesRecord(),
        false,
        false,
        createDefaultSymptomRecords(),
        createExportState(),
      ),
      {
        lastPeriodStart: "2026-03-16",
        cycleLength: 21,
        periodLength: 10,
        autoPeriodFill: true,
        irregularCycle: true,
        unpredictableCycle: true,
        ageGroup: "age_45_plus",
        usageGoal: "trying_to_conceive",
      },
      new Date(2026, 2, 17),
    );

    expect(result).toEqual({
      ok: true,
      state: expect.objectContaining({
        profile: expect.objectContaining({
          cycleLength: 21,
          periodLength: 10,
          unpredictableCycle: true,
          ageGroup: "age_45_plus",
          usageGoal: "trying_to_conceive",
        }),
      }),
    });
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        lastPeriodStart: "2026-03-16",
        cycleLength: 21,
        periodLength: 10,
        irregularCycle: true,
        unpredictableCycle: true,
        dismissedCalendarPredictionNoticeKey: null,
      }),
    );
  });

  it("rejects incompatible cycle settings instead of silently clamping them", async () => {
    const storage = createStorageMock();

    const result = await saveCycleSettings(
      storage,
      createLoadedSettingsState(
        await storage.readProfileRecord(),
        createDefaultSyncPreferencesRecord(),
        false,
        false,
        createDefaultSymptomRecords(),
        createExportState(),
      ),
      {
        lastPeriodStart: "2026-03-16",
        cycleLength: 21,
        periodLength: 20,
        autoPeriodFill: true,
        irregularCycle: true,
        unpredictableCycle: true,
        ageGroup: "age_45_plus",
        usageGoal: "trying_to_conceive",
      },
      new Date(2026, 2, 17),
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "invalid_cycle_settings",
    });
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
  });

  it("persists interface settings, including screenshot protection", async () => {
    const storage = createStorageMock();
    const state = createLoadedSettingsState(
      await storage.readProfileRecord(),
      createDefaultSyncPreferencesRecord(),
      false,
      false,
      createDefaultSymptomRecords(),
      createExportState(),
    );

    const result = await saveInterfaceSettings(storage, state, {
      languageOverride: "en",
      themeOverride: "light",
      screenCaptureProtectionEnabled: false,
    });

    expect(result).toEqual({
      ok: true,
      state: expect.objectContaining({
        profile: expect.objectContaining({
          screenCaptureProtectionEnabled: false,
        }),
      }),
    });
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        screenCaptureProtectionEnabled: false,
      }),
    );
  });

  it("resets a dismissed calendar notice when the prediction mode changes", async () => {
    const storage = createStorageMock();

    const result = await saveCycleSettings(
      storage,
      createLoadedSettingsState(
        {
          ...(await storage.readProfileRecord()),
          irregularCycle: true,
          unpredictableCycle: false,
          dismissedCalendarPredictionNoticeKey:
            "calendar_irregular_prediction_notice_v1",
        },
        createDefaultSyncPreferencesRecord(),
        false,
        false,
        createDefaultSymptomRecords(),
        createExportState(),
      ),
      {
        lastPeriodStart: "2026-03-16",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: true,
        ageGroup: "under_40",
        usageGoal: "health",
      },
      new Date(2026, 2, 17),
    );

    expect(result).toEqual({
      ok: true,
      state: expect.objectContaining({
        profile: expect.objectContaining({
          dismissedCalendarPredictionNoticeKey: null,
          unpredictableCycle: true,
        }),
      }),
    });
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        dismissedCalendarPredictionNoticeKey: null,
        unpredictableCycle: true,
      }),
    );
  });

  it("rejects out-of-range cycle start dates", async () => {
    const storage = createStorageMock();

    await expect(
      saveCycleSettings(
        storage,
        createLoadedSettingsState(
          await storage.readProfileRecord(),
          createDefaultSyncPreferencesRecord(),
          false,
          false,
          createDefaultSymptomRecords(),
          createExportState(),
        ),
        {
          lastPeriodStart: "2025-12-31",
          cycleLength: 28,
          periodLength: 5,
          autoPeriodFill: true,
          irregularCycle: false,
          unpredictableCycle: false,
          ageGroup: "under_40",
          usageGoal: "health",
        },
        new Date(2026, 2, 17),
      ),
    ).resolves.toEqual({
      ok: false,
      errorCode: "invalid_last_period_start",
    });
  });

  it("normalizes tracking settings before persisting", async () => {
    const storage = createStorageMock();

    const result = await saveTrackingSettings(
      storage,
      createLoadedSettingsState(
        await storage.readProfileRecord(),
        createDefaultSyncPreferencesRecord(),
        false,
        false,
        createDefaultSymptomRecords(),
        createExportState(),
      ),
      {
        trackBBT: true,
        temperatureUnit: "F" as "f",
        trackCervicalMucus: true,
        hideSexChip: true,
        hideNotes: true,
      },
    );

    expect(result).toEqual({
      ok: true,
      state: expect.objectContaining({
        profile: expect.objectContaining({
          trackBBT: true,
          temperatureUnit: "f",
          trackCervicalMucus: true,
          hideSexChip: true,
          hideNotes: true,
        }),
      }),
    });
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        temperatureUnit: "f",
      }),
    );
  });

  it("validates and persists reminder settings locally", async () => {
    const storage = createStorageMock();
    const state = createLoadedSettingsState(
      await storage.readProfileRecord(),
      createDefaultSyncPreferencesRecord(),
      false,
      false,
      createDefaultSymptomRecords(),
      createExportState(),
    );

    const result = await saveReminderSettings(storage, state, {
      dailyLogReminderEnabled: true,
      upcomingPeriodReminderEnabled: true,
      fertileWindowReminderEnabled: false,
      managedReminderEmailsEnabled: true,
      reminderTime: "21:30",
    });

    expect(result).toEqual({
      ok: true,
      state: expect.objectContaining({
        profile: expect.objectContaining({
          dailyLogReminderEnabled: true,
          upcomingPeriodReminderEnabled: true,
          fertileWindowReminderEnabled: false,
          managedReminderEmailsEnabled: true,
          reminderTime: "21:30",
        }),
      }),
    });
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyLogReminderEnabled: true,
        upcomingPeriodReminderEnabled: true,
        fertileWindowReminderEnabled: false,
        managedReminderEmailsEnabled: true,
        reminderTime: "21:30",
      }),
    );
  });

  it("creates, updates, archives, and restores custom symptoms through the canonical repository", async () => {
    const storage = createStorageMock();
    const initialState = createLoadedSettingsState(
      await storage.readProfileRecord(),
      createDefaultSyncPreferencesRecord(),
      false,
      false,
      createDefaultSymptomRecords(),
      createExportState(),
    );

    const created = await createSettingsSymptom(storage, initialState, {
      label: "Jaw pain",
      icon: "🔥",
    });
    expect(created).toEqual({
      ok: true,
      state: expect.objectContaining({
        symptomRecords: expect.arrayContaining([
          expect.objectContaining({
            label: "Jaw pain",
            icon: "🔥",
            isArchived: false,
          }),
        ]),
      }),
    });
    expect(storage.writeSymptomRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Jaw pain",
        icon: "🔥",
        isArchived: false,
      }),
    );
    if (!created.ok) {
      throw new Error("Expected a created settings symptom");
    }

    const createdRecord = created.state.symptomRecords.find(
      (record) => record.label === "Jaw pain",
    );
    if (!createdRecord) {
      throw new Error("Expected the new custom symptom to exist");
    }

    const updated = await updateSettingsSymptom(
      storage,
      created.state,
      createdRecord.id,
      {
        label: "Jaw tension",
        icon: "⚡",
      },
    );
    expect(updated).toEqual({
      ok: true,
      state: expect.objectContaining({
        symptomRecords: expect.arrayContaining([
          expect.objectContaining({
            id: createdRecord.id,
            label: "Jaw tension",
            icon: "⚡",
          }),
        ]),
      }),
    });
    if (!updated.ok) {
      throw new Error("Expected an updated settings symptom");
    }

    const archived = await archiveSettingsSymptom(
      storage,
      updated.state,
      createdRecord.id,
    );
    expect(archived).toEqual({
      ok: true,
      state: expect.objectContaining({
        symptomRecords: expect.arrayContaining([
          expect.objectContaining({
            id: createdRecord.id,
            isArchived: true,
          }),
        ]),
      }),
    });
    if (!archived.ok) {
      throw new Error("Expected an archived settings symptom");
    }

    await expect(
      restoreSettingsSymptom(storage, archived.state, createdRecord.id),
    ).resolves.toEqual({
      ok: true,
      state: expect.objectContaining({
        symptomRecords: expect.arrayContaining([
          expect.objectContaining({
            id: createdRecord.id,
            isArchived: false,
          }),
        ]),
      }),
    });
  });

  it("refreshes export preview state and prepares a JSON artifact through the canonical repositories", async () => {
    const storage = createStorageMock({
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([
        {
          ...createEmptyDayLogRecord("2026-03-10"),
          isPeriod: true,
          notes: "Cycle start",
        },
      ]),
      readDayLogSummary: jest.fn().mockImplementation(async (from?: string, to?: string) => {
        if (from === "2026-03-10" && to === "2026-03-10") {
          return {
            totalEntries: 1,
            hasData: true,
            dateFrom: "2026-03-10",
            dateTo: "2026-03-10",
          };
        }

        return {
          totalEntries: 1,
          hasData: true,
          dateFrom: "2026-03-10",
          dateTo: "2026-03-10",
        };
      }),
    });
    const initialState = createLoadedSettingsState(
      await storage.readProfileRecord(),
      createDefaultSyncPreferencesRecord(),
      false,
      false,
      createDefaultSymptomRecords(),
      createExportState(),
    );

    const refreshed = await refreshSettingsExportState(
      storage,
      initialState,
      {
        preset: "custom",
        fromDate: "2026-03-10",
        toDate: "2026-03-10",
      },
      new Date(2026, 2, 18),
    );
    expect(refreshed).toEqual({
      ok: true,
      state: expect.objectContaining({
        exportState: expect.objectContaining({
          summary: expect.objectContaining({
            totalEntries: 1,
          }),
        }),
      }),
    });
    if (!refreshed.ok) {
      throw new Error("Expected refreshed export state");
    }

    await expect(
      prepareSettingsExportArtifact(
        storage,
        refreshed.state,
        "json",
        new Date("2026-03-18T10:00:00.000Z"),
      ),
    ).resolves.toEqual({
      ok: true,
      state: expect.any(Object),
      artifact: expect.objectContaining({
        filename: "ovumcy-export-2026-03-18.json",
      }),
    });
  });

  it("blocks PDF export when no managed cloud plan is active", async () => {
    const storage = createStorageMock();
    const initialState = createLoadedSettingsState(
      await storage.readProfileRecord(),
      createDefaultSyncPreferencesRecord(),
      false,
      false,
      createDefaultSymptomRecords(),
      createExportState(),
    );

    await expect(
      prepareSettingsExportArtifact(
        storage,
        initialState,
        "pdf",
        new Date("2026-03-18T10:00:00.000Z"),
      ),
    ).resolves.toEqual({
      ok: false,
      errorCode: "pdf_locked",
      state: initialState,
    });
  });

  it("allows PDF export only when the managed billing entitlement is active", async () => {
    const storage = createStorageMock();
    const initialState = createLoadedSettingsState(
      await storage.readProfileRecord(),
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
      },
      false,
      true,
      createDefaultSymptomRecords(),
      createExportState(),
      undefined,
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
      {
        planStatus: "active",
        doctorPDF: true,
        reminders: false,
      },
    );

    await expect(
      prepareSettingsExportArtifact(
        storage,
        initialState,
        "pdf",
        new Date("2026-03-18T10:00:00.000Z"),
        {
          buildPDFContent: jest
            .fn()
            .mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
        },
      ),
    ).resolves.toEqual({
      ok: true,
      state: expect.any(Object),
      artifact: expect.objectContaining({
        filename: "ovumcy-export-2026-03-18.pdf",
        mimeType: "application/pdf",
      }),
    });
  });

  it("prepares local encrypted sync state through settings services without faking account auth", async () => {
    const storage = createStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const initialState = createLoadedSettingsState(
      await storage.readProfileRecord(),
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
      },
      false,
      false,
      createDefaultSymptomRecords(),
      createExportState(),
    );

    const result = await prepareBackupSyncSetup(
      storage,
      secretStore,
      initialState,
      new Date("2026-03-19T08:15:00.000Z"),
    );

    expect(result).toEqual({
      ok: true,
      state: expect.objectContaining({
        syncPreferences: expect.objectContaining({
          normalizedEndpoint: "http://192.168.1.20:8080",
          setupStatus: "local_ready",
        }),
        hasStoredSyncSecrets: true,
      }),
      regenerated: false,
      recoveryPhrase: expect.any(String),
    });
    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceLabel: "Pixel 7",
        normalizedEndpoint: "http://192.168.1.20:8080",
      }),
    );
  });

  it("saves sync preference drafts and resets prepared state when the endpoint changes", async () => {
    const storage = createStorageMock();
    const secretStore = createSyncSecretStoreMock({
      device: {
        deviceID: "device-1",
        deviceLabel: "Pixel 7",
        createdAt: "2026-03-19T08:15:00.000Z",
      },
      masterKeyHex: "aa",
      deviceSecretHex: "bb",
      wrappedKey: {
        algorithm: "xchacha20poly1305",
        kdf: "bip39_seed_hkdf_sha256",
        mnemonicWordCount: 12,
        wrapNonceHex: "cc",
        wrappedMasterKeyHex: "dd",
        phraseFingerprintHex: "ee",
      },
      authSessionToken: null,
      managedAuthSessionToken: null,
    });
    const initialState = createLoadedSettingsState(
      await storage.readProfileRecord(),
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
        preparedAt: "2026-03-19T08:15:00.000Z",
      },
      true,
      false,
      createDefaultSymptomRecords(),
      createExportState(),
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.21:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
        preparedAt: "2026-03-19T08:15:00.000Z",
      },
    );

    const result = await saveBackupSyncDraft(storage, secretStore, initialState);

    expect(result).toEqual({
      ok: true,
      state: expect.objectContaining({
        savedSyncPreferences: expect.objectContaining({
          endpointInput: "192.168.1.21:8080",
          normalizedEndpoint: "http://192.168.1.21:8080",
          setupStatus: "not_configured",
          preparedAt: null,
        }),
        syncPreferences: expect.objectContaining({
          endpointInput: "192.168.1.21:8080",
          normalizedEndpoint: "http://192.168.1.21:8080",
          setupStatus: "not_configured",
          preparedAt: null,
        }),
        hasStoredSyncSecrets: false,
      }),
    });
    await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
  });
});

function createStorageMock(overrides = {}) {
  return createLocalAppStorageMock({
    readProfileRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-03-10",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: false,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: "en",
      themeOverride: "light",
      screenCaptureProtectionEnabled: true,
      dismissedCalendarPredictionNoticeKey: null,
    }),
    readOnboardingRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-03-10",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      ageGroup: "",
      usageGoal: "health",
    }),
    readDayLogRecord: jest
      .fn()
      .mockImplementation(async (date: string) => createEmptyDayLogRecord(date)),
    readDayLogSummary: jest.fn().mockResolvedValue({
      totalEntries: 1,
      hasData: true,
      dateFrom: "2026-03-10",
      dateTo: "2026-03-10",
    }),
    ...overrides,
  });
}

function createExportState() {
  return {
    values: {
      preset: "all" as const,
      fromDate: "2026-03-10",
      toDate: "2026-03-18",
    },
    availableSummary: {
      totalEntries: 1,
      hasData: true,
      dateFrom: "2026-03-10",
      dateTo: "2026-03-10",
    },
    summary: {
      totalEntries: 1,
      hasData: true,
      dateFrom: "2026-03-10",
      dateTo: "2026-03-10",
    },
    bounds: {
      minDate: "2026-03-10",
      maxDate: "2026-03-18",
    },
  };
}
