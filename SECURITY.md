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
  invalidating its authentication tag. A row whose encrypted payload is empty
  is never adopted from its plaintext columns: it is deleted at boot and read
  as absent, and a singleton whose payload does not open falls back to its
  defaults, and a day-log or symptom row whose payload does not open is
  deleted at boot without failing startup or Clear data, so clearing or
  corrupting a payload cannot inject a record or lock the app.
- **Key/data mismatch resets deterministically and atomically.** At boot the
  stored key is checked against canary rows (the two singletons, then one day
  log and one symptom). The reset needs a well-formed envelope that fails
  authentication and none that authenticates, or a stored key that cannot be a
  32-byte key — a single tampered row never wipes the rest; a SQLite read error
  propagates and an unparseable envelope is skipped, so neither wipes anything.
  The wipe of every local table runs in one transaction, and the replacement
  key is written only after it commits.
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
  (advanced fertility, extended reports, partner access, reminders,
  doctor PDF, advanced insights) are unlocked by a boolean
  entitlement / `has_active_plan` snapshot read from the managed cloud. Local
  device reminder notifications are a free-tier feature derived entirely from
  on-device data and read no billing state. For the two purely-local
  compute features (doctor PDF, advanced insights) a signed EdDSA
  entitlement-token overlay is implemented and test-covered, and the production
  premium-features loader builds the token gate, but the gate is inert until the
  managed cloud issues tokens: with no fetched or cached token it falls back to
  the snapshot boolean, which decides those gates today; issuing tokens is the
  activation step (see Accepted Residual Risks). Gating is **additive**: a free
  or expired account keeps full core cycle-tracking and renders an explicit lock
  card; no health feature is taken away.

### On-device privacy hardening

- **Screen-capture protection.** In production builds, screenshots and the iOS
  app-switcher snapshot are blocked while the app shell is mounted; the user can
  turn this off, and it is disabled in development.
- **Sensitive-action re-auth.** High-sensitivity actions request a device
  biometric / passcode challenge (`expo-local-authentication`); browser preview
  is treated as unavailable unless a caller explicitly opts into a web bypass
  behind another guard. Restore from a sync backup is one of these actions. The
  offline JSON restore is not: it only ever adds records, never overwrites,
  merges or deletes, and is gated by a dry-run preview plus an explicit confirm
  instead of a device challenge. Its one derived write is the stored cycle
  start: an added spotting or uncertain-marked day on that date repoints it, as
  saving the same day from the day screen does.
- **Export and import artifact cleanup.** Generated export files (cycle
  CSV/JSON/PDF and the private recovery-phrase export) are swept from the cache
  directory so they do not linger after sharing. The JSON-import flow's picked
  backup file — a cache copy created by the document picker — is deleted after
  the read attempt whether it succeeds or fails, and the picker's cache
  subdirectory is included in the boot sweep so a mid-import process kill
  cannot leave a health-data backup behind.
- **CSV formula-injection neutralization.** Free-text that begins with a
  spreadsheet formula trigger (`=`, `+`, `-`, `@`) is prefixed so exported CSVs
  cannot execute on open, and any cell containing a comma, semicolon, quote, CR
  or LF is RFC 4180 quoted so no delimiter or bare CR starts a new cell.
- **Cleartext HTTP blocked by default (Android).** The Android network security
  config (`android/app/src/main/res/xml/network_security_config.xml`) is generated
  at prebuild by the committed `plugins/withAndroidNetworkSecurityConfig.js` —
  `android/` itself is gitignored, so the plugin is the real committed source of
  truth — and sets `cleartextTrafficPermitted="false"` app-wide. The
  emulator-host/loopback dev addresses (`10.0.2.2`, `127.0.0.1`, `localhost`) are
  exempted only in the debug variant's config (`src/debug`, which Metro needs) and
  in the main config of an EAS build for the `local` profile (whose sync endpoints
  are `http://10.0.2.2`); every other release build ships the config with no
  cleartext exception, so production traffic is HTTPS-only at the OS layer. On
  top of that, `src/sync/sync-endpoint-policy.ts` rejects `http://` to any non-private host
  (parsing the host as a literal IPv4 and bucketing by octet, never
  prefix-matching the hostname) as defense in depth, so an `http://` sync/managed
  endpoint is refused before a request goes out regardless of the OS layer.
- **No OS-level backup or remote-delivery channels (Android).** `app.json` sets
  `android.allowBackup=false`, and the committed config plugin
  `plugins/withAndroidExcludeDataFromBackup.js` points
  `android:dataExtractionRules` (Android 12+) and `android:fullBackupContent`
  (Android 11 and lower) at rules that exclude every backup domain — credential-
  and device-protected storage and app-specific external storage — from both
  cloud backup and device-to-device transfer. `allowBackup=false` alone stops
  device-to-device transfer only up to Android 11; on Android 12+ only the
  extraction rules do. So Android's OS-managed Auto Backup, cloud backup, and
  device-transfer flows never copy this app's on-device data (encrypted SQLite,
  AsyncStorage, SecureStore-backed material, library-persisted state such as
  scheduled notifications) off the device. `expo-secure-store`'s own backup
  rules (`configureAndroidBackup`) are disabled because they transfer every
  shared-preferences file except SecureStore's. Moving to a new device carries
  data over through JSON export/import or sync, never the OS transfer. The app
  also ships no Firebase Cloud Messaging integration and no over-the-air update channel (no
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
  from `allowBackup=false` plus its exclude-all extraction rules. Excluding the
  directories also covers files created after launch; the hook is idempotent and
  never fatal, and `ios/` is gitignored so the plugin (not a checked-in
  `AppDelegate`) is the committed source of truth. Keychain secrets are governed
  separately (`expo-secure-store` with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`), an
  accessibility class iOS already keeps out of cross-device Keychain sync and
  restore.

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
  snapshot boolean. It is **not activated**: the production premium-features
  loader builds the token gate, but no token is issued yet, so the gate falls
  back and both features are decided by the managed billing-snapshot boolean —
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
  `EXPO_PUBLIC_ENTITLEMENT_PUBKEYS` would leave the placeholder active, is an empty
  map, or holds a value that is not a 64-hex-character Ed25519 public key, so a
  production artifact cannot ship the placeholder or a gate that verifies nothing
  silently. The
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
  token is still present on-device **and** the failure was at the transport level (no
  response, a 5xx without a recognized error body, or the server's own
  temporary-unavailability answer); an explicit server refusal (unauthorized or any
  other 4xx-derived error) yields no cached premium, and a refusal about the session
  or the plan (unauthorized, sync not allowed) also discards the cached snapshot, so
  a later blip cannot revive it. A billing answer whose managed session token
  changed while the fetch was in flight (refresh rotation, sign-out, account switch)
  is never cached or returned; billing is read once more under the session then
  present, and nothing is served if it changes again. A signed-out or never-connected device gets no
  grace. Past 72 hours, or with nothing ever cached, the gate fails closed exactly as
  it did before this cache existed. Server-checked operations (sync upload/restore and
  the plan status that gates them on Settings and after a managed connect, partner
  projections, the partner-access pre-check on the backup-sync screen) never
  read this cache — they load the billing snapshot live-only (`liveOnly`), or take
  plan status only from a live answer, and the
  server remains their sole authority. The cached entitlement token follows the same
  transport-only rule: a refused mint serves no cached token, and a plan or endpoint
  refusal also discards it (a 401 does not, since it may only mean a rotated bearer). The
  trade-off is deliberate: a network blip or managed outage should not instantly
  re-lock the premium gates of a paying device, at the cost of a revoked plan keeping
  its local unlocks for up to 72 hours while the device cannot reach billing truth.
  Settings follows the same grace for its doctor PDF, while its plan status stays
  "could not confirm" until a live answer arrives.
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
- **The partner-share key is rooted in a client-only invite secret carried in
  the link fragment.** The managed cloud knows the invite token and every grant
  context field, so the key is derived from a 32-byte secret the owner device
  generates and appends as `#k=…`; no HTTP request carries a fragment and no API
  call sends it. Whoever holds the whole link — the intended partner, or anyone
  who intercepts it — can still redeem and read, exactly as before. What the
  secret removes is the server's (or a database copy's) ability to derive the
  key. Residual: a compromised invite host serving script on the no-app fallback
  page could read the fragment (`docs/sync-trust-model.md`, Partner-Share Invite
  Secret).
- **Sync restore freshness is per-device.** The snapshot generation is sealed in
  the AAD and each device keeps a floor of the highest generation it has uploaded
  or restored, so a server cannot roll a device back below what that device has
  itself seen without a second confirm. A device with no floor (fresh install,
  just recovered or set up again, or its saved sync mode, endpoint or device
  label changed) accepts any genuine blob, and a device that
  never saw another device's later upload cannot tell it was withheld. A
  restore that stops partway leaves the device marked as mid-restore, and
  uploads refuse until a retried restore completes, so incomplete local data
  never replaces the backup. Details: `docs/sync-trust-model.md` (*Restore
  Freshness*).

### Device-clock trust

- **Signed entitlement-token expiry trusts the device clock.** `verifyEntitlementToken`
  (`src/security/entitlement-token.ts`) rejects a token unless `payload.exp > opts.now`,
  where `now` is unix-seconds supplied by the caller — there is no secondary,
  clock-independent freshness check, and the verifier must stay fully offline-capable
  (it is also the code path that checks the cached token during the offline grace in
  `src/services/entitlement-token-service.ts`). As documented above, the production
  loader builds the token gate but no token is issued yet, so this comparison has nothing
  to verify outside tests today;
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
  real-world hours). Each time the cache is served it records that instant
  (`lastServedAt`) as a high-water mark that only moves forward, and a clock more
  than ten minutes (`MANAGED_BILLING_CLOCK_SKEW_TOLERANCE_MS`, the allowance for
  concurrent loads reaching the cache out of order) earlier than either the fetch
  instant or the high-water mark is refused the cache (it is kept, not deleted, so a
  caller holding a stale `now` cannot wipe it for other surfaces), so winding the clock back after
  the cache has been read cannot reopen the window. What remains is a rewind within
  that allowance, or one made before the next read and kept there: the ceiling is
  still measured in device-clock time, not verified elapsed time. This stays within the bounds the
  cache itself already accepts above: only local premium gates, only under a
  still-present managed session token, never a server-checked operation.
