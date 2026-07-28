# Sync Trust Model

`ovumcy-app` is local-first first. Sync is optional.

Core owner flows such as onboarding, profile, tracking, calendar, and insights must still work without any account or cloud dependency.

## On-Device Baseline

On native platforms:

- privacy-sensitive health records live in SQLite-backed repositories;
- health payloads are stored with encrypted-at-rest payloads;
- local encryption keys, sync session tokens, wrapped keys, and recovery material stay in secure storage, not broad key-value storage.

On web preview:

- storage is intentionally session-only and non-durable;
- web preview is not the strong secure-storage path for health data.

## Sync Principles

The sync model is intended to be zero-knowledge with respect to health content:

- the device generates key material;
- health payloads are encrypted before upload;
- the server stores ciphertext blobs;
- recovery phrases do not leave the device.

What the sync server may still see:

- account/session metadata;
- device IDs and device labels;
- blob generation, size, checksum, and timestamps;
- wrapped recovery-key package metadata.

What the sync server should not see:

- plaintext cycle history;
- symptoms;
- notes;
- recovery phrases;
- client master keys;
- decrypted sync payloads.

## Self-Hosted Community Flow

In `self_hosted` mode:

1. the device prepares local recovery material;
2. the owner enters their server endpoint;
3. the owner creates or signs in to an account on their own sync server;
4. the app uploads and restores encrypted snapshot blobs through `ovumcy-sync-community`.

In this mode the self-hosted server operator can know the chosen login on that server, because that server is also the auth surface.

## Managed Cloud Flow

In `managed` mode the trust boundary is intentionally split:

- managed auth and entitlement are a separate plane;
- sync transport is a separate plane.

The goal is:

- email, billing identity, and entitlement logic belong to the managed auth or billing service;
- ciphertext storage belongs to the managed sync transport;
- the sync endpoint should not need plaintext billing identity in order to store encrypted blobs.

The app should therefore treat managed auth and managed sync as separate responsibilities even when the UI presents them in one owner flow.

"Managed" itself is backend vocabulary, not a user-facing concept: no screen or copy catalog surfaces it as a product term. The UI speaks of the Ovumcy Cloud plan and backup & sync.

## Recovery

Recovery phrases are shown only when the app prepares or recreates local sync keys.

The new-phone flow is: install → sign in → enter the recovery phrase to restore the key → download the blob → decrypt on the device. The server participates only as blob storage; it never sees the phrase or the restored key.

If an owner loses every device and also loses the recovery phrase, encrypted sync data cannot be recovered.

This is a privacy tradeoff, not a support bug: the server is not supposed to know enough to recover the health payload by itself.

## Identity Axes, Storefront Doors, and Trust Anchors

Decision (2026-07-23): this section is the model of record for the billing /
entitlement / premium-boundary work (product contract v1). Premium and billing
changes are High-risk: the model lands in this document first, code follows it —
never the other way around. Parts marked **target** are not implemented yet;
everything else is the shipped posture. Nothing below relaxes the
premium-boundary invariants in `SECURITY.md`.

### Three orthogonal identity axes

One device can hold three independent capabilities. They are different axes, not
levels of one ladder, and the app must never conflate them:

- **premium** — unlocked features;
- **sync** — data survival (encrypted off-device backup);
- **guest access** — read of another person's shared projection.

What the app may and may not infer:

- **Premium never implies sync.** A local premium unlock grants no sync
  entitlement and no account.
- **Sync never implies premium.** Sync entitlement is a signal separate from
  plan status (already the shipped posture — see Premium Entitlement and the
  Sync Plane below).
- **Guest access never unlocks premium.** A guest reads someone else's
  minimized projection, read-only; premium insights over one's own data do not
  apply to a guest session.
- **`sub` classes stay distinct.** Guest accounts, device-anchored premium
  identities (**target** — the managed cloud is email-centric today), and email
  accounts are separate `sub` classes and never merge implicitly. The only
  account-class transition is the explicit guest→full upgrade path, which
  preserves the account id and grants.

### The three storefront doors

Decision (2026-07-23): the paid offer is three doors, each answering a different
need and each backed by its own trust anchor. There is deliberately no
subscription-without-sync SKU (it would be dominated by the one-time unlock) and
no expensive lifetime tier.

| Door | Grants | Account | Trust anchor |
| --- | --- | --- | --- |
| **Free** | Core tracking, predictions, stats, local CSV/JSON export | none | none — data lives only on the device and dies with it |
| **One-time premium unlock** (store non-consumable, **target**) | Premium features; no sync, no account, no server round-trip | none | Store receipt verified on-device (StoreKit 2 / Play Billing); restored through the store account |
| **Monthly + yearly subscription** | Premium features + sync included | needed only for sync — subscribing without enabling sync or connecting the account is allowed | Managed billing snapshot under a managed session (the shipped premium authority) |

Door rules:

- The one-time unlock is positioned as "unlock features", not "forever": it
  lives as long as the installed app plus the store account's restore path, and
  is priced below the yearly subscription (exact price points are an open
  product item, not code).
