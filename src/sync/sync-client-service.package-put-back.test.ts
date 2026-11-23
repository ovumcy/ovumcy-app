import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { SyncAPIClient } from "./sync-api-client";
import { createDefaultSyncPreferencesRecord, type SyncPreferencesRecord } from "./sync-contract";
import { runSyncUpload } from "./sync-client-service";

const NOW = new Date("2026-03-20T08:10:00.000Z");
const STEP_UP = { currentPassword: "correct horse battery" };

function setup(putBlobFailure: string, overrides: Partial<SyncAPIClient> = {}) {
  const local = createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z"));
  const previous = createSyncSecretsRecord("Pixel 6", new Date("2026-03-01T08:00:00.000Z"));
  const preferences: SyncPreferencesRecord = {
    ...createDefaultSyncPreferencesRecord(),
    mode: "self_hosted",
    endpointInput: "192.168.1.20:8080",
    normalizedEndpoint: "http://192.168.1.20:8080",
    deviceLabel: "Pixel 7",
    setupStatus: "connected",
  };
  const putRecoveryKey = jest.fn().mockResolvedValue({ ok: true });
  const api = {
    getCapabilities: jest.fn().mockResolvedValue({
      ok: true,
      capabilities: {
        mode: "self_hosted",
        syncEnabled: true,
        recoverySupported: true,
        pushSupported: false,
        portalSupported: false,
        advancedCloudInsights: false,
        maxDevices: 5,
        maxBlobBytes: 16 << 20,
      },
    }),
    getRecoveryKey: jest
      .fn()
      .mockResolvedValue({ ok: true, recoveryKey: previous.record.wrappedKey }),
    getBlob: jest.fn().mockResolvedValue({ ok: false, errorCode: "blob_not_found" }),
    putRecoveryKey,
    putBlob: jest.fn().mockResolvedValue({ ok: false, errorCode: putBlobFailure }),
    ...overrides,
  } as unknown as SyncAPIClient;
  return {
    putRecoveryKey,
    local: local.record.wrappedKey,
    previous: previous.record.wrappedKey,
    upload: () =>
      runSyncUpload(
        createLocalAppStorageMock({
          readSyncPreferencesRecord: jest.fn().mockResolvedValue(preferences),
        }),
        createSyncSecretStoreMock({ ...local.record, authSessionToken: "session-1" }),
        preferences,
        NOW,
        () => api,
        jest.fn(),
        { confirmUploadOverExistingBackup: async () => true },
        STEP_UP,
      ),
  };
}

describe("runSyncUpload recovery-package put-back (self-hosted)", () => {
  it.each(["invalid_blob", "unauthorized", "sync_disabled"])(
    "puts the replaced package back with the same step-up after a definitive %s refusal",
    async (refusal) => {
      const harness = setup(refusal);

      const result = await harness.upload();

      expect(result.ok).toBe(false);
      expect(harness.putRecoveryKey).toHaveBeenCalledTimes(2);
      expect(harness.putRecoveryKey).toHaveBeenNthCalledWith(1, "session-1", harness.local, STEP_UP);
      expect(harness.putRecoveryKey).toHaveBeenNthCalledWith(
        2,
        "session-1",
        harness.previous,
        STEP_UP,
      );
    },
  );

  it("puts the replaced package back when the stored blob shows another device wrote it", async () => {
    const harness = setup("stale_generation", {
      getBlob: jest
        .fn()
        .mockResolvedValueOnce({ ok: false, errorCode: "blob_not_found" })
        .mockResolvedValue({
          ok: true,
          blob: {
            schemaVersion: 1,
            generation: 1,
            checksumSHA256: "ff",
            ciphertextBase64: "",
            ciphertextSize: 0,
            updatedAt: "2026-03-20T08:09:00.000Z",
          },
        }),
    });

    const result = await harness.upload();

    expect(result).toMatchObject({ ok: false, errorCode: "remote_backup_changed" });
    expect(harness.putRecoveryKey).toHaveBeenCalledTimes(2);
    expect(harness.putRecoveryKey).toHaveBeenNthCalledWith(
      2,
      "session-1",
      harness.previous,
      STEP_UP,
    );
  });

  it.each(["network_failed", "server_busy", "generic"])(
    "keeps the new package after an ambiguous %s outcome",
    async (failure) => {
      const harness = setup(failure);

      const result = await harness.upload();

      expect(result.ok).toBe(false);
      expect(harness.putRecoveryKey).toHaveBeenCalledTimes(1);
      expect(harness.putRecoveryKey).toHaveBeenCalledWith("session-1", harness.local, STEP_UP);
    },
  );
});
