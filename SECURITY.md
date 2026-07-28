# Security Policy

## Supported Versions

Security fixes are provided for the `main` branch only.

| Version | Supported |
| --- | --- |
| `main` | :white_check_mark: |
| older commits/tags | :x: |

## Reporting a Vulnerability

Please report security issues privately — not through public GitHub issues.

- Email: `contact@ovumcy.com`
- Subject: `SECURITY: <short summary>`
- Include: impact, reproduction steps, affected screens/files, and a suggested
  fix if you have one.

We acknowledge receipt within 72 hours and provide a remediation plan after
triage. Please give us reasonable time to remediate before disclosing publicly.

Do not open public GitHub issues for unpatched security vulnerabilities.

## Data Boundary / Threat Model

Ovumcy is a **local-first** reproductive-health app. The phone is the system of
record; the network is an optional, opaque transport. The security posture
follows from that:

- **Health data is encrypted at rest on-device.** Cycle days, symptoms, notes,
  and profile preferences are stored as ciphertext through an XChaCha20-Poly1305
  AEAD with a per-record associated-data (AAD) binding (table name plus the
  row's lookup key). A blob cannot be moved between rows or tables without
  invalidating its authentication tag.
- **Secrets live in platform secure storage.** The local-data encryption key and
  all sync/partner secrets are held in the OS keystore (iOS Keychain / Android
  Keystore via `expo-secure-store`) with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`
  accessibility — never in plaintext `AsyncStorage` or the SQLite database. That
  accessibility class means at-rest encryption protects a powered-off or
  not-yet-unlocked device; once the device has been unlocked the key becomes
  available to the app, so a thief with an already-unlocked or otherwise
  compromised phone is out of scope (see *Out of scope* below).
- **Sync is zero-knowledge.** When the user opts into backup/sync (self-hosted
  `ovumcy-sync-community` or the managed Ovumcy Cloud), payloads are encrypted on-device
  before upload. The server receives opaque ciphertext plus integrity metadata
  (size, checksum, generation) and returns it byte-for-byte; it never holds the
  master key or plaintext. Sync subkeys are derived from the device/recovery key
  material, not shared with the backend.
- **Partner projections are owner-curated and minimized.** A partner never sees
  the owner's raw store. The app builds a separate projection: `summary` access
  collapses detailed day fields to neutral defaults, `full` access honors the
  owner's privacy toggles, and the **pregnancy-test field is stripped at every
  access level**. The projection is encrypted under a per-grant subkey before it
  leaves the device.
- **Guest partner access provisions no credential.** A partner can redeem an
  invite with no prior Ovumcy Cloud account: the managed cloud atomically
  provisions a guest account (no password, no recovery code, marked by the
  reserved, non-issuable `guest+<accountID>@guest.invalid` address, RFC 2606)
  and issues it a normal, server-revocable session bound to that device, in
  the same call that accepts the invite. That session is short-lived and
  renewed by a rotating refresh token written in the same transaction, so the
  link-minted bearer is worth hours rather than weeks — which matters most
  here, since a guest holds no password to fall back on. Every existing
  invariant — single-use
  + 7-day TTL, owner-entitlement gating on every operation, access-level
  minimization, pregnancy-test stripping, owner visibility + permanent revoke
  — applies to a guest identically, because guest accept reuses the same
  invite row and the same entitlement gate. On a device with no prior local
  sync secrets, accepting as a guest silently prepares one (the same
  generator normal setup uses) purely to satisfy the local storage contract;
  it is inert, since guests always carry `syncEnabled: false` and no recovery
  phrase is ever surfaced. See `docs/sync-trust-model.md` (Guest Partner
  Access) for the full model, the threat-model delta this creates for the
  invite-interception analysis in `docs/deep-links.md` §1.3, and the
  sequencing requirement that guest accept must not ship to production before
  the #101 verified invite links are live.
- **No telemetry.** The app ships no analytics, advertising, crash-attribution,
  or third-party tracking SDKs. Nothing about the user's health data or usage is
  reported off-device by default.
- **Premium is gated by the managed billing snapshot; the signed-token overlay
  for the purely-local features is shipped but dormant.** All premium features
  (advanced fertility, extended reports, partner access, reminder emails,
  doctor PDF, advanced insights) are unlocked by a boolean
  entitlement / `has_active_plan` snapshot read from the managed cloud. Local
  device reminder notifications are a free-tier feature derived entirely from
  on-device data and read no billing state. For the two purely-local
  compute features (doctor PDF, advanced insights) a signed EdDSA
  entitlement-token overlay is implemented and test-covered, but no production
  caller constructs the token gate yet, so today those gates too read only the
  snapshot boolean; switching them to the token is a later activation step
  (see Accepted Residual Risks). Gating is **additive**: a free
  or expired account keeps full core cycle-tracking and renders an explicit lock
  card; no health feature is taken away.

### On-device privacy hardening

- **Screen-capture protection.** In production builds, screenshots and the iOS
  app-switcher snapshot are blocked while the app shell is mounted; the user can
  turn this off, and it is disabled in development.
- **Sensitive-action re-auth.** High-sensitivity actions request a device
  biometric / passcode challenge (`expo-local-authentication`); browser preview
  is treated as unavailable unless a caller explicitly opts into a web bypass
  behind another guard.
- **Export and import artifact cleanup.** Generated export files (cycle
  CSV/JSON/PDF and the private recovery-phrase export) are swept from the cache
  directory so they do not linger after sharing. The JSON-import flow's picked
  backup file — a cache copy created by the document picker — is deleted after
  the read attempt whether it succeeds or fails, and the picker's cache
  subdirectory is included in the boot sweep so a mid-import process kill
  cannot leave a health-data backup behind.
- **CSV formula-injection neutralization.** Free-text that begins with a
  spreadsheet formula trigger (`=`, `+`, `-`, `@`) is prefixed so exported CSVs
  cannot execute on open, with RFC 4180 quoting preserved.
- **Cleartext HTTP blocked by default (Android).** The Android network security
  config (`android/app/src/main/res/xml/network_security_config.xml`) is generated
  at prebuild by the committed `plugins/withAndroidNetworkSecurityConfig.js` —
  `android/` itself is gitignored, so the plugin is the real committed source of
  truth — and sets `cleartextTrafficPermitted="false"` app-wide and permits
  cleartext only for the emulator-host/loopback dev addresses (`10.0.2.2`,
  `127.0.0.1`, `localhost`) that serve Metro and local sync stacks in debug builds.
  Production traffic is HTTPS-only at the OS layer. On top of that,
  `src/sync/sync-endpoint-policy.ts` rejects `http://` to any non-private host
  (parsing the host as a literal IPv4 and bucketing by octet, never
  prefix-matching the hostname) as defense in depth, so an `http://` sync/managed
  endpoint is refused before a request goes out regardless of the OS layer.
- **No OS-level backup or remote-delivery channels (Android).** `app.json` sets
  `android.allowBackup=false`, so Android's OS-managed Auto Backup, cloud backup,
  and device-transfer flows never copy this app's on-device data (encrypted
  SQLite, SecureStore-backed material) off the device. The app also ships no
  Firebase Cloud Messaging integration and no over-the-air update channel (no
  `expo-updates` dependency, no `updates` config in `app.json`) — there is no
  push-delivery or remote-code-update surface to secure or audit.
