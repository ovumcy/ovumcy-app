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
  listSyncDevices,
  loadConnectedSyncCapabilities,
  persistGuestPartnerSession,
  recoverSyncAccess,
  removeSyncDevice,
  requiresUploadOverBackupConfirmation,
  runSyncRestore,
  runSyncUpload,
  upgradeGuestPartnerAccount,
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

  it("rejects a register password below the minimum before any network call", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const apiClientFactory = jest.fn();
    const managedClientFactory = jest.fn();

    const result = await connectSyncAccount(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
        preparedAt: "2026-03-20T08:00:00.000Z",
      },
      { login: "alice", password: "short" },
      "register",
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "password_too_short" });
    expect(apiClientFactory).not.toHaveBeenCalled();
    expect(managedClientFactory).not.toHaveBeenCalled();
  });

  it("does NOT pre-validate password length on login (legacy short passwords stay the server's call)", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    // A short password on login must reach the client, which surfaces the
    // server's invalid_credentials rather than a client-side length error.
    const login = jest
      .fn()
      .mockResolvedValue({ ok: false, errorCode: "invalid_credentials" });
    const apiClientFactory = jest
      .fn()
      .mockReturnValue(createAPIClientMock({ login }));

    const result = await connectSyncAccount(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
        preparedAt: "2026-03-20T08:00:00.000Z",
      },
      { login: "alice", password: "short" },
      "login",
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
      jest.fn(),
    );

    expect(result).toEqual({ ok: false, errorCode: "invalid_credentials" });
    expect(login).toHaveBeenCalledTimes(1);
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
    listDevices: jest.fn(),
    removeDevice: jest.fn(),
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

describe("persistGuestPartnerSession", () => {
  it("generates a fresh SyncSecretsRecord on a device with no prior secrets and forces managed/connected preferences", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(null);

    const result = await persistGuestPartnerSession(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
      },
      {
        sessionToken: "guest-session-1",
        sessionExpiresAt: "2026-05-05T08:00:00.000Z",
      },
      new Date("2026-04-05T08:00:00.000Z"),
    );

    expect(result).toEqual({
      capabilities: expect.objectContaining({
        mode: "managed",
        syncEnabled: false,
      }),
      preferences: expect.objectContaining({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        setupStatus: "connected",
        // The ONLY local guest-partner marker: persisted from the
        // guest-accept response so the client can detect guest mode without
        // any extra network round trip. With no refresh token in the
        // response this is the session's own expiry, and the countdown it
        // drives is accurate.
        guestSessionExpiresAt: "2026-05-05T08:00:00.000Z",
        guestSessionRenewable: false,
      }),
    });

    const storedSecrets = await secretStore.readSyncSecrets();
    expect(storedSecrets).toEqual(
      expect.objectContaining({
        authSessionToken: null,
        managedAuthSessionToken: "guest-session-1",
      }),
    );
    // A fresh device gets real device/master-key material — the same shape
    // prepareSyncSetup would have produced — not a degenerate placeholder.
    expect(storedSecrets?.masterKeyHex.length).toBeGreaterThan(0);
    expect(storedSecrets?.device.deviceID.length).toBeGreaterThan(0);

    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "managed", setupStatus: "connected" }),
    );
    // New account boundary: the billing cache is reset exactly like a normal
    // managed connect resets it.
    expect(storage.writeManagedBillingCacheRecord).toHaveBeenCalledTimes(1);
  });

  it("persists the refresh material a renewable guest received and marks the session renewable", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(null);

    const result = await persistGuestPartnerSession(
      storage,
      secretStore,
      createDefaultSyncPreferencesRecord(),
      {
        sessionToken: "guest-session-3",
        sessionExpiresAt: "2026-04-06T08:00:00.000Z",
        refreshToken: "guest-refresh-3",
        refreshTokenExpiresAt: "2026-07-04T08:00:00.000Z",
      },
      new Date("2026-04-05T08:00:00.000Z"),
    );

    // A guest account has no password, so a short session persisted without
    // the token that renews it would strand the device.
    const storedSecrets = await secretStore.readSyncSecrets();
    expect(storedSecrets).toEqual(
      expect.objectContaining({
        managedAuthSessionToken: "guest-session-3",
        managedAuthSessionExpiresAt: "2026-04-06T08:00:00.000Z",
        managedRefreshToken: "guest-refresh-3",
        managedRefreshTokenExpiresAt: "2026-07-04T08:00:00.000Z",
      }),
    );

    // The marker records the deadline the device faces if it does nothing —
    // the refresh token's, not the 24h session's — and flags that the
    // deadline slides, so the nudge withholds a countdown.
    expect(result.preferences).toEqual(
      expect.objectContaining({
        guestSessionExpiresAt: "2026-07-04T08:00:00.000Z",
        guestSessionRenewable: true,
      }),
    );
  });

  it("clears refresh material left by an earlier owner session when the guest cannot renew", async () => {
    const storage = createLocalAppStorageMock();
    const prepared = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-19T08:15:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...prepared.record,
      managedAuthSessionToken: "previous-owner-session",
      managedAuthSessionExpiresAt: "2026-04-06T08:00:00.000Z",
      managedRefreshToken: "previous-owner-refresh",
      managedRefreshTokenExpiresAt: "2026-07-04T08:00:00.000Z",
    });

    const result = await persistGuestPartnerSession(
      storage,
      secretStore,
      createDefaultSyncPreferencesRecord(),
      {
        sessionToken: "guest-session-4",
        sessionExpiresAt: "2026-05-05T08:00:00.000Z",
      },
      new Date("2026-04-05T08:00:00.000Z"),
    );

    // Inheriting the previous account's refresh token would let this guest
    // session mint sessions for someone else's account.
    const storedSecrets = await secretStore.readSyncSecrets();
    expect(storedSecrets).toEqual(
      expect.objectContaining({
        managedAuthSessionToken: "guest-session-4",
        managedAuthSessionExpiresAt: null,
        managedRefreshToken: null,
        managedRefreshTokenExpiresAt: null,
      }),
    );
    expect(result.preferences.guestSessionRenewable).toBe(false);
  });

  it("keeps an already-prepared device's master key and device identity untouched", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-19T08:15:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);

    await persistGuestPartnerSession(
      storage,
      secretStore,
      { ...createDefaultSyncPreferencesRecord(), mode: "managed" },
      {
        sessionToken: "guest-session-2",
        sessionExpiresAt: "2026-05-05T08:00:00.000Z",
      },
      new Date("2026-04-05T08:00:00.000Z"),
    );

    const storedSecrets = await secretStore.readSyncSecrets();
    expect(storedSecrets).toEqual({
      ...preparedSecrets.record,
      authSessionToken: null,
      managedAuthSessionToken: "guest-session-2",
    });
  });
});

