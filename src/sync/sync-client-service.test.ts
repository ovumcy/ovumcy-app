import { fromByteArray, toByteArray } from "base64-js";

import { createEmptyDayLogRecord } from "../models/day-log";
import {
  buildSyncPayloadAad,
  createSyncSecretsRecord,
  decryptSyncPayload,
  encryptSyncPayload,
} from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { SyncAPIClient } from "./sync-api-client";
import {
  createDefaultSyncPreferencesRecord,
  type EncryptedSyncEnvelope,
} from "./sync-contract";
import {
  clearLocalSyncSession,
  connectSyncAccount,
  disconnectSyncAccount,
  finalizeSyncSessionAfterTOTP,
  loadConnectedSyncCapabilities,
  recoverSyncAccess,
  requiresUploadOverBackupConfirmation,
  runSyncRestore,
  runSyncUpload,
} from "./sync-client-service";
import {
  decodeSyncSnapshot,
  encodeSyncSnapshot,
  SYNC_SNAPSHOT_SCHEMA_VERSION,
} from "./sync-snapshot-service";
import type { ManagedCloudAPIClient } from "./managed-cloud-api-client";

describe("sync-client-service", () => {
  it("registers a prepared managed device through ovumcy-managed without touching the sync endpoint", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const apiClientFactory = jest.fn();
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({
        register: jest.fn().mockResolvedValue({
          ok: true,
          auth: {
            accountID: "managed-account-1",
            email: "alice@example.com",
            sessionToken: "managed-session-1",
            sessionExpiresAt: "2026-03-21T08:00:00.000Z",
            entitlement: {
              syncAllowed: true,
              source: "manual",
              updatedAt: "2026-03-20T08:05:00.000Z",
              effectiveAt: "2026-03-20T08:05:00.000Z",
              explanation: "beta access",
            },
          },
        }),
      }),
    );

    const result = await connectSyncAccount(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
      },
      {
        login: "alice@example.com",
        password: "correct horse battery staple",
      },
      "register",
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
      managedClientFactory,
    );

    expect(result).toEqual({
      ok: true,
      capabilities: expect.objectContaining({
        mode: "managed",
        syncEnabled: true,
      }),
      preferences: expect.objectContaining({
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        setupStatus: "connected",
      }),
    });
    expect(apiClientFactory).not.toHaveBeenCalled();
    expect(managedClientFactory).toHaveBeenCalledTimes(1);
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        authSessionToken: null,
        managedAuthSessionToken: "managed-session-1",
      }),
    );
  });

  it("connects a prepared device and uploads the wrapped recovery key when supported", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
      deviceLabel: "Pixel 7",
      setupStatus: "local_ready" as const,
      preparedAt: "2026-03-20T08:00:00.000Z",
    };
    const putRecoveryKey = jest.fn().mockResolvedValue({
      ok: true,
      recoveryKey: preparedSecrets.record.wrappedKey,
    });
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        register: jest.fn().mockResolvedValue({
          ok: true,
          auth: {
            accountID: "account-1",
            sessionToken: "session-1",
            sessionExpiresAt: "2026-03-21T08:00:00.000Z",
          },
        }),
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
            maxBlobBytes: 1024,
          },
        }),
        attachDevice: jest.fn().mockResolvedValue({
          ok: true,
          device: {
            deviceID: preparedSecrets.record.device.deviceID,
            deviceLabel: preparedSecrets.record.device.deviceLabel,
            createdAt: preparedSecrets.record.device.createdAt,
            lastSeenAt: preparedSecrets.record.device.createdAt,
          },
        }),
        putRecoveryKey,
      }),
    );

    const result = await connectSyncAccount(
      storage,
      secretStore,
      preferences,
      {
        login: "alice@example.com",
        password: "correct horse battery staple",
      },
      "register",
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
    );

    expect(result).toEqual({
      ok: true,
      capabilities: expect.objectContaining({
        mode: "self_hosted",
        recoverySupported: true,
        syncEnabled: true,
      }),
      preferences: expect.objectContaining({
        normalizedEndpoint: "http://192.168.1.20:8080",
        setupStatus: "connected",
        lastSyncedAt: null,
      }),
    });
    expect(putRecoveryKey).toHaveBeenCalledWith(
      "session-1",
      preparedSecrets.record.wrappedKey,
    );
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        authSessionToken: "session-1",
      }),
    );
  });

  it("uploads an encrypted sync snapshot and refreshes recovery key storage when supported", async () => {
    const dayLog = {
      ...createEmptyDayLogRecord("2026-03-10"),
      isPeriod: true,
      notes: "Cycle start",
    };
    const storage = createLocalAppStorageMock({
      readDayLogSummary: jest.fn().mockResolvedValue({
        totalEntries: 1,
        hasData: true,
        dateFrom: "2026-03-10",
        dateTo: "2026-03-10",
      }),
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([dayLog]),
    });
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
      normalizedEndpoint: "http://192.168.1.20:8080",
      deviceLabel: "Pixel 7",
      setupStatus: "connected" as const,
      preparedAt: "2026-03-20T08:00:00.000Z",
    };
    const putRecoveryKey = jest.fn().mockResolvedValue({
      ok: true,
      recoveryKey: preparedSecrets.record.wrappedKey,
    });
    const putBlob = jest.fn().mockImplementation(async (_token, input) => {
      const encryptedEnvelope = JSON.parse(
        new TextDecoder().decode(toByteArray(input.ciphertextBase64)),
      ) as EncryptedSyncEnvelope;
      const snapshot = decodeSyncSnapshot(
        decryptSyncPayload(
          preparedSecrets.record.masterKeyHex,
          encryptedEnvelope,
          buildSyncPayloadAad(preparedSecrets.record.device.deviceID),
        ),
      );

      expect(snapshot.dayLogs).toEqual([dayLog]);
      expect(snapshot.profile).toEqual(
        expect.objectContaining({ cycleLength: 28 }),
      );
      expect(input.schemaVersion).toBe(SYNC_SNAPSHOT_SCHEMA_VERSION);

      return {
        ok: true,
        blob: {
          schemaVersion: input.schemaVersion,
          generation: input.generation,
          checksumSHA256: input.checksumSHA256,
          ciphertextBase64: input.ciphertextBase64,
          ciphertextSize: toByteArray(input.ciphertextBase64).byteLength,
          updatedAt: "2026-03-20T08:10:00.000Z",
        },
      };
    });
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
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
            maxBlobBytes: 1024,
          },
        }),
        putRecoveryKey,
        putBlob,
      }),
    );

    const result = await runSyncUpload(
      storage,
      secretStore,
      preferences,
      new Date("2026-03-20T08:10:00.000Z"),
      apiClientFactory,
    );

    expect(result).toEqual({
      ok: true,
      preferences: expect.objectContaining({
        setupStatus: "connected",
        lastRemoteGeneration: expect.any(Number),
        lastSyncedAt: "2026-03-20T08:10:00.000Z",
      }),
    });
    expect(putRecoveryKey).toHaveBeenCalledWith(
      "session-1",
      preparedSecrets.record.wrappedKey,
    );
    expect(putBlob).toHaveBeenCalledTimes(1);
    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSyncedAt: "2026-03-20T08:10:00.000Z",
      }),
    );
  });

  it("flags upload-over-backup only for never-synced installs facing an existing remote blob", () => {
    expect(
      requiresUploadOverBackupConfirmation({
        lastRemoteGeneration: null,
        remoteBackupExists: true,
      }),
    ).toBe(true);
    expect(
      requiresUploadOverBackupConfirmation({
        lastRemoteGeneration: null,
        remoteBackupExists: false,
      }),
    ).toBe(false);
    expect(
      requiresUploadOverBackupConfirmation({
        lastRemoteGeneration: 42,
        remoteBackupExists: true,
      }),
    ).toBe(false);
  });

  describe("upload-over-backup guard in runSyncUpload", () => {
    function createUploadGuardHarness(options: {
      lastRemoteGeneration: number | null;
      remoteBlobExists: boolean;
    }) {
      const storage = createLocalAppStorageMock();
      const preparedSecrets = createSyncSecretsRecord(
        "Pixel 7",
        new Date("2026-03-20T08:00:00.000Z"),
      );
      const secretStore = createSyncSecretStoreMock({
        ...preparedSecrets.record,
        authSessionToken: "session-1",
      });
      const preferences = {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted" as const,
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "connected" as const,
        preparedAt: "2026-03-20T08:00:00.000Z",
        lastRemoteGeneration: options.lastRemoteGeneration,
      };
      const getBlob = jest.fn().mockResolvedValue(
        options.remoteBlobExists
          ? {
              ok: true,
              blob: {
                schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
                generation: 999,
                checksumSHA256: "aa",
                ciphertextBase64: "bb",
                ciphertextSize: 2,
                updatedAt: "2026-03-19T00:00:00.000Z",
              },
            }
          : { ok: false, errorCode: "blob_not_found" },
      );
      const putBlob = jest.fn().mockImplementation(async (_token, input) => ({
        ok: true,
        blob: {
          schemaVersion: input.schemaVersion,
          generation: input.generation,
          checksumSHA256: input.checksumSHA256,
          ciphertextBase64: input.ciphertextBase64,
          ciphertextSize: 3,
          updatedAt: "2026-03-20T08:10:00.000Z",
        },
      }));
      const apiClientFactory = jest.fn().mockReturnValue(
        createAPIClientMock({
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
              maxBlobBytes: 1024,
            },
          }),
          getBlob,
          putBlob,
        }),
      );

      return { storage, secretStore, preferences, getBlob, putBlob, apiClientFactory };
    }

    it("requires the confirmation and aborts on decline for a fresh install over an existing backup", async () => {
      const harness = createUploadGuardHarness({
        lastRemoteGeneration: null,
        remoteBlobExists: true,
      });
      const confirmUploadOverExistingBackup = jest.fn().mockResolvedValue(false);

      const result = await runSyncUpload(
        harness.storage,
        harness.secretStore,
        harness.preferences,
        new Date("2026-03-20T08:10:00.000Z"),
        harness.apiClientFactory,
        undefined,
        { confirmUploadOverExistingBackup },
      );

      expect(result).toEqual({
        ok: false,
        errorCode: "upload_over_backup_declined",
      });
      expect(confirmUploadOverExistingBackup).toHaveBeenCalledTimes(1);
      expect(harness.putBlob).not.toHaveBeenCalled();
      expect(harness.storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
    });

    it("proceeds with the upload when the owner explicitly confirms the overwrite", async () => {
      const harness = createUploadGuardHarness({
        lastRemoteGeneration: null,
        remoteBlobExists: true,
      });
      const confirmUploadOverExistingBackup = jest.fn().mockResolvedValue(true);

      const result = await runSyncUpload(
        harness.storage,
        harness.secretStore,
        harness.preferences,
        new Date("2026-03-20T08:10:00.000Z"),
        harness.apiClientFactory,
        undefined,
        { confirmUploadOverExistingBackup },
      );

      expect(result.ok).toBe(true);
      expect(confirmUploadOverExistingBackup).toHaveBeenCalledTimes(1);
      expect(harness.putBlob).toHaveBeenCalledTimes(1);
    });

    it("fails closed when no guard is wired and a remote backup exists", async () => {
      const harness = createUploadGuardHarness({
        lastRemoteGeneration: null,
        remoteBlobExists: true,
      });

      const result = await runSyncUpload(
        harness.storage,
        harness.secretStore,
        harness.preferences,
        new Date("2026-03-20T08:10:00.000Z"),
        harness.apiClientFactory,
      );

      expect(result).toEqual({
        ok: false,
        errorCode: "upload_over_backup_declined",
      });
      expect(harness.putBlob).not.toHaveBeenCalled();
    });

    it("uploads without any prompt on a fresh install when the server has no blob yet", async () => {
      const harness = createUploadGuardHarness({
        lastRemoteGeneration: null,
        remoteBlobExists: false,
      });
      const confirmUploadOverExistingBackup = jest.fn().mockResolvedValue(false);

      const result = await runSyncUpload(
        harness.storage,
        harness.secretStore,
        harness.preferences,
        new Date("2026-03-20T08:10:00.000Z"),
        harness.apiClientFactory,
        undefined,
        { confirmUploadOverExistingBackup },
      );

      expect(result.ok).toBe(true);
      expect(harness.getBlob).toHaveBeenCalledTimes(1);
      expect(confirmUploadOverExistingBackup).not.toHaveBeenCalled();
      expect(harness.putBlob).toHaveBeenCalledTimes(1);
    });

    it("skips the remote probe entirely for an already-synced install", async () => {
      const harness = createUploadGuardHarness({
        lastRemoteGeneration: 456,
        remoteBlobExists: true,
      });
      const confirmUploadOverExistingBackup = jest.fn().mockResolvedValue(false);

      const result = await runSyncUpload(
        harness.storage,
        harness.secretStore,
        harness.preferences,
        new Date("2026-03-20T08:10:00.000Z"),
        harness.apiClientFactory,
        undefined,
        { confirmUploadOverExistingBackup },
      );

      expect(result.ok).toBe(true);
      expect(harness.getBlob).not.toHaveBeenCalled();
      expect(confirmUploadOverExistingBackup).not.toHaveBeenCalled();
      expect(harness.putBlob).toHaveBeenCalledTimes(1);
    });

    it("fails closed when the remote-backup probe errors with anything but blob_not_found", async () => {
      const harness = createUploadGuardHarness({
        lastRemoteGeneration: null,
        remoteBlobExists: false,
      });
      (harness.getBlob as jest.Mock).mockResolvedValue({
        ok: false,
        errorCode: "network_failed",
      });

      const result = await runSyncUpload(
        harness.storage,
        harness.secretStore,
        harness.preferences,
        new Date("2026-03-20T08:10:00.000Z"),
        harness.apiClientFactory,
        undefined,
        {
          confirmUploadOverExistingBackup: jest.fn().mockResolvedValue(true),
        },
      );

      expect(result).toEqual({ ok: false, errorCode: "network_failed" });
      expect(harness.putBlob).not.toHaveBeenCalled();
    });
  });

  it("purges the managed billing cache when the local sync session is cleared", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "sync-session-1",
      managedAuthSessionToken: "managed-session-1",
    });
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
      setupStatus: "connected" as const,
      deviceLabel: "Pixel 7",
    };

    await clearLocalSyncSession(storage, secretStore, preferences);

    expect(storage.writeManagedBillingCacheRecord).toHaveBeenCalledWith({
      snapshot: null,
      dismissedOfferIDs: [],
    });
  });

  it("loads managed sync capabilities from the managed cloud session", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "stale-sync-session",
      managedAuthSessionToken: "managed-session-1",
    });
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
      normalizedEndpoint: "https://sync.ovumcy.cloud",
      setupStatus: "connected" as const,
      preparedAt: "2026-03-20T08:00:00.000Z",
      deviceLabel: "Pixel 7",
    };
    const apiClientFactory = jest.fn();
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({
        getSession: jest.fn().mockResolvedValue({
          ok: true,
          session: {
            accountID: "managed-account-1",
            email: "alice@example.com",
            sessionExpiresAt: "2026-03-21T08:00:00.000Z",
            entitlement: {
              syncAllowed: false,
              source: "manual",
              updatedAt: "2026-03-20T08:05:00.000Z",
              effectiveAt: "2026-03-20T08:05:00.000Z",
              explanation: "plan inactive",
            },
          },
        }),
      }),
    );

    await expect(
      loadConnectedSyncCapabilities(
        secretStore,
        preferences,
        apiClientFactory,
        managedClientFactory,
      ),
    ).resolves.toEqual({
      ok: true,
      capabilities: expect.objectContaining({
        mode: "managed",
      }),
    });
    expect(apiClientFactory).not.toHaveBeenCalled();
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        authSessionToken: null,
        managedAuthSessionToken: "managed-session-1",
      }),
    );
  });

  it("restores sync access from a recovery phrase and server-side recovery package", async () => {
    const storage = createLocalAppStorageMock();
    const originalSecrets = createSyncSecretsRecord(
      "Original device",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock();
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
      deviceLabel: "Recovered Pixel",
      setupStatus: "not_configured" as const,
      preparedAt: null,
    };
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        login: jest.fn().mockResolvedValue({
          ok: true,
          auth: {
            accountID: "account-1",
            sessionToken: "session-1",
            sessionExpiresAt: "2026-03-21T08:00:00.000Z",
          },
        }),
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
            maxBlobBytes: 1024,
          },
        }),
        getRecoveryKey: jest.fn().mockResolvedValue({
          ok: true,
          recoveryKey: originalSecrets.record.wrappedKey,
        }),
        attachDevice: jest.fn().mockResolvedValue({
          ok: true,
          device: {
            deviceID: "recovered-device",
            deviceLabel: "Recovered Pixel",
            createdAt: "2026-03-20T08:05:00.000Z",
            lastSeenAt: "2026-03-20T08:05:00.000Z",
          },
        }),
      }),
    );

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      preferences,
      {
        login: "alice@example.com",
        password: "correct horse battery staple",
      },
      originalSecrets.recoveryPhrase,
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
    );

    expect(result).toEqual({
      ok: true,
      capabilities: expect.objectContaining({
        recoverySupported: true,
        syncEnabled: true,
      }),
      preferences: expect.objectContaining({
        normalizedEndpoint: "http://192.168.1.20:8080",
        setupStatus: "connected",
      }),
    });

    const storedSecrets = await secretStore.readSyncSecrets();
    expect(storedSecrets).toEqual(
      expect.objectContaining({
        authSessionToken: "session-1",
        masterKeyHex: originalSecrets.record.masterKeyHex,
        wrappedKey: originalSecrets.record.wrappedKey,
        device: expect.objectContaining({
          deviceLabel: "Recovered Pixel",
        }),
      }),
    );
    expect(storedSecrets?.device.deviceID).not.toBe(
      originalSecrets.record.device.deviceID,
    );
    expect(storedSecrets?.deviceSecretHex).not.toBe(
      originalSecrets.record.deviceSecretHex,
    );
  });

  it("recovers managed sync access through managed auth and a bridge-minted sync session", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const originalSecrets = createSyncSecretsRecord(
      "Original device",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        getRecoveryKey: jest.fn().mockResolvedValue({
          ok: true,
          recoveryKey: originalSecrets.record.wrappedKey,
        }),
        attachDevice: jest.fn().mockResolvedValue({
          ok: true,
          device: {
            deviceID: "recovered-device",
            deviceLabel: "Recovered Pixel",
            createdAt: "2026-03-20T08:05:00.000Z",
            lastSeenAt: "2026-03-20T08:05:00.000Z",
          },
        }),
        putRecoveryKey: jest.fn().mockResolvedValue({
          ok: true,
          recoveryKey: originalSecrets.record.wrappedKey,
        }),
      }),
    );
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({
        login: jest.fn().mockResolvedValue({
          ok: true,
          auth: {
            accountID: "managed-account-1",
            email: "alice@example.com",
            sessionToken: "managed-session-1",
            sessionExpiresAt: "2026-03-21T08:00:00.000Z",
            entitlement: {
              syncAllowed: true,
              source: "manual",
              updatedAt: "2026-03-20T08:05:00.000Z",
              effectiveAt: "2026-03-20T08:05:00.000Z",
              explanation: "beta access",
            },
          },
        }),
        createSyncSession: jest.fn().mockResolvedValue({
          ok: true,
          auth: {
            accountID: "managed-account-1",
            sessionToken: "sync-session-1",
            sessionExpiresAt: "2026-03-21T08:00:00.000Z",
          },
        }),
      }),
    );

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Recovered Pixel",
      },
      {
        login: "alice@example.com",
        password: "correct horse battery staple",
      },
      originalSecrets.recoveryPhrase,
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
      managedClientFactory,
    );

    expect(result).toEqual({
      ok: true,
      capabilities: expect.objectContaining({
        mode: "managed",
        recoverySupported: true,
      }),
      preferences: expect.objectContaining({
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        setupStatus: "connected",
      }),
    });
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        authSessionToken: "sync-session-1",
        managedAuthSessionToken: "managed-session-1",
        masterKeyHex: originalSecrets.record.masterKeyHex,
      }),
    );
  });

  it("rejects an invalid recovery phrase before attempting network recovery", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
      deviceLabel: "Recovered Pixel",
    };
    const apiClientFactory = jest.fn();

    await expect(
      recoverSyncAccess(
        storage,
        secretStore,
        preferences,
        {
          login: "alice@example.com",
          password: "correct horse battery staple",
        },
        "not a valid mnemonic",
        new Date("2026-03-20T08:05:00.000Z"),
        apiClientFactory,
      ),
    ).resolves.toEqual({
      ok: false,
      errorCode: "invalid_recovery_phrase",
    });
    expect(apiClientFactory).not.toHaveBeenCalled();
  });

  it("restores a remote encrypted blob back into canonical local storage", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
      normalizedEndpoint: "http://192.168.1.20:8080",
      deviceLabel: "Pixel 7",
      setupStatus: "connected" as const,
      preparedAt: "2026-03-20T08:00:00.000Z",
    };
    const dayLog = {
      ...createEmptyDayLogRecord("2026-03-11"),
      mood: 5,
    };
    const snapshotPayload = encodeSyncSnapshot({
      schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
      createdAt: "2026-03-20T08:12:00.000Z",
      bootstrapState: await storage.readBootstrapState(),
      profile: await storage.readProfileRecord(),
      symptomRecords: await storage.listSymptomRecords(),
      dayLogs: [dayLog],
    });
    const encryptedEnvelope = encryptSyncPayload(
      preparedSecrets.record.masterKeyHex,
      snapshotPayload,
      buildSyncPayloadAad(preparedSecrets.record.device.deviceID),
    );
    const ciphertextBytes = new TextEncoder().encode(
      JSON.stringify(encryptedEnvelope),
    );
    const ciphertextBase64 = fromByteArray(ciphertextBytes);
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        getBlob: jest.fn().mockResolvedValue({
          ok: true,
          blob: {
            schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
            generation: 456,
            checksumSHA256: "aa",
            ciphertextBase64,
            ciphertextSize: ciphertextBytes.byteLength,
            updatedAt: "2026-03-20T08:12:00.000Z",
          },
        }),
      }),
    );

    const result = await runSyncRestore(
      storage,
      secretStore,
      preferences,
      apiClientFactory,
    );

    expect(result).toEqual({
      ok: true,
      preferences: expect.objectContaining({
        lastRemoteGeneration: 456,
        lastSyncedAt: "2026-03-20T08:12:00.000Z",
        setupStatus: "connected",
      }),
    });
    expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1);
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(dayLog);
    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        lastRemoteGeneration: 456,
      }),
    );
  });

  it("clears only the auth session when disconnecting an existing sync account", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
      normalizedEndpoint: "http://192.168.1.20:8080",
      deviceLabel: "Pixel 7",
      setupStatus: "connected" as const,
      preparedAt: "2026-03-20T08:00:00.000Z",
    };
    const logout = jest.fn().mockResolvedValue({ ok: true });
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        logout,
      }),
    );

    const result = await disconnectSyncAccount(
      storage,
      secretStore,
      preferences,
      apiClientFactory,
    );

    expect(result).toEqual({
      ok: true,
      preferences: expect.objectContaining({
        setupStatus: "local_ready",
      }),
    });
    expect(logout).toHaveBeenCalledWith("session-1");
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        authSessionToken: null,
      }),
    );
  });

  it("clears both managed and sync sessions when disconnecting managed cloud access", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "sync-session-1",
      managedAuthSessionToken: "managed-session-1",
    });
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
      normalizedEndpoint: "https://sync.ovumcy.cloud",
      deviceLabel: "Pixel 7",
      setupStatus: "connected" as const,
      preparedAt: "2026-03-20T08:00:00.000Z",
    };
    const syncLogout = jest.fn().mockResolvedValue({ ok: true });
    const managedLogout = jest.fn().mockResolvedValue({ ok: true });

    const result = await disconnectSyncAccount(
      storage,
      secretStore,
      preferences,
      jest.fn().mockReturnValue(
        createAPIClientMock({
          logout: syncLogout,
        }),
      ),
      jest.fn().mockReturnValue(
        createManagedClientMock({
          logout: managedLogout,
        }),
      ),
    );

    expect(result).toEqual({
      ok: true,
      preferences: expect.objectContaining({
        setupStatus: "local_ready",
      }),
    });
    expect(syncLogout).toHaveBeenCalledWith("sync-session-1");
    expect(managedLogout).toHaveBeenCalledWith("managed-session-1");
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        authSessionToken: null,
        managedAuthSessionToken: null,
      }),
    );
  });
});

