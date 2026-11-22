import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { SyncAPIClient } from "./sync-api-client";
import {
  createDefaultSyncPreferencesRecord,
  type SyncBlobRecord,
  type SyncPreferencesRecord,
} from "./sync-contract";
import { runSyncUpload } from "./sync-client-service";

const NOW = new Date("2026-03-20T08:10:00.000Z");
const LAST_SYNCED_AT = "2026-03-20T08:00:00.000000001Z";
const FLOOR = 1_000;

type PutInput = Parameters<SyncAPIClient["putBlob"]>[1];

function selfHosted(overrides: Partial<SyncPreferencesRecord> = {}): SyncPreferencesRecord {
  return {
    ...createDefaultSyncPreferencesRecord(),
    mode: "self_hosted",
    endpointInput: "192.168.1.20:8080",
    normalizedEndpoint: "http://192.168.1.20:8080",
    deviceLabel: "Pixel 7",
    setupStatus: "connected",
    lastRemoteGeneration: FLOOR,
    lastSyncedAt: LAST_SYNCED_AT,
    ...overrides,
  };
}

function blob(overrides: Partial<SyncBlobRecord> = {}): SyncBlobRecord {
  return {
    schemaVersion: 3,
    generation: FLOOR,
    checksumSHA256: "aa",
    ciphertextBase64: "",
    ciphertextSize: 0,
    updatedAt: LAST_SYNCED_AT,
    ...overrides,
  };
}

// The blob the server would store for exactly this PUT.
function echo(input: PutInput, updatedAt = "2026-03-20T08:10:00.5Z"): SyncBlobRecord {
  return blob({
    generation: input.generation,
    checksumSHA256: input.checksumSHA256,
    updatedAt,
  });
}

function setup(
  putBlob: jest.Mock,
  getBlob: jest.Mock = jest.fn().mockResolvedValue({ ok: false, errorCode: "blob_not_found" }),
) {
  const storage = createLocalAppStorageMock();
  const secretStore = createSyncSecretStoreMock({
    ...createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z")).record,
    authSessionToken: "session-1",
  });
  const client = {
    getCapabilities: jest.fn().mockResolvedValue({
      ok: true,
      capabilities: {
        mode: "self_hosted",
        syncEnabled: true,
        recoverySupported: false,
        pushSupported: false,
        portalSupported: false,
        advancedCloudInsights: false,
        maxDevices: 5,
        maxBlobBytes: 16 << 20,
      },
    }),
    getBlob,
    putBlob,
  } as unknown as SyncAPIClient;
  return {
    storage,
    upload: (preferences: SyncPreferencesRecord = selfHosted()) =>
      runSyncUpload(storage, secretStore, preferences, NOW, () => client, undefined, {
        confirmUploadOverExistingBackup: async () => true,
      }),
  };
}

function putArg(putBlob: jest.Mock, call: number): PutInput {
  return putBlob.mock.calls[call]![1] as PutInput;
}

