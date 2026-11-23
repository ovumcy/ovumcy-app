import { hmac } from "@noble/hashes/hmac.js";
import { sha1 } from "@noble/hashes/legacy.js";

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
  finalizeSyncSessionAfterTOTP,
  removeSyncDevice,
  runSyncRestore,
  runSyncUpload,
} from "./sync-client-service";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "./sync-contract";
import { prepareSyncSetup } from "./sync-setup-service";
import {
  completeTOTPChallenge,
  startTOTPEnrollment,
  verifyTOTPEnrollment,
} from "./sync-totp-service";

// The suite-wide expo/fetch stub forwards to globalThis.fetch, which jest-expo
// points back at expo/fetch; a live run needs a fetch that reaches the network.
jest.mock("expo/fetch", () => ({ fetch: jest.requireActual("node-fetch") }));

const liveBaseURL = process.env.OVUMCY_SYNC_LIVE_BASE_URL ?? "";
const describeIfLive = liveBaseURL ? describe : describe.skip;

const livePassword = "CorrectHorseBattery42!";
const TOTP_PERIOD_SECONDS = 30;

function decodeBase32(encoded: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = encoded.replace(/=+$/, "").toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value < 0) {
      throw new Error("invalid base32 secret");
    }
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

// RFC 6238 over HMAC-SHA1, 6 digits, 30 s steps: the authenticator-app
// parameters the server provisions.
function totpCode(secretBase32: string, step: number): string {
  const counter = new Uint8Array(8);
  let value = step;
  for (let index = 7; index >= 0; index -= 1) {
    counter[index] = value & 0xff;
    value = Math.floor(value / 256);
  }
  const digest = hmac(sha1, decodeBase32(secretBase32), counter);
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;
  return String(binary % 1_000_000).padStart(6, "0");
}

function currentTOTPStep(): number {
  return Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
}

// A code that matches none of the steps the server's skew window accepts.
function wrongTOTPCode(secretBase32: string): string {
  const step = currentTOTPStep();
  const accepted = new Set(
    [step - 2, step - 1, step, step + 1, step + 2].map((each) =>
      totpCode(secretBase32, each),
    ),
  );
  for (let candidate = 0; ; candidate += 1) {
    const code = String(candidate).padStart(6, "0");
    if (!accepted.has(code)) {
      return code;
    }
  }
}

async function connectFreshSelfHostedDevice(
  deviceLabel: string,
  login: string,
  mode: "register" | "login",
  now: Date,
) {
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
      deviceLabel,
    },
    now,
  );
  if (!prepareResult.ok) {
    throw new Error(`prepare failed: ${prepareResult.errorCode}`);
  }
  const connectResult = await connectSyncAccount(
    storage,
    secretStore,
    prepareResult.preferences,
    { login, password: livePassword },
    mode,
    now,
  );
  return { storage, secretStore, preferences: prepareResult.preferences, connectResult };
}

// Turns two-factor on for the signed-in account and returns its secret. The
// enrollment code claims the current step, so a later code must come from a
// later step.
async function enrollTOTP(
  secretStore: ReturnType<typeof createSyncSecretStoreMock>,
  preferences: SyncPreferencesRecord,
): Promise<string> {
  const started = await startTOTPEnrollment(secretStore, preferences, {
    currentPassword: livePassword,
  });
  if (!started.ok) {
    throw new Error(`enrollment start failed: ${started.errorCode}`);
  }
  const secretBase32 = started.enrollment.secretBase32;
  const verified = await verifyTOTPEnrollment(secretStore, preferences, {
    code: totpCode(secretBase32, currentTOTPStep()),
  });
  expect(verified).toEqual({ ok: true, recoveryCode: expect.any(String) });
  return secretBase32;
}

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

  it("signs a second device in through the TOTP challenge of a two-factor account", async () => {
    const now = new Date("2026-03-23T09:00:00.000Z");
    const login = `totp-${Date.now()}@ovumcy.test`;
    const first = await connectFreshSelfHostedDevice("TOTP Device A", login, "register", now);
    expect(first.connectResult.ok).toBe(true);
    if (!first.connectResult.ok || "totpChallengeRequired" in first.connectResult) {
      return;
    }
    const secretBase32 = await enrollTOTP(first.secretStore, first.connectResult.preferences);

    const second = await connectFreshSelfHostedDevice("TOTP Device B", login, "login", now);
    expect(second.connectResult).toEqual(
      expect.objectContaining({
        ok: true,
        totpChallengeRequired: true,
        challengeID: expect.any(String),
        accountID: expect.any(String),
      }),
    );
    if (!second.connectResult.ok || !("totpChallengeRequired" in second.connectResult)) {
      return;
    }
    // The password alone never yields a session.
    await expect(second.secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({ authSessionToken: null }),
    );

    const completed = await completeTOTPChallenge(second.preferences, {
      challengeID: second.connectResult.challengeID,
      code: totpCode(secretBase32, currentTOTPStep() + 1),
    });
    expect(completed.ok).toBe(true);
    if (!completed.ok) {
      return;
    }

    const finalized = await finalizeSyncSessionAfterTOTP(
      second.storage,
      second.secretStore,
      second.preferences,
      {
        sessionToken: completed.auth.sessionToken,
        sessionExpiresAt: completed.auth.sessionExpiresAt,
        accountID: completed.auth.accountID,
      },
    );
    expect(finalized.ok).toBe(true);
    if (!finalized.ok) {
      return;
    }
    expect(finalized.preferences.setupStatus).toBe("connected");

    await disconnectSyncAccount(second.storage, second.secretStore, finalized.preferences);
    await disconnectSyncAccount(
      first.storage,
      first.secretStore,
      first.connectResult.preferences,
    );
  });

  it("answers rate_limited with Retry-After once the step-up code budget is spent", async () => {
    const now = new Date("2026-03-24T09:00:00.000Z");
    const device = await connectFreshSelfHostedDevice(
      "Budget Device",
      `budget-${Date.now()}@ovumcy.test`,
      "register",
      now,
    );
    expect(device.connectResult.ok).toBe(true);
    if (!device.connectResult.ok || "totpChallengeRequired" in device.connectResult) {
      return;
    }
    const preferences = device.connectResult.preferences;
    const secretBase32 = await enrollTOTP(device.secretStore, preferences);
    const secrets = await device.secretStore.readSyncSecrets();
    const deviceID = secrets?.device.deviceID ?? "";

    const removeWithWrongCode = () =>
      removeSyncDevice(device.storage, device.secretStore, preferences, deviceID, {
        currentPassword: livePassword,
        code: wrongTOTPCode(secretBase32),
      });

    // The server's step-up budget is 5 wrong codes per 15 minutes; the sixth
    // check is refused before the code is looked at.
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(removeWithWrongCode()).resolves.toEqual({
        ok: false,
        errorCode: "totp_invalid_code",
      });
    }
    const refused = await removeWithWrongCode();
    expect(refused).toEqual({
      ok: false,
      errorCode: "rate_limited",
      retryAfterSeconds: expect.any(Number),
    });
    if (refused.ok) {
      return;
    }
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);

    // Nothing was removed: the device still reaches its own account.
    const upload = await runSyncUpload(device.storage, device.secretStore, preferences, now);
    expect(upload.ok).toBe(true);

    await disconnectSyncAccount(device.storage, device.secretStore, preferences);
  });
});
