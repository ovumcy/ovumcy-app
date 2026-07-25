import {
  createPregnancyRecord,
  type ContractionSession,
  type KickCountSession,
} from "../models/pregnancy";
import { createPostpartumRecord } from "../models/postpartum";
import { createScreeningResponse } from "../models/screening";
import { createVolatileWebAppStorage } from "../storage/local/volatile-web-app-storage";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import { createManagedCloudAPIClient } from "./managed-cloud-api-client";
import { createSyncAPIClient } from "./sync-api-client";
import {
  connectSyncAccount,
  disconnectSyncAccount,
  loadConnectedSyncCapabilities,
  runSyncRestore,
  runSyncUpload,
} from "./sync-client-service";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "./sync-contract";
import { prepareSyncSetup } from "./sync-setup-service";

const managedBaseURL = process.env.OVUMCY_MANAGED_LIVE_BASE_URL ?? "";
const syncBaseURL = process.env.OVUMCY_SYNC_LIVE_BASE_URL ?? "";
const managedAdminToken = process.env.OVUMCY_MANAGED_LIVE_ADMIN_TOKEN ?? "";
const describeIfLive =
  managedBaseURL && syncBaseURL && managedAdminToken ? describe : describe.skip;

describeIfLive("sync-client-service managed live transport", () => {
  jest.setTimeout(45000);

  it("starts entitled from the signup trial, round-trips the bridge, re-locks on expiry, and recovers on re-activation", async () => {
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
      notes: "managed live sync smoke",
    });

    let preferences: SyncPreferencesRecord = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed",
      deviceLabel: "Managed Live Device",
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

    const uniqueEmail = `managed-live-${Date.now()}@ovumcy.test`;
    let managedAccountID = "";
    const managedClientFactory = () => {
      const client = createManagedCloudAPIClient(managedBaseURL);
      return {
        ...client,
        async register(input: { email: string; password: string }) {
          const result = await client.register(input);
          if (result.ok) {
            managedAccountID = result.auth.accountID;
          }
          return result;
        },
        async login(input: { email: string; password: string }) {
          const result = await client.login(input);
          if (result.ok) {
            managedAccountID = result.auth.accountID;
          }
          return result;
        },
      };
    };
    const syncClientFactory = () => createSyncAPIClient(syncBaseURL);

    const connectResult = await connectSyncAccount(
      storage,
      secretStore,
      preferences,
      {
        login: uniqueEmail,
        password: "CorrectHorseBattery42!",
      },
      "register",
      now,
      syncClientFactory,
      managedClientFactory,
    );
    expect(connectResult.ok).toBe(true);
    if (!connectResult.ok || "totpChallengeRequired" in connectResult) {
      return;
    }
    // Public signup auto-starts a 30-day trial, so a fresh account is
    // entitled immediately (sync_allowed=true, source=billing_subscription).
    expect(connectResult.capabilities.syncEnabled).toBe(true);
    preferences = connectResult.preferences;
    expect(managedAccountID).toBeTruthy();

    const trialSnapshot = await fetchAdminAccountSnapshot(managedAccountID);
    expect(trialSnapshot.sync_entitlement).toEqual(
      expect.objectContaining({
        sync_allowed: true,
        source: "billing_subscription",
      }),
    );
    expect(trialSnapshot.active_subscription).toEqual(
      expect.objectContaining({
        source: "trial",
        status: "trialing",
      }),
    );

    const uploadResult = await runSyncUpload(
      storage,
      secretStore,
      preferences,
      now,
      syncClientFactory,
      managedClientFactory,
    );
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

    const restoreResult = await runSyncRestore(
      storage,
      secretStore,
      preferences,
      syncClientFactory,
      managedClientFactory,
    );
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
        notes: "managed live sync smoke",
      }),
    );

    // Admin-expire the subscription: the server re-derives the entitlement
    // (sync_allowed=false, source=billing_subscription_inactive) and the app
    // must re-lock both the capability document and the upload path.
    await setManagedSubscriptionStatus(managedAccountID, "expired");

    const expiredCapabilities = await loadConnectedSyncCapabilities(
      secretStore,
      preferences,
      syncClientFactory,
      managedClientFactory,
    );
    expect(expiredCapabilities).toEqual({
      ok: true,
      capabilities: expect.objectContaining({
        mode: "managed",
        syncEnabled: false,
      }),
    });

    await expect(
      runSyncUpload(
        storage,
        secretStore,
        preferences,
        now,
        syncClientFactory,
        managedClientFactory,
      ),
    ).resolves.toEqual({
      ok: false,
      errorCode: "sync_not_allowed",
    });

    const expiredSnapshot = await fetchAdminAccountSnapshot(managedAccountID);
    expect(expiredSnapshot.sync_entitlement).toEqual(
      expect.objectContaining({
        sync_allowed: false,
        source: "billing_subscription_inactive",
      }),
    );

    // Admin re-activation restores the entitlement and the app recovers
    // without reconnecting: capabilities re-enable and uploads flow again.
    await setManagedSubscriptionStatus(managedAccountID, "active");

    const recoveredCapabilities = await loadConnectedSyncCapabilities(
      secretStore,
      preferences,
      syncClientFactory,
      managedClientFactory,
    );
    expect(recoveredCapabilities).toEqual({
      ok: true,
      capabilities: expect.objectContaining({
        mode: "managed",
        syncEnabled: true,
      }),
    });

    const recoveredUploadResult = await runSyncUpload(
      storage,
      secretStore,
      preferences,
      now,
      syncClientFactory,
      managedClientFactory,
    );
    expect(recoveredUploadResult.ok).toBe(true);
    if (!recoveredUploadResult.ok) {
      return;
    }
    preferences = recoveredUploadResult.preferences;

    const disconnectResult = await disconnectSyncAccount(
      storage,
      secretStore,
      preferences,
      syncClientFactory,
      managedClientFactory,
    );
    expect(disconnectResult.preferences.setupStatus).toBe("local_ready");
  });

  it("round-trips a positive pregnancy test through managed cloud sync", async () => {
    const now = new Date("2026-04-05T09:00:00.000Z");
    const storage = createVolatileWebAppStorage();
    const secretStore = createSyncSecretStoreMock();

    await storage.writeBootstrapState({
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    });
    await storage.writeProfileRecord({
      lastPeriodStart: "2026-03-01",
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
      date: "2026-04-05",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none",
      mood: 0,
      sexActivity: "none",
      bbt: 0,
      cervicalMucus: "none",
      lhTest: "none",
      pregnancyTest: "positive",
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "pregnancy round-trip",
    });

    // Pregnancy-module domain alongside the pregnancyTest day field:
    // records + kick + contraction must survive the managed encrypted bridge.
    const pregnancy = createPregnancyRecord({
      edd: "2026-12-01",
      eddBasis: "lmp",
      startedAt: "2026-03-01",
      lmpDate: "2026-02-24",
    });
    const kickSession: KickCountSession = {
      id: "kick-managed-1",
      date: "2026-04-04",
      durationMinutes: 45,
      kickCount: 14,
    };
    const contractionSession: ContractionSession = {
      id: "contraction-managed-1",
      date: "2026-04-04",
      startedAt: "2026-04-04T21:00:00.000Z",
      contractions: [
        { startedAt: "2026-04-04T21:00:00.000Z", durationSeconds: 50 },
        { startedAt: "2026-04-04T21:06:00.000Z", durationSeconds: 55 },
      ],
    };
    await storage.writePregnancyRecord(pregnancy);
    await storage.writeKickSession(kickSession);
    await storage.writeContractionSession(contractionSession);

    // Premium postpartum + EPDS screening domain alongside the pregnancy
    // round-trip: the recovery record and the most-sensitive mood-screening
    // answers must survive the managed encrypted bridge too.
    const postpartum = createPostpartumRecord({
      startedAt: "2026-03-28",
      modeOfDelivery: "cesarean",
    });
    const screening = createScreeningResponse({
      date: "2026-04-04",
      answers: [1, 1, 2, 1, 0, 1, 0, 2, 1, 0],
    });
    await storage.writePostpartumRecord(postpartum);
    await storage.writeScreeningResponse(screening);

    let preferences: SyncPreferencesRecord = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed",
      deviceLabel: "Pregnancy Round-Trip Device",
    };
    const prepareResult = await prepareSyncSetup(storage, secretStore, preferences, now);
    expect(prepareResult.ok).toBe(true);
    if (!prepareResult.ok) {
      return;
    }
    preferences = prepareResult.preferences;

    const uniqueEmail = `managed-pregnancy-${Date.now()}@ovumcy.test`;
    let managedAccountID = "";
    const managedClientFactory = () => {
      const client = createManagedCloudAPIClient(managedBaseURL);
      return {
        ...client,
        async register(input: { email: string; password: string }) {
          const result = await client.register(input);
          if (result.ok) {
            managedAccountID = result.auth.accountID;
          }
          return result;
        },
        async login(input: { email: string; password: string }) {
          const result = await client.login(input);
          if (result.ok) {
            managedAccountID = result.auth.accountID;
          }
          return result;
        },
      };
    };
    const syncClientFactory = () => createSyncAPIClient(syncBaseURL);

    const connectResult = await connectSyncAccount(
      storage,
      secretStore,
      preferences,
      { login: uniqueEmail, password: "CorrectHorseBattery42!" },
      "register",
      now,
      syncClientFactory,
      managedClientFactory,
    );
    expect(connectResult.ok).toBe(true);
    if (!connectResult.ok || "totpChallengeRequired" in connectResult) {
      return;
    }
    // The signup trial entitles the account without any admin grant.
    expect(connectResult.capabilities.syncEnabled).toBe(true);
    preferences = connectResult.preferences;
    expect(managedAccountID).toBeTruthy();

    const uploadResult = await runSyncUpload(
      storage,
      secretStore,
      preferences,
      now,
      syncClientFactory,
      managedClientFactory,
    );
    expect(uploadResult.ok).toBe(true);
    if (!uploadResult.ok) {
      return;
    }
    preferences = uploadResult.preferences;

    // Clear local pregnancy data, restore from cloud, verify it came back.
    await storage.deleteDayLogRecord("2026-04-05");
    await expect(storage.readDayLogRecord("2026-04-05")).resolves.toEqual(
      expect.objectContaining({ pregnancyTest: "none" }),
    );
    await storage.deleteAllPregnancyData();
    await storage.deleteAllPostpartumData();
    await storage.deleteAllScreeningData();
    await expect(storage.readActivePregnancy()).resolves.toBeNull();
    await expect(storage.readActivePostpartum()).resolves.toBeNull();
    await expect(storage.listScreeningResponses()).resolves.toEqual([]);

    const restoreResult = await runSyncRestore(
      storage,
      secretStore,
      preferences,
      syncClientFactory,
      managedClientFactory,
    );
    expect(restoreResult.ok).toBe(true);
    if (!restoreResult.ok) {
      return;
    }

    await expect(storage.readDayLogRecord("2026-04-05")).resolves.toEqual(
      expect.objectContaining({
        pregnancyTest: "positive",
        notes: "pregnancy round-trip",
      }),
    );
    await expect(storage.readActivePregnancy()).resolves.toEqual(
      expect.objectContaining({
        id: pregnancy.id,
        status: "active",
        edd: "2026-12-01",
      }),
    );
    await expect(storage.listKickSessions()).resolves.toEqual([
      expect.objectContaining({ id: kickSession.id, kickCount: 14 }),
    ]);
    const restoredContractions = await storage.listContractionSessions();
    expect(restoredContractions).toHaveLength(1);
    expect(restoredContractions[0]?.contractions).toHaveLength(2);
    // The postpartum + screening domain arrived intact through the managed bridge.
    await expect(storage.readActivePostpartum()).resolves.toEqual(
      expect.objectContaining({ id: postpartum.id, status: "active" }),
    );
    await expect(storage.listScreeningResponses()).resolves.toEqual([
      expect.objectContaining({ id: screening.id, score: screening.score }),
    ]);
  });
});

