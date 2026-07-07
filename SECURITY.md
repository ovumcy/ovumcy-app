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
- **No telemetry.** The app ships no analytics, advertising, crash-attribution,
  or third-party tracking SDKs. Nothing about the user's health data or usage is
  reported off-device by default.
- **Premium is gated by a managed billing snapshot, with signed tokens for the
  purely-local features.** Most premium features (advanced fertility, extended
  reports, partner access, reminder emails) are unlocked by a boolean
  entitlement / `has_active_plan` snapshot read from the managed cloud. Local
  device reminder notifications are a free-tier feature derived entirely from
  on-device data and read no billing state. The two purely-local
  compute features (doctor PDF, advanced insights) additionally prefer a signed
  EdDSA entitlement token when one verifies, falling back to the snapshot
  boolean otherwise (see Accepted Residual Risks). Gating is **additive**: a free
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
- **Cleartext HTTP blocked by default (Android).** The committed Android network
  security config (`android/app/src/main/res/xml/network_security_config.xml`,
  generated in prebuild by `plugins/withAndroidNetworkSecurityConfig.js`) sets
  `cleartextTrafficPermitted="false"` app-wide and permits cleartext only for the
  emulator-host/loopback dev addresses (`10.0.2.2`, `127.0.0.1`, `localhost`) that
  serve Metro and local sync stacks in debug builds. Production traffic is
  HTTPS-only at the OS layer. On top of that, `src/sync/sync-endpoint-policy.ts`
  rejects `http://` to any non-private host (parsing the host as a literal IPv4
  and bucketing by octet, never prefix-matching the hostname) as defense in
  depth, so an `http://` sync/managed endpoint is refused before a request goes
  out regardless of the OS layer.

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
  for when native pinning is enabled.
- **Signed entitlement tokens are verified, but verification is bypassable by a
  forked client (honest non-DRM scope).** The two *purely-local* premium
  features (doctor PDF, advanced insights) are now gated by a signed
  EdDSA/Ed25519 token (`src/security/entitlement-token.ts`): the app verifies the
  signature against an embedded public key keyed by `kid`, checks
  `iss`/`aud`/`exp`/`sub`, and trusts the token's `entitlements` over the plain
  snapshot boolean when a valid token is present. This raises casual
  circumvention from "flip a boolean" to "patch out signature verification or
  reimplement the managed signer" — and that is the entire claim. It is **not**
  DRM: a determined forker can still patch out the verifier or reimplement the
  signer, and doing so only exposes the user's own data. During rollout phase 1
  the gate **falls back to the billing-snapshot boolean** whenever no valid token
  is present (no endpoint, offline with an expired cache, unknown `kid`, tamper),
  so older managed servers and the pre-rollout state behave exactly as before.
  The embedded public key shipped today is a documented placeholder; until the
  operator installs the production key (and managed ships the issuance endpoint)
  no production token verifies and every gate uses the snapshot. The
  authoritative gate for any *server-side* premium capability (e.g. managed sync)
  remains enforced on the backend, not by this token.
- **Server-side rate limiting is in-memory.** The sync/managed backends rate-limit
  per process and reset on restart (see their own `SECURITY.md`). The app does
  not add a second client-side limiter.

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
- **Signed premium entitlement tokens (honest non-DRM scope).** The two
  purely-local premium features are now verified against a signed EdDSA token
  (matrix rows above); the remaining policy note is that verification is
  *bypassable by a forked client* by design. This is not asserted by a single
  test — it is the explicit non-goal recorded in the Accepted-Residual note
  above, reviewed by humans. The token is treated as a hardened UX control over the
  user's own local data, not a DRM trust boundary.
- **Secure-storage backing for keys/secrets.** Keys and sync/partner secrets are
  placed in `expo-secure-store` with device-only accessibility; the OS keystore
  itself is not exercised by Jest (it is mocked), so this is a code-review
  invariant rather than a matrix row.
