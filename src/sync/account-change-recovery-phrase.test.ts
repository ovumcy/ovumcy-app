import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  acknowledgeAccountChangeRecoveryPhrase,
  clearAccountChangeRecoveryPhrase,
  holdAccountChangeRecoveryPhrase,
  loadAccountChangeRecoveryPhraseState,
  readPendingAccountChangeRecoveryPhrase,
} from "./account-change-recovery-phrase";
import type { SyncSecretsRecord } from "./sync-contract";

const NOW = new Date("2026-03-20T08:05:00.000Z");

function replacedKey(): { secrets: SyncSecretsRecord; phrase: string } {
  const fresh = createSyncSecretsRecord("Pixel 7", NOW);
  return {
    secrets: { ...fresh.record, managedAuthSessionToken: "managed-session", recoveryPhraseUnrevealed: true },
    phrase: fresh.recoveryPhrase,
  };
}

describe("account-change recovery phrase", () => {
  afterEach(() => {
    clearAccountChangeRecoveryPhrase();
  });

  it("offers nothing for a key from setup or recovery", async () => {
    const secretStore = createSyncSecretStoreMock(createSyncSecretsRecord("Pixel 7", NOW).record);
    holdAccountChangeRecoveryPhrase("stray phrase", "00");

    await expect(loadAccountChangeRecoveryPhraseState(secretStore)).resolves.toBe("none");
    await expect(readPendingAccountChangeRecoveryPhrase(secretStore)).resolves.toBeNull();
  });

  it("offers the reveal while the phrase of the current key is held, and reading keeps it", async () => {
    const { secrets, phrase } = replacedKey();
    const secretStore = createSyncSecretStoreMock(secrets);
    holdAccountChangeRecoveryPhrase(phrase, secrets.masterKeyHex);

    await expect(loadAccountChangeRecoveryPhraseState(secretStore)).resolves.toBe("reveal");
    await expect(readPendingAccountChangeRecoveryPhrase(secretStore)).resolves.toBe(phrase);
    await expect(readPendingAccountChangeRecoveryPhrase(secretStore)).resolves.toBe(phrase);
  });

  it("offers a new phrase after a process kill emptied the buffer before the acknowledgement", async () => {
    const { secrets, phrase } = replacedKey();
    const secretStore = createSyncSecretStoreMock(secrets);
    holdAccountChangeRecoveryPhrase(phrase, secrets.masterKeyHex);

    let restarted: typeof import("./account-change-recovery-phrase") | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      restarted = require("./account-change-recovery-phrase");
    });
    if (!restarted) {
      throw new Error("module did not load");
    }

    await expect(restarted.loadAccountChangeRecoveryPhraseState(secretStore)).resolves.toBe(
      "replace",
    );
    await expect(restarted.readPendingAccountChangeRecoveryPhrase(secretStore)).resolves.toBeNull();
  });

  it("never hands out a held phrase for a different key", async () => {
    const { secrets, phrase } = replacedKey();
    const other = replacedKey();
    const secretStore = createSyncSecretStoreMock(other.secrets);
    holdAccountChangeRecoveryPhrase(phrase, secrets.masterKeyHex);

    await expect(readPendingAccountChangeRecoveryPhrase(secretStore)).resolves.toBeNull();
    await expect(loadAccountChangeRecoveryPhraseState(secretStore)).resolves.toBe("replace");
  });

  it("settles on acknowledgement: buffer emptied, flag removed, every other secret kept", async () => {
    const { secrets, phrase } = replacedKey();
    const secretStore = createSyncSecretStoreMock(secrets);
    holdAccountChangeRecoveryPhrase(phrase, secrets.masterKeyHex);

    await acknowledgeAccountChangeRecoveryPhrase(secretStore);

    const { recoveryPhraseUnrevealed: _flag, ...rest } = secrets;
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(rest);
    await expect(loadAccountChangeRecoveryPhraseState(secretStore)).resolves.toBe("none");
    holdAccountChangeRecoveryPhrase(phrase, secrets.masterKeyHex);
    await expect(readPendingAccountChangeRecoveryPhrase(secretStore)).resolves.toBeNull();
  });

  it("writes nothing on an acknowledgement for a key without the flag", async () => {
    const secretStore = createSyncSecretStoreMock(createSyncSecretsRecord("Pixel 7", NOW).record);
    const write = jest.spyOn(secretStore, "writeSyncSecrets");

    await acknowledgeAccountChangeRecoveryPhrase(secretStore);

    expect(write).not.toHaveBeenCalled();
  });

  it("offers nothing when the secret store cannot be read", async () => {
    const { secrets, phrase } = replacedKey();
    const secretStore = createSyncSecretStoreMock(secrets);
    holdAccountChangeRecoveryPhrase(phrase, secrets.masterKeyHex);
    jest.spyOn(secretStore, "readSyncSecrets").mockRejectedValue(new Error("locked"));

    await expect(loadAccountChangeRecoveryPhraseState(secretStore)).resolves.toBe("none");
    await expect(readPendingAccountChangeRecoveryPhrase(secretStore)).resolves.toBeNull();
  });
});
