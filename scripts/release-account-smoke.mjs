/**
 * Release account-contour smoke (P2.14).
 *
 * Exercises the end-to-end managed account lifecycle at the HTTP/API level
 * against a LOCALLY-RUN managed cloud (+ optional community-sync) started with a
 * throwaway/test config. It is the server-level counterpart to the per-repo unit
 * suites: those prove each repo in isolation, this proves the account contour
 * actually works across the wire.
 *
 * Contour:
 *   1. owner registers -> issues a partner invite
 *   2. GUEST partner invite accept (unauthenticated) -> guest session + grant
 *   3. GUEST upgrade (POST /account/upgrade) -> the guest becomes a full account
 *   4. premium lapse (entitlement / retention) -> admin grants an active plan,
 *      billing reflects it, admin lapses it, billing reflects the lapse
 *      (best-effort: SKIPPED with a clear note when no ADMIN_TOKEN is set)
 *   5. account deletion (DELETE /account) -> session no longer resolves
 *
 * HONEST BY CONSTRUCTION: every step asserts a real HTTP status / payload. A
 * server that is not reachable, or a step that does not behave, FAILS the smoke
 * (exit 1) — it never fabricates a pass. Uses only Node built-ins (global fetch),
 * so it runs with no `npm install`.
 *
 * Config (env):
 *   OVUMCY_MANAGED_SMOKE_BASE_URL  managed base URL (default http://127.0.0.1:8090)
 *   OVUMCY_SYNC_SMOKE_BASE_URL     community-sync base URL (optional; health-checked when set)
 *   OVUMCY_MANAGED_SMOKE_ADMIN_TOKEN  admin bearer for the premium-lapse step (optional)
 *
 * See docs/cross-repo-contracts.md (Release smoke) for how to stand up the
 * servers. The RN-app-inclusive UI smoke is device-gated and out of scope here.
 */

const LOG = "account-smoke:";
const MANAGED_BASE = (
  process.env.OVUMCY_MANAGED_SMOKE_BASE_URL?.trim() || "http://127.0.0.1:8090"
).replace(/\/+$/, "");
const SYNC_BASE = process.env.OVUMCY_SYNC_SMOKE_BASE_URL?.trim()?.replace(/\/+$/, "") || null;
const ADMIN_TOKEN = process.env.OVUMCY_MANAGED_SMOKE_ADMIN_TOKEN?.trim() || null;

const STRONG_PASSWORD = "Str0ng-Passw0rd-For-Smoke-2026!";
const uniqueEmail = (label) =>
  `smoke-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@ovumcy-smoke.invalid`;

class SmokeError extends Error {}

async function call(base, path, { method = "GET", token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
    });
  } catch (cause) {
    throw new SmokeError(`network error on ${method} ${path}: ${cause.message}`);
  }
  let payload = null;
  const text = await response.text();
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }
  return { status: response.status, payload };
}

function assert(condition, message) {
  if (!condition) throw new SmokeError(message);
}

function expectStatus(result, expected, label) {
  assert(
    result.status === expected,
    `${label}: expected HTTP ${expected}, got ${result.status} (${JSON.stringify(result.payload)})`,
  );
  return result.payload;
}

async function preflight() {
  console.log(`${LOG} preflight: managed=${MANAGED_BASE}${SYNC_BASE ? ` sync=${SYNC_BASE}` : " (sync not configured)"}`);
  const managed = await call(MANAGED_BASE, "/healthz");
  assert(
    managed.status === 200,
    `managed /healthz not OK (${managed.status}). Start the managed server first — this smoke needs a running managed(+sync) environment; it does not stub it.`,
  );
  if (SYNC_BASE) {
    const sync = await call(SYNC_BASE, "/healthz");
    assert(sync.status === 200, `community-sync /healthz not OK (${sync.status}).`);
  }
  console.log(`${LOG} preflight OK`);
}

function inviteTokenFromURL(inviteURL) {
  assert(typeof inviteURL === "string" && inviteURL.length > 0, "invite_url missing from issue response");
  // ovumcy://backup-sync?invite_token=<token> — parse the query without needing
  // a hierarchical URL parser for the custom scheme.
  const match = /[?&]invite_token=([^&]+)/.exec(inviteURL);
  assert(match, `invite_url has no invite_token query param: ${inviteURL}`);
  return decodeURIComponent(match[1]);
}

