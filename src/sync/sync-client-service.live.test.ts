import {
  createPregnancyRecord,
  type ContractionSession,
  type KickCountSession,
} from "../models/pregnancy";
import { createPostpartumRecord } from "../models/postpartum";
import { createScreeningResponse } from "../models/screening";
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

// The suite-wide expo/fetch stub forwards to globalThis.fetch, which jest-expo
// points back at expo/fetch; a live run needs a fetch that reaches the network.
jest.mock("expo/fetch", () => ({ fetch: jest.requireActual("node-fetch") }));

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

    // Pregnancy-module domain: must survive the encrypted round-trip.
    const pregnancy = createPregnancyRecord({
      edd: "2026-12-01",
      eddBasis: "lmp",
      startedAt: "2026-03-01",
      lmpDate: "2026-02-24",
    });
    const kickSession: KickCountSession = {
      id: "kick-live-1",
      date: "2026-03-18",
      durationMinutes: 30,
      kickCount: 12,
    };
    const contractionSession: ContractionSession = {
      id: "contraction-live-1",
      date: "2026-03-19",
      startedAt: "2026-03-19T20:00:00.000Z",
      contractions: [
        { startedAt: "2026-03-19T20:00:00.000Z", durationSeconds: 45 },
        { startedAt: "2026-03-19T20:05:00.000Z", durationSeconds: 55 },
      ],
    };
    await storage.writePregnancyRecord(pregnancy);
    await storage.writeKickSession(kickSession);
    await storage.writeContractionSession(contractionSession);

    // Premium postpartum + EPDS screening domain: the recovery record and
    // the most-sensitive mood-screening answers must survive the encrypted
    // round-trip too.
    const postpartum = createPostpartumRecord({
      startedAt: "2026-03-05",
      modeOfDelivery: "vaginal",
    });
    const screening = createScreeningResponse({
      date: "2026-03-18",
      answers: [1, 0, 2, 1, 0, 1, 0, 2, 1, 0],
    });
    await storage.writePostpartumRecord(postpartum);
    await storage.writeScreeningResponse(screening);

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
    // Simulate the second device having no pregnancy / postpartum / screening
    // data before restore.
    await storage.deleteAllPregnancyData();
    await storage.deleteAllPostpartumData();
    await storage.deleteAllScreeningData();
    await expect(storage.readActivePregnancy()).resolves.toBeNull();
    await expect(storage.readActivePostpartum()).resolves.toBeNull();
    await expect(storage.listScreeningResponses()).resolves.toEqual([]);

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
    // The pregnancy domain arrived intact on the simulated second device.
    await expect(storage.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({
        id: pregnancy.id,
        status: "active",
        edd: "2026-12-01",
      }),
    );
    await expect(storage.listKickSessions()).resolves.toEqual([
      expect.objectContaining({ id: kickSession.id, kickCount: 12 }),
    ]);
    const restoredContractions = await storage.listContractionSessions();
    expect(restoredContractions).toHaveLength(1);
    expect(restoredContractions[0]?.contractions).toHaveLength(2);
    // The postpartum + screening domain arrived intact on the second device.
    await expect(storage.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({ id: postpartum.id, status: "active" }),
    );
    await expect(storage.listScreeningResponses()).resolves.toEqual([
      expect.objectContaining({ id: screening.id, score: screening.score }),
    ]);

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

  it("refuses to overwrite a backup another device uploaded since its last sync", async () => {
    const storage = createVolatileWebAppStorage();
    const secretStore = createSyncSecretStoreMock();
    await storage.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    });

    const prepareResult = await prepareSyncSetup(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: liveBaseURL,
        normalizedEndpoint: liveBaseURL,
        deviceLabel: "Generation Device",
      },
      new Date("2026-03-22T09:00:00.000Z"),
    );
    expect(prepareResult.ok).toBe(true);
    if (!prepareResult.ok) {
      return;
    }
    const connectResult = await connectSyncAccount(
      storage,
      secretStore,
      prepareResult.preferences,
      {
        login: `generation-${Date.now()}@ovumcy.test`,
        password: "CorrectHorseBattery42!",
      },
      "register",
      new Date("2026-03-22T09:00:00.000Z"),
    );
    expect(connectResult.ok).toBe(true);
    if (!connectResult.ok || "totpChallengeRequired" in connectResult) {
      return;
    }

    const first = await runSyncUpload(
      storage,
      secretStore,
      connectResult.preferences,
      new Date("2026-03-22T09:01:00.000Z"),
    );
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    // Another device on the account uploads after this one last synced.
    const other = await runSyncUpload(
      storage,
      secretStore,
      first.preferences,
      new Date("2026-03-22T09:02:00.000Z"),
    );
    expect(other.ok).toBe(true);

    const stale = await runSyncUpload(
      storage,
      secretStore,
      first.preferences,
      new Date("2026-03-22T09:03:00.000Z"),
    );
    expect(stale).toEqual({ ok: false, errorCode: "remote_backup_changed" });

    const restored = await runSyncRestore(storage, secretStore, first.preferences);
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }
    const afterRestore = await runSyncUpload(
      storage,
      secretStore,
      restored.preferences,
      new Date("2026-03-22T09:04:00.000Z"),
    );
    expect(afterRestore.ok).toBe(true);

    await disconnectSyncAccount(storage, secretStore, restored.preferences);
  });
});
