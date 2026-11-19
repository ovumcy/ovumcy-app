import type { PartnerShareSecretStore } from "../security/partner-share-secret-store";
import { createDefaultSyncPreferencesRecord } from "../sync/sync-contract";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import * as managedPartnerAccessService from "./managed-partner-access-service";
import * as managedPremiumFeaturesService from "./managed-premium-features-service";
import * as managedPartnerShareService from "./managed-partner-share-service";
import {
  isManagedPartnerProjectionPushBackedOff,
  resetManagedPartnerProjectionPushBackoff,
} from "./managed-partner-projection-backoff";
import * as partnerSharedProjectionService from "./partner-shared-projection-service";
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
    ).resolves.toEqual({ skipped: true, syncedCount: 0, reshareRequiredGrantIDs: [] });

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

  describe("on 429 rate_limited from the projection PUT", () => {
    afterEach(() => {
      resetManagedPartnerProjectionPushBackoff();
    });

    function armTwoGrantPush(
      grants: { id: string; sourceInviteID: string | null }[] = [
        { id: "grant-1", sourceInviteID: "invite-1" },
        { id: "grant-2", sourceInviteID: "invite-2" },
      ],
    ) {
      const setupSpy = jest
        .spyOn(syncSetupService, "loadSyncSetupState")
        .mockResolvedValue({
          hasAuthSession: true,
          preferences: { ...createDefaultSyncPreferencesRecord(), mode: "managed" },
        } as Awaited<ReturnType<typeof syncSetupService.loadSyncSetupState>>);
      jest
        .spyOn(managedPremiumFeaturesService, "loadManagedPremiumFeatures")
        .mockResolvedValue({
          advancedFertility: false,
          advancedInsights: false,
          doctorPDF: false,
          extendedReports: false,
          partnerAccess: true,
          reminders: false,
        });
      const grant = ({ id, sourceInviteID }: { id: string; sourceInviteID: string | null }) =>
        ({
          id,
          accessLevel: "summary",
          ownerAccountID: "owner-1",
          revokedAt: null,
          sourceInviteID,
        }) as never;
      jest.spyOn(managedPartnerAccessService, "loadManagedPartnerAccess").mockResolvedValue({
        ok: true,
        value: {
          owned: { invites: [], grants: grants.map(grant) },
          sharedWithMe: [],
        },
      });
      jest
        .spyOn(managedPartnerShareService, "reconcileManagedPartnerShareKeys")
        .mockResolvedValue({} as never);
      jest
        .spyOn(managedPartnerShareService, "reserveNextManagedPartnerProjectionGeneration")
        .mockResolvedValue(1);
      jest
        .spyOn(partnerSharedProjectionService, "buildPartnerSharedProjectionPayload")
        .mockImplementation((input) => ({ grantID: input.grantID }) as never);
      return setupSpy;
    }

    it("stops the loop, arms the back-off and skips the next push without any request", async () => {
      const setupSpy = armTwoGrantPush();
      const uploadSpy = jest
        .spyOn(managedPartnerShareService, "uploadManagedPartnerProjection")
        .mockResolvedValue({ ok: false, errorCode: "rate_limited", retryAfterSeconds: 30 });
      const storage = createLocalAppStorageMock();
      const syncSecretStore = createSyncSecretStoreMock();
      const partnerShareSecretStore = {} as PartnerShareSecretStore;

      await expect(
        syncManagedPartnerSharedProjections(
          storage,
          syncSecretStore,
          partnerShareSecretStore,
          FIXED_NOW,
        ),
      ).resolves.toEqual({ skipped: false, syncedCount: 0, reshareRequiredGrantIDs: [] });
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(isManagedPartnerProjectionPushBackedOff()).toBe(true);

      const accessSpy = jest.mocked(managedPartnerAccessService.loadManagedPartnerAccess);
      accessSpy.mockClear();
      await expect(
        syncManagedPartnerSharedProjections(
          storage,
          syncSecretStore,
          partnerShareSecretStore,
          FIXED_NOW,
        ),
      ).resolves.toEqual({ skipped: true, syncedCount: 0, reshareRequiredGrantIDs: [] });
      expect(setupSpy).toHaveBeenCalled();
      expect(accessSpy).not.toHaveBeenCalled();
      expect(uploadSpy).toHaveBeenCalledTimes(1);
    });

    it("drops the back-off once there is no managed session, so the next account is not held", async () => {
      const setupSpy = armTwoGrantPush();
      jest
        .spyOn(managedPartnerShareService, "uploadManagedPartnerProjection")
        .mockResolvedValue({ ok: false, errorCode: "rate_limited", retryAfterSeconds: 900 });
      const storage = createLocalAppStorageMock();
      const syncSecretStore = createSyncSecretStoreMock();
      await syncManagedPartnerSharedProjections(
        storage,
        syncSecretStore,
        {} as PartnerShareSecretStore,
        FIXED_NOW,
      );
      expect(isManagedPartnerProjectionPushBackedOff()).toBe(true);

      setupSpy.mockResolvedValueOnce({
        hasAuthSession: false,
        preferences: { ...createDefaultSyncPreferencesRecord(), mode: "managed" },
      } as Awaited<ReturnType<typeof syncSetupService.loadSyncSetupState>>);
      await syncManagedPartnerSharedProjections(
        storage,
        syncSecretStore,
        {} as PartnerShareSecretStore,
        FIXED_NOW,
      );

      expect(isManagedPartnerProjectionPushBackedOff()).toBe(false);
    });

    it("does not back off on other upload failures", async () => {
      armTwoGrantPush();
      const uploadSpy = jest
        .spyOn(managedPartnerShareService, "uploadManagedPartnerProjection")
        .mockResolvedValue({ ok: false, errorCode: "network_failed" });

      await syncManagedPartnerSharedProjections(
        createLocalAppStorageMock(),
        createSyncSecretStoreMock(),
        {} as PartnerShareSecretStore,
        FIXED_NOW,
      );

      expect(uploadSpy).toHaveBeenCalledTimes(2);
      expect(isManagedPartnerProjectionPushBackedOff()).toBe(false);
    });

    it("skips a legacy grant before reserving a generation and reports it for a re-share", async () => {
      armTwoGrantPush([
        { id: "grant-legacy", sourceInviteID: null },
        { id: "grant-2", sourceInviteID: "invite-2" },
      ]);
      const reserveSpy = jest.mocked(
        managedPartnerShareService.reserveNextManagedPartnerProjectionGeneration,
      );
      const uploadSpy = jest
        .spyOn(managedPartnerShareService, "uploadManagedPartnerProjection")
        .mockResolvedValue({ ok: true, value: {} as never });

      await expect(
        syncManagedPartnerSharedProjections(
          createLocalAppStorageMock(),
          createSyncSecretStoreMock(),
          {} as PartnerShareSecretStore,
          FIXED_NOW,
        ),
      ).resolves.toEqual({
        skipped: false,
        syncedCount: 1,
        reshareRequiredGrantIDs: ["grant-legacy"],
      });
      expect(reserveSpy).toHaveBeenCalledTimes(1);
      expect(reserveSpy).toHaveBeenCalledWith(expect.anything(), "grant-2");
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(uploadSpy.mock.calls[0]?.[2]).toMatchObject({
        listedSourceInviteID: "invite-2",
      });
    });

    it("reports a re-keyed grant and keeps pushing the others", async () => {
      armTwoGrantPush();
      const uploadSpy = jest
        .spyOn(managedPartnerShareService, "uploadManagedPartnerProjection")
        .mockResolvedValueOnce({ ok: false, errorCode: "partner_grant_rekeyed" })
        .mockResolvedValueOnce({ ok: true, value: {} as never });

      await expect(
        syncManagedPartnerSharedProjections(
          createLocalAppStorageMock(),
          createSyncSecretStoreMock(),
          {} as PartnerShareSecretStore,
          FIXED_NOW,
        ),
      ).resolves.toEqual({
        skipped: false,
        syncedCount: 1,
        reshareRequiredGrantIDs: ["grant-1"],
      });
      expect(uploadSpy).toHaveBeenCalledTimes(2);
      expect(isManagedPartnerProjectionPushBackedOff()).toBe(false);
    });
  });
});
