import { useEffect } from "react";
import { renderHook, waitFor } from "@testing-library/react-native";

import * as managedPartnerAccessService from "../../../services/managed-partner-access-service";
import * as managedPremiumFeaturesService from "../../../services/managed-premium-features-service";
import * as settingsStateService from "../../../services/settings-state-service";
import { createLoadedSettingsStateFixture } from "../../../test/create-backup-sync-session-core-mock";
import { createSettingsStorageMock } from "../../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../../test/create-sync-secret-store-mock";
import { useBackupSyncSessionCore } from "./useBackupSyncSessionCore";

// "mock"-prefixed names are required inside hoisted jest.mock factories.
const mockUseEffect = useEffect;

jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockUseEffect(effect, [effect]);
  },
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock(
  "expo-router/react-navigation",
  () => ({ useNavigation: () => ({ dispatch: jest.fn() }) }),
  { virtual: true },
);

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
});
