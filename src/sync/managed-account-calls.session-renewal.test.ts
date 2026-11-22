import { createSyncSecretsRecord } from "../security/sync-crypto";
import type { SyncSecretStore } from "../security/sync-secret-store";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type {
  ManagedCloudAPIClient,
  ManagedCloudAPIErrorCode,
} from "./managed-cloud-api-client";
import { resetManagedSessionRefreshStateForTests } from "./managed-session-refresh-service";
import {
  changeSyncAccountPassword,
  regenerateSyncAccountRecoveryCode,
} from "./sync-account-recovery-service";
import {
  createDefaultSyncPreferencesRecord,
  type SyncSecretsRecord,
} from "./sync-contract";
import {
  disableTOTP,
  startTOTPEnrollment,
  verifyTOTPEnrollment,
} from "./sync-totp-service";

const managedPreferences = {
  ...createDefaultSyncPreferencesRecord(),
  mode: "managed" as const,
  deviceLabel: "Pixel 7",
  setupStatus: "connected" as const,
};

const UNAUTHORIZED = { ok: false as const, errorCode: "unauthorized" as const };

type Site =
  | "startTOTPEnrollment"
  | "verifyTOTPEnrollment"
  | "disableTOTP"
  | "changePassword"
  | "regenerateRecoveryCode";

type RefreshAnswer =
  | { ok: true }
  | { ok: false; errorCode: ManagedCloudAPIErrorCode };

const OK_ANSWERS: Record<Site, unknown> = {
  startTOTPEnrollment: {
    ok: true,
    enrollment: {
      secret: "JBSWY3DPEHPK3PXP",
      otpauthURL: "otpauth://totp/ovumcy:alice@example.com?secret=JBSWY3DPEHPK3PXP",
    },
  },
  verifyTOTPEnrollment: { ok: true },
  disableTOTP: { ok: true },
  changePassword: { ok: true },
  regenerateRecoveryCode: {
    ok: true,
    result: { recoveryCode: "abcd1234abcd1234abcd1234abcd1234" },
  },
};

// A managed cloud that refuses "access-1" on the site under test, accepts any
// other token, and answers a refresh of "refresh-1" with the "access-2" pair.
function createManagedCloud(site: Site, refreshAnswer: RefreshAnswer = { ok: true }) {
  const call = jest.fn((token: string) =>
    Promise.resolve(token === "access-1" ? UNAUTHORIZED : OK_ANSWERS[site]),
  );
  const refreshSession = jest.fn((refreshToken: string) =>
    Promise.resolve(
      refreshAnswer.ok && refreshToken === "refresh-1"
        ? {
            ok: true as const,
            auth: {
              accountID: "managed-account-1",
              email: "alice@example.com",
              sessionToken: "access-2",
              sessionExpiresAt: "2099-03-21T08:00:00.000Z",
              entitlement: {
                syncAllowed: true,
                source: "manual",
                updatedAt: "2026-03-20T08:05:00.000Z",
                effectiveAt: "2026-03-20T08:05:00.000Z",
                explanation: "",
              },
              refreshToken: "refresh-2",
              refreshTokenExpiresAt: "2099-06-18T08:00:00.000Z",
            },
          }
        : refreshAnswer.ok
          ? UNAUTHORIZED
          : refreshAnswer,
    ),
  );
  const client = { [site]: call, refreshSession };
  const managedClientFactory = jest.fn(
    () => client as unknown as ManagedCloudAPIClient,
  );
  return { call, refreshSession, managedClientFactory };
}

function createStore(overrides: Partial<SyncSecretsRecord> = {}): SyncSecretStore {
  const prepared = createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z"));
  return createSyncSecretStoreMock({
    ...prepared.record,
    managedAuthSessionToken: "access-1",
    managedRefreshToken: "refresh-1",
    managedRefreshTokenExpiresAt: "2099-06-18T08:00:00.000Z",
    ...overrides,
  });
}

type Cloud = ReturnType<typeof createManagedCloud>;

const unusedSyncAPIFactory = jest.fn();

