# Deep-Link Safety Plan — Android App Links & iOS Universal Links

Status: **in progress** — the app-side config is applied in `app.json` (Android
intent filter §2.2, iOS associated domains §3.2). Remaining: host the two
well-known files (ready-to-upload templates in `docs/deep-link-hosting/`),
reconcile signing fingerprints / Team ID (§7 step 4), and — last — flip the
managed-side invite base URL (§7 step 5). This document is the design of record
for migrating partner-invite links off the squattable `ovumcy://` custom scheme
and onto platform-verified deep links.

Related work:

- Issue #101 (this plan).
- Issue #99 (iOS privacy config) — defines the iOS `bundleIdentifier` this plan
  needs for the `apple-app-site-association` file. Until #99 lands, the bundle id
  below is a placeholder.
- Companion infrastructure lives in the managed/domain team's repo (see
  [Companion infrastructure checklist](#6-companion-infrastructure-checklist-managed--domain-team)).

Ground truth for the invite flow: `docs/sync-trust-model.md` (Partner-Share Key
Rotation, Pending Partner Invite Buffer) and `SECURITY.md` (Partner projections,
Accepted Residual Risks).

---

## 1. Threat analysis of the current state

### 1.1 How partner invite links work today

The invite URL is **minted by the managed cloud**, not assembled by the app. The
managed service builds it from a configured base URL and appends the raw token as
an `invite_token` query parameter. The base URL is a managed-side setting whose
default is the custom scheme:

```
PARTNER_INVITE_BASE_URL  default = "ovumcy://backup-sync"
invite URL               = ovumcy://backup-sync?invite_token=<token>
```

The app is a generic consumer of that URL. It never hard-codes the scheme for the
invite; it only pulls `invite_token` out of whatever URL it is handed
(`parseInviteTokenFromURL` in `src/services/managed-partner-share-service.ts`,
and the route/`window.location` readers). The `ovumcy` scheme itself is declared
once in `app.json` (`expo.scheme`) and is what makes the OS route
`ovumcy://backup-sync?...` into the app.

Token capture is already hardened on both surfaces:

- **Web:** `src/security/web-invite-token-scrub-bootstrap.ts` is the first import
  in `index.js`, so `scrubManagedPartnerInviteTokenFromWebUrl()` pulls the token
  out of `window.location` and stashes it in an in-memory buffer *before*
  expo-router, metro-runtime, or any layout reads the URL. The token never
  reaches `window.history`, browser autocomplete, devtools, or a screen
  recording (`src/security/web-invite-token-scrub.test.ts`).
- **Native:** the `backup-sync` route reads `invite_token` from
  `useLocalSearchParams`, stashes it, and immediately calls
  `router.replace("/backup-sync")` to strip it from route state
  (`src/ui/screens/backup-sync/useBackupSyncSessionCore.ts`).
- The buffer is module-level state cleared on every session boundary (accept,
  disconnect, mode-switch, forced-unauthorized clear) so a token cannot be
  redeemed under a different managed account later.

### 1.2 The vulnerability: custom-scheme squatting / link interception

A custom URI scheme is **first-come-or-chooser**, not owned. On Android any
installed app may declare:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <data android:scheme="ovumcy"/>
</intent-filter>
```

When the partner taps `ovumcy://backup-sync?invite_token=<token>`:

- If a malicious app also registers `ovumcy`, Android shows a disambiguation
  chooser (both apps look plausible), or — if Ovumcy is not installed, or the
  attacker has been set as default — routes straight to the attacker. Either way
  the attacker's app can receive the intent and read the `invite_token` from the
  URI. There is no cryptographic proof that the resolving app is Ovumcy.
- The attacker gets the token **before** Ovumcy's scrubbing runs, because the
  scrubbing only protects the token *once it is already inside Ovumcy*. Scheme
  squatting intercepts it at the OS routing layer, upstream of the app.

**iOS equivalent.** Custom schemes (`ovumcy://`) on iOS are also not owned: if two
apps register the same scheme, iOS picks one non-deterministically (historically
last-installed-wins), with no chooser and no verification. So the same
interception is possible; iOS just resolves it silently instead of prompting.
Universal Links exist precisely to replace this with a domain-verified handler.

Neither risk is mitigated by the token scrubbing, which is why link *delivery*
hardening is a separate, still-open piece.

### 1.3 What an attacker who intercepts the invite link can and cannot do

The blast radius is tightly bounded by the real invite flow. An intercepted
`invite_token` is **not** a decryption key and **not** a bearer credential — it is
a one-time redemption coupon that is only meaningful to the managed cloud.

An attacker who captures the token **cannot**:

- **Read any health data directly.** The token is not a key. Partner-share
  projections are encrypted under `K_grant`, derived only *after* a successful
  server-side accept binds the token to a specific grant/owner/partner context.
  A raw token in isolation decrypts nothing.
- **Decrypt anything the owner uploads after a legitimate accept.** Both sides
  rotate `K_invite → K_grant` and discard `K_invite` immediately
  (`docs/sync-trust-model.md`, Partner-Share Key Rotation). A transient observer
  of the token is locked out of every post-accept projection.
- **Redeem an expired token.** The managed cloud sets a **7-day TTL**
  (`defaultPartnerInviteTTL` in the managed `partner_service.go`) and rejects
  accept after expiry (`partner_invite_expired`).
- **Reuse an already-accepted token.** Invites are **single-use**: accept is only
  allowed while `status = pending`; redemption transitions the invite to
  `accepted`, and the managed store keeps only a `TokenHash` (never the raw
  token). A second accept fails (`partner_invite_not_found` / not pending).
- **Redeem without a managed account + valid session.** `acceptPartnerInvite`
  requires a `Bearer` managed session token; an anonymous interceptor cannot call
  the accept endpoint at all.
- **Derive a working key from a weak token.** The client enforces a ≥22-char
  entropy floor before key derivation (`derivePartnerShareKeyHex`).
- **Escalate to the owner's raw store or pregnancy status.** Even a *successful*
  redemption only yields the owner-curated projection (summary or full), which is
  read-only and has the pregnancy-test field stripped at **every** access level
  (`SECURITY.md`, Test Enforcement Matrix).

The one real residual harm — a **race-to-redeem**: if the attacker (a) intercepts
the token before the legitimate partner accepts, (b) already holds a managed
account, and (c) accepts within the 7-day window — is that the attacker's account
becomes the accepted partner and receives the owner's minimized, read-only
projection. This is bounded and **visible/reversible**: the owner sees a grant to
an unexpected account in their partner-access list and can revoke it (revoke stops
new projections; see the revoke-semantics limit in `docs/sync-trust-model.md`).
It is nonetheless the exact outcome verified App Links / Universal Links exist to
prevent, because it removes the interception opportunity entirely.

**Summary:** TTL (7 days) + single-use + server-side-session-gated redemption +
key rotation + projection minimization mean interception cannot silently exfiltrate
health data; the worst case is a detectable, revocable wrong-party grant of a
minimized read-only projection. Verified deep links close that last gap by making
the OS route the link only to the real Ovumcy app.

**Guest-accept forward note.** `docs/sync-trust-model.md` (§ Guest Partner
Access) adds a second, unauthenticated redemption path: a partner with no
prior managed account can accept an invite in one tap, provisioning a guest
account atomically with the accept. That removes precondition (b) above
("already holds a managed account") from the race-to-redeem analysis — an
interceptor no longer needs an existing account to redeem a captured token.
The compensating controls are unchanged (TTL, single-use, server-side-gated
redemption — now including the guest endpoint's own session-minting gate —
key rotation, projection minimization, owner visibility + revoke), so the
worst case stays the same detectable, revocable, minimized wrong-party grant
described above; guest accept just widens who can reach that worst case.
Because of that, **guest accept must not be enabled in production ahead of
step 5 below** (flipping `PARTNER_INVITE_BASE_URL` to the verified HTTPS
host) — see the sequencing note in `docs/sync-trust-model.md`.

---

## 2. Android plan (App Links)

### 2.1 `assetlinks.json` template

Host at `https://<INVITE_HOST>/.well-known/assetlinks.json` (see the domain
decision in §4). The package id is real (`app.ovumcy.mobile`, from `app.json`);
the SHA-256 fingerprint is a placeholder until sourced from signing credentials.

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.ovumcy.mobile",
      "sha256_cert_fingerprints": [
        "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
      ]
    }
  }
]
```

Sourcing the fingerprint(s) — include **every** cert that may sign an install
Android will verify against; multiple entries are allowed:

- **Play App Signing** app-signing key SHA-256 (Play Console → Test and release →
  App integrity → App signing) — required for Play-store installs.
- **Upload/EAS keystore** SHA-256 (`eas credentials` → Android, or
  `keytool -list -v -keystore <keystore>`) — needed for internal-track / direct
  APK / dev-client installs signed with the upload key.

### 2.2 `app.json` intent filter (applied)

Add an `intentFilters` array under `expo.android`. Keep the existing `expo.scheme`
(`ovumcy`) — App Links are *added* alongside the custom scheme, not a replacement;
the custom scheme stays for existing non-invite deep links and as a fallback.

```jsonc
"android": {
  "package": "app.ovumcy.mobile",
  "versionCode": 1,
  "allowBackup": false,
  "adaptiveIcon": { "...": "unchanged" },
  "intentFilters": [
    {
      "action": "VIEW",
      "autoVerify": true,
      "data": [
        {
          "scheme": "https",
          "host": "invite.ovumcy.cloud",
          "pathPrefix": "/backup-sync"
        }
      ],
      "category": ["BROWSABLE", "DEFAULT"]
    }
  ]
}
```

Notes:

- `host` must equal the chosen invite host from §4 exactly, and must match the
  host serving `assetlinks.json`.
- `pathPrefix: "/backup-sync"` matches the invite path (`…/backup-sync?invite_token=…`).
  Expo Router maps `/backup-sync` to `app/backup-sync.tsx`; `invite_token` flows
  into `useLocalSearchParams` exactly as today. **No app router/screen code
  changes are required** — the token capture + scrub path is unchanged.
- `autoVerify: true` triggers Android's automatic Digital Asset Links check
  against `assetlinks.json` at install/update time.

### 2.3 How `autoVerify` behaves when verification fails

`autoVerify` is **fail-safe for security, at the cost of the seamless open**:

- **Verification succeeds** (fingerprint in `assetlinks.json` matches the
  installed signature, file reachable over HTTPS with the right content-type): the
  app becomes the **default, exclusive** handler for `https://invite.ovumcy.cloud/backup-sync…`.
  Taps open Ovumcy directly, no chooser, and — critically — a squatting app can
  **never** claim these HTTPS links, because it cannot satisfy the asset-links
  proof for a domain it does not control.
