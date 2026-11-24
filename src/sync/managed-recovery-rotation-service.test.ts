import {
  createSyncSecretsRecord,
  unwrapMasterKeyWithRecoveryPhrase,
} from "../security/sync-crypto";
import type { SyncSecretStore } from "../security/sync-secret-store";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type {
  ManagedCloudAPIClient,
  ManagedCloudAPIErrorCode,
} from "./managed-cloud-api-client";
import {
  clearPendingManagedRecoveryRotation,
  acknowledgeManagedRecoveryPhrase,
  peekUnacknowledgedManagedRecoveryPhrase,
  prepareManagedRecoveryRotationCandidate,
  rotateManagedRecoveryPhrase,
} from "./managed-recovery-rotation-service";
import type { SyncSecretsRecord, WrappedSyncKeyMetadata } from "./sync-contract";

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

const NOW = new Date("2026-11-19T12:00:00.000Z");
const PASSWORD = "correct horse battery staple 9000";
const CODE = "482913";

type ReplaceResult = { ok: true } | { ok: false; errorCode: ManagedCloudAPIErrorCode };

function createConnectedSecrets(): { phrase: string; secrets: SyncSecretsRecord } {
  const created = createSyncSecretsRecord("Pixel 7", NOW);
  return {
    phrase: created.recoveryPhrase,
    secrets: {
      ...created.record,
      authSessionToken: "sync-1",
      managedAuthSessionToken: "access-1",
    },
  };
}

function createClient(replies: ReplaceResult[]) {
  const replaceRecoveryKey = jest.fn(async () => {
    const next = replies.shift();
    if (!next) {
      throw new Error("unexpected request");
    }
    return next;
  });
  const createSyncSession = jest.fn(async () => ({
    ok: true as const,
    auth: {
      accountID: "acct-1",
      sessionToken: "sync-2",
      sessionExpiresAt: "2026-11-20T12:00:00.000Z",
      recoveryCode: null,
      totpChallenge: null,
    },
  }));
  const client = { replaceRecoveryKey, createSyncSession } as unknown as ManagedCloudAPIClient;
  return { client, replaceRecoveryKey, createSyncSession, factory: () => client };
}

function sentPackage(
  mock: jest.Mock,
  index: number,
): WrappedSyncKeyMetadata | undefined {
  const call = mock.mock.calls[index] as unknown as
    | [string, { recoveryKeyPackage: WrappedSyncKeyMetadata }]
    | undefined;
  return call?.[1].recoveryKeyPackage;
}

// The screen shows the candidate before every submit.
async function rotate(...args: Parameters<typeof rotateManagedRecoveryPhrase>) {
  await prepareManagedRecoveryRotationCandidate(args[0]);
  return rotateManagedRecoveryPhrase(...args);
}