async function run() {
  await preflight();

  // --- 1. owner registers, issues a partner invite -------------------------
  const ownerEmail = uniqueEmail("owner");
  const register = expectStatus(
    await call(MANAGED_BASE, "/auth/register", {
      method: "POST",
      body: { email: ownerEmail, password: STRONG_PASSWORD },
    }),
    201,
    "owner register",
  );
  const ownerToken = register.session_token;
  assert(ownerToken, "owner register returned no session_token");
  console.log(`${LOG} 1/5 owner registered (${register.account_id})`);

  const issued = expectStatus(
    await call(MANAGED_BASE, "/account/partner/invites", {
      method: "POST",
      token: ownerToken,
      body: { access_level: "summary" },
    }),
    201,
    "issue partner invite",
  );
  const inviteToken = inviteTokenFromURL(issued.invite_url);
  console.log(`${LOG}     partner invite issued (${issued.invite?.id})`);

  // --- 2. guest partner invite accept (unauthenticated) --------------------
  const guestAccept = expectStatus(
    await call(MANAGED_BASE, "/auth/partner/invites/accept", {
      method: "POST",
      body: { invite_token: inviteToken },
    }),
    201,
    "guest partner accept",
  );
  const guestToken = guestAccept.session_token;
  const guestAccountID = guestAccept.account_id;
  assert(guestToken && guestAccountID, "guest accept returned no session/account");
  console.log(`${LOG} 2/5 guest accepted invite (${guestAccountID}, grant ${guestAccept.grant?.id})`);

  // --- 3. guest upgrade to a full account ----------------------------------
  const upgradeEmail = uniqueEmail("guest");
  const upgrade = expectStatus(
    await call(MANAGED_BASE, "/account/upgrade", {
      method: "POST",
      token: guestToken,
      body: { email: upgradeEmail, password: STRONG_PASSWORD },
    }),
    200,
    "guest upgrade",
  );
  assert(upgrade.account_id === guestAccountID, "upgrade changed the account id (should keep it)");
  assert(typeof upgrade.recovery_code === "string" && upgrade.recovery_code.length > 0, "upgrade returned no recovery_code");
  // The guest's existing session must stay valid (upgrade issues no new token).
  expectStatus(await call(MANAGED_BASE, "/auth/session", { token: guestToken }), 200, "post-upgrade session still valid");
  console.log(`${LOG} 3/5 guest upgraded to full account (session preserved)`);

  // --- 4. premium lapse (entitlement / retention) --------------------------
  let premiumStep = "SKIPPED";
  if (!ADMIN_TOKEN) {
    console.log(`${LOG} 4/5 premium lapse SKIPPED (set OVUMCY_MANAGED_SMOKE_ADMIN_TOKEN to exercise it)`);
  } else {
    const now = new Date();
    const plus30 = new Date(now.getTime() + 30 * 864e5);
    const minus60 = new Date(now.getTime() - 60 * 864e5);
    const minus1 = new Date(now.getTime() - 864e5);
    // Grant an active plan. Enum values must match the managed billing rules:
    // billing_interval month|year, source manual_admin, status active (a status
    // in {trialing,active,grace_period} is what makes has_active_plan true), and
    // the period must strictly advance (ends after starts). reason is required.
    expectStatus(
      await call(MANAGED_BASE, `/admin/accounts/${encodeURIComponent(guestAccountID)}/billing/subscription`, {
        method: "PUT",
        token: ADMIN_TOKEN,
        body: {
          billing_interval: "month",
          source: "manual_admin",
          status: "active",
          currency: "usd",
          amount_minor: 500,
          current_period_starts_at: now.toISOString(),
          current_period_ends_at: plus30.toISOString(),
          cancel_at_period_end: false,
          reason: "release-smoke grant",
        },
      }),
      200,
      "admin grant active subscription",
    );
    const active = expectStatus(await call(MANAGED_BASE, "/account/billing", { token: guestToken }), 200, "billing after grant");
    assert(active.has_active_plan === true, `billing did not reflect active plan after grant (${JSON.stringify(active)})`);
    // Lapse it: an "expired" status leaves has_active_plan false. The period
    // still advances within itself (past window).
    expectStatus(
      await call(MANAGED_BASE, `/admin/accounts/${encodeURIComponent(guestAccountID)}/billing/subscription`, {
        method: "PUT",
        token: ADMIN_TOKEN,
        body: {
          billing_interval: "month",
          source: "manual_admin",
          status: "expired",
          currency: "usd",
          amount_minor: 500,
          current_period_starts_at: minus60.toISOString(),
          current_period_ends_at: minus1.toISOString(),
          cancel_at_period_end: true,
          reason: "release-smoke lapse",
        },
      }),
      200,
      "admin lapse subscription",
    );
    const lapsed = expectStatus(await call(MANAGED_BASE, "/account/billing", { token: guestToken }), 200, "billing after lapse");
    assert(lapsed.has_active_plan === false, `billing still active after lapse (${JSON.stringify(lapsed)})`);
    premiumStep = "PASS";
    console.log(`${LOG} 4/5 premium lapse verified (has_active_plan true -> false)`);
  }

  // --- 5. account deletion -------------------------------------------------
  expectStatus(await call(MANAGED_BASE, "/account", { method: "DELETE", token: guestToken }), 200, "delete upgraded account");
  const afterDelete = await call(MANAGED_BASE, "/auth/session", { token: guestToken });
  assert(afterDelete.status === 401, `session still resolves after deletion (got ${afterDelete.status})`);
  // Clean up the owner account too.
  expectStatus(await call(MANAGED_BASE, "/account", { method: "DELETE", token: ownerToken }), 200, "delete owner account");
  console.log(`${LOG} 5/5 account deleted; session no longer resolves`);

  console.log("");
  console.log(`${LOG} SMOKE PASSED (premium-lapse step: ${premiumStep})`);
}

run()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((cause) => {
    if (cause instanceof SmokeError) {
      console.error(`${LOG} SMOKE FAILED: ${cause.message}`);
    } else {
      console.error(`${LOG} SMOKE FATAL: ${cause.stack ?? cause.message}`);
    }
    process.exitCode = 1;
  });
