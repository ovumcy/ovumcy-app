import type { PartnerShareSecretStore } from "../security/partner-share-secret-store";
import { createDefaultSyncPreferencesRecord } from "../sync/sync-contract";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import * as managedPartnerAccessService from "./managed-partner-access-service";
import * as managedPremiumFeaturesService from "./managed-premium-features-service";
import { syncManagedPartnerSharedProjections } from "./managed-partner-share-sync-service";
import * as syncSetupService from "../sync/sync-setup-service";

const FIXED_NOW = new Date("2026-03-20T08:00:00.000Z");

describe("syncManagedPartnerSharedProjections", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reads the live billing snapshot only and stops when partner access is not live-confirmed", async () => {
    jest.spyOn(syncSetupService, "loadSyncSetupState").mockResolvedValue({
      hasAuthSession: true,
      preferences: { ...createDefaultSyncPreferencesRecord(), mode: "managed" },
    } as Awaited<ReturnType<typeof syncSetupService.loadSyncSetupState>>);
    const premiumSpy = jest
      .spyOn(managedPremiumFeaturesService, "loadManagedPremiumFeatures")
      .mockResolvedValue({
        advancedFertility: false,
        advancedInsights: false,
        doctorPDF: false,
        extendedReports: false,
        partnerAccess: false,
        reminders: false,
      });
    const accessSpy = jest.spyOn(
      managedPartnerAccessService,
      "loadManagedPartnerAccess",
    );
    const storage = createLocalAppStorageMock();
    const syncSecretStore = createSyncSecretStoreMock();

    await expect(
      syncManagedPartnerSharedProjections(
        storage,
        syncSecretStore,
        {} as PartnerShareSecretStore,
        FIXED_NOW,
      ),
    ).resolves.toEqual({ skipped: true, syncedCount: 0 });

    expect(premiumSpy).toHaveBeenCalledWith(
      storage,
      syncSecretStore,
      "managed",
      undefined,
      undefined,
      { liveOnly: true },
    );
    expect(accessSpy).not.toHaveBeenCalled();
  });
});