- **Verification fails** (file missing, wrong content-type, behind a redirect,
  fingerprint mismatch, or the device is offline at verify time): Android simply
  does **not** grant Ovumcy the auto-open privilege. The link then behaves like an
  ordinary web URL — it opens in the **browser** (to the web fallback, §5). It
  does **not** silently fall through to a squatting app, and it does **not**
  re-expose the custom-scheme chooser for the HTTPS URL. Failure degrades to
  "opens in browser," never to "opens in attacker."
- Verification status is inspectable on-device with
  `adb shell pm get-app-links app.ovumcy.mobile` (states: `verified` /
  `legacy_failure` / `1024` pending etc.), and can be re-triggered with
  `pm verify-app-links`.

---

## 3. iOS plan (Universal Links)

### 3.1 `apple-app-site-association` (AASA) template

Host at `https://<INVITE_HOST>/.well-known/apple-app-site-association` (no `.json`
extension, served as `application/json`, no redirects). `TEAMID` is a placeholder
(Apple Developer → Membership → Team ID). The bundle id mirrors the Android
package and is a placeholder until issue #99 adds the `ios` section to `app.json`.

Modern form (iOS 13+, `components`):

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID.app.ovumcy.mobile"],
        "components": [
          {
            "/": "/backup-sync",
            "?": { "invite_token": "?*" },
            "comment": "Partner invite links"
          }
        ]
      }
    ]
  }
}
```

If support for iOS < 13 is required, also include the legacy `paths` array in the
same detail entry: `"paths": ["/backup-sync", "/backup-sync?*"]`.

### 3.2 `app.json` associated-domains config (applied)

The `ios` section landed with issue #99 (bundle id + privacy usage strings +
iCloud-backup exclusion), and the `associatedDomains` key below is now applied
in `app.json`:

```jsonc
"ios": {
  "bundleIdentifier": "app.ovumcy.mobile",  // confirmed by issue #99
  "associatedDomains": ["applinks:invite.ovumcy.cloud"]
}
```

Notes:

- Expo adds the `com.apple.developer.associated-domains` entitlement from this
  key at prebuild; the host must match the AASA host and the Android host.
- The `appID` in the AASA is `<TEAMID>.<bundleIdentifier>` — keep all three
  (AASA `appIDs`, `associatedDomains`, `app.json bundleIdentifier`) in lockstep.
- As on Android, keep `expo.scheme` (`ovumcy`) for existing custom-scheme deep
  links; Universal Links are additive.

---

## 4. Domain for invite URLs — DECIDED: `invite.ovumcy.cloud`

**Decision (2026-07-17): a dedicated subdomain, `invite.ovumcy.cloud`.**
User-facing links live in the `.cloud` zone alongside the service hosts (see the
resolved zone question below); the dedicated-subdomain rationale is unchanged.

This commits DNS/TLS/hosting and the managed-side `PARTNER_INVITE_BASE_URL`.
Chosen option and rationale first, rejected alternatives after.

**Decided — dedicated `invite.ovumcy.cloud`:**

- **Smallest blast radius.** The verified-link domain is isolated from the apex
  marketing site and from the API origins (`managed.ovumcy.cloud`,
  `sync.ovumcy.cloud`). A hosting/DNS/TLS compromise or a mis-serve of a
  well-known file is contained to the invite host and cannot piggy-back on the
  main brand domain or the token-bearing API surface.
- **Least-privilege hosting.** The invite host only needs to serve two static
  well-known files plus a static fallback page — no app secrets, no API. It can be
  a locked-down static bucket/CDN, separate from the dynamic managed service.
- **Clean association scope.** `applinks:invite.ovumcy.cloud` and the Android
  `host` bind the app to exactly one host that does nothing else, so the
  `handle_all_urls` / associated-domains grant is narrowly scoped.
- **Cost:** one extra DNS record + TLS cert (both trivial with modern ACME/CDN).

**Alternative A (rejected) — reuse the apex `ovumcy.com`** (as literally written
in the issue acceptance criteria):

- Pro: no new subdomain; the well-known files sit alongside the existing
  marketing/fallback site.
- Con: widens blast radius — the apex domain typically hosts the most exposed,
  most-changed surface (marketing CMS, redirects, analytics). Any mis-served
  `/.well-known/*` or open-redirect there now sits on the same host that owns the
  app-link grant. Rejected in favor of isolation.

**Alternative B (rejected) — reuse the API service subdomain
(`managed.ovumcy.cloud`):**

- Pro: reuses an existing host and its ops tooling.
- Con: co-locates the verified-link host with the token-bearing API origin;
  a redirect/misconfig on the API host would now also carry the app-link grant.
  Mixing the invite delivery host with the bearer-token API surface is the exact
  coupling §1 warns about. Prefer a purpose-built host — the decided
  `invite.ovumcy.cloud` (a new, static-only host in the same zone, not the API
  origin).

**Zone question — resolved (2026-07-17):** the issue text named
`ovumcy.com`, but user-facing links live under `.cloud`, alongside
`managed.ovumcy.cloud` / `sync.ovumcy.cloud` — hence `invite.ovumcy.cloud`. The
host must be identical across: managed `PARTNER_INVITE_BASE_URL`, the two
well-known files' host, `app.json` Android `host`, and iOS `associatedDomains`.

---

## 5. Fallback behavior when link verification fails

Because the invite URL becomes a **real HTTPS URL**, every failure mode degrades to
"open in browser," and the browser path is already safe.

Scenarios:

1. **App installed, verification OK (target state).** Tap opens Ovumcy directly on
   the `backup-sync` route; token captured + scrubbed as today.
2. **App installed, verification not yet complete / failed** (offline at verify
   time, CDN propagation lag, transient mis-serve). The HTTPS link opens in the
   **browser** at `https://invite.ovumcy.cloud/backup-sync?invite_token=…`. Serve a
   minimal static fallback page there ("Open this invite in the Ovumcy app").
   - If the web SPA is deployed on that host, the existing web scrub
     (`web-invite-token-scrub-bootstrap.ts`) strips the token from the URL bar on
     load and the accept flow runs in-browser — identical to today's web accept.
   - If the host serves only a static page, it must **not** echo, log, or forward
     the `invite_token`; it should instruct the user to open the app (which, once
     verified, will re-associate future taps). The static page treats the query
     string as sensitive and never persists it.
3. **App not installed.** The HTTPS link opens the browser fallback page (a store
   link + explanation). This is strictly better than `ovumcy://`, which today
   silently dead-ends ("no app found") when the app is absent.
4. **Old OS versions** (pre-App-Links Android < 6, pre-Universal-Links iOS < 9):
   they cannot verify, so they use the browser fallback path (scenario 2/3). No
   custom-scheme interception is reintroduced because the invite URL itself is now
   HTTPS.

**Why the fallback stays safe:** the token's security comes from server-side
redemption (auth session required), the 7-day TTL, single-use semantics, key
rotation, and projection minimization (§1.3) — none of which depend on *how* the
link was delivered. A token that lands in a browser instead of the app is still
worthless without a managed session and is still one-time/expiring. The fallback
must only avoid *creating new leaks* (no logging, no third-party redirect, no
persistence of the query string), which the guidance above enforces.

---

## 6. Companion infrastructure checklist (managed / domain team)

Lift into the managed/domain repo. `<INVITE_HOST>` = the host decided in §4:
`invite.ovumcy.cloud`.

**DNS & TLS**

- [ ] Create DNS record for `<INVITE_HOST>` pointing at the static host/CDN.
- [ ] Issue a valid, publicly-trusted TLS cert for `<INVITE_HOST>` (ACME/managed).
      Self-signed / private-CA certs fail both Apple and Android verification.
- [ ] Confirm no HSTS/redirect surprises: the two well-known URLs must return
      `200` directly, **not** a 3xx.

**Host `assetlinks.json` (Android)**

- [ ] Serve at `https://<INVITE_HOST>/.well-known/assetlinks.json`.
- [ ] `Content-Type: application/json`.
- [ ] Reachable over HTTPS with **no redirects** and no auth/cookie wall.
- [ ] Contains `package_name: app.ovumcy.mobile` and the SHA-256 fingerprint(s)
      of every signing cert in use (Play app-signing key + upload/EAS key).

**Host `apple-app-site-association` (iOS)**

- [ ] Serve at `https://<INVITE_HOST>/.well-known/apple-app-site-association`.
- [ ] **No `.json` extension**; `Content-Type: application/json`; no redirects;
      no auth wall.
- [ ] `appIDs` / `appID` = `<TEAMID>.app.ovumcy.mobile` (Team ID from Apple
      Developer; bundle id confirmed by issue #99).
- [ ] Remember Apple fetches AASA via its CDN — allow propagation time; use an
      `applinks:<host>?mode=developer` associated-domain on a dev build to bypass
      the CDN while testing.

**Invite URL minting (managed service)**

- [ ] Set `PARTNER_INVITE_BASE_URL = https://<INVITE_HOST>/backup-sync`
      (currently defaults to `ovumcy://backup-sync`). This is the single switch
      that flips minted invite URLs from custom-scheme to verified HTTPS; the app
      needs no code change to *consume* the new URL.
- [ ] Keep raw `invite_token` out of all server logs/metrics (already the
      contract: only `TokenHash` is persisted; the raw token appears solely in the
      returned URL).

**Fallback page**

- [ ] Static page at `https://<INVITE_HOST>/backup-sync` for the not-installed /
      not-verified cases (store link + "open in app"); must not log, echo, forward,
      or persist `invite_token`.

**Monitoring**

- [ ] Uptime + content check on both well-known URLs (alert on non-200, wrong
      content-type, unexpected redirect, or body drift — a broken file silently
      downgrades every install to the browser fallback).
- [ ] TLS expiry monitoring for `<INVITE_HOST>`.
- [ ] Re-verify both files after any CDN/DNS/cert change.

---

## 7. Implementation order

Land in this sequence; each step is safe on its own and nothing user-visible
breaks until the final flip.

1. **Managed/domain (infra), no app release.** Stand up `<INVITE_HOST>` (DNS +
   TLS), host `assetlinks.json` and `apple-app-site-association` with the correct
   content-types and no redirects, and stand up the fallback page. Do this while
   invite URLs are still `ovumcy://` — hosting the files early is harmless.
2. **App config (this repo), Android.** Add `expo.android.intentFilters` (§2.2)
   with `autoVerify: true` for `<INVITE_HOST>`; keep `expo.scheme`. Ship in the
   next build. Verify with `adb shell pm get-app-links app.ovumcy.mobile`.
3. **App config (this repo), iOS — after / with issue #99.** Once #99 adds the
   `ios` section with a confirmed `bundleIdentifier`, add
   `ios.associatedDomains: ["applinks:<INVITE_HOST>"]` (§3.2), and ensure the AASA
   `appID` uses the same Team ID + bundle id. Ship in an iOS build.
4. **Fingerprints reconciled.** Confirm `assetlinks.json` lists the exact
   SHA-256(s) that sign the shipped builds (Play app-signing + upload/EAS). Confirm
   the AASA Team ID + bundle id match the signed iOS build.
5. **Flip the invite URL (managed).** Only after 1–4 are verified in production —
   verification confirmed on both platforms and the fallback page live — set
   `PARTNER_INVITE_BASE_URL = https://<INVITE_HOST>/backup-sync`. New invites now
   mint verified HTTPS links; existing `ovumcy://` links already in flight still
   resolve via the retained custom scheme until they expire (≤7 days).

**Preconditions before the flip (step 5):**

- Both well-known files return `200 application/json` with no redirect on the
  production host.
- Android App Links show `verified` for `app.ovumcy.mobile` on a production-signed
  build; iOS Universal Links open the app from a real production build (not just a
  `?mode=developer` dev build).
- The browser fallback page is live and does not leak `invite_token`.
- The chosen `<INVITE_HOST>` is identical across managed config, both well-known
  files, `app.json` Android `host`, and iOS `associatedDomains`.

Rollback: revert `PARTNER_INVITE_BASE_URL` to `ovumcy://backup-sync`. Because the
custom scheme is retained in `app.json`, invites immediately mint working
custom-scheme links again; no app release is needed to roll back.
