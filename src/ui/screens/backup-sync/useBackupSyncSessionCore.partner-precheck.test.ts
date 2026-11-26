import { useEffect } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { DATA_SHARING_CONSENT_REVISION } from "../../../services/data-sharing-consent-service";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "../../../sync/sync-contract";

import * as managedPartnerAccessService from "../../../services/managed-partner-access-service";
import * as managedPremiumFeaturesService from "../../../services/managed-premium-features-service";
import * as managedPartnerShareService from "../../../services/managed-partner-share-service";
import * as managedPartnerShareSyncService from "../../../services/managed-partner-share-sync-service";
import * as settingsStateService from "../../../services/settings-state-service";
import { PartnerShareStoreClearedError } from "../../../security/partner-share-secret-store";
import { createLoadedSettingsStateFixture } from "../../../test/create-backup-sync-session-core-mock";
import { createSettingsStorageMock } from "../../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../../test/create-sync-secret-store-mock";
import { useBackupSyncSessionCore } from "./useBackupSyncSessionCore";

// "mock"-prefixed names are required inside hoisted jest.mock factories.
const mockUseEffect = useEffect;
// Stable identities: a fresh router/params/navigation object per render would
// change the focus callback's deps every render and re-run the load forever.
const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
const mockSearchParams = {};
const mockNavigation = { dispatch: jest.fn() };

jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockUseEffect(effect, [effect]);
  },
  useLocalSearchParams: () => mockSearchParams,
  useRouter: () => mockRouter,
}));

jest.mock("expo-router/react-navigation", () => ({
  useNavigation: () => mockNavigation,
}));

const FIXED_NOW = new Date("2026-03-20T08:00:00.000Z");

