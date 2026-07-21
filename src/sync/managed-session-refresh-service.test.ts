import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { ManagedCloudAPIClient } from "./managed-cloud-api-client";
import {
  applyManagedAuthResultToSecrets,
  clearManagedSessionFromSecrets,
  ensureFreshManagedSession,
  resetManagedSessionRefreshStateForTests,
} from "./managed-session-refresh-service";
import type { SyncSecretsRecord } from "./sync-contract";

const NOW = new Date("2026-07-21T12:00:00.000Z");

function createSecrets(
  overrides: Partial<SyncSecretsRecord> = {},
): SyncSecretsRecord {
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

function createRefreshingClient(
  refreshSession: ManagedCloudAPIClient["refreshSession"],
): () => ManagedCloudAPIClient {
  return () => ({ refreshSession }) as unknown as ManagedCloudAPIClient;
}

function okRefresh(sessionToken: string, refreshToken: string) {
  return jest.fn(async () => ({
    ok: true as const,
    auth: {
      accountID: "acct-1",
      email: "owner@example.com",
      sessionToken,
      sessionExpiresAt: "2026-07-22T12:00:00.000Z",
      entitlement: {
        syncAllowed: true,
        source: "trial",
        updatedAt: NOW.toISOString(),
        effectiveAt: NOW.toISOString(),
        explanation: "",
      },
      refreshToken,
      refreshTokenExpiresAt: "2026-10-19T12:00:00.000Z",
    },
  }));
}

describe("ensureFreshManagedSession", () => {
  beforeEach(() => {
    resetManagedSessionRefreshStateForTests();
  });

  it("reports no session when the device has never connected", async () => {
    const secretStore = createSyncSecretStoreMock();

    await expect(ensureFreshManagedSession(secretStore, NOW)).resolves.toEqual({
      ok: false,
      errorCode: "no_session",
    });
  });

  it("leaves a session without a refresh token exactly as it is", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(
      createSecrets({
        managedRefreshToken: null,
        managedRefreshTokenExpiresAt: null,
        // Already past its stamped expiry: a legacy session is long-lived by
        // construction and there is nothing to renew it with.
        managedAuthSessionExpiresAt: "2026-07-20T12:00:00.000Z",
      }),
    );
    const refreshSession = jest.fn();

    const result = await ensureFreshManagedSession(
      secretStore,
      NOW,
      createRefreshingClient(refreshSession as never),
    );

    expect(result).toEqual({ ok: true, sessionToken: "access-1", refreshed: false });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("does not renew a session that is still comfortably valid", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(createSecrets());
    const refreshSession = jest.fn();

    const result = await ensureFreshManagedSession(
      secretStore,
      NOW,
      createRefreshingClient(refreshSession as never),
    );

    expect(result).toEqual({ ok: true, sessionToken: "access-1", refreshed: false });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("renews and persists the rotated pair once the session is near expiry", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(
      createSecrets({ managedAuthSessionExpiresAt: "2026-07-21T12:01:00.000Z" }),
    );
    const refreshSession = okRefresh("access-2", "refresh-2");

    const result = await ensureFreshManagedSession(
      secretStore,
      NOW,
      createRefreshingClient(refreshSession as never),
    );

    expect(result).toEqual({ ok: true, sessionToken: "access-2", refreshed: true });
    expect(refreshSession).toHaveBeenCalledWith("refresh-1");

    const stored = await secretStore.readSyncSecrets();
    expect(stored?.managedAuthSessionToken).toBe("access-2");
    expect(stored?.managedRefreshToken).toBe("refresh-2");
    expect(stored?.masterKeyHex).toBe("aa");
  });

  it("shares one exchange between concurrent callers", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(
      createSecrets({ managedAuthSessionExpiresAt: "2026-07-21T12:01:00.000Z" }),
    );
    const refreshSession = okRefresh("access-2", "refresh-2");
    const client = createRefreshingClient(refreshSession as never);

    const [first, second, third] = await Promise.all([
      ensureFreshManagedSession(secretStore, NOW, client),
      ensureFreshManagedSession(secretStore, NOW, client),
      ensureFreshManagedSession(secretStore, NOW, client),
    ]);

    // A refresh token is single-use and the server treats a second use as a
    // leak, so three parallel screens must produce exactly one exchange.
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(second).toEqual(third);
  });

  it("defaults to the current clock when no time is supplied", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(
      createSecrets({ managedAuthSessionExpiresAt: "2099-01-01T00:00:00.000Z" }),
    );
    const refreshSession = jest.fn();

    // Production callers pass no clock; a session valid until 2099 must be
    // left alone against the real "now" too.
    const result = await ensureFreshManagedSession(
      secretStore,
      undefined,
      createRefreshingClient(refreshSession as never),
    );

    expect(result).toEqual({ ok: true, sessionToken: "access-1", refreshed: false });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("records no expiry when the renewed session comes back without one", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(
      createSecrets({ managedAuthSessionExpiresAt: "2026-07-21T12:01:00.000Z" }),
    );
    const refreshSession = jest.fn(async () => ({
      ok: true as const,
      auth: {
        accountID: "acct-1",
        email: "owner@example.com",
        sessionToken: "access-2",
        sessionExpiresAt: "",
        entitlement: {
          syncAllowed: true,
          source: "trial",
          updatedAt: NOW.toISOString(),
          effectiveAt: NOW.toISOString(),
          explanation: "",
        },
        refreshToken: "refresh-2",
        refreshTokenExpiresAt: "2026-10-19T12:00:00.000Z",
      },
    }));

    await ensureFreshManagedSession(
      secretStore,
      NOW,
      createRefreshingClient(refreshSession as never),
    );

    // An absent expiry must be stored as absent, not as an empty string that
    // would later parse as NaN and be read as "not due".
    const stored = await secretStore.readSyncSecrets();
    expect(stored?.managedAuthSessionExpiresAt).toBeNull();
  });

  it("clears the credentials when the refresh chain is dead", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(
      createSecrets({ managedAuthSessionExpiresAt: "2026-07-21T12:01:00.000Z" }),
    );
    const refreshSession = jest.fn(async () => ({
      ok: false as const,
      errorCode: "unauthorized" as const,
    }));

    const result = await ensureFreshManagedSession(
      secretStore,
      NOW,
      createRefreshingClient(refreshSession as never),
    );

    expect(result).toEqual({ ok: false, errorCode: "session_expired" });

    const stored = await secretStore.readSyncSecrets();
    expect(stored?.managedAuthSessionToken).toBeNull();
    expect(stored?.managedRefreshToken).toBeNull();
    // Only the managed credentials go; the device's own key material stays.
    expect(stored?.masterKeyHex).toBe("aa");
  });

  it("keeps the current session when the network is the problem", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(
      createSecrets({ managedAuthSessionExpiresAt: "2026-07-21T12:01:00.000Z" }),
    );
    const refreshSession = jest.fn(async () => ({
      ok: false as const,
      errorCode: "network_failed" as const,
    }));

    const result = await ensureFreshManagedSession(
      secretStore,
      NOW,
      createRefreshingClient(refreshSession as never),
    );

    // Being offline must never look like being signed out.
    expect(result).toEqual({ ok: true, sessionToken: "access-1", refreshed: false });
    const stored = await secretStore.readSyncSecrets();
    expect(stored?.managedRefreshToken).toBe("refresh-1");
  });

  it("leaves a session alone when the stored expiry cannot be parsed", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(
      createSecrets({ managedAuthSessionExpiresAt: "not-a-timestamp" }),
    );
    const refreshSession = jest.fn();

    const result = await ensureFreshManagedSession(
      secretStore,
      NOW,
      createRefreshingClient(refreshSession as never),
    );

    // Garbage in the record must not be read as "expired" and spend the
    // single-use refresh token on a guess.
    expect(result).toEqual({ ok: true, sessionToken: "access-1", refreshed: false });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("leaves a session alone when the server never reported an expiry", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(
      createSecrets({ managedAuthSessionExpiresAt: null }),
    );
    const refreshSession = jest.fn();

    const result = await ensureFreshManagedSession(
      secretStore,
      NOW,
      createRefreshingClient(refreshSession as never),
    );

    expect(result).toEqual({ ok: true, sessionToken: "access-1", refreshed: false });
    expect(refreshSession).not.toHaveBeenCalled();
  });
});

