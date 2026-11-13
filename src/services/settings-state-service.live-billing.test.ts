import * as syncClientService from "../sync/sync-client-service";
import * as syncSetupService from "../sync/sync-setup-service";
import { createSettingsStorageMock } from "../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import * as managedPremiumFeaturesService from "./managed-premium-features-service";
import { loadSettingsScreenState } from "./settings-state-service";

const NOW = new Date("2026-03-20T08:00:00.000Z");

describe("loadSettingsScreenState managed billing", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads billing live-only, never from the offline-grace cache", async () => {
    const storage = createSettingsStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const realSetup = await syncSetupService.loadSyncSetupState(storage, secretStore);
    jest.spyOn(syncSetupService, "loadSyncSetupState").mockResolvedValue({
      ...realSetup,
      hasAuthSession: true,
      preferences: { ...realSetup.preferences, mode: "managed" },
    });
    jest
      .spyOn(syncClientService, "loadConnectedSyncCapabilities")
      .mockResolvedValue({ ok: true, capabilities: {} } as never);
    const billingSpy = jest
      .spyOn(managedPremiumFeaturesService, "loadManagedBillingSnapshot")
      .mockResolvedValue(null);

    await loadSettingsScreenState(storage, secretStore, NOW);

    expect(billingSpy).toHaveBeenCalledTimes(1);
    expect(billingSpy.mock.calls[0]?.[5]).toEqual({ liveOnly: true });
  });
});