type AdminAccountSnapshot = {
  sync_entitlement?: {
    sync_allowed?: boolean;
    source?: string;
  };
  active_subscription?: {
    source?: string;
    status?: string;
  } | null;
};

function adminAccountURL(accountID: string, suffix = ""): string {
  return `${managedBaseURL.replace(/\/+$/, "")}/admin/accounts/${encodeURIComponent(accountID)}${suffix}`;
}

async function fetchAdminAccountSnapshot(
  accountID: string,
): Promise<AdminAccountSnapshot> {
  const response = await fetch(adminAccountURL(accountID), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${managedAdminToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to read managed admin account snapshot: ${response.status} ${errorText}`,
    );
  }

  return (await response.json()) as AdminAccountSnapshot;
}

// setManagedSubscriptionStatus drives the real billing path: upserting the
// subscription makes the server re-derive the sync entitlement, exactly like
// a production expiry or re-activation would (unlike the manual_admin
// entitlement override, which bypasses billing).
async function setManagedSubscriptionStatus(
  accountID: string,
  status: "active" | "expired",
): Promise<void> {
  const dayMs = 24 * 60 * 60 * 1000;
  const realNow = Date.now();
  const periodStartsAt = new Date(
    status === "expired" ? realNow - 31 * dayMs : realNow - dayMs,
  );
  const periodEndsAt = new Date(
    status === "expired" ? realNow - dayMs : realNow + 30 * dayMs,
  );

  const response = await fetch(adminAccountURL(accountID, "/billing/subscription"), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${managedAdminToken}`,
      "Content-Type": "application/json",
      "X-Admin-Actor": "managed-live-test",
    },
    body: JSON.stringify({
      billing_interval: "month",
      source: "manual_admin",
      status,
      currency: "EUR",
      amount_minor: 499,
      current_period_starts_at: periodStartsAt.toISOString(),
      current_period_ends_at: periodEndsAt.toISOString(),
      reason: `Live managed smoke test: flip subscription to ${status}.`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to set managed subscription status "${status}": ${response.status} ${errorText}`,
    );
  }
}
