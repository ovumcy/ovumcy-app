import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type {
  ManagedCloudAPIClient,
  ManagedCloudAPIErrorCode,
} from "./managed-cloud-api-client";
import { callWithManagedSession } from "./managed-session-call";
import { resetManagedSessionRefreshStateForTests } from "./managed-session-refresh-service";
import type { SyncSecretsRecord } from "./sync-contract";

const NOW = new Date("2026-07-21T12:00:00.000Z");

type CallResult =
  | { ok: true; value: string }
  | { ok: false; errorCode: ManagedCloudAPIErrorCode };

function createSecrets(overrides: Partial<SyncSecretsRecord> = {}): SyncSecretsRecord {
  return {
    device: {
      deviceID: "device-1",
      deviceLabel: "Pixel 7",
      createdAt: "2026-07-01T08:00:00.000Z",
    },
    masterKeyHex: "aa",
    deviceSecretHex: "bb",
    wrappedKey: {
      algorithm: "xchacha20poly1305" as const,
      kdf: "bip39_seed_hkdf_sha256" as const,
      mnemonicWordCount: 12 as const,
      wrapNonceHex: "cc",
      wrappedMasterKeyHex: "dd",
      phraseFingerprintHex: "ee",
    },
    authSessionToken: null,
    managedAuthSessionToken: "access-1",
    managedAuthSessionExpiresAt: "2026-07-22T12:00:00.000Z",
    managedRefreshToken: "refresh-1",
    managedRefreshTokenExpiresAt: "2026-10-19T12:00:00.000Z",
    ...overrides,
  };
}

function refreshAnswering(
  answer: { ok: true; sessionToken: string } | { ok: false; errorCode: ManagedCloudAPIErrorCode },
) {
  const refreshSession = jest.fn(async () =>
    answer.ok
      ? {
          ok: true as const,
          auth: {
            accountID: "acct-1",
            email: "owner@example.com",
            sessionToken: answer.sessionToken,
            sessionExpiresAt: "2026-07-22T12:00:00.000Z",
            entitlement: {
              syncAllowed: true,
              source: "trial",
              updatedAt: NOW.toISOString(),
              effectiveAt: NOW.toISOString(),
              explanation: "",
            },
            refreshToken: `refresh-for-${answer.sessionToken}`,
            refreshTokenExpiresAt: "2026-10-19T12:00:00.000Z",
          },
        }
      : answer,
  );
  const managedClientFactory = () =>
    ({ refreshSession }) as unknown as ManagedCloudAPIClient;
  return { refreshSession, managedClientFactory };
}

const UNAUTHORIZED = { ok: false as const, errorCode: "unauthorized" as const };

async function storeWith(overrides: Partial<SyncSecretsRecord> = {}) {
  const secretStore = createSyncSecretStoreMock();
  await secretStore.writeSyncSecrets(createSecrets(overrides));
  return secretStore;
}

