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

Replacing the wrapped recovery-key package stored on a community server (for example after *Set up sync on this device* made a new phrase) re-authenticates the account: the request carries the current password, plus a current TOTP code when two-factor is on, in its body. Re-sending the package already stored needs neither. Registering a new account sends the password typed at connect, since a fresh account has no backup to lose. A login puts no package at all: the stored one may guard an existing backup, so its replacement waits for the next upload, which first asks before overwriting that backup and then asks for the password (and code) in a prompt whose values live only in that prompt's screen state and the one request — never stored, logged, or put in a URL. A sign-in that went through a TOTP challenge likewise puts no package and leaves the replacement to that prompt. An upload whose capabilities request fails stops before any write, so a blob under a new key never lands beside the old package. Managed sessions are exempt server-side, and the app never sends the step-up to a managed sync host. That host refuses a *different* package for a managed account (`403 managed_recovery_key_overwrite`), so an upload from a device that still holds a package the account has rotated away from stops before the blob and tells the owner to finish the change or sign in again with the new phrase.

On a connected managed account the recovery phrase is changed only through Ovumcy Cloud (`PUT /account/recovery-key`), never by regenerating local keys: a fresh master key would leave the backup under a key no stored package opens. The rotation is offered only once the device has a rollback floor — proof that its local key wrote or opened this account's backup. A device signed in without phrase recovery has none, so it never replaces the account's package; its recovery action stays local, and the managed sync host still refuses the different package on upload. After the confirm, the device-auth gate and a current Ovumcy Cloud data-sharing consent (the package leaves the device, so the consent dialog is shown when none is stored, and a decline sends nothing), the app generates a new phrase, wraps the **same** master key under it, and shows that phrase first: it stays inactive until Ovumcy Cloud confirms the change, and the submit is enabled only once the user acknowledges writing it down. Only then, with the consent checked again, is the package sent with the current password (plus a current TOTP code when two-factor is on); a request never carries a phrase the user was not shown, and a retry carries the same one. Only after a 200 does the device store the new package and reveal the phrase again. A 503 `sync_not_configured` replaced nothing and says so; a 404 that made the app provision the sync account spent the code, so the card asks for a new one. A 502 `sync_bridge_unavailable` — or no answer — may mean the replacement already landed, so the device keeps its old package and the pending package lives in process memory only (never persisted) until a retry resends exactly it with a fresh code. No session is revoked; other devices keep syncing. A concurrent rotation does not overwrite: every request names the fingerprint of the package this device holds, and the sync server replaces only while it still stores that package. The device that lost the race gets `409 recovery_key_conflict` with nothing written; it drops the shown phrase, keeps its old package, and tells the user to use the phrase from that change (made on another device, or by an earlier change here whose confirmation was lost), or to sign back in with it before changing it here. The same package re-sent is still accepted, so the retry above holds. Only right after the app provisioned the sync account, when no package is stored yet, is the fingerprint left out. A sync server without this check refuses the field (`400 invalid_recovery_package`), so it must be deployed before an app build that sends it.

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

Recovery phrases are shown only when the app prepares or recreates local sync keys, after Ovumcy Cloud confirmed a managed phrase change, or after a sign-in to another account replaced the sync key.

A sync key serves one account. When the device signs in to an account other than the one its key was last used with, it creates a new master key, recovery phrase and device identity before it attaches the device or stores a recovery package, so the new account never receives the previous account's key, package or device id. A key that is bound to no account yet — set up while signed out, or written before the binding existed — is kept, and so is the key on a recovery (it adopts the account's own key) and on a guest accept. The new phrase stays in process memory and is shown only after an explicit confirm and device authentication; dismissing either keeps the offer. If the app is closed before the phrase is acknowledged, the phrase is gone, but a non-secret marker stored with the new key makes the screen offer a new phrase through the regular confirm-and-device-auth path instead.

The new-phone flow is: install → sign in → enter the recovery phrase to restore the key → download the blob → decrypt on the device. The recovered device gets a fresh device id, and the snapshot AAD does not bind a device id, so it opens a blob any other device uploaded. The server participates only as blob storage; it never sees the phrase or the restored key.

If an owner loses every device and also loses the recovery phrase, encrypted sync data cannot be recovered.

This is a privacy tradeoff, not a support bug: the server is not supposed to know enough to recover the health payload by itself.

A self-hosted server that reports `atomic_rekey: true` receives a new or replaced recovery-key package together with the blob in one `PUT /sync/rekey`: both land or neither does, so a refused upload leaves the stored package and backup as they were. On an older server the upload writes the package first and puts the previous one back when the server refuses the blob outright (a 4xx such as a stale generation, an oversized blob or a lost session). After a network failure or a 5xx the blob may have landed, so the new package stays and a retry heals it. A TOTP step-up code is single-use, so on a 2FA account the put-back is refused and the gap stays on such a server.

On Ovumcy Cloud the recovery action changes the phrase only once the device holds a rollback floor for the account. Before the first upload or restore it is disabled with a hint, because a new local key would be refused by the managed sync host. A successful guest-account upgrade binds the device to the upgraded account like a sign-in: a key last used with another account is replaced and its new phrase goes through the same gated reveal.

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
  identities (**target**), and password accounts that sign in with a
  server-generated Account ID are separate `sub` classes and never merge implicitly. The only
  account-class transition is the explicit guest→full upgrade path, which
  preserves the account id and grants.

### The three storefront doors

