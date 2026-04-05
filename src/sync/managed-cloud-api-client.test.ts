import { createManagedCloudAPIClient } from "./managed-cloud-api-client";

describe("managed-cloud-api-client", () => {
  it("maps register, session, billing, and sync-session responses", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            account_id: "account-1",
            email: "owner@example.com",
            session_token: "managed-session-1",
            session_expires_at: "2026-03-24T00:00:00.000Z",
            sync_entitlement: {
              sync_allowed: false,
              source: "default_register",
              updated_at: "2026-03-23T00:00:00.000Z",
              effective_at: "2026-03-23T00:00:00.000Z",
              explanation: "Pending plan.",
            },
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            account_id: "account-1",
            email: "owner@example.com",
            session_expires_at: "2026-03-24T00:00:00.000Z",
            sync_entitlement: {
              sync_allowed: true,
              source: "manual_admin",
              updated_at: "2026-03-23T00:10:00.000Z",
              effective_at: "2026-03-23T00:10:00.000Z",
              explanation: "Granted for beta.",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            premium_features: {
              advanced_fertility: true,
              doctor_pdf: true,
              advanced_insights: true,
              extended_reports: true,
              partner_access: true,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            account_id: "account-1",
            session_token: "sync-session-1",
            session_expires_at: "2026-03-24T01:00:00.000Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const client = createManagedCloudAPIClient(
      "http://127.0.0.1:8090",
      fetch as unknown as typeof global.fetch,
    );

    await expect(
      client.register({
        email: "owner@example.com",
        password: "very-secure-pass",
      }),
    ).resolves.toEqual({
      ok: true,
      auth: expect.objectContaining({
        accountID: "account-1",
        email: "owner@example.com",
        sessionToken: "managed-session-1",
        entitlement: expect.objectContaining({
          syncAllowed: false,
        }),
      }),
    });

    await expect(client.getSession("managed-session-1")).resolves.toEqual({
      ok: true,
      session: expect.objectContaining({
        accountID: "account-1",
        entitlement: expect.objectContaining({
          syncAllowed: true,
        }),
      }),
    });

    await expect(client.getBillingSnapshot("managed-session-1")).resolves.toEqual({
      ok: true,
      billing: {
        premiumFeatures: {
          advancedFertility: true,
          advancedInsights: true,
          doctorPDF: true,
          extendedReports: true,
          partnerAccess: true,
        },
      },
    });

    await expect(client.createSyncSession("managed-session-1")).resolves.toEqual({
      ok: true,
      auth: {
        accountID: "account-1",
        sessionToken: "sync-session-1",
        sessionExpiresAt: "2026-03-24T01:00:00.000Z",
      },
    });
  });

  it("maps partner access lifecycle responses", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            owned: {
              invites: [
                {
                  id: "invite-1",
                  owner_account_id: "owner-1",
                  invited_email: "partner@example.com",
                  access_level: "summary",
                  email_notifications_allowed: false,
                  status: "pending",
                  expires_at: "2026-04-10T00:00:00.000Z",
                  created_by: "owner-1",
                  created_at: "2026-04-03T00:00:00.000Z",
                  updated_at: "2026-04-03T00:00:00.000Z",
                },
              ],
              grants: [],
            },
            shared_with_me: [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            invite: {
              id: "invite-2",
              owner_account_id: "owner-1",
              invited_email: "friend@example.com",
              access_level: "full",
              email_notifications_allowed: false,
              status: "pending",
              expires_at: "2026-04-11T00:00:00.000Z",
              created_by: "owner-1",
              created_at: "2026-04-04T00:00:00.000Z",
              updated_at: "2026-04-04T00:00:00.000Z",
            },
            invite_token: "invite-token-2",
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            invite: {
              id: "invite-2",
              owner_account_id: "owner-1",
              invited_email: "friend@example.com",
              access_level: "full",
              email_notifications_allowed: false,
              status: "accepted",
              expires_at: "2026-04-11T00:00:00.000Z",
              accepted_at: "2026-04-04T10:00:00.000Z",
              accepted_account_id: "partner-1",
              created_by: "owner-1",
              created_at: "2026-04-04T00:00:00.000Z",
              updated_at: "2026-04-04T10:00:00.000Z",
            },
            grant: {
              id: "grant-1",
              owner_account_id: "owner-1",
              partner_account_id: "partner-1",
              partner_email: "friend@example.com",
              access_level: "full",
              email_notifications_allowed: false,
              source_invite_id: "invite-2",
              accepted_at: "2026-04-04T10:00:00.000Z",
              last_seen_at: "2026-04-04T10:00:00.000Z",
              created_at: "2026-04-04T10:00:00.000Z",
              updated_at: "2026-04-04T10:00:00.000Z",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "invite-1",
            owner_account_id: "owner-1",
            invited_email: "partner@example.com",
            access_level: "summary",
            email_notifications_allowed: false,
            status: "revoked",
            expires_at: "2026-04-10T00:00:00.000Z",
            revoked_at: "2026-04-05T00:00:00.000Z",
            revoked_reason: "Owner revoked partner invite.",
            created_by: "owner-1",
            created_at: "2026-04-03T00:00:00.000Z",
            updated_at: "2026-04-05T00:00:00.000Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "grant-1",
            owner_account_id: "owner-1",
            partner_account_id: "partner-1",
            partner_email: "friend@example.com",
            access_level: "full",
            email_notifications_allowed: false,
            source_invite_id: "invite-2",
            accepted_at: "2026-04-04T10:00:00.000Z",
            last_seen_at: "2026-04-04T10:00:00.000Z",
            revoked_at: "2026-04-05T00:00:00.000Z",
            revoked_reason: "Owner revoked partner access.",
            created_at: "2026-04-04T10:00:00.000Z",
            updated_at: "2026-04-05T00:00:00.000Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const client = createManagedCloudAPIClient(
      "http://127.0.0.1:8090",
      fetch as unknown as typeof global.fetch,
    );

    await expect(client.getPartnerAccess("managed-session-1")).resolves.toEqual({
      ok: true,
      overview: expect.objectContaining({
        owned: expect.objectContaining({
          invites: [
            expect.objectContaining({
              id: "invite-1",
              invitedEmail: "partner@example.com",
            }),
          ],
        }),
      }),
    });

    await expect(
      client.issuePartnerInvite("managed-session-1", {
        invitedEmail: "friend@example.com",
        accessLevel: "full",
        emailNotificationsAllowed: false,
      }),
    ).resolves.toEqual({
      ok: true,
      result: expect.objectContaining({
        inviteToken: "invite-token-2",
        invite: expect.objectContaining({
          id: "invite-2",
          accessLevel: "full",
        }),
      }),
    });

    await expect(
      client.acceptPartnerInvite("managed-session-1", "invite-token-2"),
    ).resolves.toEqual({
      ok: true,
      invite: expect.objectContaining({
        status: "accepted",
      }),
      grant: expect.objectContaining({
        id: "grant-1",
        partnerEmail: "friend@example.com",
      }),
    });

    await expect(
      client.revokePartnerInvite("managed-session-1", "invite-1"),
    ).resolves.toEqual({
      ok: true,
      invite: expect.objectContaining({
        status: "revoked",
      }),
    });

    await expect(
      client.revokePartnerGrant("managed-session-1", "grant-1"),
    ).resolves.toEqual({
      ok: true,
      grant: expect.objectContaining({
        id: "grant-1",
        revokedAt: "2026-04-05T00:00:00.000Z",
      }),
    });
  });
});