function createAPIClientMock(
  overrides: Partial<SyncAPIClient> = {},
): SyncAPIClient {
  return {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    getCapabilities: jest.fn(),
    getRecoveryKey: jest.fn(),
    attachDevice: jest.fn(),
    // Default to "no remote backup yet" so fresh-generation upload tests pass
    // the upload-over-backup probe without an explicit override.
    getBlob: jest
      .fn()
      .mockResolvedValue({ ok: false, errorCode: "blob_not_found" }),
    putRecoveryKey: jest.fn(),
    putBlob: jest.fn(),
    ...overrides,
  } as SyncAPIClient;
}

function createManagedClientMock(
  overrides: Partial<ManagedCloudAPIClient> = {},
): ManagedCloudAPIClient {
  return {
    register: jest.fn(),
    login: jest.fn(),
    getSession: jest.fn(),
    createSyncSession: jest.fn(),
    logout: jest.fn(),
    ...overrides,
  } as ManagedCloudAPIClient;
}

describe("connectSyncAccount recovery code surfacing", () => {
  it("surfaces the recovery code returned by managed register", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({
        register: jest.fn().mockResolvedValue({
          ok: true,
          auth: {
            accountID: "managed-account-1",
            email: "alice@example.com",
            sessionToken: "managed-session-1",
            sessionExpiresAt: "2026-03-21T08:00:00.000Z",
            entitlement: {
              syncAllowed: true,
              source: "default_register",
              updatedAt: "2026-03-20T08:05:00.000Z",
              effectiveAt: "2026-03-20T08:05:00.000Z",
              explanation: "Trial active.",
            },
            recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
          },
        }),
      }),
    );

    const result = await connectSyncAccount(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
      },
      {
        login: "alice@example.com",
        password: "correct horse battery staple",
      },
      "register",
      new Date("2026-03-20T08:05:00.000Z"),
      jest.fn(),
      managedClientFactory,
    );

    expect(result.ok).toBe(true);
    if (result.ok && !("totpChallengeRequired" in result)) {
      expect(result.recoveryCode).toBe(
        "abcd1234abcd1234abcd1234abcd1234",
      );
    }
  });

  it("does not surface a recovery code on managed login", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({
        login: jest.fn().mockResolvedValue({
          ok: true,
          auth: {
            accountID: "managed-account-1",
            email: "alice@example.com",
            sessionToken: "managed-session-1",
            sessionExpiresAt: "2026-03-21T08:00:00.000Z",
            entitlement: {
              syncAllowed: true,
              source: "default_register",
              updatedAt: "2026-03-20T08:05:00.000Z",
              effectiveAt: "2026-03-20T08:05:00.000Z",
              explanation: "Trial active.",
            },
          },
        }),
      }),
    );

    const result = await connectSyncAccount(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
      },
      {
        login: "alice@example.com",
        password: "correct horse battery staple",
      },
      "login",
      new Date("2026-03-20T08:05:00.000Z"),
      jest.fn(),
      managedClientFactory,
    );

    expect(result.ok).toBe(true);
    if (result.ok && !("totpChallengeRequired" in result)) {
      expect(result.recoveryCode).toBeUndefined();
    }
  });
});

