import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { SyncAPIClient } from "./sync-api-client";
import {
  createDefaultSyncPreferencesRecord,
  type SyncBlobRecord,
  type SyncCapabilityDocument,
  type SyncPreferencesRecord,
} from "./sync-contract";
import { runSyncUpload } from "./sync-client-service";

const NOW = new Date("2026-03-20T08:10:00.000Z");

function capabilities(overrides: Partial<SyncCapabilityDocument> = {}): SyncCapabilityDocument {
  return {
    mode: "self_hosted",
    syncEnabled: true,
    recoverySupported: true,
    pushSupported: false,
    portalSupported: false,
    advancedCloudInsights: false,
    maxDevices: 5,
    maxBlobBytes: 16 << 20,
    ...overrides,
  };
}

function selfHosted(overrides: Partial<SyncPreferencesRecord> = {}): SyncPreferencesRecord {
  return {
    ...createDefaultSyncPreferencesRecord(),
    mode: "self_hosted",
    endpointInput: "192.168.1.20:8080",
    normalizedEndpoint: "http://192.168.1.20:8080",
    deviceLabel: "Pixel 7",
    setupStatus: "connected",
    ...overrides,
  };
}

function remoteBlob(generation: number): SyncBlobRecord {
  return {
    schemaVersion: 1,
    generation,
    checksumSHA256: "00",
    ciphertextBase64: "",
    ciphertextSize: 0,
    updatedAt: "2026-03-20T08:00:00.000Z",
  };
}

function setup(client: Partial<SyncAPIClient>) {
  const prepared = createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z"));
  const secretStore = createSyncSecretStoreMock({
    ...prepared.record,
    authSessionToken: "session-1",
  });
  const putRecoveryKey = jest
    .fn()
    .mockResolvedValue({ ok: true, recoveryKey: prepared.record.wrappedKey });
  const putBlob = jest.fn().mockResolvedValue({
    ok: true,
    blob: { ...remoteBlob(NOW.getTime()), updatedAt: NOW.toISOString() },
  });
  const api = {
    getCapabilities: jest.fn().mockResolvedValue({ ok: true, capabilities: capabilities() }),
    getRecoveryKey: jest
      .fn()
      .mockResolvedValue({ ok: true, recoveryKey: prepared.record.wrappedKey }),
    getBlob: jest.fn().mockResolvedValue({ ok: false, errorCode: "blob_not_found" }),
    putRecoveryKey,
    putBlob,
    ...client,
  } as unknown as SyncAPIClient;
  return {
    api,
    wrappedKey: prepared.record.wrappedKey,
    putRecoveryKey: api.putRecoveryKey as jest.Mock,
    putBlob: api.putBlob as jest.Mock,
    upload: (
      preferences: SyncPreferencesRecord,
      options: { confirm?: boolean; stepUp?: { currentPassword: string } } = {},
    ) =>
      runSyncUpload(
        createLocalAppStorageMock({
          readSyncPreferencesRecord: jest.fn().mockResolvedValue(preferences),
        }),
        secretStore,
        preferences,
        NOW,
        jest.fn().mockReturnValue(api),
        jest.fn(),
        { confirmUploadOverExistingBackup: async () => options.confirm ?? false },
        options.stepUp,
      ),
  };
}