describe("useBackupSyncSessionCore partner-access pre-check", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reads the live billing snapshot only, never the offline-grace cache", async () => {
    const storage = createSettingsStorageMock();
    const syncSecretStore = createSyncSecretStoreMock();
    const loaded = createLoadedSettingsStateFixture();
    jest
      .spyOn(settingsStateService, "loadSettingsScreenState")
      .mockResolvedValue({
        ...loaded,
        hasSyncSession: true,
        syncPreferences: { ...loaded.syncPreferences, mode: "managed" },
      });
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
    jest
      .spyOn(managedPartnerAccessService, "loadManagedPartnerAccess")
      .mockResolvedValue({ ok: false, errorCode: "generic" });

    const { unmount } = await renderHook(() =>
      useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
    );

    await waitFor(() => expect(premiumSpy).toHaveBeenCalled());
    expect(premiumSpy).toHaveBeenCalledWith(
      storage,
      syncSecretStore,
      "managed",
      undefined,
      undefined,
      { liveOnly: true },
    );
    await unmount();
  });

  it("flags grants for re-share from the listing, the local keys and the push loop", async () => {
    const loaded = createLoadedSettingsStateFixture();
    jest.spyOn(settingsStateService, "loadSettingsScreenState").mockResolvedValue({
      ...loaded,
      hasSyncSession: true,
      syncPreferences: { ...loaded.syncPreferences, mode: "managed" },
    });
    jest.spyOn(managedPremiumFeaturesService, "loadManagedPremiumFeatures").mockResolvedValue({
      advancedFertility: false,
      advancedInsights: false,
      doctorPDF: false,
      extendedReports: false,
      partnerAccess: true,
      reminders: false,
    });
    const grant = (id: string, sourceInviteID: string | null) =>
      ({ id, ownerAccountID: "owner-1", revokedAt: null, sourceInviteID }) as never;
    jest.spyOn(managedPartnerAccessService, "loadManagedPartnerAccess").mockResolvedValue({
      ok: true,
      value: {
        owned: {
          invites: [],
          grants: [
            grant("grant-legacy", null),
            grant("grant-stale", "invite-2"),
            grant("grant-raced", "invite-3"),
          ],
        },
        sharedWithMe: [],
      },
    });
    const reconcileSpy = jest
      .spyOn(managedPartnerShareService, "reconcileManagedPartnerShareKeys")
      .mockResolvedValue({
        grantKeysByGrantID: {
          "grant-stale": { keyHex: "ab", rotatedAtISO: "", sourceInviteID: "invite-old" },
          "grant-raced": { keyHex: "ab", rotatedAtISO: "", sourceInviteID: "invite-3" },
        },
      } as never);
    const pushSpy = jest
      .spyOn(managedPartnerShareSyncService, "syncManagedPartnerSharedProjections")
      .mockResolvedValue({
        skipped: false,
        syncedCount: 0,
        reshareRequiredGrantIDs: ["grant-legacy", "grant-raced"],
      });

    // Stable identities: the load callback depends on every store.
    const storage = createSettingsStorageMock();
    const syncSecretStore = createSyncSecretStoreMock();
    const partnerShareSecretStore = { readPartnerShareClearEpoch: () => 0 } as never;
    const { result, unmount } = await renderHook(() =>
      useBackupSyncSessionCore({ storage, syncSecretStore, partnerShareSecretStore, now: FIXED_NOW }),
    );

    await waitFor(() => expect(reconcileSpy).toHaveBeenCalled());
    await waitFor(() => expect(pushSpy).toHaveBeenCalled());
    await waitFor(() =>
      expect(result.current.partnerReshareRequiredGrantIDs).toEqual([
        "grant-legacy",
        "grant-stale",
        "grant-raced",
      ]),
    );
    await unmount();
  });

  it("drops a listing whose reconcile met a partner-share clear, without pushing", async () => {
    const loaded = createLoadedSettingsStateFixture();
    jest.spyOn(settingsStateService, "loadSettingsScreenState").mockResolvedValue({
      ...loaded,
      hasSyncSession: true,
      syncPreferences: { ...loaded.syncPreferences, mode: "managed" },
    });
    jest.spyOn(managedPremiumFeaturesService, "loadManagedPremiumFeatures").mockResolvedValue({
      advancedFertility: false,
      advancedInsights: false,
      doctorPDF: false,
      extendedReports: false,
      partnerAccess: true,
      reminders: false,
    });
    jest.spyOn(managedPartnerAccessService, "loadManagedPartnerAccess").mockResolvedValue({
      ok: true,
      value: {
        owned: {
          invites: [],
          grants: [{ id: "grant-1", ownerAccountID: "owner-1", revokedAt: null, sourceInviteID: "invite-1" } as never],
        },
        sharedWithMe: [],
      },
    });
    const reconcileSpy = jest
      .spyOn(managedPartnerShareService, "reconcileManagedPartnerShareKeys")
      .mockRejectedValue(new PartnerShareStoreClearedError());
    const pushSpy = jest.spyOn(managedPartnerShareSyncService, "syncManagedPartnerSharedProjections");

    const storage = createSettingsStorageMock();
    const syncSecretStore = createSyncSecretStoreMock();
    const partnerShareSecretStore = { readPartnerShareClearEpoch: () => 5 } as never;
    const { result, unmount } = await renderHook(() =>
      useBackupSyncSessionCore({ storage, syncSecretStore, partnerShareSecretStore, now: FIXED_NOW }),
    );

    await waitFor(() =>
      expect(reconcileSpy).toHaveBeenCalledWith(
        partnerShareSecretStore,
        expect.anything(),
        FIXED_NOW,
        5,
      ),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(pushSpy).not.toHaveBeenCalled();
    expect(result.current.partnerOverview).toBeNull();
    expect(result.current.partnerErrorMessage).toBe("");
    await unmount();
  });

  it("propagates a reconcile failure that is not a partner-share clear", async () => {
    const loaded = createLoadedSettingsStateFixture();
    // The mount load stays local, so only the explicit call below reaches reconcile.
    jest.spyOn(settingsStateService, "loadSettingsScreenState").mockResolvedValue({
      ...loaded,
      hasSyncSession: false,
    });
    jest.spyOn(managedPremiumFeaturesService, "loadManagedPremiumFeatures").mockResolvedValue({
      advancedFertility: false,
      advancedInsights: false,
      doctorPDF: false,
      extendedReports: false,
      partnerAccess: true,
      reminders: false,
    });
    jest.spyOn(managedPartnerAccessService, "loadManagedPartnerAccess").mockResolvedValue({
      ok: true,
      value: {
        owned: {
          invites: [],
          grants: [{ id: "grant-1", ownerAccountID: "owner-1", revokedAt: null, sourceInviteID: "invite-1" } as never],
        },
        sharedWithMe: [],
      },
    });
    const storeFailure = new Error("secure store write failed");
    jest
      .spyOn(managedPartnerShareService, "reconcileManagedPartnerShareKeys")
      .mockRejectedValue(storeFailure);
    const pushSpy = jest.spyOn(managedPartnerShareSyncService, "syncManagedPartnerSharedProjections");

    const storage = createSettingsStorageMock();
    const syncSecretStore = createSyncSecretStoreMock();
    const partnerShareSecretStore = { readPartnerShareClearEpoch: () => 0 } as never;
    const { result, unmount } = await renderHook(() =>
      useBackupSyncSessionCore({ storage, syncSecretStore, partnerShareSecretStore, now: FIXED_NOW }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.loadPartnerState({
        ...loaded,
        hasSyncSession: true,
        syncPreferences: { ...loaded.syncPreferences, mode: "managed" },
      }),
    ).rejects.toBe(storeFailure);
    expect(pushSpy).not.toHaveBeenCalled();
    await unmount();
  });
});

