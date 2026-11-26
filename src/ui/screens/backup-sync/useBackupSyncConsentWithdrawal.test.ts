import { act, renderHook, waitFor } from "@testing-library/react-native";

import { DATA_SHARING_CONSENT_REVISION } from "../../../services/data-sharing-consent-service";
import { createBackupSyncSessionCoreMock } from "../../../test/create-backup-sync-session-core-mock";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "../../../sync/sync-contract";
import { useBackupSyncConsentWithdrawal } from "./useBackupSyncConsentWithdrawal";

const WITH_CONSENT: SyncPreferencesRecord = {
  ...createDefaultSyncPreferencesRecord(),
  dataSharingConsent: {
    managed_sync: {
      revision: DATA_SHARING_CONSENT_REVISION,
      givenAt: "2026-05-01T08:00:00.000Z",
    },
  },
};

describe("useBackupSyncConsentWithdrawal", () => {
  it("ignores a purpose load that resolves after the withdrawal", async () => {
    let resolveFirstLoad: (record: SyncPreferencesRecord) => void = () => {};
    const storage = createLocalAppStorageMock();
    jest
      .mocked(storage.readSyncPreferencesRecord)
      .mockImplementationOnce(
        () =>
          new Promise<SyncPreferencesRecord>((resolve) => {
            resolveFirstLoad = resolve;
          }),
      )
      .mockResolvedValue(WITH_CONSENT);
    const core = createBackupSyncSessionCoreMock({ storage });

    const { result } = await renderHook(() => useBackupSyncConsentWithdrawal(core));
    await act(async () => {
      await result.current.handleWithdrawDataSharingConsent();
    });
    await act(async () => {
      resolveFirstLoad(WITH_CONSENT);
    });

    expect(result.current.dataSharingConsentWithdrawal.hasConsent).toBe(false);
    expect(result.current.dataSharingConsentWithdrawal.statusMessage).toBe(
      "Consent withdrawn. Nothing more is sent until you agree again.",
    );
  });

  it("offers no control when the stored consent cannot be read", async () => {
    const storage = createLocalAppStorageMock();
    jest
      .mocked(storage.readSyncPreferencesRecord)
      .mockRejectedValue(new Error("locked"));
    const core = createBackupSyncSessionCoreMock({ storage });

    const { result } = await renderHook(() => useBackupSyncConsentWithdrawal(core));

    await waitFor(() =>
      expect(storage.readSyncPreferencesRecord).toHaveBeenCalled(),
    );
    expect(result.current.dataSharingConsentWithdrawal.hasConsent).toBe(false);
    expect(result.current.dataSharingConsentWithdrawal.errorMessage).toBe("");
  });
});