- The subscription includes sync because sync's marginal cost is ~0; its account
  exists for sync, not as a premium license anchor.
- Premium is not welded to an account: the one-time door must work with no
  account at all. Signed EdDSA entitlement tokens (the implemented-but-dormant
  overlay documented in `SECURITY.md`) back **only portable / gifted premium
  grants** — they are not the primary premium path, and the signing key is not
  activated yet, so no production token verifies today.
- Store-native mechanics stay store-native: discounts, intro pricing,
  month→year upsell, renewal, cancellation, refunds. The app never implements
  billing logic; app-side involvement is UI hints only.
- Server-to-server store notifications (churn analytics) are out of scope in
  v1; access truth is the store plus on-device verification.
- The self-hosted Community Sync tier is unchanged and outside the storefront:
  bring-your-own-server, no store SKU, orthogonal to these doors.

Current state vs target: today every premium surface reads the managed billing
snapshot and the token overlay is dormant (`SECURITY.md`, Accepted Residual
Risks). The store-receipt on-device path and the device-anchored `sub` class are
the target work this section models ahead of implementation.

### Out of scope in v1 (decided)

- Browser/web client for sync and partner sharing (in-browser decryption is a
  separate future feature).
- Server-to-server store notifications (churn analytics).
- A doctor-facing export-snapshot share flow (distinct from the existing
  on-device doctor PDF, which stays).
- Seamless deferred deep-linking for invites — v1 uses the explicit "press the
  link again" flow (see Partner Sharing Trust Boundary below and
  `docs/deep-links.md` §5).
- An expensive lifetime tier (dropped permanently, not deferred).

### Open product items (deliberately not detailed here)

Product-side decisions, tracked outside code:

- final price points (fixed constraint: the one-time unlock costs less than the
  yearly subscription);
- final accept-screen copy for partner sharing (the honest-revocation wording
  requirement is fixed below; exact copy is a product draft).

## Premium Entitlement and the Sync Plane

Ovumcy Cloud premium gates (advanced fertility, advanced insights, extended reports, doctor PDF, partner sharing, reminders) read from the managed billing snapshot, not from the sync transport. Device reminder notifications are free-tier, delivered on-device only, and read no billing state at all — the managed cloud runs no reminder delivery channel.

What this means in practice:

- premium feature flags arrive over an authenticated managed cloud channel and are never persisted to broad key/value storage on the device;
- the app persists a bounded 72-hour offline-grace cache of the last-known-good billing snapshot (`hasActivePlan` + `premiumFeatures` only) in the encrypted `managed_billing_cache` table, served only while fresh and only under a still-present managed session whose live fetch failed — it is not a second source of truth, and server-checked operations (sync upload/restore, partner projections) never read it;
- the encrypted snapshot envelope on the sync transport is opaque to the server; new payload fields like `pregnancyTest` ride inside the same ciphertext and require no server schema awareness;
- legacy snapshots that predate a field continue to decode; the storage layer defaults missing values when restoring on a newer client;
- the doctor PDF is generated entirely on-device from canonical local repositories — the server never sees the PDF, only the encrypted day-log records that feed it.

## Partner Sharing Trust Boundary

Partner sharing is an Ovumcy Cloud feature. The trust model for the partner shared view:

- the owner builds a partner projection from canonical local profile, day-log, and symptom records, applying the chosen access level (summary or full) before encryption;
- the projection is encrypted on the owner device and uploaded to managed as an opaque ciphertext blob tied to a specific grant;
- the partner device decrypts the projection only after the grant is accepted; managed never holds the plaintext share;
- the partner experience stays read-only and free — the partner is a guest of the owner's subscription, not a separate billing subject;
- community sync may keep history continuity for the owner, but it must not become a transport or authority path for partner shared access;
- sharing requires the owner to hold the cloud/sync tier, because projections physically live on the managed cloud — an owner with only a local premium unlock cannot share. That is an honest line, not a bug;
- the invite link is a one-time handshake: accepting places a session and the decryption key on the guest device; after accept the link is dead, and the guest simply opens the app, pulls the fresh blob, and decrypts locally;
- the shared view is a live projection, not a snapshot: the owner device re-uploads an updated projection and the guest pulls it without a new accept; a monotonic `generation` counter carried inside the AEAD payload rejects rollback, and grants are durable;
- `access_level` (summary / full) is chosen by the owner at invite time and fixed per grant; a repeat accept never raises it;
- revocation stops the future, it does not erase the past: already-downloaded ciphertext stays readable on the guest device (see Revoke semantics and limits below), and the accept screen must say so honestly — UX copy, not crypto; final wording is an open product item;
- re-sharing with the same person after a revoke happens only through a fresh invite issued after the revoke — a new handshake and a new key; invites issued before the revoke never resurrect access.

### v1 invite-link flow — "press the link again"

v1 ships without seamless deferred deep-linking (decided out of scope). A partner who taps an invite link on a device without the app installed lands on the invite host's static fallback page, which says: install the app, then press the invite link again — an explicit screen, never an empty start screen or a silent dead end. The second press of the same link still redeems because an invite is consumed on accept, not on tap, and the 7-day invite TTL comfortably survives the install pause. Delivery hardening and the full fallback matrix live in `docs/deep-links.md` §5.