describe("callWithManagedSession", () => {
  beforeEach(() => {
    resetManagedSessionRefreshStateForTests();
  });

  it("runs the call with the stored session and passes its answer through", async () => {
    const secretStore = await storeWith();
    const { refreshSession, managedClientFactory } = refreshAnswering({
      ok: true,
      sessionToken: "access-2",
    });
    const call = jest.fn(async (): Promise<CallResult> => ({ ok: true, value: "v" }));

    await expect(
      callWithManagedSession(secretStore, call, { now: NOW, managedClientFactory }),
    ).resolves.toEqual({ ok: true, value: "v" });
    expect(call).toHaveBeenCalledWith("access-1");
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("does not renew on a failure other than 401", async () => {
    const secretStore = await storeWith();
    const { refreshSession, managedClientFactory } = refreshAnswering({
      ok: true,
      sessionToken: "access-2",
    });
    const call = jest.fn(
      async (): Promise<CallResult> => ({ ok: false, errorCode: "network_failed" }),
    );

    await expect(
      callWithManagedSession(secretStore, call, { now: NOW, managedClientFactory }),
    ).resolves.toEqual({ ok: false, errorCode: "network_failed" });
    expect(call).toHaveBeenCalledTimes(1);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("renews the session on a 401 and retries once with the new token", async () => {
    const secretStore = await storeWith();
    const { refreshSession, managedClientFactory } = refreshAnswering({
      ok: true,
      sessionToken: "access-2",
    });
    const call = jest
      .fn<Promise<CallResult>, [string]>()
      .mockResolvedValueOnce(UNAUTHORIZED)
      .mockResolvedValueOnce({ ok: true, value: "v" });

    await expect(
      callWithManagedSession(secretStore, call, { now: NOW, managedClientFactory }),
    ).resolves.toEqual({ ok: true, value: "v" });
    expect(call.mock.calls).toEqual([["access-1"], ["access-2"]]);
    expect(refreshSession).toHaveBeenCalledWith("refresh-1");
  });

  it("never clears a valid refresh token on the first 401 when the refresh cannot be completed", async () => {
    const secretStore = await storeWith();
    const { managedClientFactory } = refreshAnswering({
      ok: false,
      errorCode: "network_failed",
    });
    const call = jest.fn(async (): Promise<CallResult> => UNAUTHORIZED);

    await expect(
      callWithManagedSession(secretStore, call, { now: NOW, managedClientFactory }),
    ).resolves.toEqual(UNAUTHORIZED);
    expect(call).toHaveBeenCalledTimes(1);
    const stored = await secretStore.readSyncSecrets();
    expect(stored?.managedAuthSessionToken).toBe("access-1");
    expect(stored?.managedRefreshToken).toBe("refresh-1");
  });

  it("retries only once and keeps the renewed credentials when the retry is refused too", async () => {
    const secretStore = await storeWith();
    const { managedClientFactory } = refreshAnswering({
      ok: true,
      sessionToken: "access-2",
    });
    const call = jest.fn(async (): Promise<CallResult> => UNAUTHORIZED);

    await expect(
      callWithManagedSession(secretStore, call, { now: NOW, managedClientFactory }),
    ).resolves.toEqual(UNAUTHORIZED);
    expect(call).toHaveBeenCalledTimes(2);
    const stored = await secretStore.readSyncSecrets();
    expect(stored?.managedAuthSessionToken).toBe("access-2");
    expect(stored?.managedRefreshToken).toBe("refresh-for-access-2");
  });

  it("answers session_expired, with the credentials cleared, when the refresh token is refused", async () => {
    const secretStore = await storeWith();
    const { managedClientFactory } = refreshAnswering({
      ok: false,
      errorCode: "unauthorized",
    });
    const call = jest.fn(async (): Promise<CallResult> => UNAUTHORIZED);

    await expect(
      callWithManagedSession(secretStore, call, { now: NOW, managedClientFactory }),
    ).resolves.toEqual({ ok: false, errorCode: "session_expired" });
    expect(call).toHaveBeenCalledTimes(1);
    const stored = await secretStore.readSyncSecrets();
    expect(stored?.managedAuthSessionToken).toBeNull();
    expect(stored?.managedRefreshToken).toBeNull();
  });

  it("answers session_expired when a legacy session without a refresh token is rejected", async () => {
    const secretStore = await storeWith({
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
    });
    const { refreshSession, managedClientFactory } = refreshAnswering({
      ok: true,
      sessionToken: "access-2",
    });
    const call = jest.fn(async (): Promise<CallResult> => UNAUTHORIZED);

    await expect(
      callWithManagedSession(secretStore, call, { now: NOW, managedClientFactory }),
    ).resolves.toEqual({ ok: false, errorCode: "session_expired" });
    expect(refreshSession).not.toHaveBeenCalled();
    expect((await secretStore.readSyncSecrets())?.managedAuthSessionToken).toBeNull();
  });

  it("answers no_session without calling when the device holds no managed session", async () => {
    const call = jest.fn(async (): Promise<CallResult> => ({ ok: true, value: "v" }));

    await expect(
      callWithManagedSession(createSyncSecretStoreMock(), call),
    ).resolves.toEqual({ ok: false, errorCode: "no_session" });
    expect(call).not.toHaveBeenCalled();
  });

  it("renews a session near expiry before the first call", async () => {
    const secretStore = await storeWith({
      managedAuthSessionExpiresAt: "2026-07-21T12:01:00.000Z",
    });
    const { managedClientFactory } = refreshAnswering({
      ok: true,
      sessionToken: "access-2",
    });
    const call = jest.fn(async (): Promise<CallResult> => ({ ok: true, value: "v" }));

    await callWithManagedSession(secretStore, call, { now: NOW, managedClientFactory });

    expect(call.mock.calls).toEqual([["access-2"]]);
  });
});