describe("upgradeGuestPartnerAccount", () => {
  const guestPreferences = {
    ...createDefaultSyncPreferencesRecord(),
    mode: "managed" as const,
    setupStatus: "connected" as const,
    guestSessionExpiresAt: "2026-05-05T08:00:00.000Z",
  };

  it("returns unauthorized and makes no network call when the device has no managed session", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(null);
    const managedClientFactory = jest.fn();

    const result = await upgradeGuestPartnerAccount(
      storage,
      secretStore,
      guestPreferences,
      { email: "owner@example.com", password: "very secure password 12345" },
      managedClientFactory,
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "unauthorized",
      preferences: guestPreferences,
    });
    expect(managedClientFactory).not.toHaveBeenCalled();
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("on success clears the local guest marker and surfaces the account/email/recovery code", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-04-05T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      managedAuthSessionToken: "guest-session-1",
    });
    const upgradeGuestAccount = jest.fn().mockResolvedValue({
      ok: true,
      result: {
        accountID: "guest-account-1",
        email: "owner@example.com",
        recoveryCode: "fresh1234fresh1234fresh1234fresh",
      },
    });
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({ upgradeGuestAccount }),
    );

    const result = await upgradeGuestPartnerAccount(
      storage,
      secretStore,
      guestPreferences,
      { email: "  owner@example.com  ", password: "very secure password 12345" },
      managedClientFactory,
    );

    expect(result).toEqual({
      ok: true,
      accountID: "guest-account-1",
      email: "owner@example.com",
      recoveryCode: "fresh1234fresh1234fresh1234fresh",
      preferences: { ...guestPreferences, guestSessionExpiresAt: null },
    });
    // The email is trimmed before it reaches the server, and auth uses the
    // guest's CURRENT session token — upgrade never mints or reads a new one.
    expect(upgradeGuestAccount).toHaveBeenCalledWith("guest-session-1", {
      email: "owner@example.com",
      password: "very secure password 12345",
    });
    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith({
      ...guestPreferences,
      guestSessionExpiresAt: null,
    });
    // No secrets write: the session token that already authenticated this
    // call keeps authenticating every subsequent one, and the master
    // key/device identity stay exactly as prepared.
    await expect(secretStore.readSyncSecrets()).resolves.toEqual({
      ...preparedSecrets.record,
      managedAuthSessionToken: "guest-session-1",
    });
  });

  it("clears the local guest marker on account_not_guest even though the call failed", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock({
      ...createSyncSecretsRecord("Pixel 7", new Date("2026-04-05T08:00:00.000Z")).record,
      managedAuthSessionToken: "guest-session-1",
    });
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({
        upgradeGuestAccount: jest
          .fn()
          .mockResolvedValue({ ok: false, errorCode: "account_not_guest" }),
      }),
    );

    const result = await upgradeGuestPartnerAccount(
      storage,
      secretStore,
      guestPreferences,
      { email: "owner@example.com", password: "very secure password 12345" },
      managedClientFactory,
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "account_not_guest",
      preferences: { ...guestPreferences, guestSessionExpiresAt: null },
    });
    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith({
      ...guestPreferences,
      guestSessionExpiresAt: null,
    });
  });

  it.each([
    ["invalid_registration_input", "invalid_registration_input"],
    ["registration_failed", "registration_failed"],
    ["rate_limited", "rate_limited"],
    ["network_failed", "network_failed"],
    ["unauthorized", "unauthorized"],
    ["totp_not_configured", "generic"],
  ])(
    "maps API error %s to %s and leaves local state untouched",
    async (apiErrorCode, expectedErrorCode) => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock({
        ...createSyncSecretsRecord("Pixel 7", new Date("2026-04-05T08:00:00.000Z")).record,
        managedAuthSessionToken: "guest-session-1",
      });
      const managedClientFactory = jest.fn().mockReturnValue(
        createManagedClientMock({
          upgradeGuestAccount: jest.fn().mockResolvedValue({
            ok: false,
            errorCode: apiErrorCode,
          }),
        }),
      );

      const result = await upgradeGuestPartnerAccount(
        storage,
        secretStore,
        guestPreferences,
        { email: "owner@example.com", password: "very secure password 12345" },
        managedClientFactory,
      );

      expect(result).toEqual({
        ok: false,
        errorCode: expectedErrorCode,
        preferences: guestPreferences,
      });
      expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
    },
  );
});

describe("sync device management", () => {
  const selfHostedPreferences = {
    ...createDefaultSyncPreferencesRecord(),
    mode: "self_hosted" as const,
    endpointInput: "192.168.1.20:8080",
    normalizedEndpoint: "http://192.168.1.20:8080",
    deviceLabel: "Pixel 7",
    setupStatus: "connected" as const,
  };
  const managedPreferences = {
    ...createDefaultSyncPreferencesRecord(),
    mode: "managed" as const,
    normalizedEndpoint: "https://sync.ovumcy.cloud",
    deviceLabel: "Pixel 7",
    setupStatus: "connected" as const,
  };

  it("lists devices for a self-hosted session and reports this install's device id", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const listDevices = jest.fn().mockResolvedValue({
      ok: true,
      devices: [
        {
          deviceID: preparedSecrets.record.device.deviceID,
          deviceLabel: "Pixel 7",
          createdAt: "2026-03-19T08:00:00.000Z",
          lastSeenAt: "2026-03-20T08:00:00.000Z",
        },
        {
          deviceID: "device-2",
          deviceLabel: "Old tablet",
          createdAt: "2026-03-20T09:00:00.000Z",
          lastSeenAt: "2026-03-20T09:30:00.000Z",
        },
      ],
    });
    const apiClientFactory = jest
      .fn()
      .mockReturnValue(createAPIClientMock({ listDevices }));

    const result = await listSyncDevices(
      secretStore,
      selfHostedPreferences,
      apiClientFactory,
    );

    expect(result).toEqual({
      ok: true,
      devices: [
        expect.objectContaining({
          deviceID: preparedSecrets.record.device.deviceID,
        }),
        expect.objectContaining({ deviceID: "device-2" }),
      ],
      currentDeviceID: preparedSecrets.record.device.deviceID,
    });
    expect(listDevices).toHaveBeenCalledWith("session-1");
  });

  it("lists devices in managed mode through a bridge-minted sync session", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      managedAuthSessionToken: "managed-session-1",
    });
    const listDevices = jest.fn().mockResolvedValue({ ok: true, devices: [] });
    const apiClientFactory = jest
      .fn()
      .mockReturnValue(createAPIClientMock({ listDevices }));
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({
        getSession: jest.fn().mockResolvedValue({
          ok: true,
          session: {
            accountID: "managed-account-1",
            email: "alice@example.com",
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
            accountID: "sync-account-1",
            sessionToken: "bridged-session-1",
            sessionExpiresAt: "2026-03-20T09:00:00.000Z",
          },
        }),
      }),
    );

    const result = await listSyncDevices(
      secretStore,
      managedPreferences,
      apiClientFactory,
      managedClientFactory,
    );

    expect(result).toEqual({
      ok: true,
      devices: [],
      currentDeviceID: preparedSecrets.record.device.deviceID,
    });
    expect(listDevices).toHaveBeenCalledWith("bridged-session-1");
  });

  it("flags removal of the current device and passes the id to the server", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const removeDevice = jest.fn().mockResolvedValue({ ok: true });
    const apiClientFactory = jest
      .fn()
      .mockReturnValue(createAPIClientMock({ removeDevice }));

    const otherResult = await removeSyncDevice(
      secretStore,
      selfHostedPreferences,
      "device-2",
      apiClientFactory,
    );
    const currentResult = await removeSyncDevice(
      secretStore,
      selfHostedPreferences,
      preparedSecrets.record.device.deviceID,
      apiClientFactory,
    );

    expect(otherResult).toEqual({ ok: true, removedCurrentDevice: false });
    expect(currentResult).toEqual({ ok: true, removedCurrentDevice: true });
    expect(removeDevice).toHaveBeenNthCalledWith(1, "session-1", {
      deviceID: "device-2",
    });
    expect(removeDevice).toHaveBeenNthCalledWith(2, "session-1", {
      deviceID: preparedSecrets.record.device.deviceID,
    });
  });

  it("keeps device_not_found distinct and collapses rate_limited to generic", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const removeDevice = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, errorCode: "device_not_found" })
      .mockResolvedValueOnce({ ok: false, errorCode: "rate_limited" });
    const apiClientFactory = jest
      .fn()
      .mockReturnValue(createAPIClientMock({ removeDevice }));

    await expect(
      removeSyncDevice(
        secretStore,
        selfHostedPreferences,
        "device-9",
        apiClientFactory,
      ),
    ).resolves.toEqual({ ok: false, errorCode: "device_not_found" });
    await expect(
      removeSyncDevice(
        secretStore,
        selfHostedPreferences,
        "device-9",
        apiClientFactory,
      ),
    ).resolves.toEqual({ ok: false, errorCode: "generic" });
  });

  it("fails with not_connected before any network call when no sync session exists", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const apiClientFactory = jest.fn();

    const result = await listSyncDevices(
      secretStore,
      selfHostedPreferences,
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "not_connected" });
    expect(apiClientFactory).not.toHaveBeenCalled();
  });
});

