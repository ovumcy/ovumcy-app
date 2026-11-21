import * as syncClientService from "../sync/sync-client-service";
import * as syncSetupService from "../sync/sync-setup-service";
import { createSettingsStorageMock } from "../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import * as managedPremiumFeaturesService from "./managed-premium-features-service";
import { loadSettingsScreenState } from "./settings-state-service";

const NOW = new Date("2026-03-20T08:00:00.000Z");

const PAID_BILLING = {
  hasActivePlan: true,
  premiumFeatures: {
    ...managedPremiumFeaturesService.EMPTY_MANAGED_PREMIUM_FEATURES,
    doctorPDF: true,
  },
  activeSubscription: null,
  offers: [],
};

async function stubManagedSession(
  storage: ReturnType<typeof createSettingsStorageMock>,
  secretStore: ReturnType<typeof createSyncSecretStoreMock>,
) {
  const realSetup = await syncSetupService.loadSyncSetupState(storage, secretStore);
  jest.spyOn(syncSetupService, "loadSyncSetupState").mockResolvedValue({
    ...realSetup,
    hasAuthSession: true,
    preferences: { ...realSetup.preferences, mode: "managed" },
  });
}

describe("loadSettingsScreenState managed billing", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("takes plan status and doctor PDF from a live billing snapshot", async () => {
    const storage = createSettingsStorageMock();
    const secretStore = createSyncSecretStoreMock();
    await stubManagedSession(storage, secretStore);
    jest
      .spyOn(syncClientService, "loadConnectedSyncCapabilities")
      .mockResolvedValue({ ok: true, capabilities: {} } as never);
    jest
      .spyOn(managedPremiumFeaturesService, "loadManagedBillingSnapshotWithSource")
      .mockResolvedValue({ billing: PAID_BILLING, source: "live" });

    const state = await loadSettingsScreenState(storage, secretStore, NOW);

    expect(state.managedPremiumAccess.planStatus).toBe("active");
    expect(state.managedPremiumAccess.doctorPDF).toBe(true);
  });

  it("keeps the plan status unknown on a cache-served snapshot while the doctor PDF follows the offline grace", async () => {
    const storage = createSettingsStorageMock();
    const secretStore = createSyncSecretStoreMock();
    await stubManagedSession(storage, secretStore);
    jest
      .spyOn(syncClientService, "loadConnectedSyncCapabilities")
      .mockResolvedValue({ ok: true, capabilities: {} } as never);
    jest
      .spyOn(managedPremiumFeaturesService, "loadManagedBillingSnapshotWithSource")
      .mockResolvedValue({ billing: PAID_BILLING, source: "cache" });

    const state = await loadSettingsScreenState(storage, secretStore, NOW);

    expect(state.managedPremiumAccess.planStatus).toBe("unknown");
    expect(state.managedPremiumAccess.doctorPDF).toBe(true);
    expect(state.managedPremiumAccess.activeSubscription).toBeNull();
    expect(state.managedPremiumAccess.offers).toEqual([]);
  });

  it("still reads premium when the capability fetch fails without an unauthorized answer", async () => {
    const storage = createSettingsStorageMock();
    const secretStore = createSyncSecretStoreMock();
    await stubManagedSession(storage, secretStore);
    jest
      .spyOn(syncClientService, "loadConnectedSyncCapabilities")
      .mockResolvedValue({ ok: false, errorCode: "network_failed" } as never);
    const billingSpy = jest
      .spyOn(managedPremiumFeaturesService, "loadManagedBillingSnapshotWithSource")
      .mockResolvedValue({ billing: PAID_BILLING, source: "cache" });

    const state = await loadSettingsScreenState(storage, secretStore, NOW);

    expect(billingSpy).toHaveBeenCalledTimes(1);
    expect(state.syncCapabilities).toBeNull();
    expect(state.managedPremiumAccess.doctorPDF).toBe(true);
    expect(state.managedPremiumAccess.planStatus).toBe("unknown");
  });

  it("clears the session and reads no billing when the capability fetch is unauthorized", async () => {
    const storage = createSettingsStorageMock();
    const secretStore = createSyncSecretStoreMock();
    await stubManagedSession(storage, secretStore);
    jest
      .spyOn(syncClientService, "loadConnectedSyncCapabilities")
      .mockResolvedValue({ ok: false, errorCode: "unauthorized" } as never);
    const clearSpy = jest
      .spyOn(syncClientService, "clearLocalSyncSession")
      .mockImplementation(async (_storage, _secrets, preferences) => preferences);
    const billingSpy = jest.spyOn(
      managedPremiumFeaturesService,
      "loadManagedBillingSnapshotWithSource",
    );

    const state = await loadSettingsScreenState(storage, secretStore, NOW);

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(billingSpy).not.toHaveBeenCalled();
    expect(state.hasSyncSession).toBe(false);
    expect(state.managedPremiumAccess.doctorPDF).toBe(false);
  });
});