Decision (2026-07-23): the paid offer is three doors, each answering a different
need and each backed by its own trust anchor. There is deliberately no
subscription-without-sync SKU (sync adds ~0 marginal cost to the subscription) and
no expensive lifetime tier.

| Door | Grants | Account | Trust anchor |
| --- | --- | --- | --- |
| **Free** | Core tracking, predictions, stats, local CSV/JSON export | none | none — data lives only on the device and dies with it |
| **One-time pregnancy-module unlock** (store non-consumable `pregnancy_module`; implemented for Google Play, App Store is **target**) | The pregnancy / postpartum / check-in module only — no premium feature, no sync, no account, no server round-trip | none | The store's own purchase record read on-device (Play Billing first, StoreKit 2 later); restored through the store account |
| **Monthly + yearly subscription** (`ovumcy_cloud`, base plans `monthly` / `yearly`; the store purchase is **target**) | Premium features + sync included | none to pay — the purchase may precede the account; premium turns on only after sign-in or registration, and enabling sync stays a separate choice | Managed billing snapshot under a managed session (the shipped premium authority) |

Door rules:

- The one-time unlock is positioned as "unlock the module", not "forever": it
  lives as long as the installed app plus the store account's restore path, and
  is priced below the yearly subscription (exact price points are an open
  product item, not code). It unlocks no premium feature, and the subscription
  neither grants nor revokes it.
- The subscription includes sync because sync's marginal cost is ~0. Premium
  features come only from the subscription, and its entitlement is read under a
  managed session: paying needs no account, turning premium on does.
- The pregnancy module is not welded to an account: the one-time door must work
  with no account at all. Signed EdDSA entitlement tokens (the
  implemented-but-dormant overlay documented in `SECURITY.md`) back **only
  portable / gifted premium grants** — they are not the primary premium path,
  and the signing key is not activated yet, so no production token verifies
  today.
- Store-native mechanics stay store-native: discounts, intro pricing and the
  free trial (a store intro offer, enforced once per store account by the
  store), month→year upsell, renewal, cancellation, refunds. The app never
  implements billing logic; app-side involvement is launching the store's
  purchase sheet, handing the result over, and UI hints.
- Server-to-server store notifications are in scope for the subscription
  (**target**): Google Play Real-time Developer Notifications reach the managed
  cloud and only prompt it to re-read the purchase from Google — a notification
  is never itself the access truth, and the app receives none. The one-time
  door has no server at all: its access truth is the store's record on the
  device.
- The self-hosted Community Sync tier is unchanged and outside the storefront:
  bring-your-own-server, no store SKU, orthogonal to these doors.

Current state vs target: today every premium surface reads the managed billing
snapshot, the token overlay is dormant (`SECURITY.md`, Accepted Residual
Risks), and nothing in the app can buy the subscription: the plan choice and
the store purchase are built but switched off until the managed cloud can take
the purchase over (see the subscription door below). The one-time door is
implemented for Google Play (`src/billing`, `pregnancy-purchase-service`, the
`/pregnancy-unlock` screen; claims pinned in `SECURITY.md`); on iOS and web no
store is wired, so the module stays locked and its lock card informational. The subscription flow
below is the target work this section models ahead of implementation. The
device-anchored `sub` class stays a target of its own; neither purchase flow
depends on it.

### Purchase flows (one-time door implemented, subscription door partly built and switched off)

Both products are bought through the platform store, Google Play first. The
store library is imported in exactly one adapter under `src/billing`; services
and screens see a transport-free contract, and that contract has no consume
operation at all.

**One-time door — `pregnancy_module`, decided on the device.**

- The module is owned only while the store reports a purchase of
  `pregnancy_module` in the purchased state. A pending purchase, another
  product, a subscription, or any error reading the store all resolve to not
  owned (fail-closed, as `loadPregnancyModuleOwned` already is).
- The app acknowledges the purchase — an unacknowledged Play purchase is
  refunded by Google after three days — and never consumes it. The
  acknowledgment an owned purchase still owes is started on every read of the
  store, never awaited.
- The store is asked only from the pregnancy surfaces, never by the launch
  tasks. The dashboard is one of them while a positive test is logged and no
  pregnancy record exists, so for that user it is asked on every dashboard
  load. Starting its billing client also starts the store vendor's own diagnostics,
  the one accepted exception to the no-telemetry posture (`SECURITY.md`,
  `docs/privacy.md`).
- Ownership is not written to app storage: the store's own cache answers
  offline, and "Restore purchases" re-reads it. The app verifies no receipt
  signature and sends the purchase nowhere; this is a UX control over the
  user's own device, not DRM.
- The source imports nothing from managed billing, a sync session, or the
  billing snapshot. A refunded or revoked purchase locks only the entry of new
  pregnancy data; data already logged stays readable and exportable.
- A locked surface points at the one-time purchase screen, never at the
  subscription screen.

**Subscription door — `ovumcy_cloud`, decided by the managed cloud.**

- The app launches the store purchase for a server-described offer only when
  its product and base plan are on the app's own allowlist; any other offer is
  dropped.
- The purchase token goes to the managed cloud under the managed session:
  `POST /account/billing/play/purchases` with the product id and the token.
  The base plan and the period are read from Google by the server, never taken
  from the client. The answer is the billing snapshot, and premium turns on
  only from that snapshot. A local purchase record never unlocks a premium
  surface and never writes the offline-grace cache.
- The app never acknowledges a subscription. The managed cloud acknowledges it
  after the entitlement is recorded, so a purchase that never reaches an
  account is refunded by Google on its own.
