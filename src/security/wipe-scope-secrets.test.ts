import {
  holdAccountChangeRecoveryPhrase,
  readPendingAccountChangeRecoveryPhrase,
} from "../sync/account-change-recovery-phrase";
import { readSyncWipeEpoch } from "../sync/sync-wipe-epoch";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import { createSyncSecretsRecord } from "./sync-crypto";
import { clearWipeScopeSecrets } from "./wipe-scope-secrets";

describe("clearWipeScopeSecrets", () => {
  it("drops an unrevealed account-change recovery phrase from memory", async () => {
    const fresh = createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:05:00.000Z"));
    const secrets = { ...fresh.record, recoveryPhraseUnrevealed: true as const };
    const secretStore = createSyncSecretStoreMock(secrets);
    holdAccountChangeRecoveryPhrase(fresh.recoveryPhrase, secrets.masterKeyHex);

    await clearWipeScopeSecrets(
      { clearSyncSecrets: jest.fn().mockResolvedValue(undefined) },
      {
        certPinStore: { clearAll: jest.fn().mockResolvedValue(undefined) },
        entitlementTokenStore: { clearEntitlementToken: jest.fn().mockResolvedValue(undefined) },
        partnerShareSecretStore: {
          clearPartnerShareSecrets: jest.fn().mockResolvedValue(undefined),
        },
      },
    );

    // The record is left in place on purpose: only the in-memory copy is tested.
    await expect(readPendingAccountChangeRecoveryPhrase(secretStore)).resolves.toBeNull();
  });

  it("advances the sync wipe epoch before the clears and again after them", async () => {
    const start = readSyncWipeEpoch();
    let duringClear: number | null = null;

    await clearWipeScopeSecrets(
      {
        clearSyncSecrets: jest.fn().mockImplementation(async () => {
          duringClear = readSyncWipeEpoch();
        }),
      },
      {
        certPinStore: { clearAll: jest.fn().mockResolvedValue(undefined) },
        entitlementTokenStore: { clearEntitlementToken: jest.fn().mockResolvedValue(undefined) },
        partnerShareSecretStore: {
          clearPartnerShareSecrets: jest.fn().mockResolvedValue(undefined),
        },
      },
    );

    expect(duringClear).not.toBeNull();
    expect(duringClear).not.toBe(start);
    expect(readSyncWipeEpoch()).not.toBe(duringClear);
  });

  it("advances the sync wipe epoch after the clears even when one throws", async () => {
    let duringClear: number | null = null;

    await expect(
      clearWipeScopeSecrets(
        {
          clearSyncSecrets: jest.fn().mockImplementation(async () => {
            duringClear = readSyncWipeEpoch();
            throw new Error("secure store unavailable");
          }),
        },
        {
          certPinStore: { clearAll: jest.fn().mockResolvedValue(undefined) },
          entitlementTokenStore: { clearEntitlementToken: jest.fn().mockResolvedValue(undefined) },
          partnerShareSecretStore: {
            clearPartnerShareSecrets: jest.fn().mockResolvedValue(undefined),
          },
        },
      ),
    ).rejects.toThrow("secure store unavailable");

    expect(readSyncWipeEpoch()).not.toBe(duringClear);
  });
});