describe("runSyncUpload expected_generation", () => {
  it("sends the rollback floor as the expected generation", async () => {
    const putBlob = jest.fn(async (_token: string, input: PutInput) => ({
      ok: true,
      blob: echo(input),
    }));
    const { upload } = setup(putBlob);

    const result = await upload();

    expect(result.ok).toBe(true);
    expect(putBlob).toHaveBeenCalledTimes(1);
    expect(putArg(putBlob, 0).expectedGeneration).toBe(FLOOR);
  });

  it("sends the probed generation on a device that never synced", async () => {
    const putBlob = jest.fn(async (_token: string, input: PutInput) => ({
      ok: true,
      blob: echo(input),
    }));
    const getBlob = jest.fn().mockResolvedValue({ ok: true, blob: blob({ generation: 777 }) });
    const { upload } = setup(putBlob, getBlob);

    await upload(selfHosted({ lastRemoteGeneration: null, lastSyncedAt: null }));

    expect(putArg(putBlob, 0).expectedGeneration).toBe(777);
  });

  it("sends no expected generation when the server holds no backup", async () => {
    const putBlob = jest.fn(async (_token: string, input: PutInput) => ({
      ok: true,
      blob: echo(input),
    }));
    const { upload } = setup(putBlob);

    await upload(selfHosted({ lastRemoteGeneration: null, lastSyncedAt: null }));

    expect(putArg(putBlob, 0)).not.toHaveProperty("expectedGeneration");
  });

  it("retries once without the field when an older server rejects it", async () => {
    const putBlob = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, errorCode: "invalid_json" })
      .mockImplementationOnce(async (_token: string, input: PutInput) => ({
        ok: true,
        blob: echo(input),
      }));
    const { upload } = setup(putBlob);

    const result = await upload();

    expect(result.ok).toBe(true);
    expect(putBlob).toHaveBeenCalledTimes(2);
    expect(putArg(putBlob, 1)).not.toHaveProperty("expectedGeneration");
    expect(putArg(putBlob, 1).generation).toBe(putArg(putBlob, 0).generation);
  });

  it("refuses to overwrite a backup another device uploaded", async () => {
    const putBlob = jest.fn().mockResolvedValue({ ok: false, errorCode: "stale_generation" });
    const getBlob = jest.fn().mockResolvedValue({
      ok: true,
      blob: blob({ generation: FLOOR + 5, updatedAt: "2026-03-20T08:05:00Z" }),
    });
    const { storage, upload } = setup(putBlob, getBlob);

    const result = await upload();

    expect(result).toEqual({ ok: false, errorCode: "remote_backup_changed" });
    expect(putBlob).toHaveBeenCalledTimes(1);
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("refuses when the stored backup cannot be read after a 409", async () => {
    const putBlob = jest.fn().mockResolvedValue({ ok: false, errorCode: "stale_generation" });
    const getBlob = jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" });
    const { upload } = setup(putBlob, getBlob);

    expect(await upload()).toEqual({ ok: false, errorCode: "remote_backup_changed" });
  });

  it("refuses a 409 without an expected generation unless the blob is its own", async () => {
    const putBlob = jest.fn().mockResolvedValue({ ok: false, errorCode: "stale_generation" });
    const getBlob = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, errorCode: "blob_not_found" })
      .mockResolvedValue({ ok: true, blob: blob({ updatedAt: "2026-03-20T08:09:00Z" }) });
    const { upload } = setup(putBlob, getBlob);

    const result = await upload(selfHosted({ lastRemoteGeneration: null, lastSyncedAt: null }));

    expect(result).toEqual({ ok: false, errorCode: "remote_backup_changed" });
    expect(putBlob).toHaveBeenCalledTimes(1);
  });

  it("retries once against the backup it last synced under another generation", async () => {
    const stored = blob({ generation: FLOOR - 400 });
    const putBlob = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, errorCode: "stale_generation" })
      .mockImplementationOnce(async (_token: string, input: PutInput) => ({
        ok: true,
        blob: echo(input),
      }));
    const getBlob = jest.fn().mockResolvedValue({ ok: true, blob: stored });
    const { upload } = setup(putBlob, getBlob);

    const result = await upload();

    expect(result.ok).toBe(true);
    expect(putBlob).toHaveBeenCalledTimes(2);
    expect(putArg(putBlob, 1).expectedGeneration).toBe(stored.generation);
    expect(putArg(putBlob, 1).checksumSHA256).toBe(putArg(putBlob, 0).checksumSHA256);
  });

  it("refuses when the retry against the last-synced backup is stale again", async () => {
    const putBlob = jest.fn().mockResolvedValue({ ok: false, errorCode: "stale_generation" });
    const getBlob = jest.fn().mockResolvedValue({ ok: true, blob: blob({ generation: FLOOR - 1 }) });
    const { upload } = setup(putBlob, getBlob);

    expect(await upload()).toEqual({ ok: false, errorCode: "remote_backup_changed" });
    expect(putBlob).toHaveBeenCalledTimes(2);
  });

  it("does not retry against a last-synced backup whose generation is not below its own", async () => {
    const putBlob = jest.fn().mockResolvedValue({ ok: false, errorCode: "stale_generation" });
    const getBlob = jest.fn().mockResolvedValue({
      ok: true,
      blob: blob({ generation: NOW.getTime() + 60_000 }),
    });
    const { upload } = setup(putBlob, getBlob);

    expect(await upload()).toEqual({ ok: false, errorCode: "remote_backup_changed" });
    expect(putBlob).toHaveBeenCalledTimes(1);
  });

  it("passes a non-stale failure of the retry through", async () => {
    const putBlob = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, errorCode: "stale_generation" })
      .mockResolvedValueOnce({ ok: false, errorCode: "rate_limited", retryAfterSeconds: 9 });
    const getBlob = jest.fn().mockResolvedValue({ ok: true, blob: blob({ generation: FLOOR - 1 }) });
    const { upload } = setup(putBlob, getBlob);

    expect(await upload()).toEqual({
      ok: false,
      errorCode: "rate_limited",
      retryAfterSeconds: 9,
    });
  });

  it("adopts its own write when a 409 shows it already landed", async () => {
    let sent: PutInput | undefined;
    const putBlob = jest.fn(async (_token: string, input: PutInput) => {
      sent = input;
      return { ok: false, errorCode: "stale_generation" };
    });
    const getBlob = jest.fn(async () => ({
      ok: true,
      blob: echo(sent!, "2026-03-20T08:10:01Z"),
    }));
    const { storage, upload } = setup(putBlob, getBlob);

    const result = await upload();

    expect(result).toEqual({
      ok: true,
      preferences: expect.objectContaining({
        lastRemoteGeneration: sent!.generation,
        lastSyncedAt: "2026-03-20T08:10:01Z",
      }),
    });
    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledTimes(1);
  });
});