- **Local reminder scheduling assumes an approximately correct clock.**
  `buildLocalReminderPlans` (`src/services/local-reminder-plan-service.ts`) resolves
  "today" and the one-time `upcoming_period`/`fertile_window` trigger instants from a
  `now`; `syncLocalReminderSchedule` reads `new Date()` at the moment the schedule is
  (re)built unless a test injects an instant, so no screen plans from a stale day. The native adapter
  (`platform-local-reminder-scheduler.native.ts`) hands the resolved plan to
  `expo-notifications` as either an absolute one-time `Date` trigger or an hour/minute
  daily-repeat trigger, and firing itself is then driven by the OS's own system clock,
  outside this app's control. A device clock that is wrong when a plan is built bakes
  an incorrect instant into a one-time trigger, and — since there is no background
  resync — that only self-corrects the next time a day-log save, a cycle-start action, or
  a cycle or reminder settings save rebuilds the schedule (see `docs/notifications.md`).
  The web adapter never schedules a real reminder (`"unavailable"`), so the exposure is
  native-only, and the worst case is a missed or mistimed local notification, never a data
  or entitlement exposure.
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
retracted here. [src/security/security-matrix.test.ts](src/security/security-matrix.test.ts)
fails when a cited file is missing or a cited title is not a test or describe title in it. A
citation is backticked titles followed by `in [path](path)`, or `every case in [path](path)` for
a whole file.

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
| Only an AEAD failure on a well-formed envelope, or a stored key that cannot be a key, counts as a key/data mismatch; an unparseable envelope never does | `reports a mismatch only for an AEAD failure on a well-formed envelope`, `reports a stored key that cannot be a 32-byte hex key as a mismatch`, `classifies %s as malformed, never as a mismatch` in [src/security/local-data-crypto.test.ts](src/security/local-data-crypto.test.ts) |
| An unparseable canary, a single tampered canary row, or a SQLite read error never wipes the database; an authentication failure with nothing authenticating still resets it | `keeps the key and wipes nothing when the bootstrap canary is unparseable but the profile canary authenticates`, `keeps the key and wipes nothing when one canary row was tampered but another authenticates`, `keeps the key when every canary envelope is unparseable (nothing to verify against)`, `propagates a SQLite read error from the canary probe without wiping or replacing the key`, `still resets when the bootstrap canary is unparseable and the profile canary fails authentication` in [src/storage/local/sqlite-local-data-key.test.ts](src/storage/local/sqlite-local-data-key.test.ts) |
| The mismatch wipe is one transaction; a failure mid-wipe rolls back and keeps the old key | `runs every DELETE inside one BEGIN IMMEDIATE ... COMMIT`, `rolls back and keeps the old key when a DELETE fails mid-wipe` in [src/storage/local/sqlite-local-data-key.test.ts](src/storage/local/sqlite-local-data-key.test.ts) |
| A row with an empty encrypted payload is never adopted from its plaintext columns; a singleton whose payload does not open reads as its defaults; a day-log or symptom row whose payload does not open is deleted at hydrate and never blocks startup or Clear data | `is dropped at hydrate while the good rows survive`, `does not make Clear data throw`, `drops day-log rows without an encrypted payload instead of re-encrypting their plaintext columns`, `drops a symptom row without an encrypted payload instead of adopting its plaintext columns`, `does not adopt a plaintext v1 onboarding_profile row into the profile`, `falls back to defaults for singleton rows whose payload was cleared or does not authenticate` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts) |

### Sync snapshot AAD