describe("managed session secret helpers", () => {
  it("writes the session, its expiry, and the refresh pair together", () => {
    const applied = applyManagedAuthResultToSecrets(
      createSecrets({
        managedAuthSessionToken: null,
        managedAuthSessionExpiresAt: null,
        managedRefreshToken: null,
        managedRefreshTokenExpiresAt: null,
      }),
      {
        accountID: "acct-1",
        email: "owner@example.com",
        sessionToken: "access-9",
        sessionExpiresAt: "2026-07-22T12:00:00.000Z",
        entitlement: {
          syncAllowed: true,
          source: "trial",
          updatedAt: NOW.toISOString(),
          effectiveAt: NOW.toISOString(),
          explanation: "",
        },
        refreshToken: "refresh-9",
        refreshTokenExpiresAt: "2026-10-19T12:00:00.000Z",
      },
    );

    expect(applied.managedAuthSessionToken).toBe("access-9");
    expect(applied.managedAuthSessionExpiresAt).toBe("2026-07-22T12:00:00.000Z");
    expect(applied.managedRefreshToken).toBe("refresh-9");
    expect(applied.managedRefreshTokenExpiresAt).toBe("2026-10-19T12:00:00.000Z");
  });

  it("records no refresh state when the server issued none", () => {
    const applied = applyManagedAuthResultToSecrets(createSecrets(), {
      accountID: "acct-1",
      email: "owner@example.com",
      sessionToken: "access-9",
      sessionExpiresAt: "2026-08-20T12:00:00.000Z",
      entitlement: {
        syncAllowed: true,
        source: "trial",
        updatedAt: NOW.toISOString(),
        effectiveAt: NOW.toISOString(),
        explanation: "",
      },
    });

    // A managed deployment without refresh support must not leave the previous
    // session's refresh token attached to a brand-new session.
    expect(applied.managedRefreshToken).toBeNull();
    expect(applied.managedRefreshTokenExpiresAt).toBeNull();
  });

  it("drops every managed credential at once", () => {
    const cleared = clearManagedSessionFromSecrets(createSecrets());

    expect(cleared.managedAuthSessionToken).toBeNull();
    expect(cleared.managedAuthSessionExpiresAt).toBeNull();
    expect(cleared.managedRefreshToken).toBeNull();
    expect(cleared.managedRefreshTokenExpiresAt).toBeNull();
    expect(cleared.device.deviceID).toBe("device-1");
  });
});