- **No OS-level backup channels (iOS).** iOS has no `allowBackup` switch and no
  Info.plist equivalent, so the committed config plugin
  `plugins/withIosExcludeDataFromICloudBackup.js` injects a launch-time
  `AppDelegate` hook that sets `NSURLIsExcludedFromBackupKey` on the app's
  `Documents` and `Library/Application Support` directories. That keeps both
  on-device data stores — the encrypted SQLite database in `Documents/SQLite`
  (`ovumcy-local.db` plus its `-wal`/`-shm` sidecars) and the AsyncStorage backend
  under `Application Support/<bundleId>` — out of iCloud backups and encrypted
  Finder/iTunes (local) backups, the same backup-exclusion posture Android gets
  from `allowBackup=false`. Excluding the directories also covers files created
  after launch; the hook is idempotent and never fatal, and `ios/` is gitignored so
  the plugin (not a checked-in `AppDelegate`) is the committed source of truth.
  Keychain secrets are governed separately (`expo-secure-store` with
  `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`), an accessibility class iOS already keeps
  out of cross-device Keychain sync and restore.

### Pregnancy, postpartum, and screening data

- **Outcome and screening fields are encrypted-only.** `endReason` and `modeOfDelivery`, plus the EDD
  and the other dates around them, exist solely inside the AEAD-encrypted payload of
  `pregnancy_records`. Postpartum outcome fields (`modeOfDelivery`, `endReason`, the birth/end dates)
  carry the same sensitivity class inside `postpartum_records`. Mental-health screening answers, the
  derived score, and the self-harm flag exist solely inside the AEAD-encrypted payload of
  `screening_responses`. Across these five tables (`pregnancy_records`, `kick_sessions`,
  `contraction_sessions`, `postpartum_records`, `screening_responses`) the only plaintext columns are
  coarse selection metadata — the `status` enum, and the `day` a kick/contraction session or a
  screening check-in falls on — never the outcome or the answers themselves, never in a log line,
  never in an export filename.
- **Three independent, device-auth-gated hard deletes.** Pregnancy, postpartum, and screening data
  each have their own destructive action, gated behind the same device authentication challenge as
  other sensitive actions (`requestSensitiveActionChallenge`, with the same web-bypass allowance used
  by the existing local-data reset) plus an explicit confirm. Deleting one class never touches
  another: deleting all pregnancy data removes every row from `pregnancy_records`, `kick_sessions`,
  and `contraction_sessions` while leaving postpartum and screening rows (and day logs, symptoms, and
  profile data) untouched; deleting postpartum data clears only `postpartum_records`; deleting
  screening ("check-in") data clears only `screening_responses`. Screening is deleted **only** via its
  own action — never as a side effect of the postpartum or pregnancy delete.
- **Screening answers never persist partially.** The EPDS questionnaire holds answers in component
  state only; a response is written once, on finish. Abandoning the flow at any point — back, dismiss,
  navigating away — discards the in-progress answers rather than persisting a partial record. The
  history view of past check-ins surfaces the completion date and score only; the per-item answers
  never enter a history view-data shape. On import, the score and self-harm flag are recomputed from
  the answer vector, so a tampered stored score never enters the local record.
- **Never shared, never gated by ownership.** The pregnancy/kick/contraction domain, the postpartum
  domain, and the screening domain are all categorically excluded from partner-share projections (not
  merely redacted — the projection builder never accepts any of these collections as input), and
  reading or exporting data the owner already logged in any of these domains is never blocked. The
  module is a **one-time on-device unlock**, not a subscription: ownership is resolved through
  `pregnancy-entitlement-service` (fail-closed) and never through the managed billing snapshot, a sync
  session, or the secret store. An active pregnancy or postpartum record renders fully from local data
  whatever that ownership check later says; only *starting* new tracking consults it (postpartum
  reuses the same selector, not a second key).
- **Crisis-support content is a hard safety boundary, never gated.** The personal crisis-support
  contact (two additive fields on the local profile, encrypted at rest like the rest of the profile)
  and the shared crisis-support card that surfaces it — on the EPDS result when the self-harm item is
  flagged, and on the postpartum dashboard's standing "Support resources" row — are never gated and
  never read managed billing/entitlement state at all. The surface renders wherever its host renders,
  and no file in it imports premium/entitlement code.

### Out of scope

- A compromised device (OS malware, jailbreak/root keyloggers, a thief with an
  unlocked phone). Secure storage and screen protection raise the bar but cannot
  defend a fully compromised endpoint.
- The trust model of a configured sync backend beyond the zero-knowledge
  contract: a self-hoster operates their own server.
- Server-side controls (auth rate limiting, blob CAS, webhook verification) —
  those live in `ovumcy-sync-community` and the managed cloud service and carry
  their own `SECURITY.md`.

## Accepted Residual Risks