describe("connectSyncAccount input validation", () => {
  it("requires a non-empty login before any network call", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(
      createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z")).record,
    );
    const apiClientFactory = jest.fn();
    const managedClientFactory = jest.fn();

    const result = await connectSyncAccount(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
      },
      { login: "   ", password: "correct horse battery staple" },
      "login",
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "login_required" });
    expect(apiClientFactory).not.toHaveBeenCalled();
    expect(managedClientFactory).not.toHaveBeenCalled();
  });

  it("requires a non-empty password before any network call", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(
      createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z")).record,
    );
    const managedClientFactory = jest.fn();

    const result = await connectSyncAccount(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
      },
      { login: "alice@example.com", password: "" },
      "login",
      new Date("2026-03-20T08:05:00.000Z"),
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "password_required" });
    expect(managedClientFactory).not.toHaveBeenCalled();
  });

  it("passes through a self-hosted endpoint normalization failure before any network call", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(
      createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z")).record,
    );
    const apiClientFactory = jest.fn();

    const result = await connectSyncAccount(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "   ",
        deviceLabel: "Pixel 7",
      },
      { login: "alice", password: "correct horse battery staple" },
      "login",
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
      jest.fn(),
    );

    expect(result).toEqual({ ok: false, errorCode: "endpoint_required" });
    expect(apiClientFactory).not.toHaveBeenCalled();
  });

  it("returns sync_not_prepared when local sync secrets are missing", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(null);
    const apiClientFactory = jest.fn();
    const managedClientFactory = jest.fn();

    const result = await connectSyncAccount(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
      },
      { login: "alice@example.com", password: "correct horse battery staple" },
      "login",
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    expect(apiClientFactory).not.toHaveBeenCalled();
    expect(managedClientFactory).not.toHaveBeenCalled();
  });
});

describe("connectSyncAccount TOTP challenge handoff", () => {
  it("returns totpChallengeRequired for managed login without persisting a session", async () => {
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
            sessionToken: "",
            sessionExpiresAt: "2026-03-21T08:00:00.000Z",
            entitlement: {
              syncAllowed: true,
              source: "manual",
              updatedAt: "2026-03-20T08:05:00.000Z",
              effectiveAt: "2026-03-20T08:05:00.000Z",
              explanation: "beta access",
            },
            totpChallenge: {
              challengeID: "challenge-1",
              challengeExpiresAt: "2026-03-20T08:15:00.000Z",
            },
          },
        }),
      }),
    );
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
      deviceLabel: "Pixel 7",
    };

    const result = await connectSyncAccount(
      storage,
      secretStore,
      preferences,
      { login: "alice@example.com", password: "correct horse battery staple" },
      "login",
      new Date("2026-03-20T08:05:00.000Z"),
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({
      ok: true,
      totpChallengeRequired: true,
      challengeID: "challenge-1",
      challengeExpiresAt: "2026-03-20T08:15:00.000Z",
      accountID: "managed-account-1",
      preferences,
    });
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(preparedSecrets.record);
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("returns totpChallengeRequired for self-hosted login without persisting a session", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        login: jest.fn().mockResolvedValue({
          ok: true,
          auth: {
            accountID: "account-1",
            sessionToken: "",
            sessionExpiresAt: "2026-03-21T08:00:00.000Z",
            totpChallenge: {
              challengeID: "challenge-2",
              challengeExpiresAt: "2026-03-20T08:15:00.000Z",
            },
          },
        }),
      }),
    );
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
      deviceLabel: "Pixel 7",
    };

    const result = await connectSyncAccount(
      storage,
      secretStore,
      preferences,
      { login: "alice", password: "correct horse battery staple" },
      "login",
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
      jest.fn(),
    );

    expect(result).toEqual({
      ok: true,
      totpChallengeRequired: true,
      challengeID: "challenge-2",
      challengeExpiresAt: "2026-03-20T08:15:00.000Z",
      accountID: "account-1",
      preferences,
    });
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(preparedSecrets.record);
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });
});

