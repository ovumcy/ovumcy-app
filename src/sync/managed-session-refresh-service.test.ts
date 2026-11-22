import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { ManagedCloudAPIClient } from "./managed-cloud-api-client";
import {
  applyManagedAuthResultToSecrets,
  clearManagedSessionFromSecrets,
  endManagedSessionRefresh,
  ensureFreshManagedSession,
  renewRejectedManagedSession,
  settleInFlightManagedRefresh,
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

describe("a refresh in flight while the stored record changes", () => {
  beforeEach(() => {
    resetManagedSessionRefreshStateForTests();
  });

  const DUE = "2026-07-21T12:01:00.000Z";
  type Store = ReturnType<typeof createSyncSecretStoreMock>;

  // Starts the refresh, lets `mutate` change the store while the exchange is
  // pending, then lets the exchange answer with `answer`.
  async function refreshWhile(
    mutate: (secretStore: Store) => Promise<void>,
    answer: { ok: true } | { ok: false; errorCode: string },
    callers = 1,
  ) {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(
      createSecrets({ managedAuthSessionExpiresAt: DUE, authSessionToken: "sync-1" }),
    );
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const okResult = okRefresh("access-2", "refresh-2");
    const refreshSession = jest.fn(async () => {
      await gate;
      return answer.ok ? okResult() : answer;
    });
    const factory = createRefreshingClient(refreshSession as never);
    const pending = Array.from({ length: callers }, () =>
      ensureFreshManagedSession(secretStore, NOW, factory),
    );
    await new Promise((resolve) => setImmediate(resolve));
    await mutate(secretStore);
    release();
    const results = await Promise.all(pending);
    return { secretStore, refreshSession, results };
  }

  async function update(store: Store, patch: Partial<SyncSecretsRecord>) {
    const current = await store.readSyncSecrets();
    await store.writeSyncSecrets({ ...current!, ...patch });
  }

  it("keeps a replaced recovery package and lands the new tokens", async () => {
    const replaced = {
      algorithm: "xchacha20poly1305" as const,
      kdf: "bip39_seed_hkdf_sha256" as const,
      mnemonicWordCount: 12 as const,
      wrapNonceHex: "11",
      wrappedMasterKeyHex: "22",
      phraseFingerprintHex: "33",
    };
    const { secretStore, results } = await refreshWhile(
      (store) => update(store, { wrappedKey: replaced }),
      { ok: true },
    );

    expect(results[0]).toEqual({ ok: true, sessionToken: "access-2", refreshed: true });
    const stored = await secretStore.readSyncSecrets();
    expect(stored?.wrappedKey).toEqual(replaced);
    expect(stored?.managedAuthSessionToken).toBe("access-2");
    expect(stored?.managedRefreshToken).toBe("refresh-2");
  });

  it("leaves a cleared sync session cleared", async () => {
    const { secretStore } = await refreshWhile(
      (store) => update(store, { authSessionToken: null }),
      { ok: true },
    );

    const stored = await secretStore.readSyncSecrets();
    expect(stored?.authSessionToken).toBeNull();
    expect(stored?.managedAuthSessionToken).toBe("access-2");
  });

  it("writes nothing when the managed session was cleared meanwhile", async () => {
    const cleared = async (store: Store) => {
      const current = await store.readSyncSecrets();
      await store.writeSyncSecrets(clearManagedSessionFromSecrets(current!));
    };
    const ok = await refreshWhile(cleared, { ok: true });
    expect(ok.results[0]).toEqual({ ok: false, errorCode: "session_expired" });
    expect((await ok.secretStore.readSyncSecrets())?.managedAuthSessionToken).toBeNull();

    resetManagedSessionRefreshStateForTests();
    const rejected = await refreshWhile(cleared, { ok: false, errorCode: "unauthorized" });
    expect(rejected.results[0]).toEqual({ ok: false, errorCode: "session_expired" });
    expect((await rejected.secretStore.readSyncSecrets())?.managedAuthSessionToken).toBeNull();
  });

  it("writes nothing when the managed session was replaced meanwhile", async () => {
    const { secretStore, results } = await refreshWhile(
      (store) =>
        update(store, {
          managedAuthSessionToken: "access-other",
          managedRefreshToken: "refresh-other",
        }),
      { ok: true },
    );

    expect(results[0]).toEqual({ ok: false, errorCode: "session_expired" });
    const stored = await secretStore.readSyncSecrets();
    expect(stored?.managedAuthSessionToken).toBe("access-other");
    expect(stored?.managedRefreshToken).toBe("refresh-other");
  });

  it("does not wipe a replaced session when the old token is rejected", async () => {
    const { secretStore } = await refreshWhile(
      (store) => update(store, { managedAuthSessionToken: "access-other" }),
      { ok: false, errorCode: "unauthorized" },
    );

    expect((await secretStore.readSyncSecrets())?.managedAuthSessionToken).toBe("access-other");
  });

  it("still keeps the token on a network failure and clears on rejection", async () => {
    const net = await refreshWhile(async () => undefined, {
      ok: false,
      errorCode: "network_failed",
    });
    expect(net.results[0]).toEqual({ ok: true, sessionToken: "access-1", refreshed: false });
    expect((await net.secretStore.readSyncSecrets())?.managedRefreshToken).toBe("refresh-1");

    resetManagedSessionRefreshStateForTests();
    const dead = await refreshWhile(async () => undefined, {
      ok: false,
      errorCode: "unauthorized",
    });
    expect(dead.results[0]).toEqual({ ok: false, errorCode: "session_expired" });
    expect((await dead.secretStore.readSyncSecrets())?.managedAuthSessionToken).toBeNull();
  });

  it("ends both overlapping callers when a disconnect lands mid-refresh", async () => {
    const { secretStore, refreshSession, results } = await refreshWhile(
      async (store) => {
        const current = await store.readSyncSecrets();
        await store.writeSyncSecrets({
          ...clearManagedSessionFromSecrets(current!),
          authSessionToken: null,
        });
        endManagedSessionRefresh();
      },
      { ok: true },
      2,
    );

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(results).toEqual([
      { ok: false, errorCode: "session_expired" },
      { ok: false, errorCode: "session_expired" },
    ]);
    const stored = await secretStore.readSyncSecrets();
    expect(stored?.managedAuthSessionToken).toBeNull();
    expect(stored?.managedRefreshToken).toBeNull();
    expect(stored?.authSessionToken).toBeNull();
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

describe("a caller whose read predates a refresh that has since landed", () => {
  beforeEach(() => {
    resetManagedSessionRefreshStateForTests();
  });

  it("never spends the rotated-away refresh token", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(
      createSecrets({ managedAuthSessionExpiresAt: "2026-07-21T12:01:00.000Z" }),
    );
    const realRead = secretStore.readSyncSecrets.bind(secretStore);
    let releaseStaleRead: () => void = () => undefined;
    const staleReadGate = new Promise<void>((resolve) => {
      releaseStaleRead = resolve;
    });
    // The first read is taken now and handed back only after the other
    // caller's refresh has completed.
    let reads = 0;
    jest.spyOn(secretStore, "readSyncSecrets").mockImplementation(async () => {
      reads += 1;
      const isStaleRead = reads === 1;
      const snapshot = await realRead();
      if (isStaleRead) {
        await staleReadGate;
      }
      return snapshot;
    });
    const refreshSession = okRefresh("access-2", "refresh-2");
    const factory = createRefreshingClient(refreshSession);

    const stale = ensureFreshManagedSession(secretStore, NOW, factory);
    await expect(ensureFreshManagedSession(secretStore, NOW, factory)).resolves.toEqual({
      ok: true,
      sessionToken: "access-2",
      refreshed: true,
    });
    releaseStaleRead();

    await expect(stale).resolves.toEqual({
      ok: true,
      sessionToken: "access-2",
      refreshed: false,
    });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(refreshSession).toHaveBeenCalledWith("refresh-1");
  });
});

describe("renewRejectedManagedSession", () => {
  beforeEach(() => {
    resetManagedSessionRefreshStateForTests();
  });

  async function storeWith(overrides: Partial<SyncSecretsRecord> = {}) {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(createSecrets(overrides));
    return secretStore;
  }

  it("spends the refresh token on a 401 even when the stored expiry is far off", async () => {
    const secretStore = await storeWith();
    const refreshSession = okRefresh("access-2", "refresh-2");

    await expect(
      renewRejectedManagedSession(
        secretStore,
        "access-1",
        createRefreshingClient(refreshSession),
      ),
    ).resolves.toEqual({ ok: true, sessionToken: "access-2" });
    expect(refreshSession).toHaveBeenCalledWith("refresh-1");
    const stored = await secretStore.readSyncSecrets();
    expect(stored?.managedAuthSessionToken).toBe("access-2");
    expect(stored?.managedRefreshToken).toBe("refresh-2");
  });

  it("hands back the token a concurrent refresh already stored, spending nothing", async () => {
    const secretStore = await storeWith({ managedAuthSessionToken: "access-2" });
    const refreshSession = okRefresh("access-3", "refresh-3");

    await expect(
      renewRejectedManagedSession(
        secretStore,
        "access-1",
        createRefreshingClient(refreshSession),
      ),
    ).resolves.toEqual({ ok: true, sessionToken: "access-2" });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("shares one exchange between callers rejected on the same token", async () => {
    const secretStore = await storeWith();
    const refreshSession = okRefresh("access-2", "refresh-2");
    const factory = createRefreshingClient(refreshSession);

    const results = await Promise.all([
      renewRejectedManagedSession(secretStore, "access-1", factory),
      renewRejectedManagedSession(secretStore, "access-1", factory),
    ]);

    expect(results).toEqual([
      { ok: true, sessionToken: "access-2" },
      { ok: true, sessionToken: "access-2" },
    ]);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("keeps every credential when the refresh cannot be completed", async () => {
    const secretStore = await storeWith();
    const refreshSession = jest.fn(async () => ({
      ok: false as const,
      errorCode: "network_failed" as const,
    }));

    await expect(
      renewRejectedManagedSession(
        secretStore,
        "access-1",
        createRefreshingClient(refreshSession),
      ),
    ).resolves.toEqual({ ok: false, errorCode: "refresh_unavailable" });
    const stored = await secretStore.readSyncSecrets();
    expect(stored?.managedAuthSessionToken).toBe("access-1");
    expect(stored?.managedRefreshToken).toBe("refresh-1");
  });

  it("clears the credentials when the refresh token itself is refused", async () => {
    const secretStore = await storeWith();
    const refreshSession = jest.fn(async () => ({
      ok: false as const,
      errorCode: "unauthorized" as const,
    }));

    await expect(
      renewRejectedManagedSession(
        secretStore,
        "access-1",
        createRefreshingClient(refreshSession),
      ),
    ).resolves.toEqual({ ok: false, errorCode: "session_expired" });
    const stored = await secretStore.readSyncSecrets();
    expect(stored?.managedAuthSessionToken).toBeNull();
    expect(stored?.managedRefreshToken).toBeNull();
  });

  it("ends a rejected legacy session that has no refresh token to fall back on", async () => {
    const secretStore = await storeWith({
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
    });
    const refreshSession = okRefresh("access-2", "refresh-2");

    await expect(
      renewRejectedManagedSession(
        secretStore,
        "access-1",
        createRefreshingClient(refreshSession),
      ),
    ).resolves.toEqual({ ok: false, errorCode: "session_expired" });
    expect(refreshSession).not.toHaveBeenCalled();
    expect((await secretStore.readSyncSecrets())?.managedAuthSessionToken).toBeNull();
  });

  it("reports no session when the device holds none", async () => {
    await expect(
      renewRejectedManagedSession(createSyncSecretStoreMock(), "access-1"),
    ).resolves.toEqual({ ok: false, errorCode: "no_session" });
  });

  it("waits out a scheduled refresh in flight and retries with its token", async () => {
    const secretStore = await storeWith({
      managedAuthSessionExpiresAt: "2026-07-21T12:01:00.000Z",
    });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const okResult = okRefresh("access-2", "refresh-2");
    const refreshSession = jest.fn(async () => {
      await gate;
      return okResult();
    });
    const factory = createRefreshingClient(refreshSession as never);

    const scheduledPending = ensureFreshManagedSession(secretStore, NOW, factory);
    await new Promise((resolve) => setImmediate(resolve));
    expect(refreshSession).toHaveBeenCalledTimes(1);
    const renewedPending = renewRejectedManagedSession(secretStore, "access-1", factory);
    release();
    const [scheduled, renewed] = await Promise.all([scheduledPending, renewedPending]);

    expect(scheduled).toEqual({ ok: true, sessionToken: "access-2", refreshed: true });
    expect(renewed).toEqual({ ok: true, sessionToken: "access-2" });
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });
});

describe("refresh flights that see a different record than their caller", () => {
  beforeEach(() => {
    resetManagedSessionRefreshStateForTests();
  });

  const DUE = "2026-07-21T12:01:00.000Z";
  const FAR = "2026-07-22T12:00:00.000Z";

  // Holds the reads whose 1-based index is in `held` until released; each
  // read's snapshot is taken when it is made, not when it is handed back.
  function holdReads(secretStore: ReturnType<typeof createSyncSecretStoreMock>, held: number[]) {
    const realRead = secretStore.readSyncSecrets.bind(secretStore);
    const releases = new Map<number, () => void>();
    const gates = new Map<number, Promise<void>>();
    for (const index of held) {
      gates.set(index, new Promise<void>((resolve) => releases.set(index, resolve)));
    }
    let reads = 0;
    jest.spyOn(secretStore, "readSyncSecrets").mockImplementation(async () => {
      reads += 1;
      const gate = gates.get(reads);
      const snapshot = await realRead();
      if (gate) {
        await gate;
      }
      return snapshot;
    });
    return (index: number) => releases.get(index)!();
  }

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  async function update(
    store: ReturnType<typeof createSyncSecretStoreMock>,
    patch: Partial<SyncSecretsRecord>,
  ) {
    const current = await store.readSyncSecrets();
    await store.writeSyncSecrets({ ...current!, ...patch });
  }

  it("reports no session when the session is cleared before the flight reads it", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(createSecrets({ managedAuthSessionExpiresAt: DUE }));
    const release = holdReads(secretStore, [1]);
    const refreshSession = okRefresh("access-2", "refresh-2");

    const pending = ensureFreshManagedSession(secretStore, NOW, createRefreshingClient(refreshSession));
    await flush();
    await secretStore.clearSyncSecrets();
    release(1);

    await expect(pending).resolves.toEqual({ ok: false, errorCode: "no_session" });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("keeps the session unrenewed when its refresh token is gone by the time the flight reads it", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(createSecrets({ managedAuthSessionExpiresAt: DUE }));
    const release = holdReads(secretStore, [1]);
    const refreshSession = okRefresh("access-2", "refresh-2");

    const pending = ensureFreshManagedSession(secretStore, NOW, createRefreshingClient(refreshSession));
    await flush();
    await update(secretStore, { managedRefreshToken: null, managedRefreshTokenExpiresAt: null });
    release(1);

    await expect(pending).resolves.toEqual({
      ok: true,
      sessionToken: "access-1",
      refreshed: false,
    });
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("runs its own exchange after joining a scheduled flight that found nothing due", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(createSecrets({ managedAuthSessionExpiresAt: DUE }));
    const release = holdReads(secretStore, [1, 3]);
    const refreshSession = okRefresh("access-2", "refresh-2");
    const factory = createRefreshingClient(refreshSession);

    const scheduled = ensureFreshManagedSession(secretStore, NOW, factory);
    await flush();
    // Read 2 (inside update): the session's expiry moves out before the
    // flight's own read, read 3, is made.
    await update(secretStore, { managedAuthSessionExpiresAt: FAR });
    release(1);
    await flush();
    const renewed = renewRejectedManagedSession(secretStore, "access-1", factory);
    release(3);

    await expect(scheduled).resolves.toEqual({
      ok: true,
      sessionToken: "access-1",
      refreshed: false,
    });
    await expect(renewed).resolves.toEqual({ ok: true, sessionToken: "access-2" });
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("uses the stored token after joining a failed scheduled flight on a newer session", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(createSecrets({ managedAuthSessionExpiresAt: DUE }));
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const refreshSession = jest.fn(async () => {
      await gate;
      return { ok: false as const, errorCode: "network_failed" as const };
    });
    const factory = createRefreshingClient(refreshSession as never);

    const scheduled = ensureFreshManagedSession(secretStore, NOW, factory);
    await flush();
    const renewed = renewRejectedManagedSession(secretStore, "access-0", factory);
    release();

    await expect(scheduled).resolves.toEqual({
      ok: true,
      sessionToken: "access-1",
      refreshed: false,
    });
    await expect(renewed).resolves.toEqual({ ok: true, sessionToken: "access-1" });
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("reports the refresh unavailable when the exchange hands back the rejected token", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(createSecrets());

    await expect(
      renewRejectedManagedSession(
        secretStore,
        "access-1",
        createRefreshingClient(okRefresh("access-1", "refresh-2")),
      ),
    ).resolves.toEqual({ ok: false, errorCode: "refresh_unavailable" });
  });

  it("lets a caller wait out the refresh in flight", async () => {
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets(createSecrets({ managedAuthSessionExpiresAt: DUE }));
    const refreshSession = okRefresh("access-2", "refresh-2");

    const pending = ensureFreshManagedSession(secretStore, NOW, createRefreshingClient(refreshSession));
    await flush();
    await settleInFlightManagedRefresh();

    expect((await secretStore.readSyncSecrets())?.managedAuthSessionToken).toBe("access-2");
    await pending;
  });
});
