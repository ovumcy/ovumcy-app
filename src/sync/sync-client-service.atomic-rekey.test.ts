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
    atomicRekey: true,
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

function storedBlob(generation: number, checksumSHA256 = "00"): SyncBlobRecord {
  return {
    schemaVersion: 1,
    generation,
    checksumSHA256,
    ciphertextBase64: "",
    ciphertextSize: 0,
    updatedAt: "2026-03-20T08:00:00.000Z",
  };
}

function setup(client: Partial<SyncAPIClient>) {
  const prepared = createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z"));
  const other = createSyncSecretsRecord("Tablet", new Date("2026-03-20T08:00:00.000Z"));
  const secretStore = createSyncSecretStoreMock({
    ...prepared.record,
    authSessionToken: "session-1",
  });
  const landed = { ...storedBlob(NOW.getTime()), updatedAt: NOW.toISOString() };
  const api = {
    getCapabilities: jest.fn().mockResolvedValue({ ok: true, capabilities: capabilities() }),
    // A package from another install: this device's package differs.
    getRecoveryKey: jest.fn().mockResolvedValue({ ok: true, recoveryKey: other.record.wrappedKey }),
    getBlob: jest.fn().mockResolvedValue({ ok: false, errorCode: "blob_not_found" }),
    putRecoveryKey: jest.fn().mockResolvedValue({ ok: true, recoveryKey: prepared.record.wrappedKey }),
    putBlob: jest.fn().mockResolvedValue({ ok: true, blob: landed }),
    rekey: jest.fn().mockResolvedValue({ ok: true, blob: landed }),
    ...client,
  } as unknown as SyncAPIClient;
  return {
    api,
    wrappedKey: prepared.record.wrappedKey,
    rekey: api.rekey as jest.Mock,
    putRecoveryKey: api.putRecoveryKey as jest.Mock,
    putBlob: api.putBlob as jest.Mock,
    upload: (
      preferences: SyncPreferencesRecord,
      options: { confirm?: boolean; stepUp?: { currentPassword: string; code?: string } } = {},
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

const STEP_UP = { currentPassword: "owner password" };

describe("runSyncUpload with PUT /sync/rekey (self-hosted)", () => {
  it("sends a first package and its blob in one rekey call, expecting no stored blob", async () => {
    const harness = setup({
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "recovery_package_not_found" }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: null }), {
      stepUp: STEP_UP,
    });

    expect(result.ok).toBe(true);
    expect(harness.rekey).toHaveBeenCalledTimes(1);
    const [token, input, stepUp] = harness.rekey.mock.calls[0];
    expect(token).toBe("session-1");
    expect(input.recoveryKey).toEqual(harness.wrappedKey);
    expect(input.expectedGeneration).toBe(0);
    expect(input.blob.generation).toBe(NOW.getTime());
    expect(input.blob.checksumSHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(stepUp).toEqual(STEP_UP);
    expect(harness.putRecoveryKey).not.toHaveBeenCalled();
    expect(harness.putBlob).not.toHaveBeenCalled();
  });

  it("expects the probed generation when a confirmed fresh device replaces the package", async () => {
    const harness = setup({
      getBlob: jest.fn().mockResolvedValue({ ok: true, blob: storedBlob(1000) }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: null }), {
      confirm: true,
      stepUp: STEP_UP,
    });

    expect(result.ok).toBe(true);
    expect(harness.rekey.mock.calls[0][1].expectedGeneration).toBe(1000);
    expect(harness.putRecoveryKey).not.toHaveBeenCalled();
    expect(harness.putBlob).not.toHaveBeenCalled();
  });

  it("uploads an unchanged package's blob with a plain put", async () => {
    const harness = setup({});
    (harness.api.getRecoveryKey as jest.Mock).mockResolvedValue({
      ok: true,
      recoveryKey: harness.wrappedKey,
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: 100 }));

    expect(result.ok).toBe(true);
    expect(harness.rekey).not.toHaveBeenCalled();
    expect(harness.putBlob).toHaveBeenCalledTimes(1);
  });

  it("keeps the guard: a device that has uploaded never sends a different package", async () => {
    const harness = setup({});

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: 100 }), {
      stepUp: STEP_UP,
    });

    expect(result).toEqual({ ok: false, errorCode: "recovery_key_changed_elsewhere" });
    expect(harness.rekey).not.toHaveBeenCalled();
  });

  it("reports another device's write on a 409 and puts nothing back", async () => {
    const harness = setup({
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "recovery_package_not_found" }),
      rekey: jest.fn().mockResolvedValue({ ok: false, errorCode: "stale_generation" }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: null }), {
      stepUp: STEP_UP,
    });

    expect(result).toEqual({ ok: false, errorCode: "remote_backup_changed" });
    expect(harness.putRecoveryKey).not.toHaveBeenCalled();
    expect(harness.putBlob).not.toHaveBeenCalled();
  });

  it("asks for the step-up when the server wants one and none was sent", async () => {
    const harness = setup({
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "recovery_package_not_found" }),
      rekey: jest.fn().mockResolvedValue({ ok: false, errorCode: "invalid_current_password" }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: null }));

    expect(result).toEqual({ ok: false, errorCode: "recovery_key_step_up_required" });
  });

  it("passes a refused step-up through as the server judged it", async () => {
    const harness = setup({
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "recovery_package_not_found" }),
      rekey: jest
        .fn()
        .mockResolvedValueOnce({ ok: false, errorCode: "invalid_current_password" })
        .mockResolvedValueOnce({ ok: false, errorCode: "totp_invalid_code" }),
    });

    await expect(
      harness.upload(selfHosted({ lastRemoteGeneration: null }), { stepUp: STEP_UP }),
    ).resolves.toEqual({ ok: false, errorCode: "invalid_current_password" });
    await expect(
      harness.upload(selfHosted({ lastRemoteGeneration: null }), { stepUp: STEP_UP }),
    ).resolves.toEqual({ ok: false, errorCode: "recovery_key_code_required" });
  });

  it("treats a lost reply as landed when the stored blob is this attempt's", async () => {
    const getBlob = jest.fn().mockResolvedValue({ ok: false, errorCode: "blob_not_found" });
    const harness = setup({
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "recovery_package_not_found" }),
      getBlob,
      rekey: jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" }),
    });
    harness.rekey.mockImplementation(async (_token, input) => {
      getBlob.mockResolvedValueOnce({
        ok: true,
        blob: {
          ...storedBlob(input.blob.generation, input.blob.checksumSHA256),
          updatedAt: NOW.toISOString(),
        },
      });
      return { ok: false, errorCode: "network_failed" };
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: null }), {
      stepUp: STEP_UP,
    });

    expect(result.ok).toBe(true);
    expect(harness.rekey).toHaveBeenCalledTimes(1);
    expect(harness.putBlob).not.toHaveBeenCalled();
  });

  it("keeps a lost reply a network failure when the stored blob is not this attempt's", async () => {
    const harness = setup({
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "recovery_package_not_found" }),
      rekey: jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: null }), {
      stepUp: STEP_UP,
    });

    expect(result).toEqual({ ok: false, errorCode: "network_failed" });
  });

  it("passes the server's wait through a busy rekey", async () => {
    const harness = setup({
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "recovery_package_not_found" }),
      rekey: jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "server_busy", retryAfterSeconds: 6 }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: null }), {
      stepUp: STEP_UP,
    });

    expect(result).toEqual({ ok: false, errorCode: "server_busy", retryAfterSeconds: 6 });
  });

  it("falls back to the package write then the blob on a server that does not offer rekey", async () => {
    const harness = setup({
      getCapabilities: jest.fn().mockResolvedValue({
        ok: true,
        capabilities: capabilities({ atomicRekey: false }),
      }),
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "recovery_package_not_found" }),
    });

    const result = await harness.upload(selfHosted({ lastRemoteGeneration: null }), {
      stepUp: STEP_UP,
    });

    expect(result.ok).toBe(true);
    expect(harness.rekey).not.toHaveBeenCalled();
    expect(harness.putRecoveryKey).toHaveBeenCalledTimes(1);
    expect(harness.putBlob).toHaveBeenCalledTimes(1);
  });
});