describe("connectSyncAccount self-hosted handshake failures", () => {
  it("maps a getCapabilities failure during connect", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
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
        getCapabilities: jest.fn().mockResolvedValue({ ok: false, errorCode: "unauthorized" }),
      }),
    );

    const result = await connectSyncAccount(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
      },
      { login: "alice", password: "correct horse battery staple" },
      "register",
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
  });

  it("maps an attachDevice failure during connect", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
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
            recoverySupported: false,
            pushSupported: false,
            portalSupported: false,
            advancedCloudInsights: false,
            maxDevices: 5,
            maxBlobBytes: 1024,
          },
        }),
        attachDevice: jest.fn().mockResolvedValue({ ok: false, errorCode: "too_many_devices" }),
      }),
    );

    const result = await connectSyncAccount(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
      },
      { login: "alice", password: "correct horse battery staple" },
      "register",
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "too_many_devices" });
  });

  it("maps a recovery-key sync failure during connect", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
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
            deviceLabel: "Pixel 7",
            createdAt: "2026-03-20T08:00:00.000Z",
            lastSeenAt: "2026-03-20T08:00:00.000Z",
          },
        }),
        putRecoveryKey: jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" }),
      }),
    );

    const result = await connectSyncAccount(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
      },
      { login: "alice", password: "correct horse battery staple" },
      "register",
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "network_failed" });
  });

  it("surfaces the recovery code returned by self-hosted register", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        register: jest.fn().mockResolvedValue({
          ok: true,
          auth: {
            accountID: "account-1",
            sessionToken: "session-1",
            sessionExpiresAt: "2026-03-21T08:00:00.000Z",
            recoveryCode: "self1234self1234self1234self1234",
          },
        }),
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
            createdAt: "2026-03-20T08:00:00.000Z",
            lastSeenAt: "2026-03-20T08:00:00.000Z",
          },
        }),
      }),
    );

    const result = await connectSyncAccount(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
      },
      { login: "alice", password: "correct horse battery staple" },
      "register",
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
    );

    expect(result.ok).toBe(true);
    if (result.ok && !("totpChallengeRequired" in result)) {
      expect(result.recoveryCode).toBe("self1234self1234self1234self1234");
    }
  });
});

describe("connectSyncAccount error mapping", () => {
  it.each([
    ["invalid_registration_input", "invalid_registration_input"],
    ["registration_failed", "registration_failed"],
    ["invalid_credentials", "invalid_credentials"],
    ["unauthorized", "unauthorized"],
    ["too_many_devices", "too_many_devices"],
    ["network_failed", "network_failed"],
    ["rate_limited", "generic"],
  ])(
    "maps self-hosted register API error %s to %s",
    async (apiErrorCode, expectedErrorCode) => {
      const storage = createLocalAppStorageMock();
      const preparedSecrets = createSyncSecretsRecord(
        "Pixel 7",
        new Date("2026-03-20T08:00:00.000Z"),
      );
      const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
      const apiClientFactory = jest.fn().mockReturnValue(
        createAPIClientMock({
          register: jest.fn().mockResolvedValue({ ok: false, errorCode: apiErrorCode }),
        }),
      );

      const result = await connectSyncAccount(
        storage,
        secretStore,
        {
          ...createDefaultSyncPreferencesRecord(),
          mode: "self_hosted",
          endpointInput: "192.168.1.20:8080",
          deviceLabel: "Pixel 7",
        },
        { login: "alice", password: "correct horse battery staple" },
        "register",
        new Date("2026-03-20T08:05:00.000Z"),
        apiClientFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: expectedErrorCode });
    },
  );

  it.each([
    ["invalid_registration_input", "invalid_registration_input"],
    ["registration_failed", "registration_failed"],
    ["invalid_credentials", "invalid_credentials"],
    ["unauthorized", "unauthorized"],
    ["sync_not_allowed", "sync_not_allowed"],
    ["network_failed", "network_failed"],
    ["sync_bridge_unavailable", "network_failed"],
    ["totp_not_configured", "generic"],
  ])(
    "maps managed register API error %s to %s",
    async (apiErrorCode, expectedErrorCode) => {
      const storage = createLocalAppStorageMock();
      const preparedSecrets = createSyncSecretsRecord(
        "Pixel 7",
        new Date("2026-03-20T08:00:00.000Z"),
      );
      const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
      const managedClientFactory = jest.fn().mockReturnValue(
        createManagedClientMock({
          register: jest.fn().mockResolvedValue({ ok: false, errorCode: apiErrorCode }),
        }),
      );

      const result = await connectSyncAccount(
        storage,
        secretStore,
        {
          ...createDefaultSyncPreferencesRecord(),
          mode: "managed",
          deviceLabel: "Pixel 7",
        },
        { login: "alice@example.com", password: "correct horse battery staple" },
        "register",
        new Date("2026-03-20T08:05:00.000Z"),
        jest.fn(),
        managedClientFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: expectedErrorCode });
    },
  );
});

describe("finalizeSyncSessionAfterTOTP additional branches", () => {
  it("passes through a self-hosted endpoint normalization failure", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-05-17T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const apiClientFactory = jest.fn();

    const result = await finalizeSyncSessionAfterTOTP(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "   ",
        deviceLabel: "Pixel 7",
      },
      { sessionToken: "community-session-after-totp" },
      apiClientFactory,
      jest.fn(),
    );

    expect(result).toEqual({ ok: false, errorCode: "endpoint_required" });
    expect(apiClientFactory).not.toHaveBeenCalled();
  });

  it("returns sync_not_prepared when local sync secrets are missing", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(null);

    const result = await finalizeSyncSessionAfterTOTP(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
      },
      { sessionToken: "managed-session-after-totp" },
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
  });

  it("maps a managed getSession failure during finalize", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-05-17T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({
        getSession: jest.fn().mockResolvedValue({ ok: false, errorCode: "unauthorized" }),
      }),
    );

    const result = await finalizeSyncSessionAfterTOTP(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
      },
      { sessionToken: "managed-session-after-totp" },
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
  });

  it("maps a self-hosted getCapabilities failure during finalize", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-05-17T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        getCapabilities: jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" }),
      }),
    );

    const result = await finalizeSyncSessionAfterTOTP(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
      },
      { sessionToken: "community-session-after-totp" },
      apiClientFactory,
      jest.fn(),
    );

    expect(result).toEqual({ ok: false, errorCode: "network_failed" });
  });

  it("maps a self-hosted attachDevice failure during finalize", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-05-17T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
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
        attachDevice: jest.fn().mockResolvedValue({ ok: false, errorCode: "too_many_devices" }),
      }),
    );

    const result = await finalizeSyncSessionAfterTOTP(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
      },
      { sessionToken: "community-session-after-totp" },
      apiClientFactory,
      jest.fn(),
    );

    expect(result).toEqual({ ok: false, errorCode: "too_many_devices" });
  });

  it("maps a self-hosted recovery-key sync failure during finalize", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-05-17T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
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
        attachDevice: jest.fn().mockResolvedValue({
          ok: true,
          device: {
            deviceID: preparedSecrets.record.device.deviceID,
            deviceLabel: "Pixel 7",
            createdAt: "2026-05-17T08:00:00.000Z",
            lastSeenAt: "2026-05-17T08:00:00.000Z",
          },
        }),
        putRecoveryKey: jest.fn().mockResolvedValue({ ok: false, errorCode: "unauthorized" }),
      }),
    );

    const result = await finalizeSyncSessionAfterTOTP(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
      },
      { sessionToken: "community-session-after-totp" },
      apiClientFactory,
      jest.fn(),
    );

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
  });
});