- The purchase token is never written to app storage, logged, or carried in a
  route parameter or URL. The retry queue is the store itself: at launch, at
  sign-in, and on a manual plan check the app re-reads unacknowledged purchases
  and hands them over again; the handoff is idempotent by token.
- Paying before an account exists is allowed. The step after payment asks the
  user to create an account or sign in; premium stays off until the handoff
  succeeds under that session. A token binds to the first account that presents
  it, and the same token from another account is refused.
- When a session already exists at purchase time, the app passes the store an
  opaque per-account reference issued by the managed cloud. It is never the
  login or the internal account id, and the app never derives it.
- A handoff the server refuses or that cannot reach it grants nothing: a
  purchase alone never turns premium on. The bounded offline-grace cache
  (`SECURITY.md`) is unchanged and is filled only from a billing snapshot.
- "Manage subscription" opens the store's own subscription page; it is not an
  external checkout.

Plan choice and the store purchase (built, switched off):

- The plan step offers only the base plans `monthly` and `yearly` of
  `ovumcy_cloud` that the store itself returns; any other base plan is dropped,
  and a plan the store does not return is not offered. Each plan shows the
  store's formatted recurring price verbatim — no amount is written in the app —
  and a free-trial note only when the store returned a free-trial offer for this
  store account (the store decides eligibility).
- The adapter picks the offer: the free-trial offer when the store returned one
  for that base plan, otherwise the base plan itself. Offers are re-read from
  the store at purchase time, and the offer token stays inside the adapter like
  the purchase token.
- A completed purchase sheet grants nothing on the device: the app re-reads the
  billing snapshot and premium follows only that answer.
- The whole affordance stays off (`CLOUD_SUBSCRIPTION_PURCHASE_ENABLED`) until
  the handoff endpoint above exists; while it is off the plan step never contacts
  the store. Turning it on is a change of its own: the handoff, the opaque
  per-account reference, and the in-app privacy notice naming the plan step as a
  store contact point land with it.

### Out of scope in v1 (decided)

- Browser/web client for sync and partner sharing (in-browser decryption is a
  separate future feature).
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

Ovumcy Cloud premium gates (advanced fertility, advanced insights, extended reports, doctor PDF, partner sharing) read from the managed billing snapshot, not from the sync transport. Device reminder notifications are free-tier, delivered on-device only, and read no billing state at all — the managed cloud runs no reminder delivery channel, so reminders are not among those gates and no surface treats them as one. The billing snapshot may still carry a `reminders` flag; the client parses it and acts on nothing.

What this means in practice:

- premium feature flags arrive over an authenticated managed cloud channel and are never persisted to broad key/value storage on the device;
- the app persists a bounded 72-hour offline-grace cache of the last-known-good billing snapshot (`hasActivePlan` + `premiumFeatures` only) in the encrypted `managed_billing_cache` table, served only while fresh, only under a still-present managed session whose live fetch failed at the transport level (no response, a request past the 30-second request timeout, or temporary server unavailability; an explicit refusal yields no cached premium, and a server fault (500) is a live answer, not an offline failure: no grace, and a cached entitlement token is discarded; a refusal about the session or the plan discards the cached snapshot) — it is not a second source of truth, and server-checked operations (sync upload/restore, partner projections, the plan status that gates them) never read it. A billing answer whose managed session changed while the fetch was in flight (refresh rotation, sign-out, account switch) is never cached or returned — billing is re-read once under the current session — and a device clock found more than a ten-minute allowance behind the last instant the cache was served voids the cache instead of reopening the window;
- the signed entitlement token, once verified, is authoritative for the two purely-local features even when its entitlement list is empty (a lapsed plan re-locks them); only an absent or unverifiable token falls back to the billing snapshot, a refused token mint discards the cached token, and the end of a managed session (disconnect, or the unauthorized sign-out) clears it before the session secrets (a mint still in flight at that moment never writes its token back); every new managed session resets the billing cache before it is stored and again after, so the previous session's snapshot never serves the new session's grace;
- the encrypted snapshot envelope on the sync transport is opaque to the server; new payload fields like `pregnancyTest` ride inside the same ciphertext and require no server schema awareness;
- legacy snapshots that predate a field continue to decode; the storage layer defaults missing values when restoring on a newer client;
- the doctor PDF is generated entirely on-device from canonical local repositories — the server never sees the PDF, only the encrypted day-log records that feed it;
- upload and restore on Ovumcy Cloud follow the server's `sync_allowed` answer alone, never the billing plan status: they stay locked while that answer is false or has not loaded (fail closed), even under an active plan, and unlock when it is true without one. The no-plan copy appears only when the billing snapshot reports no active plan; an active plan whose server refuses sync is told sync is not included in it.

## Partner Sharing Trust Boundary

Partner sharing is an Ovumcy Cloud feature. The trust model for the partner shared view:

- the owner builds a partner projection from canonical local profile, day-log, and symptom records, applying the chosen access level (summary or full) before encryption; the level the owner chose is pinned on the owner device with the invite key, and the projection is built at the stricter of that level and the one the server lists, so the server can narrow but never widen it (a key record with no pinned level builds as summary);
- the projection is encrypted on the owner device and uploaded to managed as an opaque ciphertext blob tied to a specific grant;
- the partner device decrypts the projection only after the grant is accepted; managed never holds the plaintext share, nor enough material to derive the share key (see Partner-Share Invite Secret below);
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

