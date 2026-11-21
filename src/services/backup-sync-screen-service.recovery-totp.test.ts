import * as syncClientService from "../sync/sync-client-service";
import {
  createDefaultSyncPreferencesRecord,
  type SyncCapabilityDocument,
  type SyncPreferencesRecord,
} from "../sync/sync-contract";
import * as syncTOTPService from "../sync/sync-totp-service";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createLoadedSettingsStateFixture } from "../test/create-backup-sync-session-core-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  completeBackupSyncRecoveryTOTPChallenge,
  recoverBackupSyncAccess,
} from "./backup-sync-screen-service";

const NOW = new Date("2026-03-20T08:05:00.000Z");
const PHRASE = "alpha beta gamma delta epsilon zeta";

const selfHosted: SyncPreferencesRecord = {
  ...createDefaultSyncPreferencesRecord(),
  mode: "self_hosted",
  endpointInput: "192.168.1.20:8080",
  deviceLabel: "Replacement phone",
};

const capabilities: SyncCapabilityDocument = {
  mode: "self_hosted",
  syncEnabled: true,
  recoverySupported: true,
  pushSupported: false,
  portalSupported: false,
  advancedCloudInsights: false,
  maxDevices: 5,
  maxBlobBytes: 16 << 20,
};

describe("backup-sync screen recovery with a TOTP challenge", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("passes a recovery's TOTP challenge through without building a state", async () => {
    const challenge = {
      ok: true as const,
      totpChallengeRequired: true as const,
      challengeID: "challenge-1",
      challengeExpiresAt: "2026-03-20T08:10:00.000Z",
    };
    jest.spyOn(syncClientService, "recoverSyncAccess").mockResolvedValue(challenge);

    const result = await recoverBackupSyncAccess(
      createLocalAppStorageMock(),
      createSyncSecretStoreMock(),
      createLoadedSettingsStateFixture({ savedSyncPreferences: selfHosted }),
      { login: "alice@example.com", password: "correct horse battery staple" },
      PHRASE,
      NOW,
    );

    expect(result).toEqual(challenge);
  });

  it("completes the challenge, then finishes the recovery with its token and the phrase", async () => {
    const recoveredPreferences: SyncPreferencesRecord = {
      ...selfHosted,
      setupStatus: "connected",
    };
    const completeSpy = jest.spyOn(syncTOTPService, "completeTOTPChallenge").mockResolvedValue({
      ok: true,
      auth: {
        accountID: "account-1",
        sessionToken: "session-after-totp",
        sessionExpiresAt: "2026-03-21T08:05:00.000Z",
      },
    });
    const finalizeSpy = jest
      .spyOn(syncClientService, "finalizeSyncRecoveryAfterTOTP")
      .mockResolvedValue({ ok: true, capabilities, preferences: recoveredPreferences });
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();

    const result = await completeBackupSyncRecoveryTOTPChallenge(
      storage,
      secretStore,
      createLoadedSettingsStateFixture(),
      selfHosted,
      { challengeID: "challenge-1", code: "123456", recoveryPhrase: PHRASE },
      NOW,
    );

    expect(completeSpy).toHaveBeenCalledWith(selfHosted, {
      challengeID: "challenge-1",
      code: "123456",
    });
    expect(finalizeSpy).toHaveBeenCalledWith(
      storage,
      secretStore,
      selfHosted,
      { sessionToken: "session-after-totp", recoveryPhrase: PHRASE },
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.hasSyncSession).toBe(true);
      expect(result.state.syncPreferences).toEqual(recoveredPreferences);
      expect(result.state.syncCapabilities).toEqual(capabilities);
    }
  });

  it("returns a refused code without finishing the recovery", async () => {
    jest
      .spyOn(syncTOTPService, "completeTOTPChallenge")
      .mockResolvedValue({ ok: false, errorCode: "totp_invalid_code" });
    const finalizeSpy = jest.spyOn(syncClientService, "finalizeSyncRecoveryAfterTOTP");

    const result = await completeBackupSyncRecoveryTOTPChallenge(
      createLocalAppStorageMock(),
      createSyncSecretStoreMock(),
      createLoadedSettingsStateFixture(),
      selfHosted,
      { challengeID: "challenge-1", code: "000000", recoveryPhrase: PHRASE },
      NOW,
    );

    expect(result).toEqual({ ok: false, errorCode: "totp_invalid_code" });
    expect(finalizeSpy).not.toHaveBeenCalled();
  });

  it("returns a failed resume as is", async () => {
    jest.spyOn(syncTOTPService, "completeTOTPChallenge").mockResolvedValue({
      ok: true,
      auth: {
        accountID: "account-1",
        sessionToken: "session-after-totp",
        sessionExpiresAt: "2026-03-21T08:05:00.000Z",
      },
    });
    jest
      .spyOn(syncClientService, "finalizeSyncRecoveryAfterTOTP")
      .mockResolvedValue({ ok: false, errorCode: "recovery_package_not_found" });

    const result = await completeBackupSyncRecoveryTOTPChallenge(
      createLocalAppStorageMock(),
      createSyncSecretStoreMock(),
      createLoadedSettingsStateFixture(),
      selfHosted,
      { challengeID: "challenge-1", code: "123456", recoveryPhrase: PHRASE },
      NOW,
    );

    expect(result).toEqual({ ok: false, errorCode: "recovery_package_not_found" });
  });
});