describe("loadConnectedSyncCapabilities additional branches", () => {
  it("returns unauthorized without any network call when the managed session token is missing", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const managedClientFactory = jest.fn();

    const result = await loadConnectedSyncCapabilities(
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
      },
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
    expect(managedClientFactory).not.toHaveBeenCalled();
  });

  it("maps a self-hosted prepared-context failure to sync_not_prepared", async () => {
    const secretStore = createSyncSecretStoreMock(null);

    const result = await loadConnectedSyncCapabilities(
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
      },
      jest.fn(),
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
  });

  it("collapses a self-hosted not_connected prepared-context failure to generic", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);

    const result = await loadConnectedSyncCapabilities(
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
      },
      jest.fn(),
    );

    expect(result).toEqual({ ok: false, errorCode: "generic" });
  });

  it("maps a self-hosted getCapabilities failure", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        getCapabilities: jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" }),
      }),
    );

    const result = await loadConnectedSyncCapabilities(
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
      },
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "network_failed" });
  });

  it("keeps the community sync-bridge token when the managed refresh still confirms entitlement", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "bridged-sync-session",
      managedAuthSessionToken: "managed-session-1",
    });
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({
        getSession: jest.fn().mockResolvedValue({
          ok: true,
          session: {
            accountID: "managed-account-1",
            email: "alice@example.com",
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

    const result = await loadConnectedSyncCapabilities(
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
      },
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({
      ok: true,
      capabilities: expect.objectContaining({ mode: "managed", syncEnabled: true }),
    });
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({ authSessionToken: "bridged-sync-session" }),
    );
  });

  it("returns capabilities for a successful self-hosted lookup", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
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
      }),
    );

    const result = await loadConnectedSyncCapabilities(
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
      },
      apiClientFactory,
    );

    expect(result).toEqual({
      ok: true,
      capabilities: expect.objectContaining({ mode: "self_hosted", syncEnabled: true }),
    });
  });

  it("clears local session tokens and returns unauthorized when the managed session is invalid", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "stale-session",
      managedAuthSessionToken: "managed-session-1",
    });
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({
        getSession: jest.fn().mockResolvedValue({ ok: false, errorCode: "unauthorized" }),
      }),
    );

    const result = await loadConnectedSyncCapabilities(
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
      },
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({ authSessionToken: null, managedAuthSessionToken: null }),
    );
  });

  it("maps a managed getSession failure without clearing local secrets for other error codes", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      managedAuthSessionToken: "managed-session-1",
    });
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({
        getSession: jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" }),
      }),
    );

    const result = await loadConnectedSyncCapabilities(
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
      },
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "network_failed" });
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({ managedAuthSessionToken: "managed-session-1" }),
    );
  });
});

describe("recoverSyncAccess input validation", () => {
  it("requires a non-empty login before any network call", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const apiClientFactory = jest.fn();

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Recovered Pixel",
      },
      { login: "   ", password: "correct horse battery staple" },
      "",
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "login_required" });
    expect(apiClientFactory).not.toHaveBeenCalled();
  });

  it("requires a non-empty password before any network call", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Recovered Pixel",
      },
      { login: "alice@example.com", password: "" },
      "",
      new Date("2026-03-20T08:05:00.000Z"),
      jest.fn(),
    );

    expect(result).toEqual({ ok: false, errorCode: "password_required" });
  });

  it("requires a non-empty device label before any network call", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "   ",
      },
      { login: "alice@example.com", password: "correct horse battery staple" },
      "",
      new Date("2026-03-20T08:05:00.000Z"),
      jest.fn(),
    );

    expect(result).toEqual({ ok: false, errorCode: "device_label_required" });
  });

  it("requires a non-empty recovery phrase before any network call", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Recovered Pixel",
      },
      { login: "alice@example.com", password: "correct horse battery staple" },
      "   ",
      new Date("2026-03-20T08:05:00.000Z"),
      jest.fn(),
    );

    expect(result).toEqual({ ok: false, errorCode: "recovery_phrase_required" });
  });

  it("passes through a self-hosted endpoint normalization failure before any network call", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const validPhrase = createSyncSecretsRecord(
      "Original device",
      new Date("2026-03-20T08:00:00.000Z"),
    ).recoveryPhrase;
    const apiClientFactory = jest.fn();

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "   ",
        deviceLabel: "Recovered Pixel",
      },
      { login: "alice@example.com", password: "correct horse battery staple" },
      validPhrase,
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "endpoint_required" });
    expect(apiClientFactory).not.toHaveBeenCalled();
  });
});

