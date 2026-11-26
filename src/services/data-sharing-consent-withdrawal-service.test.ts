import type { PartnerShareSecretStore } from "../security/partner-share-secret-store";
import type { SyncSecretStore } from "../security/sync-secret-store";
import { createVolatileWebAppStorage } from "../storage/local/volatile-web-app-storage";
import type {
  ManagedCloudPartnerAccessGrant,
  ManagedCloudPartnerAccessOverview,
} from "../sync/managed-cloud-api-client";
import { recordDataSharingConsent } from "./data-sharing-consent-service";
import {
  buildPartnerRevokeConfirmLines,
  loadPartnerGrantsToRevokeOnWithdrawal,
  withdrawDataSharingConsentAndRevokePartnerGrants,
  type DataSharingConsentWithdrawalDeps,
} from "./data-sharing-consent-withdrawal-service";
import * as partnerAccessService from "./managed-partner-access-service";
import * as partnerShareService from "./managed-partner-share-service";

jest.mock("./managed-partner-access-service");
jest.mock("./managed-partner-share-service");

const mockLoad = jest.mocked(partnerAccessService.loadManagedPartnerAccess);
const mockRevoke = jest.mocked(partnerAccessService.revokeManagedPartnerGrant);
const mockClearKey = jest.mocked(partnerShareService.clearManagedPartnerGrantKey);

const NOW = new Date("2026-11-26T08:00:00.000Z");

function grant(
  id: string,
  overrides: Partial<ManagedCloudPartnerAccessGrant> = {},
): ManagedCloudPartnerAccessGrant {
  return {
    id,
    ownerAccountID: "owner",
    partnerAccountID: `partner-${id}`,
    accessLevel: "summary",
    sourceInviteID: null,
    acceptedAt: "2026-11-01T08:00:00.000Z",
    lastSeenAt: null,
    revokedAt: null,
    revokedReason: "",
    createdAt: "2026-11-01T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
    ...overrides,
  };
}

function overview(
  grants: ManagedCloudPartnerAccessGrant[],
): ManagedCloudPartnerAccessOverview {
  return { owned: { invites: [], grants }, sharedWithMe: [grant("shared")] };
}

function deps(): DataSharingConsentWithdrawalDeps {
  return {
    partnerShareSecretStore: {} as PartnerShareSecretStore,
    storage: createVolatileWebAppStorage(),
    syncSecretStore: {} as SyncSecretStore,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  mockClearKey.mockResolvedValue(undefined);
});

