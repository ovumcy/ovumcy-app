import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "../sync/sync-contract";
import {
  shouldBlockManagedRecoveryAction,
  shouldRotateManagedRecoveryPhrase,
} from "./backup-sync-view-service";

function managed(overrides: Partial<SyncPreferencesRecord> = {}): SyncPreferencesRecord {
  return {
    ...createDefaultSyncPreferencesRecord(),
    mode: "managed",
    setupStatus: "connected",
    ...overrides,
  };
}

const CONNECTED = { hasStoredSyncSecrets: true, hasSyncSession: true };

describe("shouldBlockManagedRecoveryAction", () => {
  it("blocks the recovery action on a connected, non-guest managed account with no floor", () => {
    const input = { ...CONNECTED, preferences: managed({ lastRemoteGeneration: null }) };

    expect(shouldBlockManagedRecoveryAction(input)).toBe(true);
    expect(shouldRotateManagedRecoveryPhrase(input)).toBe(false);
  });

  it.each([
    ["a floor (rotation applies)", CONNECTED, managed({ lastRemoteGeneration: 100 })],
    ["a guest session", CONNECTED, managed({ guestSessionExpiresAt: "2026-04-20T08:00:00.000Z" })],
    ["no session", { ...CONNECTED, hasSyncSession: false }, managed()],
    ["no stored secrets", { ...CONNECTED, hasStoredSyncSecrets: false }, managed()],
    ["self-hosted mode", CONNECTED, managed({ mode: "self_hosted" })],
  ])("leaves the action alone with %s", (_label, flags, preferences) => {
    expect(shouldBlockManagedRecoveryAction({ ...flags, preferences })).toBe(false);
  });
});