## Guest Partner Access

A partner can redeem an invite with **no prior Ovumcy Cloud account**. Opening the invite link on a device with no managed session offers a one-tap "Accept as guest" alongside the existing "sign in to accept" path (`SettingsPartnerAccessSection`, the `hasManagedSession` branch). The managed cloud (`PartnerService.AcceptInviteAsGuest`, `POST /auth/partner/invites/accept`, unauthenticated) atomically provisions a guest account and accepts the invite under it in one database transaction (`Store.ProvisionGuestPartnerAccount`): the account row, its sync entitlement, its session, and the accepted grant are all persisted together or not at all — a failure partway through can never leave an orphaned guest account.

A guest account has no password, no recovery code, and no real email. It is marked by a reserved, non-issuable address of the form `guest+<accountID>@guest.invalid` (`models.GuestPartnerEmail`). `.invalid` is the TLD RFC 2606 reserves specifically so it can never be registered or resolved by a real party, so the existing `accounts` table's `NOT NULL UNIQUE email` column alone distinctly marks a guest row — no new column, no migration. Both `PasswordHash` and `RecoveryCodeHash` are left empty, so no credential can ever authenticate the row (the same bcrypt-compare-against-empty-hash-always-fails behavior the rest of the account system already relies on). The session the guest device receives is stored in the same `sessions` table as every other login: a normal, individually server-revocable session bound to this device, not a special bearer-forever token. It is also short. A guest client that declares `refresh_supported` receives the same `ACCESS_SESSION_TTL` session plus the same rotating refresh token any other managed client gets, and the refresh row is written inside the very same provisioning transaction as the account. This matters more here than anywhere else in the product: the guest has no password to fall back on, so its session token is the only thing between a stranger and the owner's projection — and it is minted by tapping a link, the kind of secret that ends up in screenshots and forwarded messages. Shrinking its usable life from `SESSION_TTL` to `ACCESS_SESSION_TTL` is the point of issuing it that way.

Revoking a grant does not tear down the guest's refresh chain, just as it never tore down the guest's session. That is not a gap: every projection read re-checks the grant, so a revoked guest's renewals grant nothing, and the managed cloud's guest GC deletes the account outright once all its grants have been revoked past the grace period.

Every invariant that already governs partner sharing applies to a guest exactly as it does to a full account, because guest accept reuses the same invite row and the same gate as the logged-in accept path:

- **Single-use + 7-day TTL.** Guest accept reads and consumes the identical `PartnerInvite` row `AcceptInvite` does — `ExpiresAt`, `AcceptedAt`, and `RevokedAt`/`Status` are all checked before any account is created, so an expired, already-accepted, or revoked token fails exactly like it does for a logged-in accept, with the same error codes (`partner_invite_not_found`, `partner_invite_expired`, `invalid_partner_invite`).
- **Owner entitlement gated on every operation.** `ensurePartnerAccessAllowed(ctx, invite.OwnerAccountID)` runs before a guest account is ever created — a lapsed owner subscription blocks a guest redemption exactly like it blocks a logged-in one (`partner_access_unavailable`).
- **Access-level minimization and pregnancy-test stripping.** The grant's access level is fixed by the owner at invite-issue time and carried through unchanged; the projection a guest ends up reading goes through the same projection service as every other partner, so `summary` still collapses detailed fields and `full` still strips `pregnancyTest` at every level.
- **Owner visibility and permanent revoke are unchanged.** A guest's grant is a normal row in `owned.grants` — the owner's partner list shows it with the same last-seen tracking and the same revoke action as a full account; there is nothing about a guest grant the owner sees less of.

### The local side effect

The one thing guest accept does differently from a normal accept is the local storage precondition. Every other accept path (`connectSyncAccount`, `acceptManagedPartnerInvite`) assumes the device already ran "prepare local sync" and already has a `SyncSecretsRecord`. A partner who just tapped an invite link has never done that, so `persistGuestPartnerSession` (`src/sync/sync-client-service.ts`) generates one on the fly with the exact same generator normal setup uses (`createSyncSecretsRecord("", now)`) purely to satisfy the local storage contract. This is inert: the guest capabilities document is built with `syncEnabled` hardcoded to `false` (`buildManagedCapabilitiesDocument(false)`), never inferred from the server response — the guest-accept response carries no entitlement field to read one from in the first place, because the server issues every guest `SyncEntitlement.SyncAllowed = false` (`Source: "guest_partner"`). No sync upload is ever reachable from a guest session: `readPreparedSyncContext` rejects a `syncAllowed: false` session with `sync_not_allowed` before `runSyncUpload`/`runSyncRestore`/device management ever run — the same gate a suspended owner hits. On a device that already prepared local sync (or is already managed-connected), the existing call short-circuits: `persistGuestPartnerSession` only overwrites the auth-session fields on top of the existing record, so it can never regenerate keys out from under an already-set-up device.