describe("recoverSyncAccess managed failures", () => {
  const managedRecoverPreferences = {
    ...createDefaultSyncPreferencesRecord(),
    mode: "managed" as const,
    deviceLabel: "Recovered Pixel",
  };

  function managedLoginAndSyncSessionSuccessFactory() {
    return jest.fn().mockReturnValue(
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
  }

  it.each([
    ["invalid_credentials", "invalid_credentials"],
    ["unauthorized", "unauthorized"],
    ["sync_not_allowed", "sync_not_allowed"],
    ["network_failed", "network_failed"],
    ["sync_bridge_unavailable", "network_failed"],
    ["totp_not_configured", "generic"],
  ])(
    "maps managed login failure %s to %s",
    async (apiErrorCode, expectedErrorCode) => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock();
      const validPhrase = createSyncSecretsRecord(
        "Original device",
        new Date("2026-03-20T08:00:00.000Z"),
      ).recoveryPhrase;
      const managedClientFactory = jest.fn().mockReturnValue(
        createManagedClientMock({
          login: jest.fn().mockResolvedValue({ ok: false, errorCode: apiErrorCode }),
        }),
      );

      const result = await recoverSyncAccess(
        storage,
        secretStore,
        managedRecoverPreferences,
        { login: "alice@example.com", password: "correct horse battery staple" },
        validPhrase,
        new Date("2026-03-20T08:05:00.000Z"),
        jest.fn(),
        managedClientFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: expectedErrorCode });
    },
  );

  it("returns sync_not_allowed without minting a sync session when the managed account has no sync entitlement", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const validPhrase = createSyncSecretsRecord(
      "Original device",
      new Date("2026-03-20T08:00:00.000Z"),
    ).recoveryPhrase;
    const createSyncSession = jest.fn();
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
              syncAllowed: false,
              source: "manual",
              updatedAt: "2026-03-20T08:05:00.000Z",
              effectiveAt: "2026-03-20T08:05:00.000Z",
              explanation: "plan inactive",
            },
          },
        }),
        createSyncSession,
      }),
    );

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      managedRecoverPreferences,
      { login: "alice@example.com", password: "correct horse battery staple" },
      validPhrase,
      new Date("2026-03-20T08:05:00.000Z"),
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_allowed" });
    expect(createSyncSession).not.toHaveBeenCalled();
  });

  it("maps a managed createSyncSession failure", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const validPhrase = createSyncSecretsRecord(
      "Original device",
      new Date("2026-03-20T08:00:00.000Z"),
    ).recoveryPhrase;
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
        createSyncSession: jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" }),
      }),
    );

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      managedRecoverPreferences,
      { login: "alice@example.com", password: "correct horse battery staple" },
      validPhrase,
      new Date("2026-03-20T08:05:00.000Z"),
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "network_failed" });
  });

  it("maps a managed getRecoveryKey failure", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const validPhrase = createSyncSecretsRecord(
      "Original device",
      new Date("2026-03-20T08:00:00.000Z"),
    ).recoveryPhrase;
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        getRecoveryKey: jest
          .fn()
          .mockResolvedValue({ ok: false, errorCode: "recovery_package_not_found" }),
      }),
    );

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      managedRecoverPreferences,
      { login: "alice@example.com", password: "correct horse battery staple" },
      validPhrase,
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
      managedLoginAndSyncSessionSuccessFactory(),
    );

    expect(result).toEqual({ ok: false, errorCode: "recovery_package_not_found" });
  });

  it("returns invalid_recovery_phrase when the phrase does not match the account's wrapped key", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const wrongAccountSecrets = createSyncSecretsRecord(
      "Some other device",
      new Date("2026-03-19T08:00:00.000Z"),
    );
    const wrappedKeyOnServer = createSyncSecretsRecord(
      "Original device",
      new Date("2026-03-20T08:00:00.000Z"),
    ).record.wrappedKey;
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        getRecoveryKey: jest.fn().mockResolvedValue({ ok: true, recoveryKey: wrappedKeyOnServer }),
      }),
    );

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      managedRecoverPreferences,
      { login: "alice@example.com", password: "correct horse battery staple" },
      wrongAccountSecrets.recoveryPhrase,
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
      managedLoginAndSyncSessionSuccessFactory(),
    );

    expect(result).toEqual({ ok: false, errorCode: "invalid_recovery_phrase" });
  });

  it("maps a managed attachDevice failure", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const originalSecrets = createSyncSecretsRecord(
      "Original device",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        getRecoveryKey: jest
          .fn()
          .mockResolvedValue({ ok: true, recoveryKey: originalSecrets.record.wrappedKey }),
        attachDevice: jest.fn().mockResolvedValue({ ok: false, errorCode: "too_many_devices" }),
      }),
    );

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      managedRecoverPreferences,
      { login: "alice@example.com", password: "correct horse battery staple" },
      originalSecrets.recoveryPhrase,
      new Date("2026-03-20T08:05:00.000Z"),
      apiClientFactory,
      managedLoginAndSyncSessionSuccessFactory(),
    );

    expect(result).toEqual({ ok: false, errorCode: "too_many_devices" });
  });
});

describe("recoverSyncAccess self-hosted failures", () => {
  const selfHostedRecoverPreferences = {
    ...createDefaultSyncPreferencesRecord(),
    mode: "self_hosted" as const,
    endpointInput: "192.168.1.20:8080",
    deviceLabel: "Recovered Pixel",
  };

  function selfHostedLoginSuccessFactory(overrides: Partial<SyncAPIClient> = {}) {
    return jest.fn().mockReturnValue(
      createAPIClientMock({
        login: jest.fn().mockResolvedValue({
          ok: true,
          auth: {
            accountID: "account-1",
            sessionToken: "session-1",
            sessionExpiresAt: "2026-03-21T08:00:00.000Z",
          },
        }),
        ...overrides,
      }),
    );
  }

  it.each([
    ["invalid_credentials", "invalid_credentials"],
    ["unauthorized", "unauthorized"],
    ["too_many_devices", "too_many_devices"],
    ["network_failed", "network_failed"],
    ["recovery_package_not_found", "recovery_package_not_found"],
    ["rate_limited", "generic"],
  ])(
    "maps self-hosted login failure %s to %s",
    async (apiErrorCode, expectedErrorCode) => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock();
      const validPhrase = createSyncSecretsRecord(
        "Original device",
        new Date("2026-03-20T08:00:00.000Z"),
      ).recoveryPhrase;
      const apiClientFactory = jest.fn().mockReturnValue(
        createAPIClientMock({
          login: jest.fn().mockResolvedValue({ ok: false, errorCode: apiErrorCode }),
        }),
      );

      const result = await recoverSyncAccess(
        storage,
        secretStore,
        selfHostedRecoverPreferences,
        { login: "alice@example.com", password: "correct horse battery staple" },
        validPhrase,
        new Date("2026-03-20T08:05:00.000Z"),
        apiClientFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: expectedErrorCode });
    },
  );

  it("maps a self-hosted getCapabilities failure during recovery", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const validPhrase = createSyncSecretsRecord(
      "Original device",
      new Date("2026-03-20T08:00:00.000Z"),
    ).recoveryPhrase;

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      selfHostedRecoverPreferences,
      { login: "alice@example.com", password: "correct horse battery staple" },
      validPhrase,
      new Date("2026-03-20T08:05:00.000Z"),
      selfHostedLoginSuccessFactory({
        getCapabilities: jest.fn().mockResolvedValue({ ok: false, errorCode: "unauthorized" }),
      }),
    );

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
  });

  it("returns recovery_not_available when the self-hosted server does not support recovery", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const validPhrase = createSyncSecretsRecord(
      "Original device",
      new Date("2026-03-20T08:00:00.000Z"),
    ).recoveryPhrase;

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      selfHostedRecoverPreferences,
      { login: "alice@example.com", password: "correct horse battery staple" },
      validPhrase,
      new Date("2026-03-20T08:05:00.000Z"),
      selfHostedLoginSuccessFactory({
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
      }),
    );

    expect(result).toEqual({ ok: false, errorCode: "recovery_not_available" });
  });

  it("maps a self-hosted getRecoveryKey failure", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const validPhrase = createSyncSecretsRecord(
      "Original device",
      new Date("2026-03-20T08:00:00.000Z"),
    ).recoveryPhrase;

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      selfHostedRecoverPreferences,
      { login: "alice@example.com", password: "correct horse battery staple" },
      validPhrase,
      new Date("2026-03-20T08:05:00.000Z"),
      selfHostedLoginSuccessFactory({
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
        getRecoveryKey: jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" }),
      }),
    );

    expect(result).toEqual({ ok: false, errorCode: "network_failed" });
  });

  it("returns invalid_recovery_phrase when the phrase does not match the account's wrapped key", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const wrongAccountSecrets = createSyncSecretsRecord(
      "Some other device",
      new Date("2026-03-19T08:00:00.000Z"),
    );
    const wrappedKeyOnServer = createSyncSecretsRecord(
      "Original device",
      new Date("2026-03-20T08:00:00.000Z"),
    ).record.wrappedKey;

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      selfHostedRecoverPreferences,
      { login: "alice@example.com", password: "correct horse battery staple" },
      wrongAccountSecrets.recoveryPhrase,
      new Date("2026-03-20T08:05:00.000Z"),
      selfHostedLoginSuccessFactory({
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
        getRecoveryKey: jest.fn().mockResolvedValue({ ok: true, recoveryKey: wrappedKeyOnServer }),
      }),
    );

    expect(result).toEqual({ ok: false, errorCode: "invalid_recovery_phrase" });
  });

  it("maps a self-hosted attachDevice failure during recovery", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const originalSecrets = createSyncSecretsRecord(
      "Original device",
      new Date("2026-03-20T08:00:00.000Z"),
    );

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      selfHostedRecoverPreferences,
      { login: "alice@example.com", password: "correct horse battery staple" },
      originalSecrets.recoveryPhrase,
      new Date("2026-03-20T08:05:00.000Z"),
      selfHostedLoginSuccessFactory({
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
        getRecoveryKey: jest
          .fn()
          .mockResolvedValue({ ok: true, recoveryKey: originalSecrets.record.wrappedKey }),
        attachDevice: jest.fn().mockResolvedValue({ ok: false, errorCode: "too_many_devices" }),
      }),
    );

    expect(result).toEqual({ ok: false, errorCode: "too_many_devices" });
  });
});