| Claim | Enforced by |
| --- | --- |
| The snapshot AAD is `ovumcy-sync-v3\|<schemaVersion>\|<generation>` with no device id; a different schema version or generation fails the open | `builds the snapshot AAD from the schema version and generation with no device id`, `rejects sync payload decryption with a different schema version AAD`, `rejects sync payload decryption with a different generation AAD` in [src/security/sync-crypto.test.ts](src/security/sync-crypto.test.ts) |
| Only a v3 open reports a sealed generation; a v2 `ovumcy-sync-v2\|<schemaVersion>` or v1 blob opens with none | `reports the sealed generation of a v3 blob`, `opens a v2 blob on a device with a different device id`, `falls back to the legacy AAD built from the local device id` in [src/security/sync-crypto.test.ts](src/security/sync-crypto.test.ts) |
| A blob whose reported generation differs from the sealed one, or is not a non-negative safe integer, is refused without touching local data | `refuses a blob whose reported generation differs from the sealed one`, `refuses a reported generation of %p before decrypting` in [src/sync/sync-client-service.test.ts](src/sync/sync-client-service.test.ts) |
| Upload stores the generation it sent as the rollback floor, never the server's echo, and sends nothing when the floor leaves no safe next generation | `stores the sent generation as the rollback floor, not the server echo`, `refuses to upload when the floor leaves no valid next generation` in [src/sync/sync-client-service.test.ts](src/sync/sync-client-service.test.ts) |
| A restore below the floor, of a v2/v1 blob on a device that has a floor, or on a device whose stored floor is not a valid generation, asks first; no answer or a decline leaves local data and the floor untouched; a confirmed one restores and keeps the floor | `asks before restoring a blob older than the rollback floor and keeps local data when declined`, `asks before restoring when the stored floor is unreadable`, `refuses an older blob when no confirm is wired`, `restores an older blob once confirmed and keeps the floor`, `asks before restoring a legacy v2 blob on a device that has a floor` in [src/sync/sync-client-service.test.ts](src/sync/sync-client-service.test.ts); `hands the older-backup guard to the sync restore and passes its decline through` in [src/services/backup-sync-screen-service.test.ts](src/services/backup-sync-screen-service.test.ts); `cancels the restore quietly when the older-backup confirm is dismissed`, `restores after the older-backup confirm is accepted` in [src/ui/screens/backup-sync/useBackupSyncActions.test.ts](src/ui/screens/backup-sync/useBackupSyncActions.test.ts) |
| A restore at or above the floor, or on a device with no floor, needs no extra confirm and the floor never moves down; a v2/v1 blob's unsealed generation never moves an existing floor and is capped at the current time on a device with none | `restores a fresher blob without asking and raises the floor`, `restores a legacy v2 blob without asking on a device with no floor`, `never raises the floor from an unsealed generation`, `caps an unsealed generation at the current time on a device with no floor` in [src/sync/sync-client-service.test.ts](src/sync/sync-client-service.test.ts) |
| A recovered device with a fresh device id restores a snapshot another device uploaded | `restores on a recovered device a snapshot another device uploaded` in [src/sync/sync-client-service.test.ts](src/sync/sync-client-service.test.ts) |
| A restore that stops partway keeps the device marked mid-restore: uploads refuse with `sync_not_prepared` (the screen names the unfinished restore) whatever the caller's in-memory preferences say, an ordinary preferences write cannot clear the mark, restore stays allowed, and only a completed restore, a new sync key (sync prepared again, secrets cleared) or a restore that finds no server backup clears it | `refuses to upload while a restore that stopped partway is unfinished, whatever the caller's copy says`, `clears the unfinished-restore mark when the server holds no backup to restore`, `keeps restore allowed while a partial restore is marked, so a retry can finish it` in [src/sync/sync-client-service.test.ts](src/sync/sync-client-service.test.ts); `leaves the restore marked in progress when it stops partway, and clears the mark once a retry completes`, `marks the restore in progress even with no retained preferences` in [src/sync/sync-snapshot-service.test.ts](src/sync/sync-snapshot-service.test.ts); `keeps the stored restore mark across ordinary preferences writes and changes it only when asked` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts); `names an unfinished restore instead of asking to prepare sync, without any network call` in [src/services/backup-sync-screen-service.test.ts](src/services/backup-sync-screen-service.test.ts); `prepares encrypted sync secrets and persists normalized preferences`, `clears prepared sync secrets when saved sync preferences change materially`, `keeps the unfinished-restore mark on a local-only draft save` in [src/sync/sync-setup-service.test.ts](src/sync/sync-setup-service.test.ts) |
| A legacy `ovumcy-sync-v1\|<deviceID>` blob opens only on the device that wrote it | `restores a legacy device-bound blob on the device that wrote it`, `refuses a legacy device-bound blob written by another device` in [src/sync/sync-client-service.test.ts](src/sync/sync-client-service.test.ts) |
| A blob whose reported schema version differs from the sealed one is refused without touching local data | `refuses a blob whose reported schema version differs from the sealed one` in [src/sync/sync-client-service.test.ts](src/sync/sync-client-service.test.ts) |

### Sync envelope and recovery-phrase wrap

| Claim | Enforced by |
| --- | --- |
| A sync payload round-trips under the generated master key and matching AAD | `encrypts and decrypts payloads with the generated master key and matching AAD` in [src/security/sync-crypto.test.ts](src/security/sync-crypto.test.ts) |
| A blob sealed under an unrelated AAD is refused | `refuses a blob sealed under an unrelated AAD` in [src/security/sync-crypto.test.ts](src/security/sync-crypto.test.ts) |
| The master key is wrapped under a valid 12-word recovery phrase and unwraps back to the same key | `generates a valid 12-word recovery phrase and wraps the master key`, `rewraps an existing master key with a fresh recovery phrase` in [src/security/sync-crypto.test.ts](src/security/sync-crypto.test.ts) |
| An invalid recovery phrase is refused before any wrap or unwrap | `rejects invalid recovery phrases before wrapping or unwrapping keys` in [src/security/sync-crypto.test.ts](src/security/sync-crypto.test.ts) |
| A different recovery phrase cannot unwrap the master key | `fails to unwrap a master key with the wrong recovery phrase` in [src/security/sync-crypto.test.ts](src/security/sync-crypto.test.ts) |

### Partner-share crypto and projection privacy

| Claim | Enforced by |
| --- | --- |
| The invite key is HKDF over the client-only invite secret with the token bound into `info`; it is never derivable from the token alone, a malformed or missing secret is refused, and short tokens are still rejected | `refuses to derive without a well-formed invite secret`, `matches the documented key schedule (HKDF-SHA256 over the invite secret, token-bound info)`, `the token alone does not determine the key: a different secret yields a different key`, `produces distinct keys for distinct tokens under the same secret`, `rejects tokens shorter than the entropy floor`, `rejects tokens that only become non-empty after trim and still fall under the floor` in [src/security/partner-share-crypto.test.ts](src/security/partner-share-crypto.test.ts); `derivePartnerShareKeyHex changes whenever the invite secret changes` in [src/security/partner-share-crypto.property.test.ts](src/security/partner-share-crypto.property.test.ts) |
| Owner and partner reach the same grant key from the shared link alone, while server-known material does not; a partner accept without the secret stores no key | `derives the same K_grant on the partner side as the owner-side reconcile produces`, `server-known material alone does not reproduce the owner's K_grant`, `refuses an accept without the link's invite secret and stores nothing` in [src/services/managed-partner-share-service.test.ts](src/services/managed-partner-share-service.test.ts) |
| The shared link is the server's URL with the secret as its only fragment, and only on the pinned verified link base (`https://invite.ovumcy.cloud/backup-sync`; the custom scheme `ovumcy://` is refused outbound because any installed app can claim it, and stays accepted inbound), so neither a server-chosen host nor a hostile app serves or receives the page that would read it; a link without a well-formed secret is refused before the single-use invite is redeemed | `appends the secret as the fragment of the server's URL`, `replaces any fragment the server put on its URL`, `refuses a server URL outside the pinned link bases: %s`, `refuses the custom scheme for the outbound link: %s` in [src/security/partner-invite-link.test.ts](src/security/partner-invite-link.test.ts); `%s refuses a link without its invite secret before redeeming the invite` in [src/ui/screens/backup-sync/useBackupSyncPartnerAccess.test.ts](src/ui/screens/backup-sync/useBackupSyncPartnerAccess.test.ts) |
| The secret is captured from the route fragment or, for custom-scheme links, the raw link, and is only ever paired with the invite buffered under the same token; it shares the token's TTL and clear | `buffers the secret expo-router exposes from an https link fragment`, `reads the secret from the raw link when the route drops a custom-scheme fragment`, `attaches the secret when the raw link arrives after the route capture`, `never pairs a raw link's secret with a different buffered invite` in [src/ui/screens/backup-sync/useBackupSyncSessionCore.test.ts](src/ui/screens/backup-sync/useBackupSyncSessionCore.test.ts); `holds the secret with its token and drops both together at the TTL`, `clears the secret together with the token`, `attaches a secret only to the invite buffered under the same token` in [src/security/managed-partner-invite-token-buffer.test.ts](src/security/managed-partner-invite-token-buffer.test.ts) |
| Keys from the retired token-only derivation are never read: their SecureStore entry is deleted on first access and by every clear | `never reads keys from the retired entry and deletes it on first access`, `retries the delete on the next access after a failure`, `is deleted by a clear together with the current entry` in [src/security/partner-share-secret-store.test.ts](src/security/partner-share-secret-store.test.ts) |
| The per-grant subkey rotates away from the invite key and changes when grant/owner/source context changes | `rotates away from K_invite — K_grant must differ`, `produces distinct keys when grantID, ownerAccountID, or sourceInviteID change`, `rejects empty context fields rather than collapsing distinct grants to the same key` in [src/security/partner-share-crypto.test.ts](src/security/partner-share-crypto.test.ts) |
| A projection upload names the key context its ciphertext was encrypted under — the `sourceInviteID` stored with that `K_grant`, read in the same secure-store read — and a legacy grant without one, or a grant whose listed context no longer matches the stored key, is never encrypted or sent; the owner is prompted to revoke and re-invite instead | `sends the encryption-time source_invite_id and maps 409 partner_grant_rekeyed` in [src/sync/managed-cloud-api-client.test.ts](src/sync/managed-cloud-api-client.test.ts); `refuses a legacy grant listed with source invite %p without touching the network`, `refuses when the listed key context no longer matches the stored key's`, `forwards the server's 409 partner_grant_rekeyed`, `flags a live grant whose local key was derived under another invite` in [src/services/managed-partner-share-service.test.ts](src/services/managed-partner-share-service.test.ts); `skips a legacy grant before reserving a generation and reports it for a re-share`, `skips a grant whose local key was derived under another invite, before reserving`, `reports a re-keyed grant and keeps pushing the others` in [src/services/managed-partner-share-sync-service.test.ts](src/services/managed-partner-share-sync-service.test.ts); `prompts a re-share on a legacy grant and on a grant flagged by the key-context check` in [src/ui/screens/backup-sync/SettingsPartnerAccessSection.test.tsx](src/ui/screens/backup-sync/SettingsPartnerAccessSection.test.tsx) |
| An encrypted projection round-trips its generation counter and rejects a missing / non-integer / below-floor generation | `preserves the generation counter across an encrypt/decrypt round-trip`, `rejects a payload whose generation is below the floor (F5 defense-in-depth)`, `rejects a payload whose generation is not an integer`, `rejects a payload that is missing the generation field entirely` in [src/security/partner-share-crypto.test.ts](src/security/partner-share-crypto.test.ts) |
| The partner rejects a projection whose generation regresses below the floor it has seen; the floor counts only under the invite it was seen under, so a re-share under a reused grant id drops it, a re-accept of the same invite keeps it, and a listing that names a newer invite than the key's asks for the new invite without fetching | `records the first observed generation as the last-seen marker`, `rejects a regression below the last-seen marker`, `drops the floor when a re-share replaces the key under a new invite`, `keeps the floor when the same invite is accepted again`, `ignores a floor recorded under another invite than the key's`, `answers partner_grant_rekeyed without a fetch when the listing names a newer invite` in [src/services/managed-partner-share-service.test.ts](src/services/managed-partner-share-service.test.ts) |
| Every grant key records the side this device holds it for and the account it was created under; a received key never encrypts an upload whatever the listing says, an owner key never encrypts a projection naming another owner account, a received key is never replaced by an owner key, and a key written before the side was recorded behaves as before | `records a received key as the partner's, under the partner account`, `records a rotated owner key as the owner's, under the owner account`, `never encrypts an upload under a received key, whatever the listing says`, `refuses an owner key created under another account than the projection's`, `never replaces a received key with an owner key for the same grant id`, `uploads under a key written before the side was recorded` in [src/services/managed-partner-share-service.test.ts](src/services/managed-partner-share-service.test.ts) |
| An owner re-share under a reused grant id replaces the key derived under the earlier invite once the new invite's key is on the device; a received grant listed as revoked loses its key and replay markers, one missing from the listing keeps them | `replaces the key derived under the earlier invite once the new invite's key is here`, `purges the key and replay markers of a received grant listed as revoked`, `keeps a key accepted under a newer invite than the revoked row names`, `keeps an owner key even if the listing shows the grant revoked as received` in [src/services/managed-partner-share-service.test.ts](src/services/managed-partner-share-service.test.ts) |
| A server id named after an Object member (`__proto__`, `constructor`) reads as a plain id, never an inherited member | `treats grant id %p as having no key instead of throwing`, `rotates and stores a key for grant id %p` in [src/services/managed-partner-share-service.test.ts](src/services/managed-partner-share-service.test.ts); `reads ids named after Object members as plain entries` in [src/security/partner-share-secret-store.test.ts](src/security/partner-share-secret-store.test.ts) |
| Projection encryption round-trips and rejects a foreign key or a rewritten envelope header over generated inputs (property-based) | `round-trips any projection under the grant key`, `does not open under a different grant key`, `does not open when the envelope header is rewritten` in [src/security/partner-share-crypto.property.test.ts](src/security/partner-share-crypto.property.test.ts) |
| The access level the owner chose is pinned on the owner device with the invite key and carried into the grant key; a projection is built at the stricter of that level and the one the server lists, a grant key with no pinned level builds as summary, and the listing can never widen it | `pins the owner's chosen level with the pending key, not the server's echo`, `carries the pinned level into the grant key record and clears the pending pin`, `builds at the stricter level: pinned %p, listed %p gives %p` in [src/services/managed-partner-share-service.test.ts](src/services/managed-partner-share-service.test.ts); `builds a summary projection when the server lists full over a pinned summary`, `builds a summary projection when the server lists summary over a pinned full`, `builds a summary projection from a legacy key record with no pinned level`, `keeps full detail only when the pin and the listing both say full` in [src/services/managed-partner-share-sync-service.test.ts](src/services/managed-partner-share-sync-service.test.ts); `reads a record written before access levels were pinned without dropping a key` in [src/security/partner-share-secret-store.test.ts](src/security/partner-share-secret-store.test.ts) |
| Summary access ships no day log, symptom record or date-valued profile field (and so no flow, mood, sex, BBT, mucus, LH, symptoms or notes) | `ships no per-day record, symptom record or date-valued profile field for summary access`, `summary projection carries no flow value (data minimisation)` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |
| A summary share carries cycle day, next-period window, prediction hint and summary metrics computed on the owner device (additive, schema version unchanged); a payload without it is read by recomputing; the cycle day advances only while the predicted window has not passed, and an overdue or facts-only day keeps counting from its anchor; a malformed snapshot is not rendered | `computes the summary snapshot on the owner device from the owner's cycle history`, `omits the summary snapshot at full access`, `recomputes cycle status from profile and day logs for a summary payload without a snapshot`, `renders the owner-computed values without any day log on the partner side`, `advances the cycle day by the whole days elapsed since the owner's date`, `shows the cycle day as generated when the partner clock is behind the owner's date`, `withholds the cycle day once the predicted window has passed, keeping the shipped dates`, `keeps counting an overdue cycle day from its anchor`, `keeps counting a facts-only cycle day from its anchor`, `ignores a malformed snapshot and recomputes instead of rendering it` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts); `renders the owner-computed summary metrics for a summary payload that carries no day logs` in [src/ui/screens/PartnerSharedScreen.test.tsx](src/ui/screens/PartnerSharedScreen.test.tsx) |
| An active pregnancy record or the owner's own pregnancy pause leaves no prediction value in the summary snapshot, now or when the partner reads it days later | `ships no prediction value in the summary snapshot for $name` (both cases) in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |
| `usageGoal` is never shared, and shared symptom records are picked field by field (id, label, default flag) | `never ships usageGoal at either access level`, `sends symptom records to a full-level partner with only id, label and default flag` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |
| The projection digest the server stores is an HMAC-SHA256 under an HKDF subkey of the grant key with its own domain label (never the AEAD key, never a plain hash of the plaintext); decrypt verifies it and, for the rollout, also accepts the legacy plaintext digest; the AEAD context stays bound to grant and level | `does not emit a plain SHA-256 of the payload as the digest the server stores`, `emits a digest that depends on the grant key`, `keys the digest with a subkey separate from the AEAD key`, `accepts an envelope carrying the legacy plaintext SHA-256 digest (rollout)`, `rejects an envelope whose digest is neither the keyed nor the legacy digest`, `rejects a digest computed over another payload`, `keeps the AEAD bound to the grant context when the digest is valid` in [src/security/partner-share-crypto.test.ts](src/security/partner-share-crypto.test.ts) |
| A projection upload answered 413 (named or bare) maps to `payload_too_large`, a ciphertext over 2 MiB is refused with no request, and a `payload_too_large` result backs off the push; `entitlements_unavailable` is no longer a client error code (a 5xx with that body is a transport failure) | `maps a 413 with %s on the projection upload to payload_too_large`, `refuses a projection ciphertext over the 2 MiB cap locally, sending no request`, `sends a projection ciphertext of exactly 2 MiB`, `maps a 503 entitlements_unavailable body to network_failed so the app falls back to the snapshot`, `maps a 403 entitlements_unavailable body to generic, a refusal rather than a transport failure` in [src/sync/managed-cloud-api-client.test.ts](src/sync/managed-cloud-api-client.test.ts); `backs off the push on payload_too_large so the next sync sends no request` in [src/services/managed-partner-share-sync-service.test.ts](src/services/managed-partner-share-sync-service.test.ts) |
| Full access keeps history but enforces the owner's privacy toggles | `keeps full history but respects owner privacy toggles` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |
| **The pregnancy-test field is stripped from a full projection even when the record is positive** | `full projection strips pregnancyTest even when record has a non-none value (regression)` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |
| Staleness is surfaced when a snapshot ages out and not before | `sets isStale when snapshot is older than 14 days`, `does not set isStale when snapshot is fresh (within 14 days)` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |

### Partner invite-token scrubbing (web)

| Claim | Enforced by |
| --- | --- |
| An `invite_token` query param is stashed and stripped from `window.location`, preserving other params, a secret-free hash, and history state | `stashes the invite_token and strips it from window.location`, `preserves a hash fragment that carries no invite secret`, `removes the trailing question mark when invite_token was the only parameter`, `trims surrounding whitespace from the stashed token` in [src/security/web-invite-token-scrub.test.ts](src/security/web-invite-token-scrub.test.ts) |
| The fragment invite secret is stashed with its token and stripped from `window.location`; a stray or malformed secret is stripped without being stashed | `stashes the fragment invite secret with the token and strips both`, `keeps other fragment parameters when stripping the invite secret`, `strips a stray invite secret even without a token, stashing nothing`, `stashes the token without a secret when the fragment secret is malformed` in [src/security/web-invite-token-scrub.test.ts](src/security/web-invite-token-scrub.test.ts) |
| Empty / whitespace-only tokens are stripped without stashing; a tokenless URL is a no-op | `strips a whitespace-only token without stashing it`, `strips an empty invite_token parameter without stashing it`, `is a no-op when the URL has no invite_token` in [src/security/web-invite-token-scrub.test.ts](src/security/web-invite-token-scrub.test.ts) |
| The token and the fragment invite secret are gone from the address bar by the time the SPA bundle has executed (runtime) | `F9: partner invite_token and invite secret are scrubbed from the URL by the time the SPA bundle has executed` in [e2e/web-smoke.spec.ts](e2e/web-smoke.spec.ts) |

### Guest partner access

