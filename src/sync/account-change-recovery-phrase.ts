import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import type { SyncSecretStore } from "../security/sync-secret-store";
import type { SyncSecretsRecord } from "./sync-contract";

type PendingPhrase = {
  recoveryPhrase: string;
  masterKeyTag: string;
};

// Process memory only, never persisted, logged or returned in a connect result:
// a sign-in to another account created a new sync key, and its phrase waits
// here for the gated reveal. It survives an unmount, a reload and a disconnect
// (the key it belongs to stays on the device), and is bound to that key, so a
// later key change (regenerate, recover, wipe) makes it unreadable.
let pending: PendingPhrase | null = null;

const MASTER_KEY_TAG_INFO = "ovumcy-account-change-phrase-tag|";

/**
 * What the screen offers for a key a sign-in to another account created:
 * `reveal` while its phrase is still in memory, `replace` once a process kill
 * lost it before the acknowledgement (only a new phrase can be shown then),
 * `none` when no such key awaits.
 */
export type AccountChangeRecoveryPhraseState = "none" | "reveal" | "replace";

export function holdAccountChangeRecoveryPhrase(
  recoveryPhrase: string,
  masterKeyHex: string,
): void {
  pending = { recoveryPhrase, masterKeyTag: masterKeyTag(masterKeyHex) };
}

export async function loadAccountChangeRecoveryPhraseState(
  secretStore: SyncSecretStore,
): Promise<AccountChangeRecoveryPhraseState> {
  const secrets = await readSecretsOrNull(secretStore);
  if (!secrets?.recoveryPhraseUnrevealed) {
    return "none";
  }
  return matchPending(secrets) !== null ? "reveal" : "replace";
}

/**
 * The phrase for the device's current sync key, or null. Reading does not
 * consume it: only the acknowledgement after the reveal does, so a reveal
 * interrupted before that can be repeated behind the same gate.
 */
export async function readPendingAccountChangeRecoveryPhrase(
  secretStore: SyncSecretStore,
): Promise<string | null> {
  const secrets = await readSecretsOrNull(secretStore);
  if (!secrets?.recoveryPhraseUnrevealed) {
    return null;
  }
  return matchPending(secrets);
}

/**
 * Runs when the user confirmed they saved a revealed phrase. Any phrase shown
 * for the current key settles it: a setup or recovery key never carries the
 * flag, and a managed rotation wraps this same key under the phrase it shows.
 */
export async function acknowledgeAccountChangeRecoveryPhrase(
  secretStore: SyncSecretStore,
): Promise<void> {
  pending = null;
  const secrets = await readSecretsOrNull(secretStore);
  if (!secrets?.recoveryPhraseUnrevealed) {
    return;
  }
  const { recoveryPhraseUnrevealed: _settled, ...rest } = secrets;
  await secretStore.writeSyncSecrets(rest);
}

export function clearAccountChangeRecoveryPhrase(): void {
  pending = null;
}

function matchPending(secrets: SyncSecretsRecord): string | null {
  const held = pending;
  if (!held) {
    return null;
  }
  if (!secrets.masterKeyHex || masterKeyTag(secrets.masterKeyHex) !== held.masterKeyTag) {
    pending = null;
    return null;
  }
  return held.recoveryPhrase;
}

async function readSecretsOrNull(
  secretStore: SyncSecretStore,
): Promise<SyncSecretsRecord | null> {
  try {
    return await secretStore.readSyncSecrets();
  } catch {
    return null;
  }
}

function masterKeyTag(masterKeyHex: string): string {
  return bytesToHex(sha256(utf8ToBytes(`${MASTER_KEY_TAG_INFO}${masterKeyHex}`)));
}
