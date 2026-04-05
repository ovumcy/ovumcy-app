import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import { loadManagedPartnerAccess } from "./managed-partner-access-service";

describe("managed-partner-access-service", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns not_connected without a managed session", async () => {
    const syncSecretStore = createSyncSecretStoreMock();

    await expect(
      loadManagedPartnerAccess(syncSecretStore, "managed"),
    ).resolves.toEqual({
      ok: false,
      errorCode: "not_connected",
    });
  });
  it("loads partner access through the managed session token", async () => {
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets({
      device: {
        deviceID: "device-1",
        deviceLabel: "Pixel 7",
        createdAt: "2026-04-05T08:00:00.000Z",
      },
      masterKeyHex: "aa",
      deviceSecretHex: "bb",
      wrappedKey: {
        algorithm: "xchacha20poly1305",
        kdf: "bip39_seed_hkdf_sha256",
        mnemonicWordCount: 12,
        wrapNonceHex: "cc",
        wrappedMasterKeyHex: "dd",
        phraseFingerprintHex: "ee",
      },
      authSessionToken: null,
      managedAuthSessionToken: "managed-session-1",
    });
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          owned: {
            invites: [],
            grants: [],
          },
          shared_with_me: [
            {
              id: "grant-1",
              owner_account_id: "owner-1",
              partner_account_id: "partner-1",
              partner_email: "partner@example.com",
              access_level: "summary",
              email_notifications_allowed: false,
              source_invite_id: "invite-1",
              accepted_at: "2026-04-05T08:00:00.000Z",
              last_seen_at: "2026-04-05T08:10:00.000Z",
              created_at: "2026-04-05T08:00:00.000Z",
              updated_at: "2026-04-05T08:10:00.000Z",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    ) as typeof fetch;

    await expect(
      loadManagedPartnerAccess(syncSecretStore, "managed"),
    ).resolves.toEqual({
      ok: true,
      value: {
        owned: {
          invites: [],
          grants: [],
        },
        sharedWithMe: [
          expect.objectContaining({
            id: "grant-1",
            partnerEmail: "partner@example.com",
          }),
        ],
      },
    });
  });
});