describe("rotateManagedRecoveryPhrase", () => {
  beforeEach(() => {
    clearPendingManagedRecoveryRotation();
  });

  it("sends the candidate the user saw, unchanged across retries", async () => {
    const { secrets } = createConnectedSecrets();
    const store = createSyncSecretStoreMock(secrets);
    const { factory } = createClient([
      { ok: false, errorCode: "network_failed" },
      { ok: true },
    ]);

    const shown = await prepareManagedRecoveryRotationCandidate(store);
    expect(await prepareManagedRecoveryRotationCandidate(store)).toBe(shown);
    await rotateManagedRecoveryPhrase(store, { currentPassword: PASSWORD }, NOW, factory);
    expect(await prepareManagedRecoveryRotationCandidate(store)).toBe(shown);
    const confirmed = await rotateManagedRecoveryPhrase(
      store,
      { currentPassword: PASSWORD },
      NOW,
      factory,
    );

    expect(confirmed).toEqual({ ok: true, recoveryPhrase: shown });
    const adopted = (await store.readSyncSecrets())?.wrappedKey;
    expect(adopted && shown && unwrapMasterKeyWithRecoveryPhrase(shown, adopted)).toBe(
      secrets.masterKeyHex,
    );
  });

  it("sends nothing for a candidate the user never saw", async () => {
    const { secrets } = createConnectedSecrets();
    const store = createSyncSecretStoreMock(secrets);
    const { factory, replaceRecoveryKey } = createClient([{ ok: true }]);

    await expect(
      rotateManagedRecoveryPhrase(store, { currentPassword: PASSWORD }, NOW, factory),
    ).resolves.toEqual({ ok: false, errorCode: "generic" });
    expect(replaceRecoveryKey).not.toHaveBeenCalled();
  });

  it("sends nothing when the shown candidate wraps another master key", async () => {
    const { secrets } = createConnectedSecrets();
    const store = createSyncSecretStoreMock(secrets);
    const { factory, replaceRecoveryKey } = createClient([{ ok: true }]);
    await prepareManagedRecoveryRotationCandidate(store);
    await store.writeSyncSecrets({
      ...secrets,
      masterKeyHex: createSyncSecretsRecord("Pixel 7", NOW).record.masterKeyHex,
    });

    await expect(
      rotateManagedRecoveryPhrase(store, { currentPassword: PASSWORD }, NOW, factory),
    ).resolves.toEqual({ ok: false, errorCode: "generic" });
    expect(replaceRecoveryKey).not.toHaveBeenCalled();
  });

  it("prepares no candidate without a master key", async () => {
    const store = createSyncSecretStoreMock(null);

    await expect(prepareManagedRecoveryRotationCandidate(store)).resolves.toBeNull();
  });

  it("wraps the SAME master key under a new phrase and adopts it only after the 200", async () => {
    const { phrase: oldPhrase, secrets } = createConnectedSecrets();
    const store = createSyncSecretStoreMock(secrets);
    const { factory, replaceRecoveryKey } = createClient([{ ok: true }]);

    const result = await rotate(
      store,
      { currentPassword: PASSWORD, code: ` ${CODE} ` },
      NOW,
      factory,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.recoveryPhrase).not.toBe(oldPhrase);
    expect(replaceRecoveryKey).toHaveBeenCalledWith("access-1", {
      currentPassword: PASSWORD,
      code: CODE,
      recoveryKeyPackage: expect.any(Object),
      expectedPhraseFingerprintHex: secrets.wrappedKey.phraseFingerprintHex,
    });
    const stored = await store.readSyncSecrets();
    expect(stored?.wrappedKey).toEqual(sentPackage(replaceRecoveryKey, 0));
    expect(stored?.masterKeyHex).toBe(secrets.masterKeyHex);
    expect(unwrapMasterKeyWithRecoveryPhrase(result.recoveryPhrase, stored!.wrappedKey)).toBe(
      secrets.masterKeyHex,
    );
    expect(() => unwrapMasterKeyWithRecoveryPhrase(oldPhrase, stored!.wrappedKey)).toThrow();
  });

  it("sends no code field when none is given", async () => {
    const { secrets } = createConnectedSecrets();
    const { factory, replaceRecoveryKey } = createClient([{ ok: true }]);

    await rotate(
      createSyncSecretStoreMock(secrets),
      { currentPassword: PASSWORD, code: "  " },
      NOW,
      factory,
    );

    const call = replaceRecoveryKey.mock.calls[0] as unknown as [string, object];
    expect(call[1]).not.toHaveProperty("code");
  });

  it.each([
    ["sync_bridge_unavailable", "rotation_unconfirmed"],
    ["network_failed", "rotation_unconfirmed"],
    ["invalid_response", "rotation_unconfirmed"],
    ["invalid_current_password", "invalid_current_password"],
    ["totp_invalid_code", "totp_invalid_code"],
    ["totp_replayed", "totp_replayed"],
    ["rate_limited", "rate_limited"],
    ["unauthorized", "unauthorized"],
    ["totp_not_configured", "totp_not_configured"],
    // A deployment with no sync bridge replaced nothing: a refusal of its
    // own, not an unknown outcome.
    ["sync_not_configured", "sync_not_configured"],
  ] as const)(
    "keeps the old package on %s and retries with the same package",
    async (serverError, expected) => {
      const { secrets } = createConnectedSecrets();
      const store = createSyncSecretStoreMock(secrets);
      const { factory, replaceRecoveryKey } = createClient([
        { ok: false, errorCode: serverError },
        { ok: true },
      ]);

      const failed = await rotate(
        store,
        { currentPassword: PASSWORD, code: CODE },
        NOW,
        factory,
      );
      expect(failed).toEqual({ ok: false, errorCode: expected });
      expect((await store.readSyncSecrets())?.wrappedKey).toEqual(secrets.wrappedKey);

      const retried = await rotate(
        store,
        { currentPassword: PASSWORD, code: "111222" },
        NOW,
        factory,
      );
      expect(retried.ok).toBe(true);
      expect(sentPackage(replaceRecoveryKey, 1)).toEqual(sentPackage(replaceRecoveryKey, 0));
      expect((await store.readSyncSecrets())?.wrappedKey).toEqual(
        sentPackage(replaceRecoveryKey, 0),
      );
    },
  );

  it("drops a package the server refused as invalid and builds a fresh one", async () => {
    const { secrets } = createConnectedSecrets();
    const store = createSyncSecretStoreMock(secrets);
    const { factory, replaceRecoveryKey } = createClient([
      { ok: false, errorCode: "invalid_recovery_package" },
      { ok: true },
    ]);

    await expect(
      rotate(store, { currentPassword: PASSWORD }, NOW, factory),
    ).resolves.toEqual({ ok: false, errorCode: "generic" });
    await rotate(store, { currentPassword: PASSWORD }, NOW, factory);

    expect(sentPackage(replaceRecoveryKey, 1)?.phraseFingerprintHex).not.toBe(
      sentPackage(replaceRecoveryKey, 0)?.phraseFingerprintHex,
    );
  });

  it("expects the package this device holds on the first send and every resend", async () => {
    const { secrets } = createConnectedSecrets();
    const store = createSyncSecretStoreMock(secrets);
    const { factory, replaceRecoveryKey } = createClient([
      { ok: false, errorCode: "sync_bridge_unavailable" },
      { ok: true },
    ]);

    await rotate(store, { currentPassword: PASSWORD, code: CODE }, NOW, factory);
    await rotate(store, { currentPassword: PASSWORD, code: "111222" }, NOW, factory);

    for (const call of replaceRecoveryKey.mock.calls as unknown as [
      string,
      { expectedPhraseFingerprintHex?: string },
    ][]) {
      expect(call[1].expectedPhraseFingerprintHex).toBe(secrets.wrappedKey.phraseFingerprintHex);
    }
  });

  it("drops the candidate on a conflict and keeps the old package", async () => {
    const { secrets } = createConnectedSecrets();
    const store = createSyncSecretStoreMock(secrets);
    const { factory, replaceRecoveryKey } = createClient([
      { ok: false, errorCode: "recovery_key_conflict" },
    ]);

    const shown = await prepareManagedRecoveryRotationCandidate(store);
    const result = await rotateManagedRecoveryPhrase(
      store,
      { currentPassword: PASSWORD, code: CODE },
      NOW,
      factory,
    );

    expect(result).toEqual({ ok: false, errorCode: "recovery_key_conflict" });
    expect(replaceRecoveryKey).toHaveBeenCalledTimes(1);
    expect((await store.readSyncSecrets())?.wrappedKey).toEqual(secrets.wrappedKey);
    expect(peekUnacknowledgedManagedRecoveryPhrase()).toBeNull();
    expect(await prepareManagedRecoveryRotationCandidate(store)).not.toBe(shown);
  });

  it("drops the expectation once provisioning shows the server holds no package", async () => {
    const { secrets } = createConnectedSecrets();
    const store = createSyncSecretStoreMock(secrets);
    const { factory, replaceRecoveryKey } = createClient([
      { ok: false, errorCode: "sync_account_not_found" },
      { ok: true },
    ]);

    await expect(
      rotate(store, { currentPassword: PASSWORD, code: CODE }, NOW, factory),
    ).resolves.toEqual({ ok: false, errorCode: "totp_fresh_code_required" });
    await expect(
      rotate(store, { currentPassword: PASSWORD, code: "111222" }, NOW, factory),
    ).resolves.toMatchObject({ ok: true });

    const calls = replaceRecoveryKey.mock.calls as unknown as [string, object][];
    expect(calls[0]?.[1]).toHaveProperty(
      "expectedPhraseFingerprintHex",
      secrets.wrappedKey.phraseFingerprintHex,
    );
    expect(calls[1]?.[1]).not.toHaveProperty("expectedPhraseFingerprintHex");
    expect(sentPackage(replaceRecoveryKey, 1)).toEqual(sentPackage(replaceRecoveryKey, 0));
  });

  it("keeps a confirmed phrase across reads until it is acknowledged, and a session end clears it", async () => {
    const { secrets } = createConnectedSecrets();
    const store = createSyncSecretStoreMock(secrets);
    const { factory } = createClient([{ ok: true }, { ok: true }]);

    const result = await rotate(
      store,
      { currentPassword: PASSWORD },
      NOW,
      factory,
    );
    expect(result.ok).toBe(true);
    const phrase = result.ok ? result.recoveryPhrase : "";
    expect(peekUnacknowledgedManagedRecoveryPhrase()).toBe(phrase);
    expect(peekUnacknowledgedManagedRecoveryPhrase()).toBe(phrase);
    acknowledgeManagedRecoveryPhrase();
    expect(peekUnacknowledgedManagedRecoveryPhrase()).toBeNull();

    await rotate(store, { currentPassword: PASSWORD }, NOW, factory);
    clearPendingManagedRecoveryRotation();
    expect(peekUnacknowledgedManagedRecoveryPhrase()).toBeNull();
  });

  it("starts a fresh package after a confirmed rotation", async () => {
    const { secrets } = createConnectedSecrets();
    const store = createSyncSecretStoreMock(secrets);
    const { factory, replaceRecoveryKey } = createClient([{ ok: true }, { ok: true }]);

    await rotate(store, { currentPassword: PASSWORD }, NOW, factory);
    await rotate(store, { currentPassword: PASSWORD }, NOW, factory);

    expect(sentPackage(replaceRecoveryKey, 1)?.phraseFingerprintHex).not.toBe(
      sentPackage(replaceRecoveryKey, 0)?.phraseFingerprintHex,
    );
  });

  it("never reuses a pending package for a different master key", async () => {
    const first = createConnectedSecrets();
    const second = createConnectedSecrets();
    const { factory, replaceRecoveryKey } = createClient([
      { ok: false, errorCode: "sync_bridge_unavailable" },
      { ok: true },
    ]);

    await rotate(
      createSyncSecretStoreMock(first.secrets),
      { currentPassword: PASSWORD },
      NOW,
      factory,
    );
    const store = createSyncSecretStoreMock(second.secrets);
    const result = await rotate(
      store,
      { currentPassword: PASSWORD },
      NOW,
      factory,
    );

    expect(sentPackage(replaceRecoveryKey, 1)).not.toEqual(sentPackage(replaceRecoveryKey, 0));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        unwrapMasterKeyWithRecoveryPhrase(
          result.recoveryPhrase,
          (await store.readSyncSecrets())!.wrappedKey,
        ),
      ).toBe(second.secrets.masterKeyHex);
    }
  });

  it("provisions the sync account on 404 and resends a password-only step-up once", async () => {
    const { secrets } = createConnectedSecrets();
    const store = createSyncSecretStoreMock(secrets);
    const { factory, replaceRecoveryKey, createSyncSession } = createClient([
      { ok: false, errorCode: "sync_account_not_found" },
      { ok: true },
    ]);

    const result = await rotate(
      store,
      { currentPassword: PASSWORD },
      NOW,
      factory,
    );

    expect(result.ok).toBe(true);
    expect(createSyncSession).toHaveBeenCalledWith("access-1");
    expect(replaceRecoveryKey).toHaveBeenCalledTimes(2);
    expect(sentPackage(replaceRecoveryKey, 1)).toEqual(sentPackage(replaceRecoveryKey, 0));
    expect((replaceRecoveryKey.mock.calls as unknown as [string, object][])[1]?.[1]).not.toHaveProperty(
      "expectedPhraseFingerprintHex",
    );
    expect((await store.readSyncSecrets())?.authSessionToken).toBe("sync-2");
  });

  it("asks for a fresh code after provisioning on 404 instead of replaying the spent one", async () => {
    const { secrets } = createConnectedSecrets();
    const store = createSyncSecretStoreMock(secrets);
    const { factory, replaceRecoveryKey } = createClient([
      { ok: false, errorCode: "sync_account_not_found" },
    ]);

    const result = await rotate(
      store,
      { currentPassword: PASSWORD, code: CODE },
      NOW,
      factory,
    );

    expect(result).toEqual({ ok: false, errorCode: "totp_fresh_code_required" });
    expect(replaceRecoveryKey).toHaveBeenCalledTimes(1);
    expect((await store.readSyncSecrets())?.wrappedKey).toEqual(secrets.wrappedKey);
  });

  it("reports an unconfirmed rotation when the local write fails after the 200", async () => {
    const { secrets } = createConnectedSecrets();
    const backing = createSyncSecretStoreMock(secrets);
    const store: SyncSecretStore = {
      ...backing,
      writeSyncSecrets: jest.fn().mockRejectedValueOnce(new Error("keychain locked")),
    };
    const { factory } = createClient([{ ok: true }]);

    await expect(
      rotate(store, { currentPassword: PASSWORD }, NOW, factory),
    ).resolves.toEqual({ ok: false, errorCode: "rotation_unconfirmed" });
  });

  it("sends nothing without a managed session", async () => {
    const { secrets } = createConnectedSecrets();
    const { factory, replaceRecoveryKey } = createClient([]);

    await expect(
      rotate(
        createSyncSecretStoreMock({ ...secrets, managedAuthSessionToken: null }),
        { currentPassword: PASSWORD },
        NOW,
        factory,
      ),
    ).resolves.toEqual({ ok: false, errorCode: "not_connected" });
    expect(replaceRecoveryKey).not.toHaveBeenCalled();
  });

  it("reports unauthorized when the refresh chain is dead, using the current time by default", async () => {
    const { secrets } = createConnectedSecrets();
    const store = createSyncSecretStoreMock({
      ...secrets,
      managedAuthSessionExpiresAt: "2000-01-01T00:00:00.000Z",
      managedRefreshToken: "refresh-1",
      managedRefreshTokenExpiresAt: "2000-02-01T00:00:00.000Z",
    });
    const replaceRecoveryKey = jest.fn();
    const client = {
      refreshSession: jest.fn(async () => ({ ok: false, errorCode: "unauthorized" })),
      replaceRecoveryKey,
    } as unknown as ManagedCloudAPIClient;

    await expect(
      rotate(store, { currentPassword: PASSWORD }, undefined, () => client),
    ).resolves.toEqual({ ok: false, errorCode: "unauthorized" });
    expect(replaceRecoveryKey).not.toHaveBeenCalled();
  });

  it("sends nothing when the device holds no master key", async () => {
    const { secrets } = createConnectedSecrets();
    const { factory, replaceRecoveryKey } = createClient([]);

    await expect(
      rotate(
        createSyncSecretStoreMock({ ...secrets, masterKeyHex: "" }),
        { currentPassword: PASSWORD },
        NOW,
        factory,
      ),
    ).resolves.toEqual({ ok: false, errorCode: "not_connected" });
    expect(replaceRecoveryKey).not.toHaveBeenCalled();
  });

  it("stops when provisioning the sync account after a 404 fails", async () => {
    const { secrets } = createConnectedSecrets();
    const store = createSyncSecretStoreMock(secrets);
    const { client, replaceRecoveryKey, createSyncSession } = createClient([
      { ok: false, errorCode: "sync_account_not_found" },
    ]);
    createSyncSession.mockResolvedValueOnce({
      ok: false,
      errorCode: "network_failed",
    } as never);

    await expect(
      rotate(store, { currentPassword: PASSWORD }, NOW, () => client),
    ).resolves.toEqual({ ok: false, errorCode: "rotation_unconfirmed" });
    expect(replaceRecoveryKey).toHaveBeenCalledTimes(1);
    expect((await store.readSyncSecrets())?.authSessionToken).toBe("sync-1");
  });

  it("stores no provisioned token when the secrets vanished meanwhile", async () => {
    const { secrets } = createConnectedSecrets();
    const backing = createSyncSecretStoreMock(secrets);
    let reads = 0;
    const store: SyncSecretStore = {
      ...backing,
      readSyncSecrets: jest.fn(async () => {
        reads += 1;
        // Read 1 prepares the candidate; read 4 is the post-provision read.
        return reads === 4 ? null : backing.readSyncSecrets();
      }),
      writeSyncSecrets: jest.fn(backing.writeSyncSecrets),
    };
    const { factory } = createClient([
      { ok: false, errorCode: "sync_account_not_found" },
      { ok: true },
    ]);

    const result = await rotate(
      store,
      { currentPassword: PASSWORD },
      NOW,
      factory,
    );

    expect(result.ok).toBe(true);
    expect(store.writeSyncSecrets).toHaveBeenCalledTimes(1);
  });

  it("adopts nothing when the master key changed while the request was in flight", async () => {
    const { secrets } = createConnectedSecrets();
    const other = createConnectedSecrets().secrets;
    const backing = createSyncSecretStoreMock(secrets);
    let reads = 0;
    const store: SyncSecretStore = {
      ...backing,
      readSyncSecrets: jest.fn(async () => {
        reads += 1;
        // Read 1 prepares the candidate; read 4 is the post-200 read.
        return reads >= 4 ? other : backing.readSyncSecrets();
      }),
    };
    const { factory, replaceRecoveryKey } = createClient([{ ok: true }]);

    await expect(
      rotate(store, { currentPassword: PASSWORD }, NOW, factory),
    ).resolves.toEqual({ ok: false, errorCode: "generic" });
    expect(replaceRecoveryKey).toHaveBeenCalledTimes(1);
    expect((await backing.readSyncSecrets())?.wrappedKey).toEqual(secrets.wrappedKey);
  });

  it("never logs or returns the password, the code or the phrase on any path", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation(() => undefined),
    );
    try {
      const { secrets } = createConnectedSecrets();
      const store = createSyncSecretStoreMock(secrets);
      const { factory } = createClient([
        { ok: false, errorCode: "invalid_current_password" },
        { ok: false, errorCode: "sync_bridge_unavailable" },
        { ok: false, errorCode: "sync_account_not_found" },
        { ok: true },
      ]);

      const failures = [
        await rotate(store, { currentPassword: PASSWORD, code: CODE }, NOW, factory),
        await rotate(store, { currentPassword: PASSWORD, code: CODE }, NOW, factory),
        await rotate(store, { currentPassword: PASSWORD, code: CODE }, NOW, factory),
      ];
      const success = await rotate(
        store,
        { currentPassword: PASSWORD, code: CODE },
        NOW,
        factory,
      );
      expect(success.ok).toBe(true);
      const phrase = success.ok ? success.recoveryPhrase : "";

      const logged = spies
        .flatMap((spy) => spy.mock.calls)
        .map((args) => JSON.stringify(args))
        .join("\n");
      const failureText = JSON.stringify(failures);
      for (const secret of [PASSWORD, CODE, phrase]) {
        expect(logged).not.toContain(secret);
        expect(failureText).not.toContain(secret);
      }
      // Whole-word match over string values only: a mnemonic word may equal a
      // JSON key ("error" in `errorCode`) or literal ("false" in `"ok":false`)
      // without being a leak.
      const loggedValues = collectStrings(spies.flatMap((spy) => spy.mock.calls));
      const failureValues = collectStrings(failures);
      for (const word of phrase.split(" ").slice(0, 3)) {
        const asWord = new RegExp(`\\b${word}\\b`);
        expect(loggedValues.filter((value) => asWord.test(value))).toEqual([]);
        expect(failureValues.filter((value) => asWord.test(value))).toEqual([]);
      }
      const storedText = JSON.stringify(await store.readSyncSecrets());
      expect(storedText).not.toContain(PASSWORD);
      expect(storedText).not.toContain(phrase);
    } finally {
      for (const spy of spies) {
        spy.mockRestore();
      }
    }
  });
});