describe("runSyncUpload additional branches", () => {
  it("returns the prepared-context failure without attempting an upload", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(null);
    const apiClientFactory = jest.fn();

    const result = await runSyncUpload(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
      },
      new Date("2026-03-20T08:10:00.000Z"),
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    expect(apiClientFactory).not.toHaveBeenCalled();
  });

  it("returns unauthorized without uploading when getCapabilities is unauthorized", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const putBlob = jest.fn();
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        getCapabilities: jest.fn().mockResolvedValue({ ok: false, errorCode: "unauthorized" }),
        putBlob,
      }),
    );

    const result = await runSyncUpload(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
        lastRemoteGeneration: 100,
      },
      new Date("2026-03-20T08:10:00.000Z"),
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
    expect(putBlob).not.toHaveBeenCalled();
  });

  it.each([
    ["unauthorized", "unauthorized"],
    ["invalid_blob", "invalid_blob"],
    ["stale_generation", "stale_generation"],
    ["blob_not_found", "blob_not_found"],
    ["network_failed", "network_failed"],
    ["rate_limited", "generic"],
  ])(
    "maps a recovery-key sync failure %s to %s during upload",
    async (apiErrorCode, expectedErrorCode) => {
      const storage = createLocalAppStorageMock();
      const preparedSecrets = createSyncSecretsRecord(
        "Pixel 7",
        new Date("2026-03-20T08:00:00.000Z"),
      );
      const secretStore = createSyncSecretStoreMock({
        ...preparedSecrets.record,
        authSessionToken: "session-1",
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
          putRecoveryKey: jest.fn().mockResolvedValue({ ok: false, errorCode: apiErrorCode }),
        }),
      );

      const result = await runSyncUpload(
        storage,
        secretStore,
        {
          ...createDefaultSyncPreferencesRecord(),
          mode: "self_hosted",
          endpointInput: "192.168.1.20:8080",
          normalizedEndpoint: "http://192.168.1.20:8080",
          deviceLabel: "Pixel 7",
          setupStatus: "connected",
          lastRemoteGeneration: 100,
        },
        new Date("2026-03-20T08:10:00.000Z"),
        apiClientFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: expectedErrorCode });
    },
  );

  it("maps a putBlob failure", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
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
        putBlob: jest.fn().mockResolvedValue({ ok: false, errorCode: "stale_generation" }),
      }),
    );

    const result = await runSyncUpload(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
        lastRemoteGeneration: 100,
      },
      new Date("2026-03-20T08:10:00.000Z"),
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "stale_generation" });
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("proceeds with the upload when getCapabilities fails with a non-unauthorized error", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const putRecoveryKey = jest.fn();
    const putBlob = jest.fn().mockImplementation(async (_token, input) => ({
      ok: true,
      blob: {
        schemaVersion: input.schemaVersion,
        generation: input.generation,
        checksumSHA256: input.checksumSHA256,
        ciphertextBase64: input.ciphertextBase64,
        ciphertextSize: 10,
        updatedAt: "2026-03-20T08:10:00.000Z",
      },
    }));
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        getCapabilities: jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" }),
        putRecoveryKey,
        putBlob,
      }),
    );

    const result = await runSyncUpload(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
        lastRemoteGeneration: 100,
      },
      new Date("2026-03-20T08:10:00.000Z"),
      apiClientFactory,
    );

    expect(result.ok).toBe(true);
    expect(putRecoveryKey).not.toHaveBeenCalled();
    expect(putBlob).toHaveBeenCalledTimes(1);
  });
});

describe("runSyncRestore additional branches", () => {
  it("returns the prepared-context failure without attempting a restore", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(null);
    const apiClientFactory = jest.fn();

    const result = await runSyncRestore(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
      },
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    expect(apiClientFactory).not.toHaveBeenCalled();
    expect(storage.clearAllLocalData).not.toHaveBeenCalled();
  });

  it("maps a getBlob failure", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        getBlob: jest.fn().mockResolvedValue({ ok: false, errorCode: "blob_not_found" }),
      }),
    );

    const result = await runSyncRestore(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
      },
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "blob_not_found" });
    expect(storage.clearAllLocalData).not.toHaveBeenCalled();
  });

  it("returns invalid_payload when the stored envelope has the wrong shape", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const malformedEnvelopeBytes = new TextEncoder().encode(
      JSON.stringify({ not: "an envelope" }),
    );
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        getBlob: jest.fn().mockResolvedValue({
          ok: true,
          blob: {
            schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
            generation: 1,
            checksumSHA256: "aa",
            ciphertextBase64: fromByteArray(malformedEnvelopeBytes),
            ciphertextSize: malformedEnvelopeBytes.byteLength,
            updatedAt: "2026-03-20T08:12:00.000Z",
          },
        }),
      }),
    );

    const result = await runSyncRestore(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
      },
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "invalid_payload" });
    expect(storage.clearAllLocalData).not.toHaveBeenCalled();
  });

  it("returns invalid_payload when the decrypted payload is not a valid sync snapshot", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const garbagePayload = new TextEncoder().encode(JSON.stringify({ not: "a snapshot" }));
    const encryptedEnvelope = encryptSyncPayload(
      preparedSecrets.record.masterKeyHex,
      garbagePayload,
      buildSyncPayloadAad(preparedSecrets.record.device.deviceID),
    );
    const ciphertextBytes = new TextEncoder().encode(JSON.stringify(encryptedEnvelope));
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        getBlob: jest.fn().mockResolvedValue({
          ok: true,
          blob: {
            schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
            generation: 1,
            checksumSHA256: "aa",
            ciphertextBase64: fromByteArray(ciphertextBytes),
            ciphertextSize: ciphertextBytes.byteLength,
            updatedAt: "2026-03-20T08:12:00.000Z",
          },
        }),
      }),
    );

    const result = await runSyncRestore(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
      },
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "invalid_payload" });
    expect(storage.clearAllLocalData).not.toHaveBeenCalled();
  });
});

