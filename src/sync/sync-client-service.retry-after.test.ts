import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import { createSyncAPIClient, type SyncAPIClient } from "./sync-api-client";
import { createDefaultSyncPreferencesRecord } from "./sync-contract";
import { connectSyncAccount, recoverSyncAccess } from "./sync-client-service";

const NOW = new Date("2026-03-20T08:00:00.000Z");
const selfHosted = {
  ...createDefaultSyncPreferencesRecord(),
  mode: "self_hosted" as const,
  endpointInput: "192.168.1.20:8080",
  normalizedEndpoint: "http://192.168.1.20:8080",
  deviceLabel: "Pixel 7",
  setupStatus: "local_ready" as const,
};
const credentials = { login: "owner@example.test", password: "CorrectHorseBattery42!" };
const throttled = { ok: false, errorCode: "rate_limited", retryAfterSeconds: 42 } as const;

function store() {
  return createSyncSecretStoreMock(createSyncSecretsRecord("Pixel 7", NOW).record);
}

function factory(overrides: Partial<SyncAPIClient>) {
  return jest.fn().mockReturnValue(overrides as SyncAPIClient);
}

describe("credential routes carry Retry-After", () => {
  it.each(["login", "register"] as const)("connect (%s) passes the wait through", async (mode) => {
    const call = jest.fn().mockResolvedValue(throttled);

    const result = await connectSyncAccount(
      createLocalAppStorageMock(),
      store(),
      selfHosted,
      credentials,
      mode,
      NOW,
      factory({ login: call, register: call }),
    );

    expect(result).toEqual({ ok: false, errorCode: "rate_limited", retryAfterSeconds: 42 });
  });

  it("connect leaves out a wait the server did not send", async () => {
    const result = await connectSyncAccount(
      createLocalAppStorageMock(),
      store(),
      selfHosted,
      credentials,
      "login",
      NOW,
      factory({ login: jest.fn().mockResolvedValue({ ok: false, errorCode: "rate_limited" }) }),
    );

    expect(result).toEqual({ ok: false, errorCode: "rate_limited" });
  });

  it("recover passes the wait through", async () => {
    const result = await recoverSyncAccess(
      createLocalAppStorageMock(),
      store(),
      selfHosted,
      credentials,
      createSyncSecretsRecord("Other", NOW).recoveryPhrase,
      NOW,
      factory({ login: jest.fn().mockResolvedValue(throttled) }),
    );

    expect(result).toEqual({ ok: false, errorCode: "rate_limited", retryAfterSeconds: 42 });
  });

  it.each(["login", "register"] as const)("the %s call reads the header", async (method) => {
    const fetchImpl = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "17" },
      }),
    );

    await expect(
      createSyncAPIClient("https://sync.example", fetchImpl)[method](credentials),
    ).resolves.toEqual({ ok: false, errorCode: "rate_limited", retryAfterSeconds: 17 });
  });
});
