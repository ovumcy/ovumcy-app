import { fromByteArray, toByteArray } from "base64-js";

import { createEmptyDayLogRecord } from "../models/day-log";
import { createSyncSecretsRecord, decryptSyncPayload, encryptSyncPayload } from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import { createDefaultSyncPreferencesRecord, type EncryptedSyncEnvelope } from "./sync-contract";
import { connectSyncAccount, disconnectSyncAccount, runSyncRestore, runSyncUpload } from "./sync-client-service";
import { decodeSyncSnapshot, encodeSyncSnapshot, SYNC_SNAPSHOT_SCHEMA_VERSION } from "./sync-snapshot-service";

describe("sync-client-service", () => {
  it("connects a prepared device through the community server contract", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z"));
    const secretStore = createSyncSecretStoreMock(preparedSecrets.record);
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
      deviceLabel: "Pixel 7",
      setupStatus: "local_ready" as const,
      preparedAt: "2026-03-20T08:00:00.000Z",
    };
    const apiClientFactory = jest.fn().mockReturnValue({
      register: jest.fn().mockResolvedValue({
        ok: true,
        auth: {
          accountID: "account-1",
          sessionToken: "session-1",
          sessionExpiresAt: "2026-03-21T08:00:00.000Z",
        },
      }),
      login: jest.fn(),
      logout: jest.fn(),
      getCapabilities: jest.fn().mockResolvedValue({
        ok: true,
        capabilities: {
          mode: "self_hosted",
          syncEnabled: true,
          premiumActive: false,
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
          deviceLabel: preparedSecrets.record.device.deviceLabel,
          createdAt: preparedSecrets.record.device.createdAt,
          lastSeenAt: preparedSecrets.record.device.createdAt,
        },
      }),
      putBlob: jest.fn(),
      getBlob: jest.fn(),
    });

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
        syncEnabled: true,
      }),
      preferences: expect.objectContaining({
        normalizedEndpoint: "http://192.168.1.20:8080",
        setupStatus: "connected",
        lastSyncedAt: null,
      }),
    });
    const storedSecrets = await secretStore.readSyncSecrets();
    expect(storedSecrets?.authSessionToken).toBe("session-1");
    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedEndpoint: "http://192.168.1.20:8080",
        setupStatus: "connected",
      }),
    );
  });

  it("uploads an encrypted sync snapshot and persists remote generation metadata", async () => {
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
    const preparedSecrets = createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z"));
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
    const putBlob = jest.fn().mockImplementation(async (_token, input) => {
      const encryptedEnvelope = JSON.parse(
        new TextDecoder().decode(toByteArray(input.ciphertextBase64)),
      ) as EncryptedSyncEnvelope;
      const snapshot = decodeSyncSnapshot(
        decryptSyncPayload(preparedSecrets.record.masterKeyHex, encryptedEnvelope),
      );

      expect(snapshot.dayLogs).toEqual([dayLog]);
      expect(snapshot.profile).toEqual(expect.objectContaining({ cycleLength: 28 }));
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
    const apiClientFactory = jest.fn().mockReturnValue({
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      getCapabilities: jest.fn(),
      attachDevice: jest.fn(),
      putBlob,
      getBlob: jest.fn(),
    });

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
    expect(putBlob).toHaveBeenCalledTimes(1);
    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSyncedAt: "2026-03-20T08:10:00.000Z",
      }),
    );
  });

  it("restores a remote encrypted blob back into canonical local storage", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z"));
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
    );
    const ciphertextBytes = new TextEncoder().encode(JSON.stringify(encryptedEnvelope));
    const ciphertextBase64 = fromByteArray(ciphertextBytes);
    const apiClientFactory = jest.fn().mockReturnValue({
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      getCapabilities: jest.fn(),
      attachDevice: jest.fn(),
      putBlob: jest.fn(),
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
    });

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
    const preparedSecrets = createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z"));
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
    const apiClientFactory = jest.fn().mockReturnValue({
      register: jest.fn(),
      login: jest.fn(),
      logout,
      getCapabilities: jest.fn(),
      attachDevice: jest.fn(),
      putBlob: jest.fn(),
      getBlob: jest.fn(),
    });

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
    const storedSecrets = await secretStore.readSyncSecrets();
    expect(storedSecrets?.authSessionToken).toBeNull();
  });
});
