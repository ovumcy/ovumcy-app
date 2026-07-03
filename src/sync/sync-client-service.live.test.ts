import { createVolatileWebAppStorage } from "../storage/local/volatile-web-app-storage";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  connectSyncAccount,
  disconnectSyncAccount,
  runSyncRestore,
  runSyncUpload,
} from "./sync-client-service";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "./sync-contract";
import { prepareSyncSetup } from "./sync-setup-service";

const liveBaseURL = process.env.OVUMCY_SYNC_LIVE_BASE_URL ?? "";
const describeIfLive = liveBaseURL ? describe : describe.skip;

describeIfLive("sync-client-service live transport", () => {
  jest.setTimeout(30000);

  it("uploads and restores an encrypted snapshot against the running community server", async () => {
    const now = new Date("2026-03-20T09:00:00.000Z");
    const storage = createVolatileWebAppStorage();
    const secretStore = createSyncSecretStoreMock();

    await storage.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    });
    await storage.writeProfileRecord({
      lastPeriodStart: "2026-03-14",
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
      languageOverride: null,
      themeOverride: null,
    });
    await storage.writeDayLogRecord({
      date: "2026-03-17",
      isPeriod: true,
      cycleStart: true,
      isUncertain: false,
      flow: "medium",
      mood: 3,
      sexActivity: "protected",
      bbt: 0,
      cervicalMucus: "none",
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: ["stress"],
      symptomIDs: [],
      notes: "live sync smoke",
    });

    let preferences: SyncPreferencesRecord = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted",
      endpointInput: liveBaseURL,
      normalizedEndpoint: liveBaseURL,
      deviceLabel: "Live Smoke Device",
    };

    const prepareResult = await prepareSyncSetup(
      storage,
      secretStore,
      preferences,
      now,
    );
    expect(prepareResult.ok).toBe(true);
    if (!prepareResult.ok) {
      return;
    }
    preferences = prepareResult.preferences;

    const uniqueLogin = `live-${Date.now()}@ovumcy.test`;
    const connectResult = await connectSyncAccount(
      storage,
      secretStore,
      preferences,
      {
        login: uniqueLogin,
        password: "CorrectHorseBattery42!",
      },
      "register",
      now,
    );
    expect(connectResult.ok).toBe(true);
    if (!connectResult.ok) {
      return;
    }
    preferences = connectResult.preferences;

    const uploadResult = await runSyncUpload(storage, secretStore, preferences, now);
    expect(uploadResult.ok).toBe(true);
    if (!uploadResult.ok) {
      return;
    }
    preferences = uploadResult.preferences;

    await storage.writeProfileRecord({
      lastPeriodStart: null,
      cycleLength: 31,
      periodLength: 7,
      autoPeriodFill: false,
      irregularCycle: true,
      unpredictableCycle: true,
      ageGroup: "age_45_plus",
      usageGoal: "trying_to_conceive",
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
      languageOverride: "ru",
      themeOverride: "dark",
    });
    await storage.deleteDayLogRecord("2026-03-17");

    const restoreResult = await runSyncRestore(storage, secretStore, preferences);
    expect(restoreResult.ok).toBe(true);
    if (!restoreResult.ok) {
      return;
    }
    preferences = restoreResult.preferences;

    await expect(storage.readProfileRecord()).resolves.toEqual(
      expect.objectContaining({
        lastPeriodStart: "2026-03-14",
        cycleLength: 28,
        periodLength: 5,
        languageOverride: null,
        themeOverride: null,
      }),
    );
    await expect(storage.readDayLogRecord("2026-03-17")).resolves.toEqual(
      expect.objectContaining({
        isPeriod: true,
        cycleStart: true,
        flow: "medium",
        notes: "live sync smoke",
      }),
    );

    const disconnectResult = await disconnectSyncAccount(
      storage,
      secretStore,
      preferences,
    );
    expect(disconnectResult.preferences.setupStatus).toBe("local_ready");
  });

  it("guards a never-synced install from overwriting an existing server backup", async () => {
    const now = new Date("2026-03-21T09:00:00.000Z");
    const storage = createVolatileWebAppStorage();
    const secretStore = createSyncSecretStoreMock();

    await storage.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    });
    await storage.writeDayLogRecord({
      date: "2026-03-18",
      isPeriod: true,
      cycleStart: true,
      isUncertain: false,
      flow: "light",
      mood: 2,
      sexActivity: "none",
      bbt: 0,
      cervicalMucus: "none",
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "device A history",
    });

    let preferences: SyncPreferencesRecord = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted",
      endpointInput: liveBaseURL,
      normalizedEndpoint: liveBaseURL,
      deviceLabel: "Guard Device A",
    };

    const prepareResult = await prepareSyncSetup(
      storage,
      secretStore,
      preferences,
      now,
    );
    expect(prepareResult.ok).toBe(true);
    if (!prepareResult.ok) {
      return;
    }
    preferences = prepareResult.preferences;

    const connectResult = await connectSyncAccount(
      storage,
      secretStore,
      preferences,
      {
        login: `guard-${Date.now()}@ovumcy.test`,
        password: "CorrectHorseBattery42!",
      },
      "register",
      now,
    );
    expect(connectResult.ok).toBe(true);
    if (!connectResult.ok || "totpChallengeRequired" in connectResult) {
      return;
    }
    preferences = connectResult.preferences;

    // Device A uploads its history: the account now has a server backup.
    const firstUpload = await runSyncUpload(storage, secretStore, preferences, now);
    expect(firstUpload.ok).toBe(true);

    // "Fresh install" moment: this device has never uploaded or restored
    // (lastRemoteGeneration null — the exact state connect/recover leaves
    // behind) while the server still holds the backup. Declining the
    // confirmation must abort before anything is overwritten.
    const freshInstallPreferences: SyncPreferencesRecord = {
      ...preferences,
      lastRemoteGeneration: null,
      lastSyncedAt: null,
    };
    const declined = await runSyncUpload(
      storage,
      secretStore,
      freshInstallPreferences,
      new Date("2026-03-21T09:05:00.000Z"),
      undefined,
      undefined,
      { confirmUploadOverExistingBackup: async () => false },
    );
    expect(declined).toEqual({
      ok: false,
      errorCode: "upload_over_backup_declined",
    });

    // The server copy must still decode after the declined attempt.
    const restoreAfterDecline = await runSyncRestore(
      storage,
      secretStore,
      freshInstallPreferences,
    );
    expect(restoreAfterDecline.ok).toBe(true);

    // An explicit confirmation still allows the overwrite.
    const confirmed = await runSyncUpload(
      storage,
      secretStore,
      { ...preferences, lastRemoteGeneration: null, lastSyncedAt: null },
      new Date("2026-03-21T09:10:00.000Z"),
      undefined,
      undefined,
      { confirmUploadOverExistingBackup: async () => true },
    );
    expect(confirmed.ok).toBe(true);

    await disconnectSyncAccount(storage, secretStore, preferences);
  });
});