Those auth-session fields are written unconditionally, nulls included. A guest that received refresh material gets it persisted so `ensureFreshManagedSession` renews the session with no guest-specific branch; a guest that did not gets the fields cleared, because refresh material left behind by a previous owner session on this device must never survive into a guest one — inheriting it would let the guest session mint sessions for somebody else's account. The `guestSessionRenewable` preference records which of the two happened, so the "save your access" nudge can withhold a countdown that would otherwise name a deadline the device slides past on every use. A guest with no renewal path keeps the accurate countdown it has always had.

Generating a `SyncSecretsRecord` internally wraps a freshly generated recovery phrase around the master key (the same `createRecoveryPhrase` + `wrapMasterKeyWithRecoveryPhrase` path prepare uses) — but the phrase itself is never returned, stored, or surfaced. `persistGuestPartnerSession` and `acceptBackupSyncPartnerInviteAsGuest` both discard it, and the guest-accept UI path never calls the screen's recovery-phrase reveal. **Guests never see a recovery phrase.**

That invariant has to hold outside guest accept too. Because guest accept leaves `hasStoredSyncSecrets` true, the backup-sync screen's local step ("Protect this device") would otherwise offer its normal "Create a new recovery phrase" / regenerate affordance to a guest exactly like it does to an owner — reachable through the same confirm-dialog + device-auth gate, and ending in a real, freshly generated phrase. `SettingsSyncSetupSection` hides that affordance for a guest session (`buildBackupSyncSetupPresentation`'s `shouldShowPrepareAction`, gated on `isGuestPartnerAccount`), and `prepareSyncSetup` (`src/sync/sync-setup-service.ts`) independently refuses to run for a guest session as a second gate at the boundary that actually mints the phrase, so a caller that bypassed the hidden UI control still cannot obtain one.

### Web