- **Certificate pinning is scaffolded, not wired.** The pure pin-evaluation
  policy (`src/sync/cert-pin-policy.ts`) and the owner pin store
  (`src/security/cert-pin-store.ts`) exist and are tested, and the sync-endpoint
  policy threads pin sets through. However, the native enforcement layer
  (`react-native-ssl-public-key-pinning`) is **not installed or registered**, so
  TLS today relies on standard CA-chain trust. The JS policy is defense-in-depth
  for when native pinning is enabled. The strategy is no longer open: the
  managed endpoint will pin the Let's Encrypt ISRG root keys rather than the
  leaf, because ACME renewal mints a new leaf key roughly every 60 days and a
  leaf pin would break every install at the first renewal. A CA-level pin
  narrows the accepted issuer set to one CA but does not defend against a
  certificate Let's Encrypt itself is induced to issue for the host — a
  deliberate trade, recorded with the pin set, the rotation rule, and the
  pre-release checklist in
  [docs/sync-trust-model.md](docs/sync-trust-model.md#tls-pinning-posture).
  Until that wiring ships, the residual risk stands exactly as described above.
- **Signed entitlement tokens are implemented but dormant; verification, once
  activated, is bypassable by a forked client (honest non-DRM scope).** A signed
  EdDSA/Ed25519 token overlay for the two *purely-local* premium features
  (doctor PDF, advanced insights) is implemented and test-covered
  (`src/security/entitlement-token.ts`): the verifier checks the signature
  against an embedded public key keyed by `kid`, checks `iss`/`aud`/`exp`/`sub`,
  and the premium loader trusts a valid token's `entitlements` over the plain
  snapshot boolean. It is **not activated**: no production screen or service
  constructs the token gate yet, so today both features are decided purely by
  the managed billing-snapshot boolean, exactly as before the token landed —
  the cross-repo contract memo (`docs/signed-entitlements.md` in the managed
  cloud repo) records the feature as IMPLEMENTED / NOT ACTIVATED, with
  activation as its rollout step 3. Once live, the token raises casual
  circumvention from "flip a boolean" to "patch out signature verification or
  reimplement the managed signer" — and that is the entire claim. It is **not**
  DRM: a determined forker can still patch out the verifier or reimplement the
  signer, and doing so only exposes the user's own data. The gate **falls back
  to the billing-snapshot boolean** whenever no valid token is present (no gate
  constructed — today's state — no endpoint, offline with an expired cache,
  unknown `kid`, tamper), so older managed servers and the pre-rollout state
  behave exactly as before. The public key compiled into the source stays a
  documented placeholder — the fail-closed default for any build that does not
  declare its own key, so a development or preview artifact verifies no
  production token at all. Production builds override it: the `production` EAS
  profile supplies the real `kid -> pubkey` map through
  `EXPO_PUBLIC_ENTITLEMENT_PUBKEYS`, and `npm run deploy` requires the same
  variable in its environment. Only the public half ever reaches the client;
  the managed signing seed stays server-side. A release guard
  (`scripts/verify-entitlement-pubkeys.mjs`, run as the
  `eas-build-pre-install` hook on the production EAS profile and at the start
  of `npm run deploy`) fails any production build or web deploy whose
  `EXPO_PUBLIC_ENTITLEMENT_PUBKEYS` would leave the placeholder active, so a
  production artifact cannot ship it silently. The
  authoritative gate for any *server-side* premium capability (e.g. managed sync)
  remains enforced on the backend, not by this token.
- **Managed billing snapshot cache is a bounded 72h offline-grace exception, not a
  second source of truth.** `loadManagedBillingSnapshot` persists the last-known-good
  billing snapshot — only `hasActivePlan` and `premiumFeatures`; server-driven
  display state like the subscription details and offers is deliberately excluded so
  it fails closed from cache — to the encrypted `managed_billing_cache` table after every
  successful fetch (`MANAGED_BILLING_CACHE_TTL_MS`,
  `src/services/managed-premium-features-service.ts`). If a live fetch then fails,
  the cache is served only while it is at most 72 hours old **and** a managed session
  token is still present on-device; a signed-out or never-connected device gets no
  grace. Past 72 hours, or with nothing ever cached, the gate fails closed exactly as
  it did before this cache existed. Server-checked operations (sync upload/restore,
  partner projections) never read this cache — the server remains their sole
  authority. The trade-off is deliberate: a network blip or managed outage should not
  instantly re-lock all six premium gates on a paying device, at the cost of a revoked
  plan keeping its local unlocks for up to 72 hours while the device cannot reach
  billing truth.
- **Compile-time sync/managed base-URL overrides are dev-only and release-guarded.**
  `EXPO_PUBLIC_OVUMCY_SYNC_BASE_URL` / `EXPO_PUBLIC_OVUMCY_MANAGED_BASE_URL` let a
  local build point at a self-hosted dev stack. A release guard
  (`scripts/verify-base-urls.mjs`, run as the `eas-build-pre-install` hook on the
  production EAS profile and at the start of `npm run deploy`) fails the build
  unless both are unset or exactly the canonical `sync.ovumcy.cloud` /
  `managed.ovumcy.cloud` defaults in the ambient process environment, and the
  deploy web export itself runs through `scripts/export-web.mjs`, which disables
  Expo's dotenv loading (`EXPO_NO_DOTENV=1`) and clears the bundler cache (a
  stale Metro cache can re-inject values inlined under an earlier environment)
  — so a stray `.env.local` override on the deploying machine cannot leak into
  the exported web artifact either.
- **Server-side rate limiting is in-memory.** The sync/managed backends rate-limit
  per process and reset on restart (see their own `SECURITY.md`). The app does
  not add a second client-side limiter.
- **Partner invite links are delivered over a squattable custom scheme (planned
  migration).** Invite URLs are currently minted on the `ovumcy://` custom scheme,
  which any Android app can also register, so the delivery path (not the token
  handling) is interceptable. The blast radius is bounded: the invite token is a
  one-time, 7-day-TTL redemption coupon that only works when POSTed to the
  managed accept endpoint — under an existing managed session, or, once guest
  accept ships (see Guest partner access provisions no credential, above), via
  the dedicated unauthenticated guest-accept endpoint, which mints its own
  minimal session as part of redemption — is scrubbed from the URL/route on
  capture and never logged or persisted, and even a successful wrong-party
  redemption yields only a minimized, read-only projection (pregnancy-test
  stripped) that the owner sees and can revoke. Guest accept removes the
  "attacker needs a pre-existing managed account" precondition from this
  analysis (`docs/deep-links.md` §1.3) — exactly why it must not ship to
  production before the migration below lands. Migrating invite links to
  platform-verified Android App Links / iOS Universal Links closes the
  interception gap; the threat analysis and the ready-to-apply Android/iOS/managed
  plan are in `docs/deep-links.md`.

### Device-clock trust

- **Signed entitlement-token expiry trusts the device clock.** `verifyEntitlementToken`
  (`src/security/entitlement-token.ts`) rejects a token unless `payload.exp > opts.now`,
  where `now` is unix-seconds supplied by the caller — there is no secondary,
  clock-independent freshness check, and the verifier must stay fully offline-capable
  (it is also the code path that checks the cached token during the offline grace in
  `src/services/entitlement-token-service.ts`). As documented above, no production
  caller constructs the token gate yet, so this comparison runs only in tests today;
  once activated, the sole realistic source for `now` is the device clock. A clock set
  behind real time makes an already-issued token keep verifying as unexpired for
  longer than its issuer intended; a clock set ahead of real time only expires a token
  sooner (fails closed). Both directions stay bounded to the two purely-local premium
  features (doctor PDF, advanced insights) behind an already-authenticated managed
  session.