describe("useBackupSyncSessionCore partner-share consent for live grants", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function renderWithLiveGrantAndNoConsent() {
    const loaded = createLoadedSettingsStateFixture();
    jest.spyOn(settingsStateService, "loadSettingsScreenState").mockResolvedValue({
      ...loaded,
      hasSyncSession: true,
      syncPreferences: { ...loaded.syncPreferences, mode: "managed" },
    });
    jest.spyOn(managedPremiumFeaturesService, "loadManagedPremiumFeatures").mockResolvedValue({
      advancedFertility: false,
      advancedInsights: false,
      doctorPDF: false,
      extendedReports: false,
      partnerAccess: true,
      reminders: false,
    });
    jest.spyOn(managedPartnerAccessService, "loadManagedPartnerAccess").mockResolvedValue({
      ok: true,
      value: {
        owned: {
          invites: [],
          grants: [{ id: "grant-1", ownerAccountID: "owner-1", revokedAt: null, sourceInviteID: "invite-1" } as never],
        },
        sharedWithMe: [],
      },
    });
    jest
      .spyOn(managedPartnerShareService, "reconcileManagedPartnerShareKeys")
      .mockResolvedValue({ grantKeysByGrantID: {} } as never);
    const pushSpy = jest
      .spyOn(managedPartnerShareSyncService, "syncManagedPartnerSharedProjections")
      .mockResolvedValue({ skipped: true, syncedCount: 0, reshareRequiredGrantIDs: [] });

    // The stored record persists, as the real storage does.
    let preferences: SyncPreferencesRecord = createDefaultSyncPreferencesRecord();
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest.fn(async () => preferences),
      writeSyncPreferencesRecord: jest.fn(
        async (record: SyncPreferencesRecord, options?: Partial<SyncPreferencesRecord>) => {
          preferences = { ...record, ...options };
        },
      ),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    const partnerShareSecretStore = { readPartnerShareClearEpoch: () => 0 } as never;
    const rendered = await renderHook(() =>
      useBackupSyncSessionCore({ storage, syncSecretStore, partnerShareSecretStore, now: FIXED_NOW }),
    );
    await waitFor(() =>
      expect(rendered.result.current.pendingDataSharingConsent).toBe("partner_share"),
    );
    expect(rendered.result.current.isLoading).toBe(false);
    return { ...rendered, pushSpy, storage, readPreferences: () => preferences };
  }

  it("asks after the screen renders and, on a decline, records nothing and pushes no more", async () => {
    const { result, pushSpy, readPreferences, unmount } = await renderWithLiveGrantAndNoConsent();
    const pushesBeforeAnswer = pushSpy.mock.calls.length;

    await act(async () => {
      result.current.answerDataSharingConsent(false);
    });

    expect(result.current.pendingDataSharingConsent).toBeNull();
    expect(readPreferences().dataSharingConsent?.partner_share).toBeUndefined();
    expect(pushSpy).toHaveBeenCalledTimes(pushesBeforeAnswer);
    await unmount();
  });

  it("on an acceptance records the consent, pushes again and does not ask twice", async () => {
    const { result, pushSpy, readPreferences, unmount } = await renderWithLiveGrantAndNoConsent();
    const pushesBeforeAnswer = pushSpy.mock.calls.length;

    await act(async () => {
      result.current.answerDataSharingConsent(true);
    });

    await waitFor(() => expect(pushSpy).toHaveBeenCalledTimes(pushesBeforeAnswer + 1));
    expect(readPreferences().dataSharingConsent?.partner_share?.revision).toBe(
      DATA_SHARING_CONSENT_REVISION,
    );
    expect(result.current.pendingDataSharingConsent).toBeNull();
    await unmount();
  });
});
