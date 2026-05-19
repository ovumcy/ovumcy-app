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
  jest.setTimeout(30000);

  it("gates managed sync by entitlement and uploads/restores through the bridge once enabled", async () => {
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
    expect(connectResult.capabilities.syncEnabled).toBe(false);
    preferences = connectResult.preferences;
    expect(managedAccountID).toBeTruthy();

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

    await grantManagedSyncEntitlement(managedAccountID);

    const capabilitiesResult = await loadConnectedSyncCapabilities(
      secretStore,
      preferences,
      syncClientFactory,
      managedClientFactory,
    );
    expect(capabilitiesResult).toEqual({
      ok: true,
      capabilities: expect.objectContaining({
        mode: "managed",
        syncEnabled: true,
        premiumActive: true,
      }),
    });

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

    const disconnectResult = await disconnectSyncAccount(
      storage,
      secretStore,
      preferences,
      syncClientFactory,
      managedClientFactory,
    );
    expect(disconnectResult.preferences.setupStatus).toBe("local_ready");
  });
});

async function grantManagedSyncEntitlement(accountID: string): Promise<void> {
  const response = await fetch(
    `${managedBaseURL.replace(/\/+$/, "")}/admin/accounts/${encodeURIComponent(accountID)}/entitlements/sync`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${managedAdminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sync_allowed: true,
        explanation: "Live managed smoke test entitlement",
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to grant managed sync entitlement: ${response.status} ${errorText}`,
    );
  }
}
