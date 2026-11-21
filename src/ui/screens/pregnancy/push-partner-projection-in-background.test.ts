import { syncManagedPartnerSharedProjections } from "../../../services/managed-partner-share-sync-service";
import type { PartnerShareSecretStore } from "../../../security/partner-share-secret-store";
import type { SyncSecretStore } from "../../../security/sync-secret-store";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import { pushPartnerProjectionInBackground } from "./push-partner-projection-in-background";

jest.mock("../../../services/managed-partner-share-sync-service", () => ({
  syncManagedPartnerSharedProjections: jest.fn(),
}));

const mockSync = jest.mocked(syncManagedPartnerSharedProjections);
const syncSecretStore = {} as SyncSecretStore;
const partnerShareSecretStore = {} as PartnerShareSecretStore;

describe("pushPartnerProjectionInBackground", () => {
  beforeEach(() => {
    mockSync.mockReset();
    mockSync.mockResolvedValue({ skipped: true, syncedCount: 0, reshareRequiredGrantIDs: [] });
  });

  it("pushes with the injected instant", () => {
    const storage = createLocalAppStorageMock();
    const now = new Date(2026, 5, 1, 12, 0, 0);

    pushPartnerProjectionInBackground(storage, syncSecretStore, partnerShareSecretStore, now);

    expect(mockSync).toHaveBeenCalledWith(storage, syncSecretStore, partnerShareSecretStore, now);
  });

  it("pushes with the current clock when no instant is injected", () => {
    jest.useFakeTimers();
    try {
      const clock = new Date(2026, 5, 2, 7, 15, 0);
      jest.setSystemTime(clock);

      pushPartnerProjectionInBackground(
        createLocalAppStorageMock(),
        syncSecretStore,
        partnerShareSecretStore,
        undefined,
      );

      expect(mockSync.mock.calls[0]![3]).toEqual(clock);
    } finally {
      jest.useRealTimers();
    }
  });

  it("swallows a failed push", async () => {
    mockSync.mockRejectedValue(new Error("network down"));

    expect(() =>
      pushPartnerProjectionInBackground(
        createLocalAppStorageMock(),
        syncSecretStore,
        partnerShareSecretStore,
        undefined,
      ),
    ).not.toThrow();
    await Promise.resolve();
  });
});