describe("loadPartnerGrantsToRevokeOnWithdrawal", () => {
  it("revokes nothing without a stored partner-share consent", async () => {
    const d = deps();
    await recordDataSharingConsent(d.storage, "managed_sync", NOW);

    await expect(
      loadPartnerGrantsToRevokeOnWithdrawal(d, overview([grant("g1")])),
    ).resolves.toMatchObject({ grants: [], listingFailed: false });
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("lists the live owned grants from a fresh listing and falls back to the last one", async () => {
    const d = deps();
    await recordDataSharingConsent(d.storage, "partner_share", NOW);
    mockLoad.mockResolvedValueOnce({
      ok: true,
      value: overview([
        grant("fresh"),
        grant("gone", { revokedAt: "2026-11-20T08:00:00.000Z" }),
      ]),
    });

    const fresh = await loadPartnerGrantsToRevokeOnWithdrawal(
      d,
      overview([grant("stale")]),
    );
    expect(fresh.grants.map((g) => g.id)).toEqual(["fresh"]);
    expect(fresh.listingFailed).toBe(false);

    mockLoad.mockResolvedValueOnce({ ok: false, errorCode: "network_failed" });
    const fallback = await loadPartnerGrantsToRevokeOnWithdrawal(
      d,
      overview([grant("stale")]),
    );
    expect(fallback.grants.map((g) => g.id)).toEqual(["stale"]);
    expect(fallback.listingFailed).toBe(false);
  });

  it("lists with the saved sync mode and flags a listing it could not read", async () => {
    const d = deps();
    await d.storage.writeSyncPreferencesRecord({
      ...(await d.storage.readSyncPreferencesRecord()),
      mode: "self_hosted",
    });
    await recordDataSharingConsent(d.storage, "partner_share", NOW);
    mockLoad.mockResolvedValueOnce({ ok: false, errorCode: "network_failed" });

    await expect(
      loadPartnerGrantsToRevokeOnWithdrawal(d, null),
    ).resolves.toEqual({ grants: [], listingFailed: true, syncMode: "self_hosted" });
    expect(mockLoad).toHaveBeenCalledWith(d.syncSecretStore, "self_hosted");
  });

  it("falls back to the last listing when the fresh one throws", async () => {
    const d = deps();
    await recordDataSharingConsent(d.storage, "partner_share", NOW);
    mockLoad.mockRejectedValueOnce(new Error("offline"));

    const plan = await loadPartnerGrantsToRevokeOnWithdrawal(
      d,
      overview([grant("stale")]),
    );
    expect(plan.grants.map((g) => g.id)).toEqual(["stale"]);
    expect(plan.listingFailed).toBe(false);
  });

  it("names nothing to revoke without a managed session", async () => {
    const d = deps();
    await recordDataSharingConsent(d.storage, "partner_share", NOW);
    mockLoad.mockResolvedValueOnce({ ok: false, errorCode: "not_connected" });

    await expect(
      loadPartnerGrantsToRevokeOnWithdrawal(d, overview([grant("stale")])),
    ).resolves.toMatchObject({ grants: [], listingFailed: false });
  });
});

describe("withdrawDataSharingConsentAndRevokePartnerGrants", () => {
  it("withdraws first and revokes nothing when the withdrawal fails", async () => {
    const d = deps();
    jest
      .spyOn(d.storage, "readSyncPreferencesRecord")
      .mockRejectedValue(new Error("locked"));

    await expect(
      withdrawDataSharingConsentAndRevokePartnerGrants(d, "managed", ["g1"]),
    ).rejects.toThrow("locked");
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it("reports each failed revoke and clears the key of each revoked grant", async () => {
    const d = deps();
    await recordDataSharingConsent(d.storage, "partner_share", NOW);
    await recordDataSharingConsent(d.storage, "managed_sync", NOW);
    mockRevoke
      .mockResolvedValueOnce({ ok: true, value: grant("g1") })
      .mockResolvedValueOnce({ ok: false, errorCode: "network_failed" })
      .mockRejectedValueOnce(new Error("offline"));

    const result = await withdrawDataSharingConsentAndRevokePartnerGrants(d, "managed", [
      "g1",
      "g2",
      "g3",
    ]);

    expect(result).toEqual({
      revokedGrantIDs: ["g1"],
      failedGrantIDs: ["g2", "g3"],
      keyCleanupFailed: false,
    });
    expect(mockClearKey).toHaveBeenCalledTimes(1);
    expect(mockClearKey).toHaveBeenCalledWith(d.partnerShareSecretStore, "g1");
    const record = await d.storage.readSyncPreferencesRecord();
    expect(record.dataSharingConsent ?? {}).toEqual({});
  });

  it("reports a key that could not be cleared after a revoke", async () => {
    const d = deps();
    mockRevoke.mockResolvedValue({ ok: true, value: grant("g1") });
    mockClearKey.mockRejectedValue(new Error("secure store"));

    await expect(
      withdrawDataSharingConsentAndRevokePartnerGrants(d, "managed", ["g1"]),
    ).resolves.toEqual({
      revokedGrantIDs: ["g1"],
      failedGrantIDs: [],
      keyCleanupFailed: true,
    });
  });
});

describe("buildPartnerRevokeConfirmLines", () => {
  it("names each partner by access level and last fetch", () => {
    expect(
      buildPartnerRevokeConfirmLines(
        [grant("g1"), grant("g2", { accessLevel: "full" })],
        "en",
      ),
    ).toEqual([
      "Partner access · Summary only · Shared view last fetched: Not fetched yet.",
      "Partner access · Full access · Shared view last fetched: Not fetched yet.",
    ]);
  });
});