A partner can redeem an invite with **no prior Ovumcy Cloud account**. Opening the invite link on a device with no managed session offers a one-tap "Accept as guest" alongside the existing "sign in to accept" path (`SettingsPartnerAccessSection`, the `hasManagedSession` branch). The web build does not offer guest accept: web keeps sync secrets in memory only, so a reload after a guest accept would drop the guest session, refresh token and grant key while the single-use invite is already spent. On web the card asks to open the invite in the Ovumcy app instead and leaves the invite unredeemed; a signed-in accept on web is unchanged. The managed cloud (`PartnerService.AcceptInviteAsGuest`, `POST /auth/partner/invites/accept`, unauthenticated) atomically provisions a guest account and accepts the invite under it in one database transaction (`Store.ProvisionGuestPartnerAccount`): the account row, its sync entitlement, its session, and the accepted grant are all persisted together or not at all — a failure partway through can never leave an orphaned guest account.

A guest account has no password, no recovery code, and no Account ID to sign in with. It is marked by a reserved login of the form `guest:<accountID>` (`models.GuestPartnerLogin`). A generated Account ID is 16 hex characters and never holds a colon, and the server looks a sign-in up only after it validates as 16 hex characters, so the `accounts` table's `NOT NULL UNIQUE login` column alone distinctly marks a guest row, with no extra column. The managed cloud reports a guest's `login` as an empty string. Upgrading a guest (`POST /account/upgrade`) takes only a password; the server generates the Account ID and returns it once with the recovery code, and the app shows both in one reveal. Both `PasswordHash` and `RecoveryCodeHash` are left empty, so no credential can ever authenticate the row (the same bcrypt-compare-against-empty-hash-always-fails behavior the rest of the account system already relies on). The session the guest device receives is stored in the same `sessions` table as every other login: a normal, individually server-revocable session bound to this device, not a special bearer-forever token. It is also short. A guest client that declares `refresh_supported` receives the same `ACCESS_SESSION_TTL` session plus the same rotating refresh token any other managed client gets, and the refresh row is written inside the very same provisioning transaction as the account. This matters more here than anywhere else in the product: the guest has no password to fall back on, so its session token is the only thing between a stranger and the owner's projection — and it is minted by tapping a link, the kind of secret that ends up in screenshots and forwarded messages. Shrinking its usable life from `SESSION_TTL` to `ACCESS_SESSION_TTL` is the point of issuing it that way.

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

Every AEAD encrypt/decrypt boundary in the app — local SQLite payloads, sync snapshot blobs, partner-share projections, recovery-phrase wrap — must thread context-specific associated data (AAD) into the auth tag. This prevents ciphertext blobs from being swapped between rows, envelope formats, or grants without invalidating the tag. Sync snapshots are deliberately not bound to a device: every device of the account holds the same sync key, and a recovered device must open another device's upload.

- Local data uses `buildLocalDataAad(tableName, rowKey)` — both encrypt and decrypt sites construct identical context.
- Sync snapshots use `buildSyncPayloadAad(schemaVersion, generation)` (`ovumcy-sync-v3|<schemaVersion>|<generation>`, no device id, so any device holding the account key opens them; the generation is what makes restore freshness checkable — see *Restore Freshness* below). Restore falls back to the v2 AAD (`ovumcy-sync-v2|<schemaVersion>`) and then to the legacy device-bound v1 AAD built from the local device id, which opens only blobs this device wrote before; neither fallback carries a sealed generation, and the next upload writes v3.
- Partner-share envelopes bind `(grantID, accessLevel, schemaVersion)` and additionally verify inner payload matches the envelope on those fields after decrypt.
- Recovery-phrase wrap binds `(phraseFingerprintHex, mnemonicWordCount)`.

The `payload-crypto.encryptPayload` / `decryptPayload` primitive requires AAD as a non-optional argument; passing `new Uint8Array(0)` is legal cryptographically but defeats the purpose, so helpers exist to force the choice at every call site.

## Restore Freshness

The server keeps one snapshot blob per account. Authenticating the blob proves the account key sealed it, not that it is the newest one: a server could serve an older genuine blob and roll a device's data back. Two mechanisms bound that.