Guest sessions on web go through the existing session-only in-memory secret store (`platform-sync-secret-store.web.ts`'s module-level `Map`) — the same non-durable store every web sync secret already uses. Nothing new or guest-specific is added to browser storage; the guest session, like every other web sync session, ends when the tab closes.

### Threat-model delta

Guest accept changes the interception analysis in `docs/deep-links.md` §1.3: today, an attacker who intercepts an invite link can only redeem it if they *already hold a managed account* (§1.3, precondition b). Guest accept removes that precondition — an interceptor with no account at all can now redeem a captured token in one unauthenticated call. The compensating controls are unchanged and still bound the blast radius the same way §1.3 already documents: single-use + 7-day TTL, owner-entitlement gating, a minimized read-only projection, and owner visibility + revoke. What closes the gap is delivery-channel hardening, not token handling — once invite links are served over platform-verified HTTPS (Android App Links / iOS Universal Links, `docs/deep-links.md` §2–§3), the interception channel itself is closed and there is no link left to intercept.

**This is why guest accept must not be enabled in production before the #101 verified links are live** (`docs/deep-links.md` §7 step 5 — flipping `PARTNER_INVITE_BASE_URL` to the HTTPS host). Both the app-side flow (this document) and the managed endpoint ship on feature branches not yet merged (ovumcy-app #119, ovumcy-managed #68); the sequencing requirement is a release-order gate on top of that, not a runtime flag — guest accept must not reach production ahead of the deep-link migration's step 5.

### Recovery

A guest has no password and no recovery code by design, so a guest who loses the device or the session **cannot re-authenticate** — there is no credential to recover. The owner simply issues a new invite; re-inviting is a one-tap action identical to the first invite, and the old grant (now orphaned) stays visible to the owner until they revoke it.

## AEAD Envelope Discipline

Every AEAD encrypt/decrypt boundary in the app — local SQLite payloads, sync snapshot blobs, partner-share projections, recovery-phrase wrap — must thread context-specific associated data (AAD) into the auth tag. This prevents ciphertext blobs from being swapped between rows, devices, or grants without invalidating the tag.

- Local data uses `buildLocalDataAad(tableName, rowKey)` — both encrypt and decrypt sites construct identical context.
- Sync snapshots use `buildSyncPayloadAad(deviceID)`.
- Partner-share envelopes bind `(grantID, accessLevel, schemaVersion)` and additionally verify inner payload matches the envelope on those fields after decrypt.
- Recovery-phrase wrap binds `(phraseFingerprintHex, mnemonicWordCount)`.

The `payload-crypto.encryptPayload` / `decryptPayload` primitive requires AAD as a non-optional argument; passing `new Uint8Array(0)` is legal cryptographically but defeats the purpose, so helpers exist to force the choice at every call site.

## Local Data Key Lifecycle

When SecureStore returns a key that no longer authenticates the on-disk ciphertext (a manually restored or copied SQLite file — e.g. `adb pull`/`adb push`, a device-to-device file copy, or a stale emulator/CI snapshot — landing next to a freshly generated SecureStore key, or key truncation during migration), `resolveLocalDataKey` must canary-decrypt a singleton row before trusting the key. On auth-tag failure it wipes and reseeds with a fresh key, never returning the mismatched key to callers. This is the deterministic-reset behavior promised by the broader security invariants — the alternative (propagating the wrong key) bricks the app on every read.

## Partner-Share Token Floor

The managed cloud mints the partner-share invite token, and the owner derives the symmetric share key from it via HKDF. Without a client-side entropy floor, a compromised server could hand the owner a weak token (`"ab"`), derive the same key, and decrypt the supposedly opaque ciphertext. The client therefore enforces a minimum length (≥ 22 chars after trim) in `derivePartnerShareKeyHex` before accepting the token.

## Partner-Share Key Rotation

The invite-derived key `K_invite = HKDF(invite_token, info="ovumcy-partner-share-v1")` is *not* the key that actually encrypts uploaded projections. Both owner and partner rotate to a per-grant subkey immediately after accept:

```
K_grant = HKDF-SHA256(
  IKM   = K_invite,
  salt  = "ovumcy-partner-share-grant-v1",
  info  = "<grant.id>|<grant.ownerAccountID>|<grant.sourceInviteID>",
  L     = 32 bytes,
)
```

`K_invite` is discarded immediately after `K_grant` is derived — on the partner side it never touches persistent storage at all, and on the owner side it is removed from `pendingInviteKeysByInviteID` during the next `reconcileManagedPartnerShareKeys` turn that observes the accepted grant. A transient observer of the invite token (clipboard, share-sheet, OS recents, screenshot) therefore cannot decrypt any partner-share blob that the owner uploads after accept.

Three managed-cloud fields anchor the rotation context and MUST stay immutable per grant after first emission. The managed-cloud team treats them as key-binding:

- `grant.id` — unique stable identifier.
- `grant.ownerAccountID` — owner identity, never reassigned.
- `grant.sourceInviteID` — pointer back to the originating invite.

Mutating any of these for an existing grant breaks decryption on both sides — loudly, immediately, on the next upload or load. There is no silent path. This is intentional: the failure mode is "partner can't read the new projection, surfaces an error" rather than "different key silently produces garbage."

### Anti-replay on the owner

Once `K_grant` has been derived for an `inviteID → grantID` pair, the owner records `consumedInviteIDs[inviteID] = { grantID, consumedAtISO }`. A second `reconcileManagedPartnerShareKeys` turn that sees a different grant referencing the same `sourceInviteID` refuses to derive `K_grant` for it — only the first observed grant is ever keyed. This defends against a malicious managed cloud calling `acceptPartnerInvite(T)` twice for two partner accounts: the second grant ends up unkeyed locally, and any upload attempt fails with `share_key_unavailable`. The marker is kept for the lifetime of the partner-share secret store (cleared only by `clearPartnerShareSecrets`, which runs on disconnect / mode-switch / forced unauthorized clear); resetting it would re-enable the replay.

### Revoke semantics and limits

When the owner revokes a grant, the managed cloud stops accepting uploads and serving ciphertext, and the owner client drops `K_grant` plus `ownerGenerationByGrantID[grantID]` from local storage. Future uploads cannot re-encrypt under a stale key: the next upload sees no key and bails with `share_key_unavailable`.

What revoke cannot do: symmetric AEAD does not support post-hoc key revocation for ciphertext the partner has already downloaded. If the partner cached a projection before revoke, that ciphertext stays decryptable on the partner device — there is no cryptographic way to retract it without rolling out a new key the partner does not have. This is documented as a trust-boundary limit, not a bug; the UI surfaces the revoke as "no new updates will be visible," not as "all data deleted from the partner device."

Decision (2026-07-23): a revoke is permanent for the issued handshake — a repeat accept of the consumed invite, or any invite issued before the revoke, never resurrects access. Sharing with the same person again is legitimate and supported, but only through a fresh invite issued after the revoke: a new handshake deriving a new `K_grant`, with the old link and the old stored projection dead. Re-sharing the same pair via a fresh post-revoke invite is a supported scenario, not a revocation bypass.

## Managed Session Renewal

The app declares `refresh_supported` on every managed register, login, TOTP-challenge completion, and guest-partner invite accept. A managed cloud that understands the flag answers with a short-lived access session plus a refresh token; one that does not simply ignores it and returns the long-lived session as before, so the client works against either.

Both the access token and the refresh token are bearer secrets and live in secure storage beside the other sync material (`SyncSecretsRecord.managedAuthSessionToken` / `managedRefreshToken`), never in broad key-value storage, route params, or logs. The stamped access expiry is stored alongside them so renewal can happen before a request fails rather than after.

`ensureFreshManagedSession` (`src/sync/managed-session-refresh-service.ts`) is the only place that exchanges a refresh token. It renews when the access session is within five minutes of expiry, and it serializes: a refresh token is single-use and the server treats a second use of the same token as a leak — revoking the whole family — so concurrent screens share one in-flight exchange rather than racing. It is called from `loadManagedBillingSnapshot`, the read every premium surface funnels through, so one refresher keeps the stored token fresh for every other consumer.

Failure handling is deliberately asymmetric. A rejected refresh means the chain is dead and the credentials are cleared, because the server has already revoked the family and retrying is pointless. A network failure returns the existing token untouched: being offline must never look like being signed out. A guest-partner session goes through this same refresher with no special case — see Guest Partner Access above for why the short access session matters more there than anywhere else, and for what a guest that received no refresh material stores instead.

## Outbound Fetch Posture

`sync-api-client` and `managed-cloud-api-client` set `redirect: "error"` on every request. The sync API is strictly same-origin, so any 3xx is unambiguously suspicious; following a 307/308 to a different host re-sends the bearer session token because HTTP preserves method + headers on those status codes.

## TLS Pinning Posture

Decision (2026-07-23): the managed endpoint (Ovumcy Cloud) pins at the **Let's Encrypt CA level — the ISRG root public keys — never the leaf certificate**. This supersedes the 2026-07-20 deferral recorded below. That deferral was right about the risk it named and wrong only in its conclusion: what makes pinning fragile in this deployment is the *shape* of the pin, not pinning itself.

Unchanged by this decision, and still true: **nothing is wired**. The pure-TypeScript scaffolding (`src/security/cert-pin-store.ts`, `src/sync/cert-pin-policy.ts`, `src/sync/sync-endpoint-policy.ts`) is reachable from no runtime call site, `resolveManagedPinSet()` returns `null`, and the native enforcement layer is not a dependency of this project. Transport relies on platform CA-chain trust plus the outbound-fetch posture above, exactly as before. What this section adds is the pin set and the rotation rule, so that turning pinning on becomes a mechanical step taken deliberately before public production, rather than a design question answered under release pressure.

### Why not the leaf

Managed TLS terminates at Traefik with ACME (Let's Encrypt) auto-renewal, and ACME clients mint a **fresh key pair on every renewal** by default. The leaf Subject Public Key Info therefore changes roughly every 60 days, on a schedule the app release cycle does not control. A leaf pin shipped in a release stops matching at the first renewal after that release and breaks every installed copy until its user updates — precisely the failure the 2026-07-20 deferral described.

Pinning the issuing intermediate is no better. Let's Encrypt keeps four intermediates in active rotation and does not promise which one signs a given renewal, so an intermediate pin is a bet on a value the subscriber does not choose.

The root key is the only element of the chain that the deployment's renewal cadence cannot move. Roots live for decades, rotate on a generational timetable announced years ahead, and survive every leaf and intermediate rotation beneath them.

The price of that stability has to be stated plainly. A CA-level pin narrows the accepted issuers from every public CA in the platform trust store down to Let's Encrypt alone. It defeats the threat issue #145 names — a fraudulent but chain-valid certificate from *some other* CA. It does **not** defeat an adversary who can make Let's Encrypt itself issue for the pinned hostname, for example by hijacking DNS or BGP for the ACME challenge. A leaf pin would defeat that; a CA pin trades it away in exchange for surviving renewals. That trade is the decision.

### The pin set

A pin is the SHA-256 hash of a certificate's Subject Public Key Info, base64-encoded — 44 characters, the shape `sync-endpoint-policy` and `cert-pin-store` already validate. The pin follows the *key*, not the certificate, so a root and its cross-signed re-issuance share one pin.

| CA | Key | Pin (base64 SHA-256 of SPKI) | Certificate `notAfter` | Trust horizon published by Let's Encrypt |
| --- | --- | --- | --- | --- |
| ISRG Root X1 | RSA 4096 | `C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=` | 2035-06-04 | 2030-06-04 |
| ISRG Root X2 | ECDSA P-384 | `diGVwiVYbubAI3RW4hB9xU8e/CH2GnkuvVFZE8zmgzI=` | 2040-09-17 | 2035-09-04 |
| ISRG Root YE | ECDSA P-384 | `sCkq5UWXjg+7mKu9lMhhYF5bGLsy7VI/UNW3tccdR7w=` | 2045-09-02 | not yet in trust stores |
| ISRG Root YR | RSA 4096 | `fk6IOKit1ild5647BH06ujSIq5XbCgqlbYl6ANhhi88=` | 2045-09-02 | not yet in trust stores |

Four pins, not two, and the reason is the whole rotation strategy.

X1 backs the RSA chain and X2 the ECDSA chain. Either may serve the deployment — Traefik requests whichever key type the ACME client is configured for, and that setting can change without an app release — so both belong in the set regardless of what the server serves today.

YE and YR are the next root generation, self-signed 2025-09-03 and currently cross-signed by X2 and X1 respectively. They are not yet in platform trust stores, so today they appear in a served chain as intermediates and the chain still *validates* up to X1 or X2. As observed on 2026-07-23, the live default chains are:

```
EE ← Let's Encrypt YE2 ← ISRG Root YE ← ISRG Root X2     (ECDSA)
EE ← Let's Encrypt YR2 ← ISRG Root YR ← ISRG Root X1     (RSA)
```

Once YE and YR land in trust stores, path building terminates at them: the validated chain becomes `EE ← YE1 ← Root YE`, containing neither X1 nor X2. This is not a forecast — Let's Encrypt already publishes and serves that short chain, as `valid.ye.test-certs.letsencrypt.org` demonstrates today. A pin set holding only X1 and X2 would fail at that moment, on devices whose trust store updated ahead of the app: a slower repeat of the leaf-pin failure, and harder to anticipate because the trigger is a platform update rather than a renewal. Pinning all four covers both sides of the migration with no further release — today YE and YR match as chain members, afterwards they match as anchors, and X1/X2 keep covering devices whose trust store has not moved yet.

The pin set is bounded by the earliest horizon in it. X1 is the near one — Let's Encrypt states trust until 2030-06-04, ahead of the certificate's own 2035-06-04 expiry. That is the date by which the pin set must be revisited, not because anything breaks in 2030, but because after it X1 stops being a meaningful anchor and the set should be re-derived.

### How the pins were derived

Derived on 2026-07-23 from the certificates published at `letsencrypt.org/certs/`, never copied from memory or from a third-party pin list. Reproduce with:

```sh
curl -sO https://letsencrypt.org/certs/isrgrootx1.der
openssl x509 -inform der -in isrgrootx1.der -pubkey -noout \
  | openssl pkey -pubin -outform der \
  | openssl dgst -sha256 -binary \
  | openssl base64
# C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=
```

The other three use the same pipeline over `certs/isrg-root-x2.der`, `certs/gen-y/root-ye.der`, and `certs/gen-y/root-yr.der`.

Let's Encrypt publishes no pin values of its own to compare against, so each value was cross-checked against an independent copy of the same key rather than against a document:

- X1 and X2 — re-derived from the Mozilla NSS root bundle shipped with the local OpenSSL install. Both matched.
- X2 and YE — re-derived from the certificates served over a live TLS handshake to `letsencrypt.org`. Both matched, which also demonstrates the cross-signature property: the YE certificate on the wire is the X2-cross-signed one, and its pin equals the self-signed root's.
- YR — re-derived from the live chain of `valid.x1.test-certs.letsencrypt.org`. Matched.

No discrepancy was found. Any future re-derivation that disagrees with this table is a stop condition, not a value to reconcile by hand.

### Does a root pin actually get honored

It does, on both platforms, and this was checked rather than assumed — a root pin that the enforcement layer ignored would invalidate the whole strategy.

- **iOS (TrustKit)** compares each pin against every certificate in the trust object, iterating from the anchor down to the leaf and succeeding on the first match. A root pin matches at the anchor.
- **Android (OkHttp `CertificatePinner`)** iterates the cleaned chain and compares each certificate's SPKI hash against the pin set. Android's chain cleaner returns the validated chain with the trust anchor as its last element, so the root is in scope.

Two consequences follow from *validated* chain rather than *served* chain being what is matched. First, the pinned certificate does not need to be sent by the server — an anchor supplied by the device trust store still counts. Second, and less comfortably, a root that has dropped out of the validated chain cannot be matched even if the server still sends it, which is exactly the YE/YR migration case above and the reason all four pins ship together.

Two operational notes from the same libraries: TrustKit requires at least two pins per domain, which this set satisfies, and iOS caches TLS sessions, so a pin change may not take effect on a connection that already succeeded. Pinning behaviour must be tested from a cold start.

### What pinning buys, and what it does not

Pinning hardens the **session bearer token and connection metadata**. Those are what a CA-compromise adversary would otherwise obtain by MITM: the token grants managed-account access, and the metadata reveals device identifiers, blob sizes, and sync timing.

It does not change the confidentiality of health content, because that never depended on TLS. Health payloads are end-to-end encrypted with XChaCha20-Poly1305 under a device-local key before upload, so under a fully successful CA-compromise MITM they remain ciphertext. Pinning is a token- and metadata-hardening measure, not a medical-data measure — a claim to the contrary would overstate what the mechanism does.

Also out of reach of pinning: a compromised device, a hostile or breached managed server (it is the legitimate endpoint, not a MITM), and — as above — a certificate that Let's Encrypt itself is tricked into issuing for the pinned host.

### Operational constraints this creates

The pin becomes a standing constraint on infrastructure, and it points the wrong way round: **infrastructure must follow the app, not lead it.**

- Moving off Let's Encrypt breaks the pin. Putting Cloudflare or any CDN, WAF, or load balancer that terminates TLS in front of the managed host means the app sees that provider's certificate chain, signed by a different CA, matching no pin. Same for switching ACME provider. Any such change requires shipping an app release carrying the new pin set **first**, then waiting for adoption, and only then moving the infrastructure.
- Adding a managed hostname requires deciding its pin set at the same time; a host is either pinned deliberately or left unpinned deliberately.
- The generational root migration is already covered by shipping YE and YR now. The next one will not be, and needs the same treatment: add the incoming roots as backup pins in a release well ahead of the switch.

### Rollback

The lever is a release that empties the pin set — `resolveManagedPinSet()` back to `null` — which restores platform CA-chain trust.

Its limit has to be stated with it: rollback only reaches devices that install the new release. An install already refusing to connect stays broken until its user updates, and a remote kill switch cannot help, because fetching it would use the pinned connection that is broken. That asymmetry is why the pre-release checklist below matters more than the rollback does.

### Self-hosted: unchanged, still unwired, out of scope here

Nothing in this decision applies to community self-hosted sync. That path pins the operator's own certificate under the Trust On First Use model `cert-pin-store` implements — a leaf pin is the right shape there, since a self-hoster may use a private CA or a self-signed certificate, and no public root is a meaningful anchor.

Owner-entered pins remain unwired, and the work that path still needs is unchanged from the 2026-07-20 note: a setup-form input field, format validation on entry, a mismatch warning screen distinguishing operator-initiated rotation from active MITM, and copy across all six locales. Deliberately not in scope here. The threat model for self-hosted stays dominated by the operator's own infrastructure choices, which they already control.

### Implementation plan (not part of this change)

Recorded so the wiring is a checklist rather than a redesign:

1. **Native dependency.** `react-native-ssl-public-key-pinning` — TrustKit on iOS, OkHttp `CertificatePinner` on Android. Not in `package.json` today; adding it is a separate change.
2. **Prebuild / config plugin.** It is a native module, so it needs a prebuild and its registration belongs in a committed config plugin, alongside the existing Android network-security-config plugin under `plugins/`. It does **not** work in Expo Go; a development build or release build is required.
3. **Wiring.** Populate the managed pin constant in `sync-contract`, return it from `resolveManagedPinSet()`, register the pins before the first managed fetch, and keep `evaluateCertPin` as the JS-side defensive check so a registration regression cannot silently downgrade to unpinned.
4. **Verification is device-only.** Neither CI nor the web export can exercise this: the web target has no native pinning and stays on browser CA trust, and the pure policy tests cannot observe a real handshake. Verification means a real device or dev build, from a cold TLS session, against the live endpoint.
5. **Timing.** Immediately before public production, once the managed host actually serves an ACME certificate. As of 2026-07-23 `sync.ovumcy.cloud` and `invite.ovumcy.cloud` answer with Traefik's built-in default self-signed certificate, so no live chain exists yet to validate the pin set against.

### Pre-release checklist

Run before shipping the release that enables pinning, not after:

- [ ] Re-derive all four pins from `letsencrypt.org` with the command above; do not copy them out of this table. Stop if any value differs from what is recorded here.
- [ ] For every pinned host, capture the live chain — `openssl s_client -connect <host>:443 -servername <host> -showcerts` — hash each certificate's SPKI, and confirm at least one is in the pin set.
- [ ] Confirm the chain still terminates in an ISRG root and that no CDN, WAF, or proxy has been placed in front of the host.
- [ ] Check both key types if the ACME configuration can produce either, since the chain differs between them.
- [ ] Confirm at least two pins per host are registered (TrustKit refuses fewer).
- [ ] On a real device or dev build, from a cold start: a good chain connects, and a deliberately wrong pin set produces a refused connect with the mismatch warning — never a crash, never a silent fallback to unpinned.
- [ ] Confirm the release notes state that sync requires this app version onward, since older installs are unaffected but a later infrastructure change will not be able to reach them.

### The superseded 2026-07-20 deferral, kept for context

Pinning was deferred on 2026-07-20 for operational reasons: a leaf pin would have required every certificate rotation to be preceded by a release adding the next pin and followed by one dropping the old, and against a ~60-day renewal cadence the first missed window bricks every install that has not updated. That reasoning stands. It argued against *leaf* pinning, which is why the pin moved up the chain to the roots instead of the posture staying at platform CA trust.

## Pending Partner Invite Buffer

The `pendingManagedPartnerInviteToken` module-level state must clear on every session boundary that invalidates the prior owner context: explicit disconnect, mode-switch, and forced unauthorized-session clear. Clearing only on successful accept lets the token outlive disconnect and risks redeeming it under a different managed account on the same device.

## Export Artifact Cleanup

Recovery-phrase, cycle CSV/JSON, and doctor-PDF exports write a temporary file under `Paths.cache` and remove it in a `try/finally` after the OS share-sheet returns. Because a JS-process kill mid-share bypasses `finally`, the root layout runs a startup sweep of `Paths.cache` matching the `ovumcy-export-*` and `ovumcy-private-export-*` prefixes. Recovery-phrase artifact body must contain only the phrase bytes — never a self-labeling header — because OS share-sheet recents and receiving-app caches preserve content independently of our cleanup.

## Confirm-Dialog as Destructive Gate

The in-app `ConfirmDialogProvider` is the only UI barrier before destructive privacy actions (delete day-log, revoke partner grant, disconnect sync, restore from cloud, regenerate sync keys, discard unsaved drafts). When a confirmation is already pending, a concurrent `requestConfirmation` must NOT auto-resolve the first to `false`: the unsaved-changes callers treat `false` as "discard", and auto-resolution on race silently destroys user state. Instead the second concurrent caller is dropped: its promise never resolves and no second dialog is queued, leaving the first (visible) dialog to resolve normally.