describe("finalizeSyncSessionAfterTOTP", () => {
  it("persists the managed session and applies the entitlement from getSession", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-05-17T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const getSession = jest.fn().mockResolvedValue({
      ok: true,
      session: {
        accountID: "managed-account-1",
        email: "alice@example.com",
        sessionExpiresAt: "2026-05-18T08:00:00.000Z",
        entitlement: {
          syncAllowed: true,
          source: "default_register",
          updatedAt: "2026-05-17T08:00:00.000Z",
          effectiveAt: "2026-05-17T08:00:00.000Z",
          explanation: "Trial active.",
        },
      },
    });
    const managedClientFactory = jest
      .fn()
      .mockReturnValue(createManagedClientMock({ getSession }));

    const result = await finalizeSyncSessionAfterTOTP(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
      },
      { sessionToken: "managed-session-after-totp" },
      jest.fn(),
      managedClientFactory,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.capabilities.mode).toBe("managed");
      expect(result.capabilities.syncEnabled).toBe(true);
      expect(result.preferences.setupStatus).toBe("connected");
    }
    expect(getSession).toHaveBeenCalledWith("managed-session-after-totp");
    const storedSecrets = await secretStore.readSyncSecrets();
    expect(storedSecrets?.managedAuthSessionToken).toBe(
      "managed-session-after-totp",
    );
  });

  it("runs the community handshake (capabilities + attachDevice + recovery-key) for self-hosted mode", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-05-17T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const apiClient = createAPIClientMock({
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
          maxBlobBytes: 1024,
        },
      }),
      attachDevice: jest.fn().mockResolvedValue({
        ok: true,
        device: {
          deviceID: preparedSecrets.record.device.deviceID,
          deviceLabel: "Pixel 7",
          createdAt: "2026-05-17T08:00:00.000Z",
          lastSeenAt: "2026-05-17T08:00:00.000Z",
        },
      }),
    });
    const apiClientFactory = jest.fn().mockReturnValue(apiClient);

    const result = await finalizeSyncSessionAfterTOTP(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
      },
      { sessionToken: "community-session-after-totp" },
      apiClientFactory,
      jest.fn(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.capabilities.mode).toBe("self_hosted");
    }
    expect(apiClient.attachDevice).toHaveBeenCalledWith(
      "community-session-after-totp",
      expect.objectContaining({ deviceLabel: "Pixel 7" }),
    );
    const storedSecrets = await secretStore.readSyncSecrets();
    expect(storedSecrets?.authSessionToken).toBe("community-session-after-totp");
  });

  it("rejects empty session tokens", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-05-17T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);

    const result = await finalizeSyncSessionAfterTOTP(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
      },
      { sessionToken: "" },
    );

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
  });
});