| Claim | Enforced by |
| --- | --- |
| The guest-accept API call carries no Authorization/session header and posts only the invite token to the unauthenticated endpoint | `accepts a partner invite as a guest with no Authorization header and maps the session + grant + invite` in [src/sync/managed-cloud-api-client.test.ts](src/sync/managed-cloud-api-client.test.ts) |
| The service-layer guest-accept function takes no session-store/mode argument at all — there is no session to read, by construction — and forwards the same no-bearer call | `redeems the invite with no session precondition and no bearer, returning the session + grant + invite` in [src/services/managed-partner-access-service.test.ts](src/services/managed-partner-access-service.test.ts) |
| Guest-accept error keys (`partner_invite_not_found`, `partner_invite_expired`, `invalid_partner_invite`, `partner_access_unavailable`, `rate_limited`) map identically to the logged-in accept path, so the invite-lifecycle and owner-entitlement checks are not weakened for guests | `maps guest-accept error keys identically to the logged-in accept path` in [src/sync/managed-cloud-api-client.test.ts](src/sync/managed-cloud-api-client.test.ts); `maps each guest-accept error key the same way the logged-in accept path does` in [src/services/managed-partner-access-service.test.ts](src/services/managed-partner-access-service.test.ts) |
| The managed per-owner partner caps (`partner_invite_limit_reached` on issue, `partner_grant_limit_reached` on logged-in and guest accept, where the invite stays pending) are surfaced as their own messages rather than a generic failure | `maps the per-owner partner caps on issue, accept and guest accept` in [src/sync/managed-cloud-api-client.test.ts](src/sync/managed-cloud-api-client.test.ts); `maps %s to its dedicated copy` in [src/ui/screens/backup-sync/backup-sync-partner-errors.test.ts](src/ui/screens/backup-sync/backup-sync-partner-errors.test.ts) |
| A `429 rate_limited` on the partner projection PUT stops the per-grant loop and gates every later push for the server's `Retry-After` (default 60 s, capped at 15 min), so push triggers cannot retry-storm | `stops the loop, arms the back-off and skips the next push without any request` in [src/services/managed-partner-share-sync-service.test.ts](src/services/managed-partner-share-sync-service.test.ts); every case in [src/services/managed-partner-projection-backoff.test.ts](src/services/managed-partner-projection-backoff.test.ts) |
| The owner's invite link, which carries the client-only secret in its fragment, leaves the app only through the OS share sheet the user opens (selectable text and one share action; no clipboard write, log, or route param), and is shown only while the screen holds it | `shares the invite link only through the OS share sheet and keeps it selectable`, `offers no share action while no invite link is held` in [src/ui/screens/backup-sync/SettingsPartnerAccessSection.test.tsx](src/ui/screens/backup-sync/SettingsPartnerAccessSection.test.tsx) |
| A malformed inbound invite (token under the length floor, malformed secret) is refused as `invalid_partner_invite` before any accept call, so it never redeems the single-use invite — logged-in and guest alike | `%s refuses a token below the length floor or a malformed secret before redeeming the invite` in [src/ui/screens/backup-sync/useBackupSyncPartnerAccess.test.ts](src/ui/screens/backup-sync/useBackupSyncPartnerAccess.test.ts) |
| A pending invite's link, with its secret, is dropped from hook state when that invite is revoked (as on grant revoke), while revoking a different pending invite keeps a just-issued link; the raw inbound link is parsed from the initial-URL read or a URL listener and never kept in hook state, and cannot revive a redeemed invite | `drops the shareable invite link, with its secret, from hook state once the invite is revoked`, `keeps a just-issued link when a different pending invite is revoked` in [src/ui/screens/backup-sync/useBackupSyncPartnerAccess.test.ts](src/ui/screens/backup-sync/useBackupSyncPartnerAccess.test.ts); `does not retain the raw link or its secret in the returned hook state`, `does not revive a redeemed invite from the link that launched the app`, `captures a link that arrives while the app runs before any route param does` in [src/ui/screens/backup-sync/useBackupSyncSessionCore.test.ts](src/ui/screens/backup-sync/useBackupSyncSessionCore.test.ts) |
| A newer inbound link replacing a live pending invite is surfaced to the user (no inviter identity is shown or invented); the notice carries no token or secret and ends with the pending invite | `raises a one-shot replacement notice only when a different live invite is overwritten`, `drops a pending replacement notice with the buffer` in [src/security/managed-partner-invite-token-buffer.test.ts](src/security/managed-partner-invite-token-buffer.test.ts); `flags a newer inbound link that replaces a pending invite, and clears the flag with the invite` in [src/ui/screens/backup-sync/useBackupSyncSessionCore.test.ts](src/ui/screens/backup-sync/useBackupSyncSessionCore.test.ts); `tells the user a newer invite link replaced the earlier one, only while an invite is pending` in [src/ui/screens/backup-sync/SettingsPartnerAccessSection.test.tsx](src/ui/screens/backup-sync/SettingsPartnerAccessSection.test.tsx) |
| A grant revoke drops every local pending-invite key and the on-screen invite link, mirroring the server revoking all of the owner's pending invites with the grant | `drops every pending invite key, since the server revokes them with the grant` in [src/services/managed-partner-share-service.test.ts](src/services/managed-partner-share-service.test.ts) |
| A device with no prior local sync secrets gets a freshly generated `SyncSecretsRecord` on guest accept, forced into managed/connected preferences, with capabilities always reporting `syncEnabled: false` | `generates a fresh SyncSecretsRecord on a device with no prior secrets and forces managed/connected preferences` in [src/sync/sync-client-service.test.ts](src/sync/sync-client-service.test.ts) |
| An already-prepared device's master key and device identity are left untouched by guest accept — only the auth-session fields change | `keeps an already-prepared device's master key and device identity untouched` in [src/sync/sync-client-service.test.ts](src/sync/sync-client-service.test.ts) |
| A rejected guest-accept attempt (any mapped error) persists no session and writes no preferences | `forwards each mapped error key and persists no session` in [src/services/backup-sync-screen-service.test.ts](src/services/backup-sync-screen-service.test.ts) |
| End-to-end: a brand-new device (no stored secrets, no session) redeems the invite through the unauthenticated endpoint in one call and ends in a connected managed state with the grant | `redeems the invite with no bearer, persists the session on a brand-new device, and returns a connected managed state + grant` in [src/services/backup-sync-screen-service.test.ts](src/services/backup-sync-screen-service.test.ts) |
| The backup-sync screen's local-step "create/regenerate recovery phrase" affordance never renders for a guest session, even though guest accept already leaves `hasStoredSyncSecrets` true; a non-guest session keeps the affordance — on a connected managed account it changes the phrase through Ovumcy Cloud and reveals it after the 200 | `hides the local-step regenerate affordance for a guest session, leaving the rest of that step intact`, `lets a connected non-guest managed owner change the phrase through Ovumcy Cloud, revealed only after the 200 (owner path)` in [src/ui/screens/BackupSyncScreen.test.tsx](src/ui/screens/BackupSyncScreen.test.tsx); `hides the local-step prepare/regenerate button for a guest session even though local secrets already exist` in [src/ui/screens/backup-sync/SettingsSyncSetupSection.test.tsx](src/ui/screens/backup-sync/SettingsSyncSetupSection.test.tsx); `hides the local-step prepare/regenerate action for a guest session but not for a normal managed session (docs/sync-trust-model.md: guests never see a recovery phrase)` in [src/services/backup-sync-view-service.test.ts](src/services/backup-sync-view-service.test.ts) |
| `prepareSyncSetup` independently refuses to mint a recovery phrase for a guest session (defense-in-depth below the UI hide), leaving any already-stored guest secrets untouched | `refuses to prepare or regenerate sync secrets for a guest session, leaving existing guest secrets untouched` in [src/sync/sync-setup-service.test.ts](src/sync/sync-setup-service.test.ts) |

### CSV formula-injection neutralization

| Claim | Enforced by |
| --- | --- |
| A note beginning with a formula prefix is neutralized | `(a) neutralizes a note starting with an injection formula prefix` in [src/services/export-service.test.ts](src/services/export-service.test.ts) |
| A custom symptom label starting with `+` and a cycle factor starting with `@` are neutralized | `(b) neutralizes a custom symptom label starting with + and a cycle factor starting with @` in [src/services/export-service.test.ts](src/services/export-service.test.ts) |
| Normal text without a dangerous prefix is left untouched | `(c) does not modify normal text without a dangerous prefix` in [src/services/export-service.test.ts](src/services/export-service.test.ts) |
| A cell containing a comma, semicolon, quote, CR or LF is quoted, and injection payloads using `;` or a bare CR stay inside one quoted cell | `(e) quotes a note containing a %s` and `(f) quotes and neutralizes injection payloads` in [src/services/export-service.test.ts](src/services/export-service.test.ts) |
| Ordinary text stays unquoted | `(g) leaves ordinary text unquoted` in [src/services/export-service.test.ts](src/services/export-service.test.ts) |
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
| Verification carries through the recovery code a community server rotates on enable, treats a missing or blank one as none (managed, older servers), and rejects a non-string one | `returns the rotated recovery code from totp verify`, `treats a blank recovery code from totp verify as none`, `rejects a non-string recovery code from totp verify as invalid_response` in [src/sync/sync-api-client.test.ts](src/sync/sync-api-client.test.ts); `returns the recovery code the community backend rotated on enable` in [src/sync/sync-totp-service.test.ts](src/sync/sync-totp-service.test.ts) |
| The rotated recovery code is shown once in the reveal dialog with replaced-code copy, held only in screen state (never written to app storage or the secret store, never logged), and cleared only by the explicit confirm — a system back/dismiss does not discard it | `reveals the rotated recovery code once and clears it on acknowledge`, `opens no reveal when the backend issued no recovery code`, `never logs or persists the recovery code issued by TOTP enrollment` in [src/ui/screens/sync-account-security/useSyncAccountSecurityController.test.ts](src/ui/screens/sync-account-security/useSyncAccountSecurityController.test.ts); `tells the user the previous recovery code was replaced when the code comes from TOTP enrollment`, `does not acknowledge the one-time recovery code on a system back/dismiss` in [src/ui/screens/sync-account-security/SyncAccountSecuritySection.test.tsx](src/ui/screens/sync-account-security/SyncAccountSecuritySection.test.tsx) |
| A community verify that fails with a lost or unreadable response, or `totp_already_enabled`, re-checks 2FA and, when it is on, tells the user the rotated code never arrived | `tells a community user the rotated code was lost when 2FA turned out to be on`, `keeps the original error when 2FA is still off after a lost response` in [src/ui/screens/sync-account-security/useSyncAccountSecurityController.test.ts](src/ui/screens/sync-account-security/useSyncAccountSecurityController.test.ts) |
| A community verify 429 (indistinguishable from a discarded pending secret) drops the pending enrollment and returns to the password step | `maps a community 429 to totp_enrollment_restart_required because the pending secret may be discarded` in [src/sync/sync-totp-service.test.ts](src/sync/sync-totp-service.test.ts); `drops the pending enrollment and returns to the password step when a restart is required` in [src/ui/screens/sync-account-security/useSyncAccountSecurityController.test.ts](src/ui/screens/sync-account-security/useSyncAccountSecurityController.test.ts) |
| Recovery-code regeneration on an account with two-factor on — community and managed alike — carries the current TOTP code in the request body (never the URL), rejects a missing or non-6-digit code before the network, never logs or persists the code, and maps `totp_invalid_code`/`totp_replayed`/`totp_not_configured`/`totp_secret_failed` to two-factor copy; a code field is sent only when given (both servers reject unknown body fields); the code field appears when 2FA is on, or after the server demands a code when the 2FA status could not be read, and is cleared on success | `regenerate-recovery-code sends the TOTP code in the body`, `regenerate-recovery-code maps totp_replayed` in [src/sync/sync-api-client.test.ts](src/sync/sync-api-client.test.ts); `regenerate-recovery-code sends the TOTP code in the body and maps totp_replayed` in [src/sync/managed-cloud-api-client.test.ts](src/sync/managed-cloud-api-client.test.ts); `sends the trimmed TOTP code to the community client`, `refuses a missing or malformed TOTP code %p before any network call`, `passes through community %s`, `sends the trimmed TOTP code to the managed client`, `sends no code field to the managed client when none is given`, `refuses a missing or malformed managed TOTP code %p before any network call`, `passes through managed %s` in [src/sync/sync-account-recovery-service.test.ts](src/sync/sync-account-recovery-service.test.ts); `sends the TOTP code and clears it on success when %s 2FA is on`, `sends no TOTP code when %s`, `reveals the code field after the server answers %s`, `keeps the server's verdict on a code that was actually sent`, `hides the demanded code field again once two-factor is disabled`, `never logs or persists the TOTP code sent with a %s regeneration` in [src/ui/screens/sync-account-security/useSyncAccountSecurityController.test.ts](src/ui/screens/sync-account-security/useSyncAccountSecurityController.test.ts); `hides the regenerate code field unless a code is required`, `maps regenerate %s to the two-factor copy` in [src/ui/screens/sync-account-security/SyncAccountSecuritySection.test.tsx](src/ui/screens/sync-account-security/SyncAccountSecuritySection.test.tsx) |
| Managed account deletion re-confirms the account password (+ the current TOTP code with two-factor on) in the `DELETE /account` body, never the URL, only after the device-auth gate and the confirms; a guest-partner session sends no body; the code is sent only when given; a wrong password/code, a replayed code or `rate_limited` keeps the form open and touches nothing local; the password and code are never logged or persisted | `sends the step-up password, and the code only when given, in the DELETE /account body`, `maps a %i %s on the step-up deleteAccount to %s` in [src/sync/managed-cloud-api-client.test.ts](src/sync/managed-cloud-api-client.test.ts); `aborts before any local teardown when Ovumcy Cloud rejects the password` in [src/sync/account-deletion-service.test.ts](src/sync/account-deletion-service.test.ts); `asks for the password after the confirms (2FA %j -> code field %s) and deletes nothing yet`, `dismissing the device-auth gate never opens the password card`, `sends the trimmed code with the password, and drops an empty code`, `keeps the card open on %s with its own message and touches nothing else`, `a guest-partner session deletes with no step-up and no card`, `never logs or persists the password or code sent with a deletion` in [src/ui/screens/backup-sync/useBackupSyncAccountDeletion.test.ts](src/ui/screens/backup-sync/useBackupSyncAccountDeletion.test.ts) |
| Self-hosted account deletion sends the current password (+ a trimmed TOTP code only when one was entered) in the `DELETE /account` JSON body, never the URL; a connected self-hosted account gets the step-up card after the device-auth gate and the confirms and before any request; a deletion without a password is refused before any request, since the server refuses a bodiless one and still charges it to the account's credential budget | `deletes the self-hosted account with the password in a JSON DELETE /account body and tolerates an empty answer`, `sends the trimmed TOTP code with the password on account deletion` in [src/sync/sync-api-client.test.ts](src/sync/sync-api-client.test.ts); `refuses a self-hosted deletion with %s before any request and wipes nothing` in [src/sync/account-deletion-service.test.ts](src/sync/account-deletion-service.test.ts); `asks a connected self-hosted account for the password before any delete`, `sends the password and code the card collected to the self-hosted delete`, `keeps the card with the server's answer after a wrong password` in [src/ui/screens/backup-sync/useBackupSyncAccountDeletion.test.ts](src/ui/screens/backup-sync/useBackupSyncAccountDeletion.test.ts) |
| Managed account deletion renews an access session that is about to expire before `DELETE /account` and deletes with the fresh token; a dead refresh chain aborts as `unauthorized` with nothing local touched, and so does any managed-mode deletion whose caller loaded a connected session but finds no managed token (the chain cleared it): the owner signs in again or disconnects; a self-hosted device is not affected by this guard | `renews an expired access session before DELETE /account and deletes with the fresh token`, `aborts with unauthorized and wipes nothing when the refresh chain is dead`, `a retry after the dead refresh chain cleared the session still wipes nothing`, `without a loaded session it keeps the local-only path`, `a self-hosted device holding only a stray managed token is not blocked by the guard` in [src/sync/account-deletion-service.test.ts](src/sync/account-deletion-service.test.ts); `tells the deletion a connected session was loaded, so a vanished one aborts` in [src/ui/screens/backup-sync/useBackupSyncAccountDeletion.test.ts](src/ui/screens/backup-sync/useBackupSyncAccountDeletion.test.ts) |
| A connected managed account changes its recovery phrase only through Ovumcy Cloud's `PUT /account/recovery-key`, never by regenerating local keys: a new phrase wraps the SAME master key, the request body carries the current password, a trimmed TOTP code only when one was entered, and the six-field package (no other key), never the URL; the step-up card opens only after the confirm and the device-auth gate; the new package is written to the secret store and the phrase revealed only after a 200 — a 502 `sync_bridge_unavailable`, no answer, an unreadable answer or a failed local write keeps the old package, and the retry resends the same package (held in process memory only, never persisted, never reused for a different master key, dropped on an `invalid_recovery_package` refusal, a session end or a wipe); a confirmed phrase stays in process memory until the screen's next load shows it once more, so an unmount or focus reload during the request cannot lose it; a 404 provisions the sync account and asks for a fresh code instead of replaying a spent one; a double submit sends one request; the password, code and phrase are never logged or returned in an error; an upload the managed sync host refuses with `managed_recovery_key_overwrite` stops before the blob | `PUTs the step-up and the snake_case package, with the code only when given`, `maps %i %s to %s` in [src/sync/managed-cloud-api-client.recovery-key.test.ts](src/sync/managed-cloud-api-client.recovery-key.test.ts); `wraps the SAME master key under a new phrase and adopts it only after the 200`, `keeps the old package on %s and retries with the same package`, `never reuses a pending package for a different master key`, `drops a package the server refused as invalid and builds a fresh one`, `stashes a confirmed phrase until the screen takes it, and a session end clears it`, `asks for a fresh code after provisioning on 404 instead of replaying the spent one`, `reports an unconfirmed rotation when the local write fails after the 200`, `never logs or returns the password, the code or the phrase on any path` in [src/sync/managed-recovery-rotation-service.test.ts](src/sync/managed-recovery-rotation-service.test.ts); `rotates instead of regenerating: rotation confirm, device-auth, then the step-up card`, `opens no card when device auth fails`, `reveals the new phrase only after the rotation is confirmed`, `keeps the card open and shows no phrase on %s`, `never consumes the stashed phrase, so the next load can show it after an unmount`, `sends one request for a double submit` in [src/ui/screens/backup-sync/useBackupSyncRecoveryMaterials.test.ts](src/ui/screens/backup-sync/useBackupSyncRecoveryMaterials.test.ts); `rotates the phrase only for a connected, non-guest managed account` in [src/services/backup-sync-view-service.test.ts](src/services/backup-sync-view-service.test.ts); `maps a managed host's 403 managed_recovery_key_overwrite` in [src/sync/sync-api-client.test.ts](src/sync/sync-api-client.test.ts); `stops before the blob when the managed host refuses a rotated-away package` in [src/sync/sync-client-service.test.ts](src/sync/sync-client-service.test.ts) |
| Replacing the stored recovery-key package on a community server carries the step-up (current password, plus a trimmed TOTP code only when one was entered) in the request body only, never the URL or logs; with no step-up a refusal asks for one instead of failing as wrong, and the blob is not uploaded; only a register connect forwards its password (in memory, never written to the secret store, nor is an upload's step-up) — a login connect and a sign-in after a TOTP challenge put no package at all, so replacing one that may guard an existing backup waits for the upload, which asks the upload-over-backup confirm first; a step-up retry skips that confirm only when it continues the attempt that passed it on the same loaded session, and a prompt opened for one session is retired when the loaded session changes; a managed sync host never receives the step-up; a step-up refusal at a register connect does not fail the connect; an upload whose capabilities request fails stops before any write | `sends no step-up fields when none is given`, `sends the password and trimmed code in the body only`, `omits an empty code` in [src/sync/sync-api-client.test.ts](src/sync/sync-api-client.test.ts); `maps a %s refusal (step-up %j) to %s and stops before the blob`, `passes the step-up to the package PUT and keeps it out of stored secrets`, `connects a prepared device and uploads the wrapped recovery key when supported`, `puts no recovery key on a login connect and leaves it to the upload`, `never forwards a step-up to a managed sync host and keeps its refusal generic`, `never puts the recovery key after the challenge and leaves it to the upload`, `stops before any write when getCapabilities fails with %s` in [src/sync/sync-client-service.test.ts](src/sync/sync-client-service.test.ts); `a step-up retry does not ask the overwrite confirm the same attempt passed`, `a step-up retry still asks the overwrite confirm the opening attempt never passed`, `retires the prompt once the loaded session changes, and its submit uploads nothing` in [src/ui/screens/backup-sync/useBackupSyncActions.test.ts](src/ui/screens/backup-sync/useBackupSyncActions.test.ts); the prompt holds the values only in its own field state and clears them on submit and cancel: `renders a secure password field and hides the code field when not required`, `submits password and code, then clears both fields`, `cancel clears the fields and calls onCancel` in [src/ui/screens/backup-sync/BackupSyncRecoveryKeyStepUpSection.test.tsx](src/ui/screens/backup-sync/BackupSyncRecoveryKeyStepUpSection.test.tsx) |
| A self-hosted upload writes the recovery-key package only when the blob after it can still be accepted, so a failed upload never leaves the old backup under a package that wraps a new key: the ciphertext is checked against `maxBlobBytes` and the generation against the server's before the package write; an unchanged stored package is not rewritten; a device that has uploaded under its key never replaces a different stored package (`recovery_key_changed_elsewhere`), and only a device with no rollback floor replaces one, behind the upload-over-backup confirm and the step-up; a stored package that cannot be read stops the upload before any write | `refuses a ciphertext over the server's maxBlobBytes before any write`, `does not rewrite a stored package that matches, whatever its hex case`, `never replaces a different package on a device that has uploaded under its key`, `checks the generation against the probed backup before a fresh device replaces the package`, `reads the remote generation before storing a missing package on a steady device`, `keeps the intentional replacement: confirmed fresh device, step-up, then the blob`, `fails closed when the stored package cannot be read` in [src/sync/sync-client-service.key-before-blob.test.ts](src/sync/sync-client-service.key-before-blob.test.ts) |

### Reset / recovery and session revocation

| Claim | Enforced by |
| --- | --- |
| A successful password reset clears the stored session tokens and downgrades the device out of the connected state | `clears session tokens and downgrades preferences to local_ready on success` in [src/sync/sync-account-recovery-service.test.ts](src/sync/sync-account-recovery-service.test.ts) |
| A failed reset (`invalid_reset_token`) does **not** wipe local session tokens | `maps invalid_reset_token` in [src/sync/sync-account-recovery-service.test.ts](src/sync/sync-account-recovery-service.test.ts) |
| Forgot-password / reset surfaces only the generic `invalid_recovery_credentials` (enumeration-safe) | `forwards generic invalid_recovery_credentials` in [src/sync/sync-account-recovery-service.test.ts](src/sync/sync-account-recovery-service.test.ts) |
| Change-password and recovery-code regeneration require the current password and dispatch to the correct backend | `validates required inputs before any network call`, `maps invalid_current_password from the community client`, `dispatches to the community client using the community session token` (regenerate) in [src/sync/sync-account-recovery-service.test.ts](src/sync/sync-account-recovery-service.test.ts) |
| A self-hosted password change shows the recovery code the server rotated once through the reveal (the previous code stops working) and sends a trimmed TOTP code only when given, never to Ovumcy Cloud; a missing, wrong or replayed code is named instead of generic; a self-hosted answer that never arrived says the password and the recovery code may already have changed | `returns the recovery code the server rotated on a password change`, `refuses a change-password answer whose recovery code is not a string` in [src/sync/sync-api-client.test.ts](src/sync/sync-api-client.test.ts); `sends the trimmed TOTP code to the community server`, `refuses a code of %j as %s before any request`, `maps the community %s answer instead of generic` in [src/sync/sync-account-recovery-service.test.ts](src/sync/sync-account-recovery-service.test.ts); `reveals once the recovery code a self-hosted password change rotated`, `never shows the code field on a managed account`, `asks for a code, not a wrong one, when the server demands it unasked`, `reports a self-hosted %s answer as a possibly applied change` in [src/ui/screens/sync-account-security/useSyncAccountSecurityController.test.ts](src/ui/screens/sync-account-security/useSyncAccountSecurityController.test.ts) |
| A self-hosted phrase recovery on a TOTP account stops at the challenge with nothing stored and no request on the empty session token, holds the challenge id and the phrase in memory only, and resumes the key fetch, the device attach and the secret write with the challenge's session token; an expired or replayed challenge, or one the accepted code spent before the recovery failed, returns to the form | `hands back the TOTP challenge and runs nothing on the empty session token`, `resumes the recovery with the challenge's session token: key, attach, then store`, `refuses %s before any request` in [src/sync/sync-client-service.recovery-totp.test.ts](src/sync/sync-client-service.recovery-totp.test.ts); `opens the challenge, drops the password and keeps the phrase`, `finishes the recovery with the code and the kept phrase`, `on %s (challenge spent: %s) keeps the challenge open: %s` in [src/ui/screens/backup-sync/useBackupSyncAccountConnection.test.ts](src/ui/screens/backup-sync/useBackupSyncAccountConnection.test.ts) |
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
| A confirm dialog dismissed by the backdrop, the system back action or a concurrent request never resolves to accept: a two-way prompt resolves false and a three-way prompt resolves its dismiss outcome; with no dialog host registered a request resolves false | `resolves false when the backdrop is pressed`, `resolves false when the system dismisses the modal via onRequestClose`, `resolves a concurrent request to the safe dismiss outcome without disturbing the visible dialog`, `resolves dismiss when a three-way prompt is dismissed via the backdrop` in [src/ui/confirm/ConfirmDialogProvider.test.tsx](src/ui/confirm/ConfirmDialogProvider.test.tsx); `resolves to false when no listener has registered`, `falls back to false after the listener unregisters` in [src/ui/confirm/confirmation-bridge.test.ts](src/ui/confirm/confirmation-bridge.test.ts) |

### Offline JSON restore gating

| Claim | Enforced by |
| --- | --- |
| Picking a file only previews: nothing is written until the explicit confirm step runs on the previewed envelope | `writes nothing while previewing a picked file and hands the envelope to the confirm step`, `writes only when the confirm step runs on the previewed envelope` in [src/ui/screens/settings/settings-screen-import-actions.test.ts](src/ui/screens/settings/settings-screen-import-actions.test.ts) |
| The restore never overwrites existing data | `never overwrites a date that already has data`, `keeps a default profile that already sits under local day logs, and still adds the rows`, `never overwrites a pregnancy record, kick session, or contraction session whose id already exists on-device`, `never overwrites a postpartum record or screening response whose id already exists on-device`, `skips an imported active pregnancy record when the device already has a DIFFERENT active record (never overwrites, never ends, never throws)`, `skips an imported active postpartum record when the device already has a DIFFERENT active record (never overwrites, never ends, never throws)` in [src/services/import-service.test.ts](src/services/import-service.test.ts) |

### Export and import artifact cleanup

| Claim | Enforced by |
| --- | --- |
| A temporary export file is deleted after the share attempt, whether the share succeeds or fails | `deletes the temporary export file after a successful share`, `deletes the temporary export file after a failed share` in [src/services/export-delivery.native.test.ts](src/services/export-delivery.native.test.ts) |
| The launch tasks run the stale-artifact sweep on every boot, also when the cycle-start repoint hangs past its timeout, and a failed sweep does not stop the reminder rebuild | `sweeps stale export artifacts and rebuilds the reminder schedule once`, `settles the profile gate, sweeps and rebuilds when the repoint hangs past the timeout`, `still rebuilds the schedule when the artifact sweep fails` in [src/services/app-launch-tasks.test.ts](src/services/app-launch-tasks.test.ts) |
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
| A verified token with an empty entitlement list is the issuer's answer: it re-locks both local features instead of falling back to the snapshot | `reports a verified token with an empty entitlement list as verified, not unavailable` in [src/services/entitlement-token-service.test.ts](src/services/entitlement-token-service.test.ts); `re-locks both local features on a verified token whose entitlement list is empty` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |

### Managed billing snapshot offline-grace cache

| Claim | Enforced by |
| --- | --- |
| A successful billing fetch refreshes the persisted last-known-good snapshot | `refreshes the persisted last-known-good snapshot on a successful fetch` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| A failed fetch serves the cached snapshot while it is within the 72h TTL | `serves the cached snapshot within the 72h TTL when the billing fetch fails` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| Once the cache exceeds 72h, a failed fetch fails closed exactly as it did before the cache existed | `fails closed exactly as before once the cache is older than 72h` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| A failed fetch with nothing ever cached fails closed | `fails closed when the fetch fails and no snapshot was ever cached` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| The cache is never served without a still-present managed session token | `never serves the cache without a managed session token` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| A network blip keeps all six premium gates unlocked via `loadManagedPremiumFeatures` on the surfaces that read billing directly (Dashboard, Calendar, Stats); Settings' doctor PDF follows the same grace while its plan status stays unknown, and only a live answer sets plan status | `keeps the plan status unknown on a cache-served snapshot while the doctor PDF follows the offline grace`, `takes plan status and doctor PDF from a live billing snapshot` in [src/services/settings-state-service.live-billing.test.ts](src/services/settings-state-service.live-billing.test.ts);  `keeps six premium gates unlocked through loadManagedPremiumFeatures on a network blip` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| The server's temporary-unavailability answer, and a 5xx without a recognized error body, also serve the fresh cache | `serves the fresh cache when the server reports temporary unavailability`, `serves the fresh cache when the billing server could not answer: %s` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| An explicit server refusal (401, 403, 404, 429, unparseable 4xx body) yields no cached premium; a refusal about the session or the plan (401 unauthorized, 403 sync not allowed) also discards the cached snapshot, the others keep it | `yields no cached premium and discards the cached snapshot when the billing fetch is answered with %s`, `yields no cached premium but keeps the cached snapshot when the billing fetch is answered with %s`, `unlocks nothing through loadManagedPremiumFeatures when the server answered 401 over a fresh cache` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| A billing answer whose managed session changed while the fetch was in flight is never cached or returned; billing is re-read once under the current session, and nothing is served if it changes again | `re-reads billing under the session now present when the session changes mid-fetch, never caching the old answer`, `returns nothing and caches nothing when the session keeps changing under every fetch` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| Serving the cache records a forward-only clock high-water mark; a clock more than the skew allowance behind it is refused the cache, which is kept | `records the serve instant as the clock high-water mark when it serves the cache`, `refuses the cache, without deleting it, when the device clock is behind the last instant it was served`, `serves the cache when another load recorded a serve instant a few minutes later` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| A live-only (server-checked) load never reads the cache, even on a network failure | `never reads the cache for a liveOnly (server-checked) load, even on a network failure` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |
| Partner projection sync and the backup-sync partner-access pre-check load billing live-only | `reads the live billing snapshot only and stops when partner access is not live-confirmed` in [src/services/managed-partner-share-sync-service.test.ts](src/services/managed-partner-share-sync-service.test.ts); `reads the live billing snapshot only, never the offline-grace cache` in [src/ui/screens/backup-sync/useBackupSyncSessionCore.partner-precheck.test.ts](src/ui/screens/backup-sync/useBackupSyncSessionCore.partner-precheck.test.ts) |
| A refused entitlement-token mint serves no cached token; a plan or endpoint refusal also discards it, a 401 keeps it; temporary unavailability still serves it | `discards the cached token when the mint is refused` in [src/services/entitlement-token-service.test.ts](src/services/entitlement-token-service.test.ts); `serves no cached token when the mint is refused with %s`, `honors a cached token when the server reports temporary unavailability` in [src/services/managed-premium-features-service.test.ts](src/services/managed-premium-features-service.test.ts) |

### Pregnancy, postpartum, and screening data

| Claim | Enforced by |
| --- | --- |
| Pregnancy outcome fields (EDD, end reason) are stored in the encrypted payload, never as plaintext columns | `stores pregnancy data in encrypted payloads, never plaintext EDD or end-reason strings` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts) |
| Screening answers and the derived score exist only inside the encrypted payload | `round-trips screening responses and stores answers/score only in the encrypted payload` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts) |
| A row whose ciphertext was moved between ids or tables fails closed and is dropped rather than decrypted | `drops a pregnancy row whose ciphertext was copied from a different pregnancy id (AAD fail-closed)`, `drops a contraction row holding a kick-session ciphertext (cross-table AAD binding)`, `drops a postpartum row whose ciphertext was copied from a different postpartum id (AAD fail-closed)`, `drops a screening row whose ciphertext was copied from a different id (AAD fail-closed)` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts) |
| Deleting one sensitive class never deletes another | `deleteAllPregnancyData clears every pregnancy table but leaves other tables intact`, `deleteAllScreeningData clears screening but leaves postpartum + other data intact (separate sensitive classes)`, `deleteAllPostpartumData does NOT delete screening data (screening is a separate class)` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts) |
| A destructive local reset / key mismatch wipes every local table (including the five pregnancy-family tables), leaving no orphaned undecryptable rows | `wipes every local table (including pregnancy, postpartum, and screening) via wipeLocalAppTables` in [src/storage/local/sqlite-local-data-key.test.ts](src/storage/local/sqlite-local-data-key.test.ts); `wipes the pregnancy tables on destructive local reset and leaves them empty and usable`, `wipes the screening table on destructive local reset and leaves it usable` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts) |
| "Clear local data" and account deletion leave no SecureStore entry of the wiped scope — every key a platform store factory can write, inventoried from source, is gone afterwards except the local-data key the storage reset regenerates | `leaves no wipe-scope SecureStore key behind after clearing local data` in [src/services/settings-danger-zone-service.test.ts](src/services/settings-danger-zone-service.test.ts); `leaves no wipe-scope SecureStore key behind after deleting the account` in [src/sync/account-deletion-service.test.ts](src/sync/account-deletion-service.test.ts) |
| A secret that cannot be deleted does not stop the others and makes the wipe report failure; a "Clear local data" storage reset that throws still deletes every wipe-scope secret; account deletion still wipes local data, since the server account is already gone | `still clears the remaining secrets and reports failure when one secret clear throws`, `still clears every wipe-scope secret and the invite buffer when the storage reset throws` in [src/services/settings-danger-zone-service.test.ts](src/services/settings-danger-zone-service.test.ts); `clears every other secret and still wipes local data, but reports failure, when one secret clear throws` in [src/sync/account-deletion-service.test.ts](src/sync/account-deletion-service.test.ts) |
| Once the server has erased the account, a failed local teardown is reported as server-deleted; the retry passes the device-auth gate and the confirms again, then repeats only the local teardown — no second `DELETE /account` with the dead token and no password card. Only the same loaded state retries this way; a reloaded or switched state takes the full flow. A failure that did not erase the server account keeps the full server-first flow | `reports serverDeleted when the server delete succeeded but the local wipe threw`, `reports serverDeleted when the server delete succeeded but a secret clear threw`, `finishLocalAccountDeletion retries only the local part, with no network call` in [src/sync/account-deletion-service.test.ts](src/sync/account-deletion-service.test.ts); `re-runs the gates, then only the local part: no DELETE, no password card`, `a dismissed device-auth gate still blocks the local-only retry`, `a dismissed confirm still blocks the local-only retry`, `keeps the full server flow when a failure did not erase the server account`, `a reloaded or switched state takes the full server flow again` in [src/ui/screens/backup-sync/useBackupSyncAccountDeletion.test.ts](src/ui/screens/backup-sync/useBackupSyncAccountDeletion.test.ts) |
| The v13 → v16 upgrade creates the five tables with existing data intact | `upgrades a v13 database through v14/v15/v16, creating the pregnancy, postpartum, and screening tables with existing data intact` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts) |
| An abandoned questionnaire persists nothing, and an unanswered item cannot finish one | `persists nothing when the questionnaire is abandoned partway through` in [src/ui/screens/postpartum/ScreeningScreen.test.tsx](src/ui/screens/postpartum/ScreeningScreen.test.tsx), `refuses to finish while any item is unanswered and persists nothing` in [src/ui/screens/postpartum/ScreeningScreen.handlers.test.tsx](src/ui/screens/postpartum/ScreeningScreen.handlers.test.tsx) |
| The check-in history surfaces date and score only, never the per-item answers | `lists rows newest-first with date and score only (no answers)` in [src/services/screening-service.test.ts](src/services/screening-service.test.ts) |
| An imported screening score / self-harm flag is recomputed from the answers, so a tampered stored score never applies | `recomputes an imported screening's score + selfHarmFlag from its answers (a drifted stored score is corrected, never trusted)` in [src/services/import-service.test.ts](src/services/import-service.test.ts) |
| **No pregnancy, postpartum, or screening data reaches a partner projection at either access level** | `never leaks pregnancy-mode day fields into the %s projection`, `never leaks postpartum or screening data into the %s projection` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |
| **The crisis-support contact never reaches a partner projection at either access level** | `never leaks the crisis-support contact into the %s projection` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |
| The crisis-support surface never consults an entitlement loader while rendering or saving | `never consults the premium loader while rendering or saving (never plan-gated)` in [src/ui/components/CrisisSupportCard.test.tsx](src/ui/components/CrisisSupportCard.test.tsx) |
| Module ownership is fail-closed: a throwing or non-`true` source reads as not owned, and a release build never unlocks from the dev flag | `returns true only when the source answers true`, `fails closed when the source throws`, `treats a non-boolean truthy answer as not owned`, `never unlocks a release build, whatever the flag says` in [src/services/pregnancy-entitlement-service.test.ts](src/services/pregnancy-entitlement-service.test.ts) |
| A locked module shows the lock card instead of the start form | `renders the premium lock card and no form when locked` in [src/ui/screens/pregnancy/PregnancyStartScreen.test.tsx](src/ui/screens/pregnancy/PregnancyStartScreen.test.tsx) |
| A locked module's lock card is informational only — it never offers a subscription route, which would misstate a one-time unlock as plan-gated | `renders the locked pregnancy entry card as information only, with no subscription route` in [src/ui/screens/DashboardScreen.test.tsx](src/ui/screens/DashboardScreen.test.tsx) |