const callSites: {
  name: string;
  site: Site;
  invoke: (
    secretStore: SyncSecretStore,
    cloud: Cloud,
  ) => Promise<{ ok: boolean; errorCode?: string }>;
}[] = [
  {
    name: "TOTP enrollment start",
    site: "startTOTPEnrollment",
    invoke: (secretStore, cloud) =>
      startTOTPEnrollment(
        secretStore,
        managedPreferences,
        { currentPassword: "correct horse battery staple" },
        unusedSyncAPIFactory,
        cloud.managedClientFactory,
      ),
  },
  {
    name: "TOTP enrollment verify",
    site: "verifyTOTPEnrollment",
    invoke: (secretStore, cloud) =>
      verifyTOTPEnrollment(
        secretStore,
        managedPreferences,
        { code: "123456" },
        unusedSyncAPIFactory,
        cloud.managedClientFactory,
      ),
  },
  {
    name: "TOTP disable",
    site: "disableTOTP",
    invoke: (secretStore, cloud) =>
      disableTOTP(
        secretStore,
        managedPreferences,
        { currentPassword: "correct horse battery staple", code: "123456" },
        unusedSyncAPIFactory,
        cloud.managedClientFactory,
      ),
  },
  {
    name: "password change",
    site: "changePassword",
    invoke: (secretStore, cloud) =>
      changeSyncAccountPassword(
        secretStore,
        managedPreferences,
        {
          currentPassword: "correct horse battery staple",
          newPassword: "another horse battery staple",
        },
        unusedSyncAPIFactory,
        cloud.managedClientFactory,
      ),
  },
  {
    name: "recovery code regeneration",
    site: "regenerateRecoveryCode",
    invoke: (secretStore, cloud) =>
      regenerateSyncAccountRecoveryCode(
        secretStore,
        managedPreferences,
        { currentPassword: "correct horse battery staple" },
        unusedSyncAPIFactory,
        cloud.managedClientFactory,
      ),
  },
];

describe("managed account calls session renewal", () => {
  beforeEach(() => {
    resetManagedSessionRefreshStateForTests();
  });

  it.each(callSites)(
    "renews a 401 on the managed $name call and retries it once with the renewed token",
    async ({ site, invoke }) => {
      const secretStore = createStore();
      const cloud = createManagedCloud(site);

      const result = await invoke(secretStore, cloud);

      expect(result.ok).toBe(true);
      expect(cloud.refreshSession).toHaveBeenCalledTimes(1);
      expect(cloud.call.mock.calls.map(([token]) => token)).toEqual([
        "access-1",
        "access-2",
      ]);
      await expect(secretStore.readSyncSecrets()).resolves.toEqual(
        expect.objectContaining({
          managedAuthSessionToken: "access-2",
          managedRefreshToken: "refresh-2",
        }),
      );
    },
  );

  it.each(callSites)(
    "keeps the session and reports generic, not unauthorized, when the refresh after a 401 on the managed $name call fails",
    async ({ site, invoke }) => {
      const secretStore = createStore();
      const cloud = createManagedCloud(site, { ok: false, errorCode: "network_failed" });

      const result = await invoke(secretStore, cloud);

      expect(result).toEqual({ ok: false, errorCode: "generic" });
      await expect(secretStore.readSyncSecrets()).resolves.toEqual(
        expect.objectContaining({
          managedAuthSessionToken: "access-1",
          managedRefreshToken: "refresh-1",
        }),
      );
    },
  );

  it.each(callSites)(
    "clears the session and reports unauthorized when the refresh token itself is refused after a 401 on the managed $name call",
    async ({ site, invoke }) => {
      const secretStore = createStore();
      const cloud = createManagedCloud(site, { ok: false, errorCode: "unauthorized" });

      const result = await invoke(secretStore, cloud);

      expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
      await expect(secretStore.readSyncSecrets()).resolves.toEqual(
        expect.objectContaining({
          managedAuthSessionToken: null,
          managedRefreshToken: null,
        }),
      );
    },
  );

  it.each(callSites)(
    "reports not_connected when the managed session is gone by the time the $name call runs",
    async ({ site, invoke }) => {
      const record = await createStore().readSyncSecrets();
      let reads = 0;
      const secretStore = createSyncSecretStoreMock(record);
      const readSyncSecrets = secretStore.readSyncSecrets.bind(secretStore);
      secretStore.readSyncSecrets = async () => {
        reads += 1;
        const current = await readSyncSecrets();
        return reads === 1 || !current
          ? current
          : { ...current, managedAuthSessionToken: null };
      };
      const cloud = createManagedCloud(site);

      const result = await invoke(secretStore, cloud);

      expect(result).toEqual({ ok: false, errorCode: "not_connected" });
      expect(cloud.call).not.toHaveBeenCalled();
    },
  );
});