- **The 72h managed-billing-cache grace window trusts the device clock.**
  `isManagedBillingCacheFresh` (`MANAGED_BILLING_CACHE_TTL_MS`,
  `src/services/managed-premium-features-service.ts`) computes
  `ageMs = now.getTime() - fetchedAtMs` and serves the cache only while
  `0 <= ageMs <= 72h`; the real call site (`loadManagedBillingSnapshot`) defaults
  `now` to `new Date()`, the device clock at the moment a live fetch fails. A
  fast-forward clock only shortens the effective grace (fails closed sooner than 72
  real-world hours). A clock set earlier than the recorded fetch instant is rejected
  outright (`ageMs >= 0` fails closed immediately), but a smaller backward adjustment
  that still lands inside the fetch-to-72h window can make an already-expired cache
  read as fresh again — the ceiling is measured in device-clock time, not verified
  elapsed time. This stays within the bounds the cache itself already accepts above:
  only the two purely-local gates, only under a still-present managed session token,
  never a server-checked operation.
- **Local reminder scheduling assumes an approximately correct clock.**
  `buildLocalReminderPlans` (`src/services/local-reminder-plan-service.ts`) resolves
  "today" and the one-time `upcoming_period`/`fertile_window` trigger instants from a
  caller-supplied `now`; the Dashboard and Calendar screens and the settings save path
  all default it to `new Date()` when the schedule is (re)built. The native adapter
  (`platform-local-reminder-scheduler.native.ts`) hands the resolved plan to
  `expo-notifications` as either an absolute one-time `Date` trigger or an hour/minute
  daily-repeat trigger, and firing itself is then driven by the OS's own system clock,
  outside this app's control. A device clock that is wrong when a plan is built bakes
  an incorrect instant into a one-time trigger, and — since there is no background
  resync — that only self-corrects the next time a screen mount or settings save
  rebuilds the schedule. The web adapter never schedules a real reminder
  (`"unavailable"`), so the exposure is native-only, and the worst case is a missed or
  mistimed local notification, never a data or entitlement exposure.
- **Accepted as a standard mobile-client baseline.** None of the above cross-checks
  wall-clock time against a network time source: doing so would need either an
  always-available trusted time service (in tension with the local-first,
  no-account-required baseline) or on-device secure-time infrastructure that neither
  this app nor `ovumcy-sync-community`/the managed cloud provide today. A clock that
  is wrong or adversarially set is a property of the device, not a gap in this app's
  validation logic, and is covered by the Out of scope note above (device compromise,
  jailbreak, OS/system tampering). Every case above is either fail-closed in the risky
  direction (a fast-forward clock only locks features sooner) or bounded to
  already-accepted, low-severity surfaces — never a server-checked capability or a
  health-data confidentiality boundary.

## Test Enforcement Matrix

This section maps each **test-enforceable client security claim** above to the
named Jest test that guards it. When a claim changes, the test must change in the
same commit; when a test is removed, the claim is no longer enforced and must be
retracted here.

Policy-level claims (no-telemetry posture, the zero-knowledge design rationale,
the out-of-scope statements, the scaffolded-pinning and signed-token roadmap
items) are intentionally excluded — they are reviewed by humans, not by
`jest`. They are listed under *Policy / Planned* at the end.

### Local-data encryption at rest

| Claim | Enforced by |
| --- | --- |
| Local records round-trip under XChaCha20-Poly1305 with a generated key and matching AAD; the plaintext is not present in the ciphertext | `encrypts and decrypts local storage records with a generated key and matching AAD` in [src/security/local-data-crypto.test.ts](src/security/local-data-crypto.test.ts) |
| A wrong key fails to open the record | `rejects decryption with the wrong key` in [src/security/local-data-crypto.test.ts](src/security/local-data-crypto.test.ts) |
| AAD binds the blob to its row/table; reading it as a different row or table fails | `rejects decryption when the AAD context does not match the one used to encrypt` in [src/security/local-data-crypto.test.ts](src/security/local-data-crypto.test.ts) |
| Altering the AAD version label fails the open | `rejects decryption when AAD version label is altered` in [src/security/local-data-crypto.test.ts](src/security/local-data-crypto.test.ts) |
| The AEAD round-trips any payload and refuses a different AAD or key (property-based) | `round-trips any payload under the same key and aad`, `does not open under a different aad (AAD binding)`, `does not open under a different key` in [src/security/payload-crypto.property.test.ts](src/security/payload-crypto.property.test.ts) |

### Partner-share crypto and projection privacy

| Claim | Enforced by |
| --- | --- |
| The partner-share key derives only from tokens at/above the entropy floor; short tokens are rejected and distinct tokens yield distinct keys | `rejects tokens shorter than the entropy floor`, `rejects tokens that only become non-empty after trim and still fall under the floor`, `derives a deterministic 32-byte hex key for tokens at or above the floor`, `produces distinct keys for distinct tokens` in [src/security/partner-share-crypto.test.ts](src/security/partner-share-crypto.test.ts) |
| The per-grant subkey rotates away from the invite key and changes when grant/owner/source context changes | `rotates away from K_invite — K_grant must differ`, `produces distinct keys when grantID, ownerAccountID, or sourceInviteID change`, `rejects empty context fields rather than collapsing distinct grants to the same key` in [src/security/partner-share-crypto.test.ts](src/security/partner-share-crypto.test.ts) |
| An encrypted projection round-trips its generation counter and rejects a missing / non-integer / below-floor generation | `preserves the generation counter across an encrypt/decrypt round-trip`, `rejects a payload whose generation is below the floor (F5 defense-in-depth)`, `rejects a payload whose generation is not an integer`, `rejects a payload that is missing the generation field entirely` in [src/security/partner-share-crypto.test.ts](src/security/partner-share-crypto.test.ts) |
| Projection encryption round-trips and rejects a foreign key/AAD over generated inputs (property-based) | property suite in [src/security/partner-share-crypto.property.test.ts](src/security/partner-share-crypto.property.test.ts) |
| Summary access strips detailed day fields (flow, mood, sex, BBT, mucus, LH, symptoms, notes) | `redacts detailed day fields for summary access`, `summary projection strips flow (data minimisation)` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |
| Full access keeps history but enforces the owner's privacy toggles | `keeps full history but respects owner privacy toggles` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |
| **The pregnancy-test field is stripped from a full projection even when the record is positive** | `full projection strips pregnancyTest even when record has a non-none value (regression)` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |
| Staleness is surfaced when a snapshot ages out and not before | `sets isStale when snapshot is older than 14 days`, `does not set isStale when snapshot is fresh (within 14 days)` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |

### Partner invite-token scrubbing (web)