### Medical-safety prediction suppression

Predictions are estimates, never medical advice or a method of contraception.
Suppression ORs two signals: the day-log pregnancy pause (a positive test on or
after every recorded cycle start, until a later cycle start is logged — an
uncertain-marked, spotting or lone unflagged day is not one) and an
ACTIVE pregnancy record. Either signal alone must hide current-cycle
predictions and fertility signals — the paused projection deliberately keeps
its cycle anchor (so the pause alone cannot null anchor-driven surfaces), a
period logged mid-pregnancy lifts the pause, and an LMP/ultrasound-dated
pregnancy never sets it, so neither signal ever covers the other.

| Claim | Enforced by |
| --- | --- |
| The day-log pause and the cycle anchor read one cluster boundary (ovumcy-web `CycleBoundaries`), so a lifted pause always leaves the anchor after the positive test — a spotting, lone or uncertain-marked first day before the test never keeps predictions anchored before it | every case in [src/services/cycle-boundaries-reference.test.ts](src/services/cycle-boundaries-reference.test.ts) (the shared cycleBoundaries golden vectors) |
| The stored cycle start (`profile.lastPeriodStart`) is trusted as stored on the read side and repointed on the write side — un-tick, spotting or an uncertain mark on its date, and clear-day, move it to the latest boundary on or before today; a BBT/note-only save on a row-less date keeps it; uncertain manual marks are not mirrored; rows and profile commit as one unit; an additive JSON import applies the same rule to a day it adds on that date, after every other imported day, in one unit with that row and never in the preview; a start changed in Settings moves its day logs in that same unit (mark moved, old auto-filled run removed, new run filled up to today), never removes a row holding user data, stores the latest boundary when a later period survives the move instead of the typed date, and refuses a typed date on a spotting day with nothing written; legacy data is re-read once at launch, before any screen renders unless the re-read runs past a ten-second timeout, best effort (old value kept on failure), and after every sync restore or profile-restoring import, because the repoint version never leaves the device (sync snapshot, JSON export) — so the pause and the anchor agree; the pregnancy default LMP, the doctor PDF and the prediction hint read that anchor (latest cycle start on or before today, stored or logged), never the raw field | every case in [src/services/stored-cycle-start-write-path.test.ts](src/services/stored-cycle-start-write-path.test.ts); `prefills a later logged start over an older stored start`, `prefills a logged start when the stored start is empty`, `never prefills a stored start dated after today` in [src/services/pregnancy-mode-service.test.ts](src/services/pregnancy-mode-service.test.ts); `explains a projection anchored by a logged start when the stored start is empty` in [src/services/prediction-explanation-service.test.ts](src/services/prediction-explanation-service.test.ts); every case in [src/services/period-start-move-service.test.ts](src/services/period-start-move-service.test.ts); `keeps the stored start over a non-period row on its date, and the pause and anchor agree` in [src/services/cycle-history-service.test.ts](src/services/cycle-history-service.test.ts); `commits day-log writes, deletes and the profile inside one transaction`, `clears a transaction left open by a failed rollback before the next commit begins` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts); `settles the profile gate only after the repoint has written the profile`, `settles the profile gate and still loads when the repoint fails`, `settles the profile gate, sweeps and rebuilds when the repoint hangs past the timeout` in [src/services/app-launch-tasks.test.ts](src/services/app-launch-tasks.test.ts); `repoints a stored cycle start withdrawn under the earlier rule after restore`, `leaves the repoint state out of the snapshot, so every restore re-reads the stored start` in [src/sync/sync-snapshot-service.test.ts](src/sync/sync-snapshot-service.test.ts) |
| Every prediction surface (dashboard, stats, the calendar in any month, device reminders) reads cycle boundaries and the day-log pause from one shared history — the last two years up to today, widened back to the first day of a bleeding episode its lower bound cuts — so no surface window drops a positive test or splits a two-day run into a lone day that opens no cycle | `counts a run straddling the two-year bound as one cycle on every surface`, `keeps the pregnancy pause on a calendar month paged past the grid window` in [src/services/cycle-history-records.test.ts](src/services/cycle-history-records.test.ts) |
| An active pregnancy record suppresses the dashboard cycle hero, fertility summary, and prediction hint even when the day-log pause never engaged or was lifted | `suppresses hero, fertility summary and prediction hint for a stale active pregnancy that never logged a positive test`, `suppresses the cycle hero for a stale active pregnancy after a period logged post-positive-test lifts the day-log pause` in [src/services/dashboard-view-service.test.ts](src/services/dashboard-view-service.test.ts) |
| An active pregnancy record suppresses the stats prediction-bearing sections after the pause lifts, keeping completed-cycle facts | `suppresses prediction-bearing sections for an active pregnancy even after the pause lifts, keeping completed-cycle facts` in [src/services/stats-view-service.test.ts](src/services/stats-view-service.test.ts) |
| The un-lifted day-log pause alone hides the stats BBT trend/coverline, the mucus peak-fertility card, and current-cycle fertility signals — no pregnancy record required | `hides BBT trend, the peak-fertility card, and current-cycle fertility signals while the day-log pause is active (no pregnancy record)` in [src/services/stats-view-service.test.ts](src/services/stats-view-service.test.ts) |
| The calendar's selected-day advanced fertility summary drops under either suppression signal | `drops the summary while a pregnancy record is active (day-log pause never set)`, `drops the summary while the day-log pause is active (no pregnancy record)` in [src/services/calendar-view-service.test.ts](src/services/calendar-view-service.test.ts) |
| The doctor PDF prints no current-cycle fertility signals under either suppression signal, leaving completed-cycle history untouched; its day-log pause comes from the shared cycle history, not the export range, so a positive test after the range still pauses it while the listed cycles and tests stay within the range | `suppresses the current-cycle LH-peak signal when an active pregnancy record exists, leaving completed-cycle history untouched`, `suppresses the current-cycle LH-peak signal while the day-log pause is active (no pregnancy record)`, `pauses from the shared cycle history when the positive test lies outside the export range` in [src/services/export-pdf-service.test.ts](src/services/export-pdf-service.test.ts); `feeds the PDF the shared cycle history beside the export range, so a later positive test still pauses it` in [src/services/export-service.test.ts](src/services/export-service.test.ts) |
| The doctor PDF keeps the retrospective fertile and tentative-ovulation calendar markers of completed cycles under suppression, and none falls on or after the latest cycle start | `keeps retrospective calendar markers under suppression and places none on or after the latest cycle start` in [src/services/export-pdf-service.test.ts](src/services/export-pdf-service.test.ts) |
| The early-bleeding notice on the manual cycle-start action (a bleed placed against the estimated ovulation) is withheld under either suppression signal and in unpredictable mode; the dashboard and calendar loaders resolve both signals for it | `withholds the notice under either prediction suppression signal`, `withholds the notice in unpredictable mode, which publishes no ovulation` in [src/services/manual-cycle-start-service.test.ts](src/services/manual-cycle-start-service.test.ts); `is set by an active pregnancy record with no day-log pause`, `is set by the day-log pause with no pregnancy record` in [src/services/dashboard-view-service.test.ts](src/services/dashboard-view-service.test.ts) and [src/services/calendar-view-service.test.ts](src/services/calendar-view-service.test.ts) |
| The active pregnancy and postpartum records resolve from the decrypted, AAD-bound record status, never the plaintext `status` column, so editing that column in the database file can neither hide an active record (dropping suppression) nor admit a second active one | `resolves the active pregnancy from the authenticated record when the plaintext status column is edited`, `resolves the active postpartum record from the authenticated record when the plaintext status column is edited` in [src/storage/local/sqlite-app-storage.test.ts](src/storage/local/sqlite-app-storage.test.ts) |
| The day-save confirmation never claims a fertile window or a self-care cycle day while a pregnancy record is active | `lets an active pregnancy record win over the fertile window and the day-log pause`, `never claims a fertile window in the day-save message while a pregnancy record is active` in [src/services/dashboard-view-service.test.ts](src/services/dashboard-view-service.test.ts) |
| Past the overdue gate (raw cycle day more than seven days past the overdue length — the shorter of the prediction length and the average-first reference length, the average trusted from the same completed-cycle count as the prediction, ovumcy-web `DashboardCycleOverdue` / `dashboardCycleOverdueLength`) the shared projection names no next period, window, ovulation or projected phase on any branch, and shows the raw cycle day | `withholds every projected date once the cycle runs more than a week past its length`, `withholds the next period and its window past the overdue gate`, `measures the stale band and the overdue gate against the shorter of the projection and reference lengths`, `ignores a single short completed cycle when sizing the overdue gate` in [src/services/cycle-history-service.test.ts](src/services/cycle-history-service.test.ts) |
| Past the overdue gate (the shared projection's `cycleDayLooksLong`, ovumcy-web `PredictionsSuppressed`) no period or fertile-window device reminder is planned, and the stats personal forecasts are withheld while completed-cycle history and current-cycle observations stay | `plans period and fertile reminders when the gate flag is clear and none when it holds`, `reads the real projection %s`, `withholds personal forecasts past the gate and keeps recorded history and observations` in [src/services/overdue-gate-prediction-surfaces.test.ts](src/services/overdue-gate-prediction-surfaces.test.ts) |
| Between the overdue length and the gate the dashboard hero shows the raw cycle day as "~N", never a day rolled forward | `keeps a conservative hero naming the overdue next period while the cycle is in its late week` in [src/services/dashboard-view-service.test.ts](src/services/dashboard-view-service.test.ts) |
| Between the overdue length and the gate (the stale band, ovumcy-web `CycleDataStale`) the shared projection publishes no ovulation date (rolled-window or upcoming) and no ovulation range and reads the phase as unknown; stats and the partner snapshot show the raw cycle day (`resolveDisplayCycleDay`), not the rolled day 1-7 | `keeps the next period on the running cycle through its late week`, `withholds the upcoming ovulation, the phase and the range in the stale band only` in [src/services/cycle-history-service.test.ts](src/services/cycle-history-service.test.ts); `resolveDisplayCycleDay`, `stats in the stale band`, `partner share in the stale band` in [src/services/stale-band-display-surfaces.test.ts](src/services/stale-band-display-surfaces.test.ts) |
| Between the overdue length and the gate the calendar paints only the running cycle's period (no chained cycle, fertile window or ovulation day, ovumcy-web `ProjectionChainSuppressed`); past the gate it paints no predicted period, fertile or ovulation cell, keeping logged days and a BBT-confirmed ovulation day (an observation), which unpredictable mode and pregnancy suppression still withhold | `paints the missed period in the late week and no prediction past the overdue gate`, `keeps a BBT-confirmed ovulation day past the overdue gate and no other prediction` in [src/services/calendar-view-service.test.ts](src/services/calendar-view-service.test.ts) |
| Period and fertile-window device reminders stay suppressed under either suppression signal | `suppresses period and fertile reminders after a positive pregnancy test`, `suppresses period and fertile reminders for an active pregnancy record with no day-log pause` in [src/services/local-reminder-plan-service.test.ts](src/services/local-reminder-plan-service.test.ts); `suppresses them on the device during an active pregnancy` in [src/services/local-reminder-sync-service.test.ts](src/services/local-reminder-sync-service.test.ts) |
| A plan-input read that fails while rebuilding device reminders clears the armed schedule instead of leaving reminders planned from data it can no longer confirm | `clears the armed schedule and reports failed when %s cannot be read` in [src/services/local-reminder-sync-service.test.ts](src/services/local-reminder-sync-service.test.ts) |
| Starting, ending or deleting a pregnancy record pushes a fresh partner projection right after the local write, so partner predictions follow the record's suppression without waiting for the next day-log save; the push never holds navigation | `pushes the partner projection once, after the pregnancy record is written`, `navigates without waiting on a push that has not settled` in [src/ui/screens/pregnancy/PregnancyStartScreen.test.tsx](src/ui/screens/pregnancy/PregnancyStartScreen.test.tsx); `pushes the partner projection once after a confirmed end, after the record is written`, `pushes the partner projection once after delete-all, after the delete` in [src/ui/screens/pregnancy/PregnancyEndScreen.test.tsx](src/ui/screens/pregnancy/PregnancyEndScreen.test.tsx) |
| The dashboard and calendar re-read the local civil date on focus, on return to the foreground and at local midnight, so a screen left open overnight files a new entry (a positive test included) under the new day; an open draft is saved on its own date first | `moves to the new civil date at local midnight while the screen stays open`, `re-reads the civil date when the app returns to the foreground`, `re-reads the civil date when the screen regains focus` in [src/ui/screens/day-log/use-local-civil-now.test.ts](src/ui/screens/day-log/use-local-civil-now.test.ts); `saves an open draft on its own date and edits the new day after midnight` in [src/ui/screens/DashboardScreen.test.tsx](src/ui/screens/DashboardScreen.test.tsx); `moves a selection resting on the old today to the new civil date`, `keeps an explicitly picked earlier day selected across midnight` in [src/ui/screens/CalendarScreen.test.tsx](src/ui/screens/CalendarScreen.test.tsx) |
| Notification payloads carry no sensitive context; the one narrow exception is a cycle-day reminder's owner-entered label, shown in the body only when that rule's own opt-in flag is on (default off), never in the title, the notification data, an identifier, a log or a deep link. A JSON import turns every rule's opt-in off. A cleared schedule (all reminders off, local wipe, account deletion) also dismisses this app's already-shown reminders. On Android the reminders channel has private lock-screen visibility, so a secure lock screen never shows the text. Cycle-day reminders are withheld under a pregnancy pause, an active pregnancy record (read for rules alone), the overdue gate, the stale band, unpredictable mode, and while the cycle start is unsettled | `uses a generic body by default and the label only when that rule opts in`, `is withheld under a positive pregnancy test (paused predictions)`, `is withheld while a pregnancy record is active`, `is withheld past the overdue gate and in the stale band`, `is withheld in unpredictable (facts-only) mode`, `holds every rule until the cycle start is settled` in [src/services/cycle-day-reminders.test.ts](src/services/cycle-day-reminders.test.ts); `reads the pregnancy state for cycle-day rules alone and suppresses them` in [src/services/local-reminder-sync-service.test.ts](src/services/local-reminder-sync-service.test.ts); `restores valid cycle-day reminders and drops invalid, duplicate and surplus rules` in [src/services/import-service.test.ts](src/services/import-service.test.ts); `dismisses its own already-shown reminders when the schedule is cleared`, `creates the reminders channel with private lock-screen visibility` in [src/services/platform-local-reminder-scheduler.native.test.ts](src/services/platform-local-reminder-scheduler.native.test.ts) |
| Cycle-day reminder rules are validated on every untrusted path (import, sync snapshot restore, stored payload at plan time): day 1-90, hour 0-23, label at most 64 characters without control, format, separator or blank-glyph characters (the one exception: a zero-width joiner or non-joiner between two visible characters, never doubled or space-adjacent; one at either end is trimmed), and never made only of joiners, variation selectors or base-less combining marks, at most 10 rules, ids re-checked; invalid rules are dropped. The rules never reach a partner projection | `drops a rule with %s`, `keeps a label with %s`, `keeps at most ten rules and drops a repeated id`, `re-validates stored rules at plan time` in [src/services/cycle-day-reminders.test.ts](src/services/cycle-day-reminders.test.ts); `restores valid cycle-day reminders and drops invalid, duplicate and surplus rules`, `does not overwrite a device that already holds cycle-day reminders` in [src/services/import-service.test.ts](src/services/import-service.test.ts); `re-validates cycle-day reminder rules from a snapshot before storing them` in [src/sync/sync-snapshot-service.test.ts](src/sync/sync-snapshot-service.test.ts); `never leaks cycle-day reminder rules or their labels into the %s projection` in [src/services/partner-shared-projection-service.test.ts](src/services/partner-shared-projection-service.test.ts) |

### Android platform config (cleartext, backup, device transfer)

| Claim | Enforced by |
| --- | --- |
| A release build for any EAS profile but `local` ships a network security config with no cleartext exception; the debug variant and the `local` profile exempt exactly `10.0.2.2`, `127.0.0.1` and `localhost`, no subdomains, and the plugin is wired into `app.json` | `ships no cleartext exception in the main config for EAS profile %s`, `exempts only the emulator-host/loopback dev addresses in the debug variant and the local profile`, `is wired into the app config` in [src/security/android-platform-config.test.ts](src/security/android-platform-config.test.ts) |
| Cloud backup and device-to-device transfer exclude every backup domain on Android 12+ and below; the manifest points at these rules, replacing expo-secure-store's partial ones; `allowBackup` stays off and expo-secure-store's own backup rules stay disabled | `excludes every backup domain from cloud backup and device-to-device transfer`, `points the manifest at its own rules, replacing expo-secure-store's partial ones`, `keeps allowBackup off, the exclusion plugin wired, and expo-secure-store's own backup rules disabled` in [src/security/android-platform-config.test.ts](src/security/android-platform-config.test.ts) |

### Sync endpoint policy

| Claim | Enforced by |
| --- | --- |
| The endpoint policy treats a host as private network only when it parses as a literal IPv4 in a private range, never by prefix-matching the hostname, so an FQDN that begins with private octets gets https by default and an explicit `http://` to it is refused; link-local addresses get no cleartext and an out-of-range octet fails closed | `rejects bare http on private-octet-prefixed FQDN %s`, `rejects explicit http on a private-octet-prefixed FQDN`, `rejects insecure public http for link-local (169.254.0.0/16) addresses`, `fails closed to invalid_endpoint for an out-of-range IPv4 octet` in [src/sync/sync-endpoint-policy.test.ts](src/sync/sync-endpoint-policy.test.ts) |

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
  and pinned by the matrix rows above, but remain dormant: the production
  loader builds the token gate, yet with no token issued it falls back, so the
  two purely-local premium features are still decided by the billing-snapshot
  boolean until the activation rollout step.
  The remaining policy note is that verification, once live, is *bypassable by
  a forked client* by design. This is not asserted by a single test — it is the
  explicit non-goal recorded in the Accepted-Residual note above, reviewed by
  humans. The token is treated as a hardened UX control over the
  user's own local data, not a DRM trust boundary.
- **Secure-storage backing for keys/secrets.** Keys and sync/partner secrets are
  placed in `expo-secure-store` with device-only accessibility; the OS keystore
  itself is not exercised by Jest (it is mocked), so this is a code-review
  invariant rather than a matrix row.
