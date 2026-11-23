import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { ManagedCloudAPIClient } from "./managed-cloud-api-client";
import { createDefaultSyncPreferencesRecord, type SyncPreferencesRecord } from "./sync-contract";
import { connectSyncAccount, recoverSyncAccess } from "./sync-client-service";

const NOW = new Date("2026-03-20T08:10:00.000Z");
const PHRASE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const managed: SyncPreferencesRecord = {
  ...createDefaultSyncPreferencesRecord(),
  mode: "managed",
  deviceLabel: "Pixel 7",
  setupStatus: "local_ready",
};

function managedFactory(answer: object, method: "login" | "register") {
  const client = { [method]: jest.fn().mockResolvedValue(answer) };
  return jest.fn().mockReturnValue(client as unknown as ManagedCloudAPIClient);
}

function connect(mode: "login" | "register", answer: object) {
  return connectSyncAccount(
    createLocalAppStorageMock(),
    createSyncSecretStoreMock(
      createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z")).record,
    ),
    managed,
    { login: "alice@example.com", password: "correct horse battery staple" },
    mode,
    NOW,
    jest.fn(),
    managedFactory(answer, mode),
  );
}

describe("managed sign-in refusals", () => {
  it("carries Retry-After from a rate-limited managed login to the connect result", async () => {
    await expect(
      connect("login", { ok: false, errorCode: "rate_limited", retryAfterSeconds: 60 }),
    ).resolves.toEqual({ ok: false, errorCode: "rate_limited", retryAfterSeconds: 60 });
  });

  it("carries Retry-After from a rate-limited managed register to the connect result", async () => {
    await expect(
      connect("register", { ok: false, errorCode: "rate_limited", retryAfterSeconds: 5 }),
    ).resolves.toEqual({ ok: false, errorCode: "rate_limited", retryAfterSeconds: 5 });
  });

  it("reports a register refused with trial_unavailable as generic, not a network failure", async () => {
    await expect(
      connect("register", { ok: false, errorCode: "trial_unavailable" }),
    ).resolves.toEqual({ ok: false, errorCode: "generic" });
  });

  it("carries Retry-After from a rate-limited managed recovery login to the recovery result", async () => {
    const result = await recoverSyncAccess(
      createLocalAppStorageMock(),
      createSyncSecretStoreMock(null),
      managed,
      { login: "alice@example.com", password: "correct horse battery staple" },
      PHRASE,
      NOW,
      jest.fn(),
      managedFactory({ ok: false, errorCode: "rate_limited", retryAfterSeconds: 30 }, "login"),
    );

    expect(result).toEqual({ ok: false, errorCode: "rate_limited", retryAfterSeconds: 30 });
  });
});