| Claim | Enforced by |
| --- | --- |
| An `invite_token` query param is stashed and stripped from `window.location`, preserving other params, hash, and history state | `stashes the invite_token and strips it from window.location`, `preserves the URL hash fragment`, `removes the trailing question mark when invite_token was the only parameter`, `trims surrounding whitespace from the stashed token` in [src/security/web-invite-token-scrub.test.ts](src/security/web-invite-token-scrub.test.ts) |
| Empty / whitespace-only tokens are stripped without stashing; a tokenless URL is a no-op | `strips a whitespace-only token without stashing it`, `strips an empty invite_token parameter without stashing it`, `is a no-op when the URL has no invite_token` in [src/security/web-invite-token-scrub.test.ts](src/security/web-invite-token-scrub.test.ts) |
| The token is gone from the address bar by the time the SPA bundle has executed (runtime) | `F9: partner invite_token is scrubbed from the URL by the time the SPA bundle has executed` in [e2e/web-smoke.spec.ts](e2e/web-smoke.spec.ts) |

### Guest partner access

| Claim | Enforced by |
| --- | --- |
| The guest-accept API call carries no Authorization/session header and posts only the invite token to the unauthenticated endpoint | `accepts a partner invite as a guest with no Authorization header and maps the session + grant + invite` in [src/sync/managed-cloud-api-client.test.ts](src/sync/managed-cloud-api-client.test.ts) |
| The service-layer guest-accept function takes no session-store/mode argument at all — there is no session to read, by construction — and forwards the same no-bearer call | `redeems the invite with no session precondition and no bearer, returning the session + grant + invite` in [src/services/managed-partner-access-service.test.ts](src/services/managed-partner-access-service.test.ts) |
| Guest-accept error keys (`partner_invite_not_found`, `partner_invite_expired`, `invalid_partner_invite`, `partner_access_unavailable`, `rate_limited`) map identically to the logged-in accept path, so the invite-lifecycle and owner-entitlement checks are not weakened for guests | `maps guest-accept error keys identically to the logged-in accept path` in [src/sync/managed-cloud-api-client.test.ts](src/sync/managed-cloud-api-client.test.ts); `maps each guest-accept error key the same way the logged-in accept path does` in [src/services/managed-partner-access-service.test.ts](src/services/managed-partner-access-service.test.ts) |
| A device with no prior local sync secrets gets a freshly generated `SyncSecretsRecord` on guest accept, forced into managed/connected preferences, with capabilities always reporting `syncEnabled: false` | `generates a fresh SyncSecretsRecord on a device with no prior secrets and forces managed/connected preferences` in [src/sync/sync-client-service.test.ts](src/sync/sync-client-service.test.ts) |
| An already-prepared device's master key and device identity are left untouched by guest accept — only the auth-session fields change | `keeps an already-prepared device's master key and device identity untouched` in [src/sync/sync-client-service.test.ts](src/sync/sync-client-service.test.ts) |
| A rejected guest-accept attempt (any mapped error) persists no session and writes no preferences | `forwards each mapped error key and persists no session` in [src/services/backup-sync-screen-service.test.ts](src/services/backup-sync-screen-service.test.ts) |
| End-to-end: a brand-new device (no stored secrets, no session) redeems the invite through the unauthenticated endpoint in one call and ends in a connected managed state with the grant | `redeems the invite with no bearer, persists the session on a brand-new device, and returns a connected managed state + grant` in [src/services/backup-sync-screen-service.test.ts](src/services/backup-sync-screen-service.test.ts) |
| The backup-sync screen's local-step "create/regenerate recovery phrase" affordance never renders for a guest session, even though guest accept already leaves `hasStoredSyncSecrets` true; a non-guest session keeps the affordance and can still complete the regenerate flow | `hides the local-step regenerate affordance for a guest session, leaving the rest of that step intact`, `still lets a non-guest complete the local-step regenerate flow and reveal a fresh phrase (owner path pinned unchanged)` in [src/ui/screens/BackupSyncScreen.test.tsx](src/ui/screens/BackupSyncScreen.test.tsx); `hides the local-step prepare/regenerate button for a guest session even though local secrets already exist` in [src/ui/screens/backup-sync/SettingsSyncSetupSection.test.tsx](src/ui/screens/backup-sync/SettingsSyncSetupSection.test.tsx); `hides the local-step prepare/regenerate action for a guest session but not for a normal managed session (docs/sync-trust-model.md: guests never see a recovery phrase)` in [src/services/backup-sync-view-service.test.ts](src/services/backup-sync-view-service.test.ts) |
| `prepareSyncSetup` independently refuses to mint a recovery phrase for a guest session (defense-in-depth below the UI hide), leaving any already-stored guest secrets untouched | `refuses to prepare or regenerate sync secrets for a guest session, leaving existing guest secrets untouched` in [src/sync/sync-setup-service.test.ts](src/sync/sync-setup-service.test.ts) |

### CSV formula-injection neutralization

| Claim | Enforced by |
| --- | --- |
| A note beginning with a formula prefix is neutralized | `(a) neutralizes a note starting with an injection formula prefix` in [src/services/export-service.test.ts](src/services/export-service.test.ts) |
| A custom symptom label starting with `+` and a cycle factor starting with `@` are neutralized | `(b) neutralizes a custom symptom label starting with + and a cycle factor starting with @` in [src/services/export-service.test.ts](src/services/export-service.test.ts) |
| Normal text without a dangerous prefix is left untouched | `(c) does not modify normal text without a dangerous prefix` in [src/services/export-service.test.ts](src/services/export-service.test.ts) |
| A neutralized value that also contains a comma is RFC 4180 quoted | `(d) wraps an apostrophe-prefixed value in RFC4180 quotes when it also contains a comma` in [src/services/export-service.test.ts](src/services/export-service.test.ts) |

### Symptom label/icon validation

| Claim | Enforced by |
| --- | --- |
| Icons containing `<`, `>`, or a control character are rejected | `rejects icon containing '<'`, `rejects icon containing '>'`, `rejects icon containing a control character` in [src/services/symptom-policy.test.ts](src/services/symptom-policy.test.ts) |
| Over-long icons are rejected and empty/whitespace falls back to a default | `rejects icon that exceeds the max length (> 16 runes)`, `falls back to the default icon when input is empty`, `falls back to the default icon when input is only whitespace` in [src/services/symptom-policy.test.ts](src/services/symptom-policy.test.ts) |
| A custom symptom with an invalid icon is rejected at creation | `rejects a custom symptom whose icon contains invalid characters` in [src/services/symptom-policy.test.ts](src/services/symptom-policy.test.ts) |
| Custom labels cannot duplicate a built-in symptom, case-insensitively or in another locale | `rejects custom symptom labels that duplicate built-ins case-insensitively`, `rejects custom symptom labels that duplicate localized built-ins` in [src/services/symptom-policy.test.ts](src/services/symptom-policy.test.ts) |

### Client TOTP validation, challenge, and replay handling

| Claim | Enforced by |
| --- | --- |
| Enrollment requires a non-empty current password and a stored session, and maps the backend `totp_not_configured` | `returns current_password_required when the password is empty`, `returns not_connected when no session token is stored`, `maps totp_not_configured from the managed backend` in [src/sync/sync-totp-service.test.ts](src/sync/sync-totp-service.test.ts) |
| Verification rejects non-6-digit codes locally before any network call and maps the backend `totp_invalid_code` | `rejects non-6-digit codes locally without calling fetch`, `maps totp_invalid_code from the community backend` in [src/sync/sync-totp-service.test.ts](src/sync/sync-totp-service.test.ts) |
| Disable requires a password and a 6-digit code, rejecting bad codes before the network | `requires a non-empty password`, `rejects non-6-digit codes locally without calling fetch` (disableTOTP) in [src/sync/sync-totp-service.test.ts](src/sync/sync-totp-service.test.ts) |
| The login TOTP challenge requires a challenge id, rejects bad codes locally, and maps the backend `totp_challenge_invalid` | `requires a non-empty challenge id`, `rejects non-6-digit codes locally without calling fetch` (completeTOTPChallenge), `maps totp_challenge_invalid for the community backend` in [src/sync/sync-totp-service.test.ts](src/sync/sync-totp-service.test.ts) |
| The challenge is dispatched to the correct backend with the correct session token | `dispatches the managed client with the managed session token`, `dispatches the community client with the community session token` in [src/sync/sync-totp-service.test.ts](src/sync/sync-totp-service.test.ts) |

### Reset / recovery and session revocation

| Claim | Enforced by |
| --- | --- |
| A successful password reset clears the stored session tokens and downgrades the device out of the connected state | `clears session tokens and downgrades preferences to local_ready on success` in [src/sync/sync-account-recovery-service.test.ts](src/sync/sync-account-recovery-service.test.ts) |
| A failed reset (`invalid_reset_token`) does **not** wipe local session tokens | `maps invalid_reset_token` in [src/sync/sync-account-recovery-service.test.ts](src/sync/sync-account-recovery-service.test.ts) |
| Forgot-password / reset surfaces only the generic `invalid_recovery_credentials` (enumeration-safe) | `forwards generic invalid_recovery_credentials` in [src/sync/sync-account-recovery-service.test.ts](src/sync/sync-account-recovery-service.test.ts) |
| Change-password and recovery-code regeneration require the current password and dispatch to the correct backend | `validates required inputs before any network call`, `maps invalid_current_password from the community client`, `dispatches to the community client using the community session token` (regenerate) in [src/sync/sync-account-recovery-service.test.ts](src/sync/sync-account-recovery-service.test.ts) |
| Reset/regeneration without stored secrets fails closed with `not_connected` and makes no network call | `returns not_connected when there are no secrets` (change-password and regenerate) in [src/sync/sync-account-recovery-service.test.ts](src/sync/sync-account-recovery-service.test.ts) |

### Screen-capture protection

| Claim | Enforced by |
| --- | --- |
| Production builds prevent screen capture (and the iOS app-switcher snapshot) while the shell is mounted, and release it on unmount | `enables privacy protection while the production app shell is mounted` in [src/security/app-screen-protection.test.tsx](src/security/app-screen-protection.test.tsx) |
| Protection is skipped in development and when the user turns it off, and is cleaned up on toggle-off | `skips privacy protection in development`, `skips privacy protection when the user turns it off`, `cleans up privacy protection when the user turns it off` in [src/security/app-screen-protection.test.tsx](src/security/app-screen-protection.test.tsx) |

### Sensitive-action re-authentication

| Claim | Enforced by |
| --- | --- |
| A sensitive action succeeds only on a successful device challenge; unavailable security and user cancellation are distinguished | `succeeds when local authentication succeeds`, `maps unavailable device security to an unavailable result`, `maps user cancellation to a cancelled result` in [src/security/sensitive-action-auth.test.ts](src/security/sensitive-action-auth.test.ts) |
| Browser preview is unavailable for device challenges unless the caller opts into an explicit web bypass | `treats browser preview as unavailable for sensitive device challenges`, `allows an explicit web bypass when the caller already has another guard` in [src/security/sensitive-action-auth.test.ts](src/security/sensitive-action-auth.test.ts) |

### Export and import artifact cleanup

| Claim | Enforced by |
| --- | --- |
| Stale Ovumcy export artifacts (cycle and private recovery exports) are removed from the cache; unrelated files are left alone | `removes files whose name matches an Ovumcy export prefix` in [src/services/export-artifact-cleanup.native.test.ts](src/services/export-artifact-cleanup.native.test.ts) |
| The sweep is resilient: it ignores directory-like entries, returns silently when the cache is absent, and survives a per-file delete failure | `skips entries that lack a delete method (directory-like)`, `returns silently when the cache directory does not exist yet`, `swallows per-file delete failures so a single locked file does not abort the sweep` in [src/services/export-artifact-cleanup.native.test.ts](src/services/export-artifact-cleanup.native.test.ts) |
| The JSON-import picker's cache copy is deleted after the read attempt — on success, on read failure, and on an oversized file rejected before reading | `returns the file content and deletes the cache copy after a successful read`, `deletes the cache copy even when reading the file fails`, `rejects an oversized file before reading it and still deletes the cache copy` in [src/services/import-file-picker.native.test.ts](src/services/import-file-picker.native.test.ts) |
| The boot sweep also removes the document picker's cache subdirectory (orphaned import copies), without aborting the export sweep on failure | `removes the document-picker cache directory left behind by a killed import`, `leaves the picker directory alone when it does not exist`, `still sweeps export files when the picker-directory delete fails` in [src/services/export-artifact-cleanup.native.test.ts](src/services/export-artifact-cleanup.native.test.ts) |

### Premium additivity (gating never removes core features)

| Claim | Enforced by |
| --- | --- |
| Advanced insights are **added** when the managed premium entitlement is active | `adds advanced insights when the managed premium entitlement is active` in [src/services/stats-view-service.test.ts](src/services/stats-view-service.test.ts) |
| Without an entitlement the Stats screen renders explicit premium **lock placeholders** rather than dropping functionality | `returns premium lock placeholders when entitlements are missing` in [src/services/stats-view-service.test.ts](src/services/stats-view-service.test.ts) |
| Doctor-PDF export is blocked without an active managed plan and allowed only with the managed billing entitlement | `blocks PDF export when no managed cloud plan is active`, `allows PDF export only when the managed billing entitlement is active` in [src/services/settings-screen-service.test.ts](src/services/settings-screen-service.test.ts) |
| Premium plan status stays billing-owned and is not inferred from sync state | `keeps managed plan status billing-owned when sync entitlement stays enabled without premium billing` in [src/services/settings-screen-service.test.ts](src/services/settings-screen-service.test.ts) |
| Free-tier stats render with locked sections in the empty state (no feature removed), surfaced on the page | `stats shows premium lock placeholders when entitlements are missing and the lock routes to backup-sync` in [e2e/web-smoke.spec.ts](e2e/web-smoke.spec.ts) |

### Signed entitlement-token verification (purely-local premium)

| Claim | Enforced by |
| --- | --- |
| The golden interop vector (the exact token the managed cloud signer emits for the same key) verifies under its embedded public key and yields its `entitlements` and `sub` | `accepts the golden token under the golden pubkey and returns its entitlements + sub` in [src/security/entitlement-token.test.ts](src/security/entitlement-token.test.ts) |
| Flipping a single payload character invalidates the signature (verification is over the received signing-input bytes, not a JSON re-serialization) | `rejects when a single payload character is flipped (signature no longer matches)` in [src/security/entitlement-token.test.ts](src/security/entitlement-token.test.ts) |
| An unknown / rotated-out `kid` is rejected (locked), never trusted | `rejects an unknown / rotated-out kid (locked)` in [src/security/entitlement-token.test.ts](src/security/entitlement-token.test.ts) |
| An expired token (`now >= exp`, including exactly at `exp`) is rejected | `rejects an expired token (now >= exp), including exactly at exp` in [src/security/entitlement-token.test.ts](src/security/entitlement-token.test.ts) |
| A non-EdDSA `alg` header (incl. `none`) is rejected before any signature work, even with an otherwise-valid signature | `rejects a header whose alg is not EdDSA, even with a valid signature` in [src/security/entitlement-token.test.ts](src/security/entitlement-token.test.ts) |
| A truncated / garbage token is rejected without throwing | `rejects a truncated signature without throwing`, `rejects garbage / structurally-invalid input without throwing` in [src/security/entitlement-token.test.ts](src/security/entitlement-token.test.ts) |
| A token minted for account A is rejected when bound to account B (`sub` mismatch / cross-account replay) | `accepts the golden token when expectedSub matches and rejects on sub mismatch (cross-account replay)` in [src/security/entitlement-token.test.ts](src/security/entitlement-token.test.ts) |
| Any token signed by a freshly generated keypair verifies, and any single-byte tamper of the signing-input or signature fails (property-based) | `verifies any token signed by a freshly generated keypair`, `rejects any single-byte tamper of the signing-input (header.payload bytes)`, `rejects any single-byte tamper of the signature segment` in [src/security/entitlement-token.property.test.ts](src/security/entitlement-token.property.test.ts) |
| With no token gate the premium snapshot is returned verbatim and the token endpoint is never called (rollout fallback preserves today's behaviour) | `returns the snapshot premiumFeatures verbatim when no gate is supplied`, `does not call the entitlements/token endpoint at all when no gate is supplied` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| When the issuance endpoint 503s (signing key absent) with nothing cached, the gate falls back to the snapshot booleans (no regression) | `falls back to snapshot booleans when the endpoint is 503 and nothing is cached (no regression)` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| A verified token overlays the two local features (and only those); an expired cached token re-locks and falls back to the snapshot | `overlays a verified token: the two local features become true, server-gated stay from the snapshot`, `re-locks when the cached token is expired and falls back to the snapshot booleans` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |

### Managed billing snapshot offline-grace cache

| Claim | Enforced by |
| --- | --- |
| A successful billing fetch refreshes the persisted last-known-good snapshot | `refreshes the persisted last-known-good snapshot on a successful fetch` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| A failed fetch serves the cached snapshot while it is within the 72h TTL | `serves the cached snapshot within the 72h TTL when the billing fetch fails` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| Once the cache exceeds 72h, a failed fetch fails closed exactly as it did before the cache existed | `fails closed exactly as before once the cache is older than 72h` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| A failed fetch with nothing ever cached fails closed | `fails closed when the fetch fails and no snapshot was ever cached` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| The cache is never served without a still-present managed session token | `never serves the cache without a managed session token` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| A network blip keeps all six premium gates unlocked via `loadManagedPremiumFeatures` instead of instantly re-locking | `keeps six premium gates unlocked through loadManagedPremiumFeatures on a network blip` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |

### Pregnancy, postpartum, and screening data

| Claim | Enforced by |
| --- | --- |
| Pregnancy outcome fields (EDD, end reason) are stored in the encrypted payload, never as plaintext columns | `stores pregnancy data in encrypted payloads, never plaintext EDD or end-reason strings` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts) |
| Screening answers and the derived score exist only inside the encrypted payload | `round-trips screening responses and stores answers/score only in the encrypted payload` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts) |
| A row whose ciphertext was moved between ids or tables fails closed and is dropped rather than decrypted | `drops a pregnancy row whose ciphertext was copied from a different pregnancy id (AAD fail-closed)`, `drops a contraction row holding a kick-session ciphertext (cross-table AAD binding)`, `drops a postpartum row whose ciphertext was copied from a different postpartum id (AAD fail-closed)`, `drops a screening row whose ciphertext was copied from a different id (AAD fail-closed)` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts) |
| Deleting one sensitive class never deletes another | `deleteAllPregnancyData clears every pregnancy table but leaves other tables intact`, `deleteAllScreeningData clears screening but leaves postpartum + other data intact (separate sensitive classes)`, `deleteAllPostpartumData does NOT delete screening data (screening is a separate class)` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts) |
| A destructive local reset / key mismatch wipes all five tables, leaving no orphaned undecryptable rows | `wipes every local table (including pregnancy, postpartum, and screening) via wipeLocalAppTables` in [src/storage/local/sqlite-local-data-key.test.ts](src/storage/local/sqlite-local-data-key.test.ts); `wipes the pregnancy tables on destructive local reset and leaves them empty and usable`, `wipes the screening table on destructive local reset and leaves it usable` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts) |
| The v13 → v16 upgrade creates the five tables with existing data intact | `upgrades a v13 database through v14/v15/v16, creating the pregnancy, postpartum, and screening tables with existing data intact` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts) |
| An abandoned questionnaire persists nothing, and an unanswered item cannot finish one | `persists nothing when the questionnaire is abandoned partway through` in [src/ui/screens/postpartum/ScreeningScreen.test.tsx](src/ui/screens/postpartum/ScreeningScreen.test.tsx), `refuses to finish while any item is unanswered and persists nothing` in [src/ui/screens/postpartum/ScreeningScreen.handlers.test.tsx](src/ui/screens/postpartum/ScreeningScreen.handlers.test.tsx) |
| The check-in history surfaces date and score only, never the per-item answers | `lists rows newest-first with date and score only (no answers)` in [src/services/screening-service.test.ts](src/services/screening-service.test.ts) |
| An imported screening score / self-harm flag is recomputed from the answers, so a tampered stored score never applies | `recomputes an imported screening's score + selfHarmFlag from its answers (a drifted stored score is corrected, never trusted)` in [src/services/import-service.test.ts](src/services/import-service.test.ts) |
| **No pregnancy, postpartum, or screening data reaches a partner projection at either access level** | `never leaks pregnancy-mode day fields into the %s projection`, `never leaks postpartum or screening data into the %s projection` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |
| **The crisis-support contact never reaches a partner projection at either access level** | `never leaks the crisis-support contact into the %s projection` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |
| The crisis-support surface never consults an entitlement loader while rendering or saving | `never consults the premium loader while rendering or saving (never plan-gated)` in [src/ui/components/CrisisSupportCard.test.tsx](src/ui/components/CrisisSupportCard.test.tsx) |
| Module ownership is fail-closed: a throwing or non-`true` source reads as not owned, and a release build never unlocks from the dev flag | `returns true only when the source answers true`, `fails closed when the source throws`, `treats a non-boolean truthy answer as not owned`, `never unlocks a release build, whatever the flag says` in [src/services/pregnancy-entitlement-service.test.ts](src/services/pregnancy-entitlement-service.test.ts) |
| A locked module shows the lock card instead of the start form | `renders the premium lock card and no form when locked` in [src/ui/screens/pregnancy/PregnancyStartScreen.test.tsx](src/ui/screens/pregnancy/PregnancyStartScreen.test.tsx) |