- **The generation is sealed.** An upload seals the snapshot under `ovumcy-sync-v3|<schemaVersion>|<generation>`, where `generation` is the number it sends with the blob (`ovumcy-sync-community` stores it verbatim and accepts only a positive one that is strictly greater than the stored one and no more than its clock-skew allowance ahead of the server's clock). Restore opens the blob with the generation the server reports, so a server reporting any other number than the sealed one fails the auth tag; a generation that is not a non-negative safe integer is refused before decryption.
- **Each device keeps a floor.** `lastRemoteGeneration` is the highest generation this device has itself uploaded or restored. An upload stores the generation it sent, never the server's echo; a restore of a v3 blob stores the larger of the floor and the sealed generation, so the floor never moves down, and it is stored only after every restored record is written — a restore that fails partway leaves the floor where it was. A v2/v1 blob's generation is server-chosen, so it never moves an existing floor, and on a device with none it is capped at the current time — a forged value cannot push the next upload's generation past what the server accepts. An upload whose next generation (one above the floor) would not be a safe integer stops with `stale_generation` before anything is sent. A restore whose verified generation is below the floor, or whose envelope is a v2/v1 one (no sealed generation) on a device that already has a floor, stops at a second confirm saying the backup may be older than what this device last synced. Dismissing it cancels the restore with local data untouched; accepting it is the deliberate older restore — for example after a self-hosted operator restored their server from its own backup.
- **The floor belongs to one account.** The sync preferences record keeps the account the floor was raised under (`accountId`, inside the encrypted payload). Every connect, sign-in finished after a TOTP challenge and recovery records the account it signed in to; a guest accept resets the floor and keeps the account of the key it keeps. A sign-in to a different account, or to one whose id the device cannot learn, resets the floor and `lastSyncedAt`, so the first upload runs the fresh-install probe and asks before it overwrites that account's backup — signing out of one account and into another on the same server can no longer skip that confirm. A sign-in to the same account keeps the floor, and a disconnect keeps the recorded account so the next sign-in is compared against it. A record written before the field existed reads as unbound, so its next sign-in starts the floor over once.
- **A partial restore blocks uploads.** The write that puts the old floor back right after the wipe also sets `restoreInProgress` on the sync preferences record, and only the restore's final preferences write clears it. While it is set, an upload stops with `sync_not_prepared` before any network call — the screen says the last restore did not finish — so a restore that stopped partway can never let its incomplete local data replace the backup. The upload reads the stored flag, not the caller's in-memory copy, and an ordinary preferences write keeps the stored value; restore stays allowed, so a retry finishes the job. A record written before the field existed reads as `false`. Two other events clear it, because after them the old restore can never finish. One is a new sync key: preparing sync again, or a settings change that clears the sync secrets. That device has no floor, so the fresh-install probe asks before an upload replaces an existing backup. The other is a restore that finds no backup on the server, which leaves nothing to protect. The local data wipes (destructive reset, key-mismatch reset) clear it along with everything else. A sign-in, recovery or guest upgrade to a known account other than the stored one clears it, since the mark protected the other account's backup. One to the same account, or to an account whose id is unknown, keeps it: the restore can still be retried.
- **A wipe supersedes a sync call in flight.** Clear local data and account deletion advance a process-wide wipe epoch before and after their secure-store clears; Clear local data also advances it before its database reset. Connect, TOTP finalize, recovery, guest accept, guest upgrade, upload and restore capture it at their start and, if it moved by the time the network answers, stop (`sync_not_prepared`; a guest upgrade reports an ended session) and write nothing, so a late response can never put the pre-wipe key, session or preferences back, nor restore a backup into the wiped database.
- **An upload never overwrites a backup it has not seen.** The blob PUT carries `expected_generation`: the floor, or on a never-synced device the generation the fresh-install probe read (nothing when the server holds no blob). The server commits only while that is still the stored generation. On `409 stale_generation` the upload reads the stored blob: if it is this attempt's own blob (same generation and checksum), the write landed and its reply was lost; if it is the blob this device last synced (same server `updated_at` as `lastSyncedAt`, as after a confirmed older restore) under a lower generation, the upload retries once against it; anything else came from another device, and the upload stops with `remote_backup_changed` so the owner restores it first. If that read fails, the upload reports the read failure, since the remote state is unknown. A network failure or 5xx on the PUT is reconciled the same way, so a lost reply is adopted instead of being retried into a 409. A server that predates the field answers `400 invalid_json`; the upload retries once without it, with today's last-writer-wins semantics on that server.

Limits:

- A device with no floor — a fresh install, one just recovered or set up again, one signed in to another account, or one whose saved sync mode or endpoint changed while it held sync secrets, all of which reset it — has nothing to compare and accepts any genuine blob.
- The floor only covers what this device has seen. A device that never saw a later upload from another device cannot tell that it exists, so the server can still hand it that device's older blob down to its own floor.
- The floor lives in the local sync preferences row. An attacker who can write the app's database is outside this boundary.
- A build older than the v3 envelope cannot open a v3 blob, so every device of an account needs a build with the v3 reader. Reverting to such a build leaves v3 blobs unreadable on it until some device uploads again.

## Local Data Key Lifecycle

When SecureStore returns a key that no longer authenticates the on-disk ciphertext (a manually restored or copied SQLite file — e.g. `adb pull`/`adb push`, a device-to-device file copy, or a stale emulator/CI snapshot — landing next to a freshly generated SecureStore key, or key truncation during migration), `resolveLocalDataKey` must canary-decrypt a singleton row before trusting the key. On auth-tag failure it wipes and reseeds with a fresh key, never returning the mismatched key to callers. This is the deterministic-reset behavior promised by the broader security invariants — the alternative (propagating the wrong key) bricks the app on every read.

## Partner-Share Invite Secret

The managed cloud mints the invite token and stores it to redeem the invite, and it knows every grant context field below. A share key derived from the token alone is therefore derivable by the server — anyone holding the managed database could decrypt every partner projection. The share key is instead rooted in a client-only invite secret `S`:

- the owner device generates `S` (32 bytes from the platform CSPRNG) when the invite is issued and appends it to the server's invite URL as the fragment `#k=<64 lowercase hex>`; the shared link is `…/backup-sync?invite_token=<T>#k=<S>`. The server chooses that URL, so the owner appends `S` only when it sits on the verified link base `https://invite.ovumcy.cloud/backup-sync` (a custom scheme is claimable by any installed app, so it is refused outbound) and refuses the invite otherwise — a server-chosen host would otherwise serve the page that reads the fragment;
- a URL fragment is never part of an HTTP request, so `S` never reaches the managed cloud or the invite host through a request, and the client never sends it in any API call — accept posts only `invite_token`;
- the partner device reads `S` from the link fragment alongside the token, holds both in the pending-invite buffer under one TTL and one clear, and scrubs both from route state (and, on web, from the address bar and history entry);
- a link without a well-formed `k` (missing, not 64 hex chars) is refused as `invalid_partner_invite`; there is no fallback to a token-only key, so a stripped fragment cannot silently downgrade the share to a server-derivable key.

```
K_invite = HKDF-SHA256(
  IKM   = S,
  salt  = "ovumcy-partner-share-v2",
  info  = "ovumcy-partner-share-v2|<invite_token>",
  L     = 32 bytes,
)
```

Binding the token into `info` ties `S` to its invite. The token still has to meet the client-side length floor (≥ 22 chars after trim) because it remains the redemption credential, but confidentiality no longer rests on its entropy.

Residual trust: `S` is exactly as exposed as the link itself — clipboard, the messenger the owner pastes it into, OS share-sheet recents, a screenshot. In process memory the pending-invite buffer holds it under the token's TTL, but the raw link that opened the app (`useLinkingURL`, the OS-provided linking URL) keeps it for the process lifetime, as it always kept the token. And when the partner opens the link without the app installed, the pinned invite host serves the fallback page; that page is static and reads nothing, but a compromised host that served script instead could read `location.hash`. Closing that would need `S` on a channel separate from the link, which v1 does not do.

No key from the previous token-only derivation survives: the partner-share secret store moved to a new SecureStore entry (`ovumcy.partner-share-secrets-v2`), and the retired entry is never read — it is deleted on the store's first access and by every clear. Pairs keyed before the change (pre-release builds only) lose their keys and re-invite.

## Partner-Share Key Rotation

The invite-derived key `K_invite` (see Partner-Share Invite Secret above) is *not* the key that actually encrypts uploaded projections. Both owner and partner rotate to a per-grant subkey immediately after accept:

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

### Key context on upload

The projection PUT carries `source_invite_id`, and the managed cloud stores the ciphertext only while the grant still has that key context (MNG-29). The owner sends the `sourceInviteID` kept in the same secure-store record as the `K_grant` that encrypted the ciphertext, read once with the key — never re-read from the grant listing at send time. Before encrypting, the owner compares it with the listed grant's `sourceInviteID`: a mismatch (the grant was re-shared after this device derived its key) or a listed grant with none (a legacy grant from before the field existed) ends the upload as `partner_grant_rekeyed` with no request, and the server answers the same `409 partner_grant_rekeyed` for any push that races a re-share. A guessed context is never sent. Both cases are repaired only by revoking the grant and inviting again, so the push loop skips them before reserving a generation and the owner's grant list shows a re-share prompt on them; a race answered with the 409 is flagged on the next listing, which then shows the new context. A grant this device holds no key for is not flagged — it may be keyed on another owner device. The partner's shared-grant list shows an ask-the-owner-to-re-invite hint for a live grant listed with no `source_invite_id`, read from the listing the partner already receives and nothing more. When the owner re-shares under the same grant id from the device holding the new invite's key, reconcile replaces the key derived under the earlier invite (the owner's generation counter continues); the partner's shared view of a grant listed under a newer invite than its key answers `partner_grant_rekeyed` without fetching and asks for the new invite link.

Each grant key records the side this device holds it for (`owner` from reconcile, `partner` from accept) and the account it was created under. A `partner` key never encrypts an upload, so a server that lists a received grant as owned cannot make the recipient publish its own history to the inviter; an owner key never encrypts a projection naming another owner account; and reconcile never replaces a received key with an owner key. A key written before these fields existed behaves as before. The partner's replay floor is kept per grant together with the invite it was seen under and counts only under that invite: accepting a new invite for a reused grant id drops it (ciphertexts under the old key no longer decrypt, so nothing older can be replayed past the reset), and re-accepting the same invite keeps it. A received grant the listing shows as revoked loses its key and markers; a grant missing from the listing keeps them, since the single-use invite could not restore a key lost to a partial listing.

### Anti-replay on the owner

Once `K_grant` has been derived for an `inviteID → grantID` pair, the owner records `consumedInviteIDs[inviteID] = { grantID, consumedAtISO }`. A second `reconcileManagedPartnerShareKeys` turn that sees a different grant referencing the same `sourceInviteID` refuses to derive `K_grant` for it — only the first observed grant is ever keyed. This defends against a malicious managed cloud calling `acceptPartnerInvite(T)` twice for two partner accounts: the second grant ends up unkeyed locally, and any upload attempt fails with `share_key_unavailable`. The marker is kept for the lifetime of the partner-share secret store (cleared only by `clearPartnerShareSecrets`, which runs on "clear local data", account deletion and a managed disconnect together with every grant and pending invite key; an unauthorized sign-out, a self-hosted disconnect and a mode switch leave the store in place); resetting it while grant keys remain would re-enable the replay.

### Revoke semantics and limits

When the owner revokes a grant, the managed cloud stops accepting uploads and serving ciphertext, and the owner client drops `K_grant` plus `ownerGenerationByGrantID[grantID]` from local storage. Future uploads cannot re-encrypt under a stale key: the next upload sees no key and bails with `share_key_unavailable`.

What revoke cannot do: symmetric AEAD does not support post-hoc key revocation for ciphertext the partner has already downloaded. If the partner cached a projection before revoke, that ciphertext stays decryptable on the partner device — there is no cryptographic way to retract it without rolling out a new key the partner does not have. This is documented as a trust-boundary limit, not a bug; the UI surfaces the revoke as "no new updates will be visible," not as "all data deleted from the partner device."

Decision (2026-07-23): a revoke is permanent for the issued handshake — a repeat accept of the consumed invite, or any invite issued before the revoke, never resurrects access. Sharing with the same person again is legitimate and supported, but only through a fresh invite issued after the revoke: a new handshake deriving a new `K_grant`, with the old link and the old stored projection dead. Re-sharing the same pair via a fresh post-revoke invite is a supported scenario, not a revocation bypass.

## Partner-Share Payload Digest and Summary Snapshot

**Keyed digest.** The `checksumSHA256` field next to a projection's ciphertext is visible to the managed cloud. A plain SHA-256 of the plaintext would let the server confirm a guess against a low-entropy payload, so the owner emits an HMAC-SHA256 under a subkey derived from `K_grant` with its own HKDF domain label (never the AEAD key). The field name and 64-hex shape are unchanged, so the server stays unaware and treats it as opaque. The AEAD associated data (`grantID`, `accessLevel`, `schemaVersion`) is built identically at encrypt and decrypt.

*Rollout.* Partner acceptance of both digests and owner emission of the keyed one ship in the same build; the app has no public release yet, so no deployed owner build emits the legacy form. Decrypt still accepts the legacy plaintext digest because the AEAD tag already authenticates the plaintext, so accepting it leaks nothing. The legacy acceptance can be removed once the first public release has shipped and every projection stored by a pre-release build has been superseded (a projection is a full snapshot re-uploaded on every sync, so one release cycle after the first public release is enough).

**Summary snapshot.** For a summary-level grant the owner device computes what the partner's summary view renders (cycle day, next-period date and window, a prediction-hint kind, last/average cycle length, average period length, logged-day count) and ships it as the optional `summarySnapshot` field inside the AEAD payload. A summary payload carries `dayLogs: []`, `symptomRecords: []` and no date-valued profile field, so no per-day date reaches the partner. `PARTNER_SHARE_SCHEMA_VERSION` stays 1 (the field is additive); a partner reading a payload without it, or with a malformed one, recomputes from `profile` and `dayLogs` as before. Full level is unchanged. `usageGoal` is not shared at either level, and symptom records carry only `id`, `label` and `isDefault`.

*Time passing.* The snapshot records the owner's local calendar date at generation (`asOfDate`). The partner advances the cycle day by the whole local days elapsed since, only while the predicted next-period window has not passed; afterwards the cycle day is shown as unknown while the shipped dates stay, because rolling an elapsed prediction forward would invent a cycle the owner device never computed. An overdue ("stale") day count, and a facts-only one (no predicted window to pass), keeps counting from its anchor. A partner clock behind `asOfDate` shows the day as generated. The 14-day snapshot staleness rule hides the prediction block entirely after that.

*Medical safety.* While an active pregnancy record exists, or the owner is pregnancy-paused, the snapshot carries no prediction value (cycle day, dates all null, state and hint `facts_only`); the wording is the neutral facts-only one, never pregnancy-specific.

**Upload size.** The managed API refuses a projection ciphertext over 2 MiB (`413 payload_too_large`, also read from a bare 413). The client refuses a larger ciphertext locally without sending a request, and a `payload_too_large` result backs off later pushes like a rate limit does; so does `invalid_partner_projection` or an unrecognized 4xx such as `400 invalid_json`. Pushes run one pass at a time, so an overlapping trigger never lands an older snapshot after a newer one.

## Managed Session Renewal

The app declares `refresh_supported` on every managed register, login, TOTP-challenge completion, and guest-partner invite accept. A managed cloud that understands the flag answers with a short-lived access session plus a refresh token; one that does not simply ignores it and returns the long-lived session as before, so the client works against either.

Both the access token and the refresh token are bearer secrets and live in secure storage beside the other sync material (`SyncSecretsRecord.managedAuthSessionToken` / `managedRefreshToken`), never in broad key-value storage, route params, or logs. The stamped access expiry is stored alongside them so renewal can happen before a request fails rather than after.

`ensureFreshManagedSession` (`src/sync/managed-session-refresh-service.ts`) is the only place that exchanges a refresh token. It renews when the access session is within five minutes of expiry, and it serializes: a refresh token is single-use and the server treats a second use of the same token as a leak — revoking the whole family — so concurrent screens share one in-flight exchange rather than racing. It is called from `loadManagedBillingSnapshot`, the read every premium surface funnels through, so one refresher keeps the stored token fresh for every other consumer. The in-flight exchange reads the stored record itself after taking the slot: a caller whose own read predates a refresh that has since landed would otherwise spend the refresh token the server already rotated away, and the server would revoke the family.

Failure handling is deliberately asymmetric. A rejected refresh means the chain is dead and the credentials are cleared, because the server has already revoked the family and retrying is pointless. A network failure returns the existing token untouched: being offline must never look like being signed out.

A 401 on an ordinary managed call is not a dead chain. `callWithManagedSession` (`src/sync/managed-session-call.ts`) runs a call with a fresh token and, on a 401, renews through `renewRejectedManagedSession` — sharing the same single in-flight exchange, and reusing a token a concurrent refresh already stored — then retries exactly once. It answers `session_expired` only after clearing the credentials, which happens only when the refresh token itself is refused or a legacy session with no refresh token is rejected; when the renewal cannot be completed it passes the 401 through with every credential kept, so a caller never clears a refresh token on a first 401. The sync-run context (session read and sync-session mint), the managed capabilities read, the guest-account upgrade, TOTP enrollment and disable, password change, recovery-code regeneration and the entitlement-token gate's session read run through it; there a 401 the renewal could not resolve is reported as `generic`, never `unauthorized`, because their callers answer `unauthorized` by ending the local session. Every managed request, headers and body, is aborted after 30 seconds and reported as `network_failed`. A guest-partner session goes through this same refresher with no special case — see Guest Partner Access above for why the short access session matters more there than anywhere else, and for what a guest that received no refresh material stores instead.

Disconnect (`disconnectSyncAccount`) does not renew. `DELETE /auth/session` revokes the session's whole refresh family under either credential — a live bearer, or the refresh token sent as `{"refresh_token": …}` in the body — so the device sends the stored refresh token with every logout, plus the bearer when it holds one, and an expired access session no longer leaves the family alive. A renewal already in flight is waited out first, so the logout carries the tokens it wrote rather than the one it spent; a renewal that outlasts the bound below is fenced off and never writes its tokens back over the wipe. The logout is retried once when it reports a server or transport failure (a 500 there means nothing was committed); a refusal (401 neither credential live, 429, 400) is not retried. The whole server phase — the managed logout and its retry, and the self-hosted logout beside it — is bounded at ten seconds, so a slow or hanging server never holds credentials on the device. Then, whatever the server answered or failed to answer, every managed credential, the refresh token included, is cleared from secure storage; a family the server never heard about stays live only until its own expiry. The disconnect reports the sign-out confirmed only when every held session was revoked (a 401 counts: the server held none live); a failed, refused, timed-out or unreachable revoke is reported unconfirmed, and the screen says the server session ends when it expires instead of claiming it was removed. The refresh token travels only in the logout body and never reaches a log or an error value (regression: `sync-client-service.test.ts` and `managed-cloud-api-client.test.ts`, "never logs the refresh token").

## Outbound Fetch Posture

`sync-api-client` and `managed-cloud-api-client` set `redirect: "error"` on every request. The sync API is strictly same-origin, so any 3xx is unambiguously suspicious; following a 307/308 to a different host re-sends the bearer session token and the JSON body (password, TOTP code, ciphertext) because HTTP preserves method, headers and body on those status codes.

The flag alone is not enforcement on native builds: React Native's global fetch is whatwg-fetch over XHR and never reads `redirect`, so the platform stack follows the 3xx. `managed-cloud-api-client` therefore defaults to `expo/fetch` (`src/sync/redirect-refusing-fetch.ts`), whose native module disables redirect following in OkHttp and URLSession and throws on a 3xx, so the redirected request is never sent; on web it is the browser fetch, which honours the flag. `sync-api-client` defaults to the same fetch. As defence in depth, every response on either client that reports a followed redirect or a final URL on another origin fails closed to `network_failed`, and both send `credentials: "omit"` so the native cookie jar never rides along with the bearer token.

## TLS Pinning Posture

Decision (2026-07-23): the managed endpoint (Ovumcy Cloud) pins at the **Let's Encrypt CA level — the ISRG root public keys — never the leaf certificate**. This supersedes the 2026-07-20 deferral recorded below. That deferral was right about the risk it named and wrong only in its conclusion: what makes pinning fragile in this deployment is the *shape* of the pin, not pinning itself.

Unchanged by this decision, and still true: **nothing is wired**. The pure-TypeScript scaffolding (`src/security/cert-pin-store.ts`, `src/sync/cert-pin-policy.ts`, `src/sync/sync-endpoint-policy.ts`) enforces nothing at runtime — the only runtime call is the wipe paths deleting the pin store's SecureStore entry (`clearAll`), and nothing writes or reads a pin — `resolveManagedPinSet()` returns `null`, and the native enforcement layer is not a dependency of this project. Transport relies on platform CA-chain trust plus the outbound-fetch posture above, exactly as before. What this section adds is the pin set and the rotation rule, so that turning pinning on becomes a mechanical step taken deliberately before public production, rather than a design question answered under release pressure.

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

The `pendingManagedPartnerInviteToken` module-level state — and the invite secret held beside it, which shares its TTL and every clear — must clear on every session boundary that invalidates the prior owner context: explicit disconnect, mode-switch, and forced unauthorized-session clear. Clearing only on successful accept lets the token outlive disconnect and risks redeeming it under a different managed account on the same device. Independently of those boundaries the buffer expires on its own: a token stashed more than 15 minutes ago (`MANAGED_PARTNER_INVITE_TOKEN_TTL_MS`) reads as empty and is dropped, so an abandoned pairing attempt never leaves a redeemable token in memory. A different token stashed while another invite is still live replaces it; the buffer then raises a one-shot replacement notice (no token or secret) that the accept card shows until the pending invite ends. Before any accept call the screen runs the same token-length and secret-shape checks as the key derivation, so a malformed link is refused without redeeming the single-use invite.

## Export Artifact Cleanup

Recovery-phrase, cycle CSV/JSON, and doctor-PDF exports write a temporary file under `Paths.cache` and remove it in a `try/finally` after the OS share-sheet returns. Because a JS-process kill mid-share bypasses `finally`, the root layout runs a startup sweep of `Paths.cache` matching the `ovumcy-export-*` and `ovumcy-private-export-*` prefixes. Recovery-phrase artifact body must contain only the phrase bytes — never a self-labeling header — because OS share-sheet recents and receiving-app caches preserve content independently of our cleanup.

## Confirm-Dialog as Destructive Gate

The in-app `ConfirmDialogProvider` is the only UI barrier before destructive privacy actions (delete day-log, revoke partner grant, disconnect sync, restore from cloud, regenerate sync keys, discard unsaved drafts). When a confirmation is already pending, a concurrent `requestConfirmation` must NOT auto-resolve the first to `false`: the unsaved-changes callers treat `false` as "discard", and auto-resolution on race silently destroys user state. Instead the second concurrent caller is dropped: its promise never resolves and no second dialog is queued, leaving the first (visible) dialog to resolve normally.
