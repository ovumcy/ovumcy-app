import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { ManagedCloudAPIClient } from "./managed-cloud-api-client";
import type { SyncAPIClient } from "./sync-api-client";
import { createDefaultSyncPreferencesRecord } from "./sync-contract";
import { removeSyncDevice } from "./sync-client-service";

const selfHosted = {
  ...createDefaultSyncPreferencesRecord(),
  mode: "self_hosted" as const,
  endpointInput: "192.168.1.20:8080",
  normalizedEndpoint: "http://192.168.1.20:8080",
  deviceLabel: "Pixel 7",
  setupStatus: "connected" as const,
};
const managed = {
  ...createDefaultSyncPreferencesRecord(),
  mode: "managed" as const,
  deviceLabel: "Pixel 7",
  setupStatus: "connected" as const,
};
const stepUp = { currentPassword: "pw-1", code: "123456" };

function secrets(extra: Record<string, unknown>) {
  const record = createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z")).record;
  return { record, store: createSyncSecretStoreMock({ ...record, ...extra }) };
}

function communityClient(removeDevice: jest.Mock) {
  return jest.fn().mockReturnValue({ removeDevice } as unknown as SyncAPIClient);
}

function managedClientFactory() {
  return jest.fn().mockReturnValue({
    getSession: jest.fn().mockResolvedValue({
      ok: true,
      session: { entitlement: { syncAllowed: true } },
    }),
    createSyncSession: jest.fn().mockResolvedValue({
      ok: true,
      auth: { sessionToken: "bridged-session-1" },
    }),
  } as unknown as ManagedCloudAPIClient);
}

describe("removeSyncDevice step-up", () => {
  it("asks for the step-up when the server wants the password", async () => {
    const { store } = secrets({ authSessionToken: "session-1" });
    const removeDevice = jest
      .fn()
      .mockResolvedValue({ ok: false, errorCode: "invalid_current_password" });

    const result = await removeSyncDevice(
      createLocalAppStorageMock(),
      store,
      selfHosted,
      "device-2",
      undefined,
      communityClient(removeDevice),
    );

    expect(result).toEqual({ ok: false, errorCode: "device_step_up_required" });
    expect(removeDevice).toHaveBeenCalledWith("session-1", { deviceID: "device-2" });
  });

  it("sends the password and code it was given", async () => {
    const { store } = secrets({ authSessionToken: "session-1" });
    const removeDevice = jest.fn().mockResolvedValue({ ok: true });

    const result = await removeSyncDevice(
      createLocalAppStorageMock(),
      store,
      selfHosted,
      "device-2",
      stepUp,
      communityClient(removeDevice),
    );

    expect(result).toEqual({ ok: true, removedCurrentDevice: false, preferences: null });
    expect(removeDevice).toHaveBeenCalledWith("session-1", { deviceID: "device-2" }, stepUp);
    expect(JSON.stringify(await store.readSyncSecrets())).not.toContain("pw-1");
  });

  it.each(["invalid_current_password", "totp_invalid_code", "totp_replayed"] as const)(
    "reports a rejected step-up as %s",
    async (errorCode) => {
      const { store } = secrets({ authSessionToken: "session-1" });
      const removeDevice = jest.fn().mockResolvedValue({ ok: false, errorCode });

      await expect(
        removeSyncDevice(
          createLocalAppStorageMock(),
          store,
          selfHosted,
          "device-2",
          stepUp,
          communityClient(removeDevice),
        ),
      ).resolves.toEqual({ ok: false, errorCode });
    },
  );

  it("carries Retry-After on a spent step-up budget", async () => {
    const { store } = secrets({ authSessionToken: "session-1" });
    const removeDevice = jest
      .fn()
      .mockResolvedValue({ ok: false, errorCode: "rate_limited", retryAfterSeconds: 30 });

    await expect(
      removeSyncDevice(
        createLocalAppStorageMock(),
        store,
        selfHosted,
        "device-2",
        stepUp,
        communityClient(removeDevice),
      ),
    ).resolves.toEqual({ ok: false, errorCode: "rate_limited", retryAfterSeconds: 30 });
  });

  it("never sends the step-up to a managed sync host", async () => {
    const { store } = secrets({ managedAuthSessionToken: "managed-session-1" });
    const removeDevice = jest
      .fn()
      .mockResolvedValue({ ok: false, errorCode: "invalid_current_password" });

    const result = await removeSyncDevice(
      createLocalAppStorageMock(),
      store,
      managed,
      "device-2",
      stepUp,
      communityClient(removeDevice),
      managedClientFactory(),
    );

    expect(result).toEqual({ ok: false, errorCode: "generic" });
    expect(removeDevice).toHaveBeenCalledWith("bridged-session-1", { deviceID: "device-2" });
  });
});

describe("removeSyncDevice on the current device", () => {
  it("clears the self-hosted session the server revoked", async () => {
    const { record, store } = secrets({ authSessionToken: "session-1" });
    const storage = createLocalAppStorageMock();

    const result = await removeSyncDevice(
      storage,
      store,
      selfHosted,
      record.device.deviceID,
      undefined,
      communityClient(jest.fn().mockResolvedValue({ ok: true })),
    );

    expect(result).toEqual({
      ok: true,
      removedCurrentDevice: true,
      preferences: expect.objectContaining({ setupStatus: "local_ready" }),
    });
    expect((await store.readSyncSecrets())?.authSessionToken).toBeNull();
    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
      expect.objectContaining({ setupStatus: "local_ready" }),
    );
  });

  it("keeps the managed session, which no device binds", async () => {
    const { record, store } = secrets({ managedAuthSessionToken: "managed-session-1" });
    const storage = createLocalAppStorageMock();

    const result = await removeSyncDevice(
      storage,
      store,
      managed,
      record.device.deviceID,
      undefined,
      communityClient(jest.fn().mockResolvedValue({ ok: true })),
      managedClientFactory(),
    );

    expect(result).toEqual({ ok: true, removedCurrentDevice: true, preferences: null });
    expect((await store.readSyncSecrets())?.managedAuthSessionToken).toBe("managed-session-1");
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });
});