describe("runSyncUpload after an ambiguous failure", () => {
  it.each(["network_failed", "server_busy"] as const)(
    "adopts the write when %s hid a reply and the stored blob is its own",
    async (errorCode) => {
      let sent: PutInput | undefined;
      const putBlob = jest.fn(async (_token: string, input: PutInput) => {
        sent = input;
        return { ok: false, errorCode };
      });
      const getBlob = jest.fn(async () => ({ ok: true, blob: echo(sent!) }));
      const { upload } = setup(putBlob, getBlob);

      const result = await upload();

      expect(result.ok).toBe(true);
      expect(putBlob).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps the failure when the stored blob is not its own", async () => {
    const putBlob = jest
      .fn()
      .mockResolvedValue({ ok: false, errorCode: "server_busy", retryAfterSeconds: 6 });
    const getBlob = jest.fn().mockResolvedValue({ ok: true, blob: blob() });
    const { upload } = setup(putBlob, getBlob);

    expect(await upload()).toEqual({
      ok: false,
      errorCode: "server_busy",
      retryAfterSeconds: 6,
    });
  });

  it("keeps the failure when the reconcile read fails too", async () => {
    const putBlob = jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" });
    const getBlob = jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" });
    const { upload } = setup(putBlob, getBlob);

    expect(await upload()).toEqual({ ok: false, errorCode: "network_failed" });
  });

  it("reconciles the field-less retry on an older server", async () => {
    let sent: PutInput | undefined;
    const putBlob = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, errorCode: "invalid_json" })
      .mockImplementationOnce(async (_token: string, input: PutInput) => {
        sent = input;
        return { ok: false, errorCode: "network_failed" };
      });
    const getBlob = jest.fn(async () => ({ ok: true, blob: echo(sent!) }));
    const { upload } = setup(putBlob, getBlob);

    expect((await upload()).ok).toBe(true);
  });

  it("matches the stored checksum case-insensitively", async () => {
    let sent: PutInput | undefined;
    const putBlob = jest.fn(async (_token: string, input: PutInput) => {
      sent = input;
      return { ok: false, errorCode: "network_failed" };
    });
    const getBlob = jest.fn(async () => ({
      ok: true,
      blob: blob({ generation: sent!.generation, checksumSHA256: sent!.checksumSHA256.toUpperCase() }),
    }));
    const { upload } = setup(putBlob, getBlob);

    expect((await upload()).ok).toBe(true);
  });
});