describe("runSyncUpload key-before-blob guard (self-hosted)", () => {
  it("refuses a ciphertext over the server's maxBlobBytes before any write", async () => {
    const harness = setup({
      getCapabilities: jest
        .fn()
        .mockResolvedValue({ ok: true, capabilities: capabilities({ maxBlobBytes: 16 }) }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: 100 }));

    expect(result).toEqual({ ok: false, errorCode: "invalid_blob" });
    expect(harness.putRecoveryKey).not.toHaveBeenCalled();
    expect(harness.putBlob).not.toHaveBeenCalled();
  });

  it("does not rewrite a stored package that matches, whatever its hex case", async () => {
    const harness = setup({});
    (harness.api.getRecoveryKey as jest.Mock).mockResolvedValue({
      ok: true,
      recoveryKey: {
        ...harness.wrappedKey,
        wrappedMasterKeyHex: harness.wrappedKey.wrappedMasterKeyHex.toUpperCase(),
      },
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: 100 }));

    expect(result.ok).toBe(true);
    expect(harness.putRecoveryKey).not.toHaveBeenCalled();
    expect(harness.putBlob).toHaveBeenCalledTimes(1);
  });

  it("never replaces a different package on a device that has uploaded under its key", async () => {
    const other = createSyncSecretsRecord("Tablet", new Date("2026-03-20T08:00:00.000Z"));
    const harness = setup({
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: true, recoveryKey: other.record.wrappedKey }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: 100 }), {
      stepUp: { currentPassword: "owner password" },
    });

    expect(result).toEqual({ ok: false, errorCode: "recovery_key_changed_elsewhere" });
    expect(harness.putRecoveryKey).not.toHaveBeenCalled();
    expect(harness.putBlob).not.toHaveBeenCalled();
  });

  it("checks the generation against the probed backup before a fresh device replaces the package", async () => {
    const other = createSyncSecretsRecord("Tablet", new Date("2026-03-20T08:00:00.000Z"));
    const harness = setup({
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: true, recoveryKey: other.record.wrappedKey }),
      getBlob: jest
        .fn()
        .mockResolvedValue({ ok: true, blob: remoteBlob(NOW.getTime() + 60_000) }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: null }), {
      confirm: true,
      stepUp: { currentPassword: "owner password" },
    });

    expect(result).toEqual({ ok: false, errorCode: "stale_generation" });
    expect(harness.api.getBlob).toHaveBeenCalledTimes(1);
    expect(harness.putRecoveryKey).not.toHaveBeenCalled();
    expect(harness.putBlob).not.toHaveBeenCalled();
  });

  it("reads the remote generation before storing a missing package on a steady device", async () => {
    const harness = setup({
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "recovery_package_not_found" }),
      getBlob: jest
        .fn()
        .mockResolvedValue({ ok: true, blob: remoteBlob(NOW.getTime() + 60_000) }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: 100 }), {
      stepUp: { currentPassword: "owner password" },
    });

    expect(result).toEqual({ ok: false, errorCode: "stale_generation" });
    expect(harness.putRecoveryKey).not.toHaveBeenCalled();
    expect(harness.putBlob).not.toHaveBeenCalled();
  });

  it("keeps the intentional replacement: confirmed fresh device, step-up, then the blob", async () => {
    const other = createSyncSecretsRecord("Tablet", new Date("2026-03-20T08:00:00.000Z"));
    const harness = setup({
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: true, recoveryKey: other.record.wrappedKey }),
      getBlob: jest.fn().mockResolvedValue({ ok: true, blob: remoteBlob(1000) }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: null }), {
      confirm: true,
      stepUp: { currentPassword: "owner password" },
    });

    expect(result.ok).toBe(true);
    expect(harness.putRecoveryKey).toHaveBeenCalledWith("session-1", harness.wrappedKey, {
      currentPassword: "owner password",
    });
    expect(harness.putRecoveryKey.mock.invocationCallOrder[0]).toBeLessThan(
      harness.putBlob.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("fails closed when the stored package cannot be read", async () => {
    const harness = setup({
      getRecoveryKey: jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: 100 }));

    expect(result).toEqual({ ok: false, errorCode: "network_failed" });
    expect(harness.putRecoveryKey).not.toHaveBeenCalled();
    expect(harness.putBlob).not.toHaveBeenCalled();
  });

  it("fails closed when the remote generation cannot be read before a package write", async () => {
    const harness = setup({
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "recovery_package_not_found" }),
      getBlob: jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: 100 }), {
      stepUp: { currentPassword: "owner password" },
    });

    expect(result).toEqual({ ok: false, errorCode: "network_failed" });
    expect(harness.putRecoveryKey).not.toHaveBeenCalled();
    expect(harness.putBlob).not.toHaveBeenCalled();
  });

  it("stores a missing package when the server holds no backup yet", async () => {
    const harness = setup({
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "recovery_package_not_found" }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: 100 }), {
      stepUp: { currentPassword: "owner password" },
    });

    expect(result.ok).toBe(true);
    expect(harness.api.getBlob).toHaveBeenCalledTimes(1);
    expect(harness.putRecoveryKey).toHaveBeenCalledTimes(1);
    expect(harness.putBlob).toHaveBeenCalledTimes(1);
  });

  it("touches no package on a server without recovery support", async () => {
    const harness = setup({
      getCapabilities: jest.fn().mockResolvedValue({
        ok: true,
        capabilities: capabilities({ recoverySupported: false }),
      }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: 100 }));

    expect(result.ok).toBe(true);
    expect(harness.api.getRecoveryKey).not.toHaveBeenCalled();
    expect(harness.putRecoveryKey).not.toHaveBeenCalled();
    expect(harness.putBlob).toHaveBeenCalledTimes(1);
  });

  it("maps a rate-limited blob write instead of generic", async () => {
    const harness = setup({
      putBlob: jest.fn().mockResolvedValue({ ok: false, errorCode: "rate_limited" }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: 100 }));

    expect(result).toEqual({ ok: false, errorCode: "rate_limited" });
  });
});
