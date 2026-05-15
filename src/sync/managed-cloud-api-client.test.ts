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
            invite_url: "ovumcy://backup-sync?invite_token=invite-token-2",
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
        inviteURL: "ovumcy://backup-sync?invite_token=invite-token-2",
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

  it("maps reminder email schedule responses", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            enabled: true,
            schedules: [
              {
                kind: "daily_log",
                schedule_type: "daily",
                locale: "en",
                time_zone: "UTC",
                daily_hour: 21,
                daily_minute: 30,
                next_delivery_at: "2026-04-05T21:30:00.000Z",
                last_delivered_at: null,
                created_at: "2026-04-05T08:00:00.000Z",
                updated_at: "2026-04-05T08:00:00.000Z",
              },
            ],
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
            enabled: true,
            schedules: [
              {
                kind: "fertile_window",
                schedule_type: "once",
                locale: "ru",
                time_zone: "Europe/Budapest",
                daily_hour: 0,
                daily_minute: 0,
                next_delivery_at: "2026-04-08T06:00:00.000Z",
                last_delivered_at: null,
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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            enabled: false,
            schedules: [],
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
      client.getReminderEmailSchedules("managed-session-1"),
    ).resolves.toEqual({
      ok: true,
      snapshot: {
        enabled: true,
        schedules: [
          {
            kind: "daily_log",
            scheduleType: "daily",
            locale: "en",
            timeZone: "UTC",
            dailyHour: 21,
            dailyMinute: 30,
            nextDeliveryAt: "2026-04-05T21:30:00.000Z",
            lastDeliveredAt: null,
            createdAt: "2026-04-05T08:00:00.000Z",
            updatedAt: "2026-04-05T08:00:00.000Z",
          },
        ],
      },
    });

    await expect(
      client.replaceReminderEmailSchedules("managed-session-1", {
        schedules: [
          {
            kind: "fertile_window",
            scheduleType: "once",
            locale: "ru",
            timeZone: "Europe/Budapest",
            dailyHour: 0,
            dailyMinute: 0,
            nextDeliveryAt: "2026-04-08T06:00:00.000Z",
          },
        ],
      }),
    ).resolves.toEqual({
      ok: true,
      snapshot: {
        enabled: true,
        schedules: [
          {
            kind: "fertile_window",
            scheduleType: "once",
            locale: "ru",
            timeZone: "Europe/Budapest",
            dailyHour: 0,
            dailyMinute: 0,
            nextDeliveryAt: "2026-04-08T06:00:00.000Z",
            lastDeliveredAt: null,
            createdAt: "2026-04-05T08:00:00.000Z",
            updatedAt: "2026-04-05T08:10:00.000Z",
          },
        ],
      },
    });

    await expect(
      client.clearReminderEmailSchedules("managed-session-1"),
    ).resolves.toEqual({
      ok: true,
      snapshot: {
        enabled: false,
        schedules: [],
      },
    });
  });

  it("maps reminder email schedule entitlement errors", async () => {
    const fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "reminder_schedule_unavailable",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const client = createManagedCloudAPIClient(
      "http://127.0.0.1:8090",
      fetch as unknown as typeof global.fetch,
    );

    await expect(
      client.replaceReminderEmailSchedules("managed-session-1", {
        schedules: [
          {
            kind: "daily_log",
            scheduleType: "daily",
            locale: "en",
            timeZone: "UTC",
            dailyHour: 20,
            dailyMinute: 0,
            nextDeliveryAt: "2026-04-05T20:00:00.000Z",
          },
        ],
      }),
    ).resolves.toEqual({
      ok: false,
      errorCode: "reminder_schedule_unavailable",
    });
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
});
