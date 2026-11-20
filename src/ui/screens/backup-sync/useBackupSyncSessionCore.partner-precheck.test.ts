import { useEffect } from "react";
import { renderHook, waitFor } from "@testing-library/react-native";

import * as managedPartnerAccessService from "../../../services/managed-partner-access-service";
import * as managedPremiumFeaturesService from "../../../services/managed-premium-features-service";
import * as managedPartnerShareService from "../../../services/managed-partner-share-service";
import * as managedPartnerShareSyncService from "../../../services/managed-partner-share-sync-service";
import * as settingsStateService from "../../../services/settings-state-service";
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
    const partnerShareSecretStore = {} as never;
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
});