describe("sync device management additional branches", () => {
  const selfHostedPreferences = {
    ...createDefaultSyncPreferencesRecord(),
    mode: "self_hosted" as const,
    endpointInput: "192.168.1.20:8080",
    normalizedEndpoint: "http://192.168.1.20:8080",
    deviceLabel: "Pixel 7",
    setupStatus: "connected" as const,
  };
  const managedPreferences = {
    ...createDefaultSyncPreferencesRecord(),
    mode: "managed" as const,
    normalizedEndpoint: "https://sync.ovumcy.cloud",
    deviceLabel: "Pixel 7",
    setupStatus: "connected" as const,
  };

  it("maps a listDevices API failure", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({
        listDevices: jest.fn().mockResolvedValue({ ok: false, errorCode: "unauthorized" }),
      }),
    );

    const result = await listSyncDevices(secretStore, selfHostedPreferences, apiClientFactory);

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
  });

  it("returns sync_not_prepared for a self-hosted endpoint normalization failure before any network call", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const apiClientFactory = jest.fn();

    const result = await listSyncDevices(
      secretStore,
      { ...selfHostedPreferences, endpointInput: "   " },
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    expect(apiClientFactory).not.toHaveBeenCalled();
  });

  it("returns sync_not_prepared when there are no local sync secrets at all", async () => {
    const secretStore = createSyncSecretStoreMock(null);
    const apiClientFactory = jest.fn();

    const result = await listSyncDevices(secretStore, selfHostedPreferences, apiClientFactory);

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    expect(apiClientFactory).not.toHaveBeenCalled();
  });

  it("returns not_connected in managed mode when there is no managed session token", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const managedClientFactory = jest.fn();

    const result = await listSyncDevices(
      secretStore,
      managedPreferences,
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "not_connected" });
    expect(managedClientFactory).not.toHaveBeenCalled();
  });

  it("clears local session tokens and returns unauthorized when the managed session is invalid", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "stale-session",
      managedAuthSessionToken: "managed-session-1",
    });
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({
        getSession: jest.fn().mockResolvedValue({ ok: false, errorCode: "unauthorized" }),
      }),
    );

    const result = await listSyncDevices(
      secretStore,
      managedPreferences,
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({ authSessionToken: null, managedAuthSessionToken: null }),
    );
  });

  it.each([
    ["sync_not_allowed", "sync_not_allowed"],
    ["network_failed", "network_failed"],
    ["sync_bridge_unavailable", "network_failed"],
    ["totp_not_configured", "generic"],
  ])(
    "maps a managed getSession failure %s to %s",
    async (apiErrorCode, expectedErrorCode) => {
      const preparedSecrets = createSyncSecretsRecord(
        "Pixel 7",
        new Date("2026-03-20T08:00:00.000Z"),
      );
      const secretStore = createSyncSecretStoreMock({
        ...preparedSecrets.record,
        managedAuthSessionToken: "managed-session-1",
      });
      const managedClientFactory = jest.fn().mockReturnValue(
        createManagedClientMock({
          getSession: jest.fn().mockResolvedValue({ ok: false, errorCode: apiErrorCode }),
        }),
      );

      const result = await listSyncDevices(
        secretStore,
        managedPreferences,
        jest.fn(),
        managedClientFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: expectedErrorCode });
    },
  );

  it("clears the sync session and returns sync_not_allowed when managed entitlement is lost", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "stale-sync-session",
      managedAuthSessionToken: "managed-session-1",
    });
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

    const result = await listSyncDevices(
      secretStore,
      managedPreferences,
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_allowed" });
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        authSessionToken: null,
        managedAuthSessionToken: "managed-session-1",
      }),
    );
  });

  it("maps a managed createSyncSession failure", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      managedAuthSessionToken: "managed-session-1",
    });
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({
        getSession: jest.fn().mockResolvedValue({
          ok: true,
          session: {
            accountID: "managed-account-1",
            email: "alice@example.com",
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
        createSyncSession: jest.fn().mockResolvedValue({ ok: false, errorCode: "unauthorized" }),
      }),
    );

    const result = await listSyncDevices(
      secretStore,
      managedPreferences,
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
  });

  it("removeSyncDevice returns the prepared-context failure without calling the API", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const apiClientFactory = jest.fn();

    const result = await removeSyncDevice(
      secretStore,
      selfHostedPreferences,
      "device-2",
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "not_connected" });
    expect(apiClientFactory).not.toHaveBeenCalled();
  });

  it("removeSyncDevice collapses an unrecognized prepared-context error to generic", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      managedAuthSessionToken: "managed-session-1",
    });
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({
        getSession: jest.fn().mockResolvedValue({ ok: false, errorCode: "totp_not_configured" }),
      }),
    );

    const result = await removeSyncDevice(
      secretStore,
      managedPreferences,
      "device-2",
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "generic" });
  });
});

describe("disconnectSyncAccount and clearLocalSyncSession additional branches", () => {
  it("skips the community logout call when the self-hosted endpoint fails to normalize, but still clears local state", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const apiClientFactory = jest.fn();

    const result = await disconnectSyncAccount(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "   ",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
      },
      apiClientFactory,
    );

    expect(apiClientFactory).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      preferences: expect.objectContaining({ setupStatus: "local_ready" }),
    });
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({ authSessionToken: null }),
    );
  });

  it("clearLocalSyncSession leaves setupStatus not_configured and writes no secrets when none exist locally", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(null);

    const result = await clearLocalSyncSession(storage, secretStore, {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted",
      endpointInput: "192.168.1.20:8080",
      deviceLabel: "Pixel 7",
      setupStatus: "connected",
    });

    expect(result.setupStatus).toBe("not_configured");
    // No secrets existed, so there is nothing to wipe — readSyncSecrets still
    // resolves null afterward, proving writeSyncSecrets was never reached.
    await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
  });
});
