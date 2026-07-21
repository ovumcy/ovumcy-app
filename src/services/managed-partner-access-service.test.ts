import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  acceptManagedPartnerInviteAsGuest,
  loadManagedPartnerAccess,
} from "./managed-partner-access-service";

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
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
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
              access_level: "summary",
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
          }),
        ],
      },
    });
  });

  describe("acceptManagedPartnerInviteAsGuest", () => {
    it("redeems the invite with no session precondition and no bearer, returning the session + grant + invite", async () => {
      global.fetch = jest.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            account_id: "guest-account-1",
            session_token: "guest-session-1",
            session_expires_at: "2026-04-12T00:00:00.000Z",
            grant: {
              id: "grant-9",
              owner_account_id: "owner-1",
              partner_account_id: "guest-account-1",
              access_level: "full",
              source_invite_id: "invite-9",
              accepted_at: "2026-04-05T08:00:00.000Z",
              last_seen_at: "2026-04-05T08:00:00.000Z",
              created_at: "2026-04-05T08:00:00.000Z",
              updated_at: "2026-04-05T08:00:00.000Z",
            },
            invite: {
              id: "invite-9",
              owner_account_id: "owner-1",
              access_level: "full",
              status: "accepted",
              expires_at: "2026-04-10T00:00:00.000Z",
              accepted_at: "2026-04-05T08:00:00.000Z",
              accepted_account_id: "guest-account-1",
              created_by: "owner-1",
              created_at: "2026-04-01T00:00:00.000Z",
              updated_at: "2026-04-05T08:00:00.000Z",
            },
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ) as typeof fetch;

      // No syncSecretStore/syncMode argument at all: unlike every other
      // function in this file, the guest endpoint has no session to read —
      // that is the entire point of the one-tap guest flow.
      await expect(
        acceptManagedPartnerInviteAsGuest("invite-token-9-fixture-padding"),
      ).resolves.toEqual({
        ok: true,
        value: {
          accountID: "guest-account-1",
          sessionToken: "guest-session-1",
          sessionExpiresAt: "2026-04-12T00:00:00.000Z",
          grant: expect.objectContaining({ id: "grant-9" }),
          invite: expect.objectContaining({ id: "invite-9", status: "accepted" }),
        },
      });

      const call = (global.fetch as jest.Mock).mock.calls[0];
      expect((call?.[1]?.headers as Headers).has("Authorization")).toBe(false);
    });

    it("maps each guest-accept error key the same way the logged-in accept path does", async () => {
      global.fetch = jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "partner_invite_expired" }), {
          status: 410,
          headers: { "Content-Type": "application/json" },
        }),
      ) as typeof fetch;

      await expect(
        acceptManagedPartnerInviteAsGuest("expired-token"),
      ).resolves.toEqual({ ok: false, errorCode: "partner_invite_expired" });
    });
  });
});