### Medical-safety prediction suppression

Predictions are estimates, never medical advice or a method of contraception.
Suppression ORs two signals: the day-log pregnancy pause (a positive test on or
after every recorded cycle start, until a later cycle start is logged) and an
ACTIVE pregnancy record. Either signal alone must hide current-cycle
predictions and fertility signals — the paused projection deliberately keeps
its cycle anchor (so the pause alone cannot null anchor-driven surfaces), a
period logged mid-pregnancy lifts the pause, and an LMP/ultrasound-dated
pregnancy never sets it, so neither signal ever covers the other.

| Claim | Enforced by |
| --- | --- |
| An active pregnancy record suppresses the dashboard cycle hero, fertility summary, and prediction hint even when the day-log pause never engaged or was lifted | `suppresses hero, fertility summary and prediction hint for a stale active pregnancy that never logged a positive test`, `suppresses the cycle hero for a stale active pregnancy after a period logged post-positive-test lifts the day-log pause` in [src/services/dashboard-view-service.test.ts](src/services/dashboard-view-service.test.ts) |
| An active pregnancy record suppresses the stats prediction-bearing sections after the pause lifts, keeping completed-cycle facts | `suppresses prediction-bearing sections for an active pregnancy even after the pause lifts, keeping completed-cycle facts` in [src/services/stats-view-service.test.ts](src/services/stats-view-service.test.ts) |
| The un-lifted day-log pause alone hides the stats BBT trend/coverline, the mucus peak-fertility card, and current-cycle fertility signals — no pregnancy record required | `hides BBT trend, the peak-fertility card, and current-cycle fertility signals while the day-log pause is active (no pregnancy record)` in [src/services/stats-view-service.test.ts](src/services/stats-view-service.test.ts) |
| The calendar's selected-day advanced fertility summary drops under either suppression signal | `drops the summary while a pregnancy record is active (day-log pause never set)`, `drops the summary while the day-log pause is active (no pregnancy record)` in [src/services/calendar-view-service.test.ts](src/services/calendar-view-service.test.ts) |
| The doctor PDF prints no current-cycle fertility signals under either suppression signal, leaving completed-cycle history untouched | `suppresses the current-cycle LH-peak signal when an active pregnancy record exists, leaving completed-cycle history untouched`, `suppresses the current-cycle LH-peak signal while the day-log pause is active (no pregnancy record)` in [src/services/export-pdf-service.test.ts](src/services/export-pdf-service.test.ts) |
| The day-save confirmation never claims a fertile window or a self-care cycle day while a pregnancy record is active | `lets an active pregnancy record win over the fertile window and the day-log pause`, `never claims a fertile window in the day-save message while a pregnancy record is active` in [src/services/dashboard-view-service.test.ts](src/services/dashboard-view-service.test.ts) |
| Period and fertile-window reminders (device push and the managed email channel) stay suppressed under either suppression signal | `suppresses period and fertile reminders after a positive pregnancy test`, `suppresses period and fertile reminders for an active pregnancy record with no day-log pause` in [src/services/local-reminder-plan-service.test.ts](src/services/local-reminder-plan-service.test.ts); `suppresses them on the device and the managed email channel during an active pregnancy` in [src/services/local-reminder-sync-service.test.ts](src/services/local-reminder-sync-service.test.ts) |

