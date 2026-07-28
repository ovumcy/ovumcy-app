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
            has_active_plan: true,
            premium_features: {
              advanced_fertility: true,
              doctor_pdf: true,
              advanced_insights: true,
              extended_reports: true,
              partner_access: true,
              reminders: true,
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
        hasActivePlan: true,
        premiumFeatures: {
          advancedFertility: true,
          advancedInsights: true,
          doctorPDF: true,
          extendedReports: true,
          partnerAccess: true,
          reminders: true,
        },
        activeSubscription: null,
        offers: [],
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

  it("parses billing offers tolerantly: malformed entries drop, valid entries survive", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          has_active_plan: true,
          offers: [
            // Valid promo with full copy + play_checkout action.
            {
              id: "offer-1",
              kind: "subscription_promo",
              audience: ["trial"],
              startsAt: "2026-06-01T00:00:00.000Z",
              endsAt: "2026-08-01T00:00:00.000Z",
              copy: {
                en: { title: "Summer deal", body: "Save 20%", cta: "Upgrade" },
                ru: { title: "Летняя акция", body: "Скидка 20%", cta: "Обновить" },
                // Malformed locale entry: dropped, offer survives.
                de: { title: "Nur Titel" },
              },
              action: {
                type: "play_checkout",
                productId: "premium",
                basePlanId: "monthly",
                offerId: "summer20",
              },
            },
            // Announcement pointing at a screen; optional fields absent.
            {
              id: "offer-2",
              kind: "announcement",
              copy: {
                en: { title: "New", body: "Backup got faster", cta: "Open" },
              },
              action: { type: "screen", screen: "backup-sync" },
            },
            // Malformed entries: dropped without failing the snapshot.
            { kind: "subscription_promo" },
            { id: "", kind: "announcement", action: { type: "screen" } },
            { id: "offer-3", kind: "announcement", action: "not-an-object" },
            "not-an-object",
            null,
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = createManagedCloudAPIClient(
      "http://127.0.0.1:8091",
      fetch as unknown as typeof global.fetch,
    );

    const result = await client.getBillingSnapshot("managed-session-1");
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected ok billing snapshot");
    }
    expect(result.billing.offers).toEqual([
      {
        id: "offer-1",
        kind: "subscription_promo",
        audience: ["trial"],
        startsAt: "2026-06-01T00:00:00.000Z",
        endsAt: "2026-08-01T00:00:00.000Z",
        copy: {
          en: { title: "Summer deal", body: "Save 20%", cta: "Upgrade" },
          ru: { title: "Летняя акция", body: "Скидка 20%", cta: "Обновить" },
        },
        action: {
          type: "play_checkout",
          productId: "premium",
          basePlanId: "monthly",
          offerId: "summer20",
          screen: null,
        },
      },
      {
        id: "offer-2",
        kind: "announcement",
        audience: [],
        startsAt: null,
        endsAt: null,
        copy: {
          en: { title: "New", body: "Backup got faster", cta: "Open" },
        },
        action: {
          type: "screen",
          productId: null,
          basePlanId: null,
          offerId: null,
          screen: "backup-sync",
        },
      },
    ]);
  });

  it("maps a missing or invalid offers field to an empty list", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ has_active_plan: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ has_active_plan: true, offers: "corrupted" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const client = createManagedCloudAPIClient(
      "http://127.0.0.1:8091",
      fetch as unknown as typeof global.fetch,
    );

    const missing = await client.getBillingSnapshot("managed-session-1");
    expect(missing.ok && missing.billing.offers).toEqual([]);
    const invalid = await client.getBillingSnapshot("managed-session-1");
    expect(invalid.ok && invalid.billing.offers).toEqual([]);
  });

  it("ignores a billing_management block an older server still sends", async () => {
    // Transition tolerance: the field was dropped from the managed snapshot
    // together with the web-checkout surface, but a server that predates that
    // removal keeps sending it. Parsing must neither fail nor surface it —
    // cancel_at_period_end on the subscription itself is a separate field and
    // still maps, since it feeds the countdown copy.
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          has_active_plan: true,
          active_subscription: {
            status: "active",
            current_period_ends_at: "2026-08-01T00:00:00.000Z",
            cancel_at_period_end: true,
          },
          billing_management: {
            can_manage_renewal: true,
            can_cancel_at_period_end: false,
            can_resume_renewal: true,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = createManagedCloudAPIClient(
      "http://127.0.0.1:8091",
      fetch as unknown as typeof global.fetch,
    );

    const result = await client.getBillingSnapshot("managed-session-1");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected ok billing snapshot");
    }
    expect(result.billing.activeSubscription?.cancelAtPeriodEnd).toBe(true);
    expect(result.billing).not.toHaveProperty("billingManagement");
  });

  it("treats null partner overview lists as empty arrays", async () => {
    // The managed server serializes empty list fields as JSON `null` (a Go nil
    // slice). The overview must still parse, mapping each null list to [].
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          owned: { invites: null, grants: null },
          shared_with_me: null,
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
      overview: {
        owned: { invites: [], grants: [] },
        sharedWithMe: [],
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
                  access_level: "summary",
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
              access_level: "full",
              status: "pending",
              expires_at: "2026-04-11T00:00:00.000Z",
              created_by: "owner-1",
              created_at: "2026-04-04T00:00:00.000Z",
              updated_at: "2026-04-04T00:00:00.000Z",
            },
            invite_url: "ovumcy://backup-sync?invite_token=invite-token-2-fixture-padding",
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
              access_level: "full",
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
              access_level: "full",
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
            access_level: "summary",
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
            access_level: "full",
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
            }),
          ],
        }),
      }),
    });

    await expect(
      client.issuePartnerInvite("managed-session-1", {
        accessLevel: "full",
      }),
    ).resolves.toEqual({
      ok: true,
      result: expect.objectContaining({
        inviteURL: "ovumcy://backup-sync?invite_token=invite-token-2-fixture-padding",
        invite: expect.objectContaining({
          id: "invite-2",
          accessLevel: "full",
        }),
      }),
    });

    await expect(
      client.acceptPartnerInvite("managed-session-1", "invite-token-2-fixture-padding"),
    ).resolves.toEqual({
      ok: true,
      invite: expect.objectContaining({
        status: "accepted",
      }),
      grant: expect.objectContaining({
        id: "grant-1",
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

  it("maps partner projection upload and read responses", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            grant_id: "grant-1",
            access_level: "full",
            schema_version: 1,
            checksum_sha256: "deadbeef",
            ciphertext_base64: "c29tZS1jaXBoZXJ0ZXh0",
            ciphertext_size: 15,
            created_at: "2026-04-05T08:00:00.000Z",
            updated_at: "2026-04-05T08:00:00.000Z",
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
            grant_id: "grant-1",
            access_level: "full",
            schema_version: 1,
            checksum_sha256: "deadbeef",
            ciphertext_base64: "c29tZS1jaXBoZXJ0ZXh0",
            ciphertext_size: 15,
            created_at: "2026-04-05T08:00:00.000Z",
            updated_at: "2026-04-05T08:10:00.000Z",
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
      client.upsertPartnerProjection("managed-session-1", "grant-1", {
        schemaVersion: 1,
        checksumSHA256: "deadbeef",
        ciphertextBase64: "c29tZS1jaXBoZXJ0ZXh0",
        ciphertextSize: 15,
      }),
    ).resolves.toEqual({
      ok: true,
      projection: expect.objectContaining({
        grantID: "grant-1",
        checksumSHA256: "deadbeef",
      }),
    });

    await expect(
      client.getPartnerProjection("managed-session-1", "grant-1"),
    ).resolves.toEqual({
      ok: true,
      projection: expect.objectContaining({
        grantID: "grant-1",
        updatedAt: "2026-04-05T08:10:00.000Z",
      }),
    });
  });

  it("accepts a partner invite as a guest with no Authorization header and maps the session + grant + invite", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
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
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example",
      fetch as unknown as typeof global.fetch,
    );

    await expect(
      client.acceptPartnerInviteAsGuest("invite-token-9-fixture-padding"),
    ).resolves.toEqual({
      ok: true,
      result: {
        accountID: "guest-account-1",
        sessionToken: "guest-session-1",
        sessionExpiresAt: "2026-04-12T00:00:00.000Z",
        grant: expect.objectContaining({
          id: "grant-9",
          partnerAccountID: "guest-account-1",
          accessLevel: "full",
        }),
        invite: expect.objectContaining({
          id: "invite-9",
          status: "accepted",
        }),
      },
    });

    const call = fetch.mock.calls[0];
    expect(call?.[0]).toBe("https://managed.example/auth/partner/invites/accept");
    expect(call?.[1]?.method).toBe("POST");
    // The whole point of the guest endpoint is that it is unauthenticated:
    // no Authorization header is ever sent, unlike every other partner call.
    expect((call?.[1]?.headers as Headers).has("Authorization")).toBe(false);
    // refresh_supported travels on this endpoint too: a guest account has no
    // password, so without it the device would hold a link-minted bearer for
    // the full SESSION_TTL.
    expect(call?.[1]?.body).toBe(
      JSON.stringify({
        invite_token: "invite-token-9-fixture-padding",
        refresh_supported: true,
      }),
    );
  });

  const guestRefreshCases: [
    string,
    Record<string, string>,
    { refreshToken?: string; refreshTokenExpiresAt?: string },
  ][] = [
    [
      "carries both refresh fields through when the server issued a token",
      {
        refresh_token: "guest-refresh-1",
        refresh_token_expires_at: "2026-07-04T00:00:00.000Z",
      },
      {
        refreshToken: "guest-refresh-1",
        refreshTokenExpiresAt: "2026-07-04T00:00:00.000Z",
      },
    ],
    [
      "drops a refresh token that arrived without its expiry",
      { refresh_token: "guest-refresh-1" },
      {},
    ],
    [
      "drops a refresh expiry that arrived without its token",
      { refresh_token_expires_at: "2026-07-04T00:00:00.000Z" },
      {},
    ],
  ];

  it.each(guestRefreshCases)("guest accept %s", async (_label, extraFields, expectedFields) => {
    // Half a credential is worse than none: a token with no expiry would be
    // stored and then used past a deadline the client cannot see, and an
    // expiry with no token marks the session renewable when nothing can
    // renew it.
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "guest-account-1",
          session_token: "guest-session-1",
          session_expires_at: "2026-04-06T00:00:00.000Z",
          ...extraFields,
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
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example",
      fetch as unknown as typeof global.fetch,
    );

    const result = await client.acceptPartnerInviteAsGuest(
      "invite-token-9-fixture-padding",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.result.refreshToken).toBe(expectedFields.refreshToken);
    expect(result.result.refreshTokenExpiresAt).toBe(
      expectedFields.refreshTokenExpiresAt,
    );
  });

  it("maps guest-accept error keys identically to the logged-in accept path", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "partner_invite_not_found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "partner_invite_expired" }), {
          status: 410,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "invalid_partner_invite" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "partner_access_unavailable" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = createManagedCloudAPIClient(
      "https://managed.example",
      fetch as unknown as typeof global.fetch,
    );

    await expect(
      client.acceptPartnerInviteAsGuest("unknown-token"),
    ).resolves.toEqual({ ok: false, errorCode: "partner_invite_not_found" });
    await expect(
      client.acceptPartnerInviteAsGuest("expired-token"),
    ).resolves.toEqual({ ok: false, errorCode: "partner_invite_expired" });
    await expect(
      client.acceptPartnerInviteAsGuest("already-used-token"),
    ).resolves.toEqual({ ok: false, errorCode: "invalid_partner_invite" });
    await expect(
      client.acceptPartnerInviteAsGuest("unentitled-owner-token"),
    ).resolves.toEqual({ ok: false, errorCode: "partner_access_unavailable" });
    await expect(
      client.acceptPartnerInviteAsGuest("rate-limited-token"),
    ).resolves.toEqual({ ok: false, errorCode: "rate_limited" });
  });

  it("upgrades a guest account with the caller's existing bearer session and maps the response", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "guest-account-1",
          email: "owner@example.com",
          recovery_code: "fresh1234fresh1234fresh1234fresh",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example",
      fetch as unknown as typeof global.fetch,
    );

    await expect(
      client.upgradeGuestAccount("guest-session-1", {
        email: "owner@example.com",
        password: "very secure password 12345",
      }),
    ).resolves.toEqual({
      ok: true,
      result: {
        accountID: "guest-account-1",
        email: "owner@example.com",
        recoveryCode: "fresh1234fresh1234fresh1234fresh",
      },
    });

    const call = fetch.mock.calls[0];
    expect(call?.[0]).toBe("https://managed.example/account/upgrade");
    expect(call?.[1]?.method).toBe("POST");
    // Unlike the guest-accept endpoint, upgrade authenticates with the
    // guest's EXISTING session — the bearer header must be present.
    expect((call?.[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer guest-session-1",
    );
    expect(call?.[1]?.body).toBe(
      JSON.stringify({
        email: "owner@example.com",
        password: "very secure password 12345",
      }),
    );
  });

  it("maps account-upgrade error keys, including an unrecognized code falling back to generic", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "account_not_guest" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "invalid_registration_input" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "registration_failed" }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        // A code this app version does not recognize (e.g. from a newer
        // server) must collapse to "generic" rather than leaking an
        // arbitrary string into ManagedCloudAPIErrorCode.
        new Response(JSON.stringify({ error: "some_future_unmapped_code" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = createManagedCloudAPIClient(
      "https://managed.example",
      fetch as unknown as typeof global.fetch,
    );
    const input = { email: "owner@example.com", password: "very secure password 12345" };

    await expect(client.upgradeGuestAccount("session-1", input)).resolves.toEqual({
      ok: false,
      errorCode: "unauthorized",
    });
    await expect(client.upgradeGuestAccount("session-1", input)).resolves.toEqual({
      ok: false,
      errorCode: "account_not_guest",
    });
    await expect(client.upgradeGuestAccount("session-1", input)).resolves.toEqual({
      ok: false,
      errorCode: "invalid_registration_input",
    });
    await expect(client.upgradeGuestAccount("session-1", input)).resolves.toEqual({
      ok: false,
      errorCode: "registration_failed",
    });
    await expect(client.upgradeGuestAccount("session-1", input)).resolves.toEqual({
      ok: false,
      errorCode: "rate_limited",
    });
    await expect(client.upgradeGuestAccount("session-1", input)).resolves.toEqual({
      ok: false,
      errorCode: "generic",
    });
  });

  // Transition tolerance: the managed cloud no longer serves reminder-email
  // routes, and `reminder_schedule_unavailable` / `invalid_reminder_schedule`
  // left the client's error-code union with them. A server that predates the
  // removal can still answer any endpoint with one of those bodies, so the
  // reader must degrade it to the generic code instead of throwing or leaking
  // a raw server string.
  it("degrades reminder-schedule error codes an older server still sends", async () => {
    for (const legacyError of [
      "reminder_schedule_unavailable",
      "invalid_reminder_schedule",
    ]) {
      const fetch = jest.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: legacyError }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const client = createManagedCloudAPIClient(
        "http://127.0.0.1:8090",
        fetch as unknown as typeof global.fetch,
      );

      await expect(
        client.getBillingSnapshot("managed-session-1"),
      ).resolves.toEqual({ ok: false, errorCode: "generic" });
    }
  });

  it("surfaces the recovery code that comes back on register", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "account-1",
          email: "owner@example.com",
          session_token: "managed-session-1",
          session_expires_at: "2026-03-24T00:00:00.000Z",
          sync_entitlement: {
            sync_allowed: true,
            source: "default_register",
            updated_at: "2026-03-23T00:00:00.000Z",
            effective_at: "2026-03-23T00:00:00.000Z",
            explanation: "Trial active.",
          },
          recovery_code: "abcd1234abcd1234abcd1234abcd1234",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    const result = await client.register({
      email: "owner@example.com",
      password: "very secure password 12345",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.auth.recoveryCode).toBe(
        "abcd1234abcd1234abcd1234abcd1234",
      );
    }
  });

  it("omits recoveryCode on login auth result", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "account-1",
          email: "owner@example.com",
          session_token: "managed-session-1",
          session_expires_at: "2026-03-24T00:00:00.000Z",
          sync_entitlement: {
            sync_allowed: true,
            source: "default_register",
            updated_at: "2026-03-23T00:00:00.000Z",
            effective_at: "2026-03-23T00:00:00.000Z",
            explanation: "Trial active.",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    const result = await client.login({
      email: "owner@example.com",
      password: "very secure password 12345",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.auth).not.toHaveProperty("recoveryCode");
    }
  });

  it("changes password and forwards bearer token", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "password_changed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    const result = await client.changePassword("session-1", {
      currentPassword: "old password 12345",
      newPassword: "new password 12345",
    });

    expect(result).toEqual({ ok: true });
    const call = fetch.mock.calls[0];
    expect(call?.[0]).toBe("https://managed.example/auth/change-password");
    expect((call?.[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer session-1",
    );
    expect(call?.[1]?.body).toBe(
      JSON.stringify({
        current_password: "old password 12345",
        new_password: "new password 12345",
      }),
    );
  });

  it("maps change-password error keys", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "invalid_current_password" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "weak_new_password" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "new_password_must_differ" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    expect(
      await client.changePassword("session-1", {
        currentPassword: "wrong",
        newPassword: "new password 12345",
      }),
    ).toEqual({ ok: false, errorCode: "invalid_current_password" });
    expect(
      await client.changePassword("session-1", {
        currentPassword: "old password 12345",
        newPassword: "short",
      }),
    ).toEqual({ ok: false, errorCode: "weak_new_password" });
    expect(
      await client.changePassword("session-1", {
        currentPassword: "same",
        newPassword: "same",
      }),
    ).toEqual({ ok: false, errorCode: "new_password_must_differ" });
  });

  it("forgot-password returns reset token; maps generic recovery credential error", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            reset_token: "reset-token-1",
            reset_token_expires_at: "2026-03-23T01:00:00.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: "invalid_recovery_credentials" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    expect(
      await client.forgotPassword({
        email: "owner@example.com",
        recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
      }),
    ).toEqual({
      ok: true,
      result: {
        resetToken: "reset-token-1",
        resetTokenExpiresAt: "2026-03-23T01:00:00.000Z",
      },
    });
    expect(fetch.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        email: "owner@example.com",
        recovery_code: "abcd1234abcd1234abcd1234abcd1234",
      }),
    );

    expect(
      await client.forgotPassword({
        email: "ghost@example.com",
        recoveryCode: "00000000000000000000000000000000",
      }),
    ).toEqual({
      ok: false,
      errorCode: "invalid_recovery_credentials",
    });
  });

  it("reset-password returns the rotated recovery code; maps invalid_reset_token and weak_new_password", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ recovery_code: "rotated1234rotated1234rotated123" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "invalid_reset_token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "weak_new_password" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    expect(
      await client.resetPassword({
        resetToken: "reset-token-1",
        newPassword: "new password 12345",
      }),
    ).toEqual({
      ok: true,
      result: { recoveryCode: "rotated1234rotated1234rotated123" },
    });
    expect(
      await client.resetPassword({
        resetToken: "bad-token",
        newPassword: "new password 12345",
      }),
    ).toEqual({ ok: false, errorCode: "invalid_reset_token" });
    expect(
      await client.resetPassword({
        resetToken: "reset-token-1",
        newPassword: "short",
      }),
    ).toEqual({ ok: false, errorCode: "weak_new_password" });
  });

  it("regenerate-recovery-code rotates code; maps invalid_current_password", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ recovery_code: "fresh1234fresh1234fresh1234fresh" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "invalid_current_password" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    const ok = await client.regenerateRecoveryCode("session-1", {
      currentPassword: "very secure password 12345",
    });
    expect(ok).toEqual({
      ok: true,
      result: { recoveryCode: "fresh1234fresh1234fresh1234fresh" },
    });
    const call = fetch.mock.calls[0];
    expect(call?.[0]).toBe(
      "https://managed.example/auth/recovery-code/regenerate",
    );
    expect((call?.[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer session-1",
    );

    expect(
      await client.regenerateRecoveryCode("session-1", {
        currentPassword: "wrong",
      }),
    ).toEqual({ ok: false, errorCode: "invalid_current_password" });
  });

  it("maps a managed login response that defers to the TOTP challenge", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "account-1",
          email: "owner@example.com",
          session_token: "",
          session_expires_at: "0001-01-01T00:00:00Z",
          sync_entitlement: {
            sync_allowed: false,
            source: "",
            updated_at: "0001-01-01T00:00:00Z",
            effective_at: "0001-01-01T00:00:00Z",
            explanation: "",
          },
          totp_challenge: {
            challenge_id: "challenge-1",
            challenge_expires_at: "2026-05-17T10:05:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    const result = await client.login({
      email: "owner@example.com",
      password: "very secure password",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.auth.sessionToken).toBe("");
      expect(result.auth.totpChallenge).toEqual({
        challengeID: "challenge-1",
        challengeExpiresAt: "2026-05-17T10:05:00.000Z",
      });
    }
  });

  it("starts a managed TOTP enrollment and surfaces the secret + provisioning URI", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          secret_base32: "JBSWY3DPEHPK3PXP",
          provisioning_uri:
            "otpauth://totp/ovumcy-managed:owner@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ovumcy-managed",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    const result = await client.startTOTPEnrollment("managed-session-1", {
      currentPassword: "very secure password",
    });

    expect(result).toEqual({
      ok: true,
      enrollment: {
        secretBase32: "JBSWY3DPEHPK3PXP",
        provisioningURI:
          "otpauth://totp/ovumcy-managed:owner@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ovumcy-managed",
      },
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://managed.example/auth/totp/enroll",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("disables managed TOTP", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "totp_disabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    const result = await client.disableTOTP("managed-session-1", {
      currentPassword: "very secure password",
      code: "123456",
    });

    expect(result).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(
      "https://managed.example/auth/totp/disable",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("propagates totp_challenge_invalid on managed challenge completion failures", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "totp_challenge_invalid" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    const result = await client.completeTOTPChallenge({
      challengeID: "challenge-1",
      code: "123456",
    });

    expect(result).toEqual({ ok: false, errorCode: "totp_challenge_invalid" });
  });

  it("completes a managed TOTP challenge and returns a real session", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "account-1",
          email: "owner@example.com",
          session_token: "managed-session-after-totp",
          session_expires_at: "2026-05-18T10:00:00.000Z",
          sync_entitlement: {
            sync_allowed: true,
            source: "default_register",
            updated_at: "2026-05-17T10:00:00.000Z",
            effective_at: "2026-05-17T10:00:00.000Z",
            explanation: "Trial active.",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    const result = await client.completeTOTPChallenge({
      challengeID: "challenge-1",
      code: "123456",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.auth.sessionToken).toBe("managed-session-after-totp");
      expect(result.auth.email).toBe("owner@example.com");
      expect(result.auth.entitlement.syncAllowed).toBe(true);
    }
  });

  it("maps a signed entitlement-token response and POSTs to /account/entitlements/token", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          token: "header.payload.signature",
          expires_at: "2026-06-14T00:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    const result = await client.getEntitlementToken("managed-session-1");

    expect(result).toEqual({
      ok: true,
      result: {
        token: "header.payload.signature",
        expiresAt: "2026-06-14T00:00:00.000Z",
      },
    });
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe(
      "https://managed.example/account/entitlements/token",
    );
    expect((init as RequestInit).method).toBe("POST");
  });

  it("maps a 503 (signing key absent) to entitlements_unavailable so the app falls back to the snapshot", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "entitlements_unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    await expect(
      client.getEntitlementToken("managed-session-1"),
    ).resolves.toEqual({ ok: false, errorCode: "entitlements_unavailable" });
  });

  it("maps a 503 (signing disabled server-side) to entitlements_not_configured so the app falls back to the snapshot", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "entitlements_not_configured" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    await expect(
      client.getEntitlementToken("managed-session-1"),
    ).resolves.toEqual({ ok: false, errorCode: "entitlements_not_configured" });
  });

  it("deletes the managed account with a DELETE /account bearer request and tolerates an empty body", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    await expect(client.deleteAccount("managed-session-1")).resolves.toEqual({
      ok: true,
    });
    const call = fetch.mock.calls[0];
    expect(call?.[0]).toBe("https://managed.example/account");
    expect(call?.[1]?.method).toBe("DELETE");
    expect((call?.[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer managed-session-1",
    );
    expect((call?.[1] as RequestInit).redirect).toBe("error");
  });

  it("maps deleteAccount error keys, including unauthorized and network failure", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockRejectedValueOnce(new Error("offline"));
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    await expect(client.deleteAccount("managed-session-1")).resolves.toEqual({
      ok: false,
      errorCode: "unauthorized",
    });
    await expect(client.deleteAccount("managed-session-1")).resolves.toEqual({
      ok: false,
      errorCode: "network_failed",
    });
  });

  it("maps a 503 sync_purge_unavailable on deleteAccount to its own code (deletion failed closed, account intact)", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "sync_purge_unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const client = createManagedCloudAPIClient(
      "https://managed.example/",
      fetch as unknown as typeof globalThis.fetch,
    );

    await expect(client.deleteAccount("managed-session-1")).resolves.toEqual({
      ok: false,
      errorCode: "sync_purge_unavailable",
    });
  });
  it("declares refresh support on sign-in and surfaces the issued refresh token", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "account-1",
          email: "owner@example.com",
          session_token: "managed-session-1",
          session_expires_at: "2026-07-22T00:00:00.000Z",
          sync_entitlement: {
            sync_allowed: true,
            source: "trial",
            updated_at: "2026-07-21T00:00:00.000Z",
            effective_at: "2026-07-21T00:00:00.000Z",
            explanation: "",
          },
          refresh_token: "refresh-1",
          refresh_token_expires_at: "2026-10-19T00:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = createManagedCloudAPIClient(
      "http://127.0.0.1:8090",
      fetch as unknown as typeof global.fetch,
    );

    await expect(
      client.login({ email: "owner@example.com", password: "very-secure-pass" }),
    ).resolves.toEqual({
      ok: true,
      auth: expect.objectContaining({
        sessionToken: "managed-session-1",
        refreshToken: "refresh-1",
        refreshTokenExpiresAt: "2026-10-19T00:00:00.000Z",
      }),
    });

    // The flag is what makes the server issue a short session with a renewable
    // token; without it we would silently keep the long-lived one.
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body));
    expect(body.refresh_supported).toBe(true);
  });

  it("ignores a half-issued refresh pair rather than storing part of a credential", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "account-1",
          email: "owner@example.com",
          session_token: "managed-session-1",
          session_expires_at: "2026-07-22T00:00:00.000Z",
          sync_entitlement: {
            sync_allowed: true,
            source: "trial",
            updated_at: "2026-07-21T00:00:00.000Z",
            effective_at: "2026-07-21T00:00:00.000Z",
            explanation: "",
          },
          refresh_token: "refresh-1",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = createManagedCloudAPIClient(
      "http://127.0.0.1:8090",
      fetch as unknown as typeof global.fetch,
    );

    const result = await client.login({
      email: "owner@example.com",
      password: "very-secure-pass",
    });

    if (!result.ok) {
      throw new Error("expected the login to succeed");
    }
    expect(result.auth.refreshToken).toBeUndefined();
    expect(result.auth.refreshTokenExpiresAt).toBeUndefined();
  });

  it("exchanges a refresh token for a rotated session without a bearer header", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "account-1",
          email: "owner@example.com",
          session_token: "managed-session-2",
          session_expires_at: "2026-07-23T00:00:00.000Z",
          sync_entitlement: {
            sync_allowed: true,
            source: "trial",
            updated_at: "2026-07-21T00:00:00.000Z",
            effective_at: "2026-07-21T00:00:00.000Z",
            explanation: "",
          },
          refresh_token: "refresh-2",
          refresh_token_expires_at: "2026-10-19T00:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = createManagedCloudAPIClient(
      "http://127.0.0.1:8090",
      fetch as unknown as typeof global.fetch,
    );

    await expect(client.refreshSession("refresh-1")).resolves.toEqual({
      ok: true,
      auth: expect.objectContaining({
        sessionToken: "managed-session-2",
        refreshToken: "refresh-2",
      }),
    });

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toContain("/auth/refresh");
    expect(JSON.parse(String(init?.body))).toEqual({ refresh_token: "refresh-1" });
    // The access session it replaces has usually expired already, so the
    // refresh token in the body is the sole credential.
    expect((init?.headers as Record<string, string>)?.Authorization).toBeUndefined();
  });

  it("reports a dead refresh chain as unauthorized", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createManagedCloudAPIClient(
      "http://127.0.0.1:8090",
      fetch as unknown as typeof global.fetch,
    );

    await expect(client.refreshSession("refresh-1")).resolves.toEqual({
      ok: false,
      errorCode: "unauthorized",
    });
  });
});