### Policy / Planned (human-reviewed, not in the matrix)

- **No telemetry.** The absence of analytics/ad/tracking SDKs is a dependency-
  and code-review invariant, not a single unit test.
- **Zero-knowledge sync rationale.** The end-to-end guarantee that the server
  only ever sees opaque ciphertext is enforced jointly with the backend test
  suites (`ovumcy-sync-community` and the managed cloud); the app side is covered by
  the local/partner crypto rows above and by the env-gated live smoke tests.
- **Certificate pinning enforcement.** Native pin registration
  (`react-native-ssl-public-key-pinning`) is not yet wired, so the
  observed-fingerprint comparison cannot be exercised against a real handshake in
  the app test suite; only the pure policy and store are tested today. Planned.
- **Signed premium entitlement tokens (honest non-DRM scope).** The
  entitlement-token verifier and its snapshot-fallback overlay are implemented
  and pinned by the matrix rows above, but remain dormant: no production caller
  constructs the token gate, so the two purely-local premium features are still
  decided by the billing-snapshot boolean until the activation rollout step.
  The remaining policy note is that verification, once live, is *bypassable by
  a forked client* by design. This is not asserted by a single test — it is the
  explicit non-goal recorded in the Accepted-Residual note above, reviewed by
  humans. The token is treated as a hardened UX control over the
  user's own local data, not a DRM trust boundary.
- **Secure-storage backing for keys/secrets.** Keys and sync/partner secrets are
  placed in `expo-secure-store` with device-only accessibility; the OS keystore
  itself is not exercised by Jest (it is mocked), so this is a code-review
  invariant rather than a matrix row.
