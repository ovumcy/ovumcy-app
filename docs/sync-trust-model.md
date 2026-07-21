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

## Recovery

Recovery phrases are shown only when the app prepares or recreates local sync keys.

If an owner loses every device and also loses the recovery phrase, encrypted sync data cannot be recovered.

This is a privacy tradeoff, not a support bug: the server is not supposed to know enough to recover the health payload by itself.

## Premium Entitlement and the Sync Plane

Ovumcy Cloud premium gates (advanced fertility, advanced insights, extended reports, doctor PDF, partner sharing, reminder emails) read from the managed billing snapshot, not from the sync transport. Local device reminder notifications are free-tier and read no billing state at all.

What this means in practice:

- premium feature flags arrive over an authenticated managed cloud channel and are never persisted to broad key/value storage on the device;
- the app persists a bounded 72-hour offline-grace cache of the last-known-good billing snapshot (`hasActivePlan` + `premiumFeatures` only) in the encrypted `managed_billing_cache` table, served only while fresh and only under a still-present managed session whose live fetch failed — it is not a second source of truth, and server-checked operations (sync upload/restore, partner projections, renewal) never read it;
- the encrypted snapshot envelope on the sync transport is opaque to the server; new payload fields like `pregnancyTest` ride inside the same ciphertext and require no server schema awareness;
- legacy snapshots that predate a field continue to decode; the storage layer defaults missing values when restoring on a newer client;
- the doctor PDF is generated entirely on-device from canonical local repositories — the server never sees the PDF, only the encrypted day-log records that feed it.

## Partner Sharing Trust Boundary

Partner sharing is an Ovumcy Cloud feature. The trust model for the partner shared view:

- the owner builds a partner projection from canonical local profile, day-log, and symptom records, applying the chosen access level (summary or full) before encryption;
- the projection is encrypted on the owner device and uploaded to managed as an opaque ciphertext blob tied to a specific grant;
- the partner device decrypts the projection only after the grant is accepted; managed never holds the plaintext share;
- the partner experience stays read-only and free — the partner is a guest of the owner's subscription, not a separate billing subject;
- community sync may keep history continuity for the owner, but it must not become a transport or authority path for partner shared access.

## Guest Partner Access

A partner can redeem an invite with **no prior Ovumcy Cloud account**. Opening the invite link on a device with no managed session offers a one-tap "Accept as guest" alongside the existing "sign in to accept" path (`SettingsPartnerAccessSection`, the `hasManagedSession` branch). The managed cloud (`PartnerService.AcceptInviteAsGuest`, `POST /auth/partner/invites/accept`, unauthenticated) atomically provisions a guest account and accepts the invite under it in one database transaction (`Store.ProvisionGuestPartnerAccount`): the account row, its sync entitlement, its session, and the accepted grant are all persisted together or not at all — a failure partway through can never leave an orphaned guest account.

A guest account has no password, no recovery code, and no real email. It is marked by a reserved, non-issuable address of the form `guest+<accountID>@guest.invalid` (`models.GuestPartnerEmail`). `.invalid` is the TLD RFC 2606 reserves specifically so it can never be registered or resolved by a real party, so the existing `accounts` table's `NOT NULL UNIQUE email` column alone distinctly marks a guest row — no new column, no migration. Both `PasswordHash` and `RecoveryCodeHash` are left empty, so no credential can ever authenticate the row (the same bcrypt-compare-against-empty-hash-always-fails behavior the rest of the account system already relies on). The session the guest device receives (`AuthService.NewSessionRecord`) is stored in the same `sessions` table as every other login: a normal, individually server-revocable session bound to this device, not a special bearer-forever token.

Every invariant that already governs partner sharing applies to a guest exactly as it does to a full account, because guest accept reuses the same invite row and the same gate as the logged-in accept path:

- **Single-use + 7-day TTL.** Guest accept reads and consumes the identical `PartnerInvite` row `AcceptInvite` does — `ExpiresAt`, `AcceptedAt`, and `RevokedAt`/`Status` are all checked before any account is created, so an expired, already-accepted, or revoked token fails exactly like it does for a logged-in accept, with the same error codes (`partner_invite_not_found`, `partner_invite_expired`, `invalid_partner_invite`).
- **Owner entitlement gated on every operation.** `ensurePartnerAccessAllowed(ctx, invite.OwnerAccountID)` runs before a guest account is ever created — a lapsed owner subscription blocks a guest redemption exactly like it blocks a logged-in one (`partner_access_unavailable`).
- **Access-level minimization and pregnancy-test stripping.** The grant's access level is fixed by the owner at invite-issue time and carried through unchanged; the projection a guest ends up reading goes through the same projection service as every other partner, so `summary` still collapses detailed fields and `full` still strips `pregnancyTest` at every level.
- **Owner visibility and permanent revoke are unchanged.** A guest's grant is a normal row in `owned.grants` — the owner's partner list shows it with the same last-seen tracking and the same revoke action as a full account; there is nothing about a guest grant the owner sees less of.

### The local side effect

The one thing guest accept does differently from a normal accept is the local storage precondition. Every other accept path (`connectSyncAccount`, `acceptManagedPartnerInvite`) assumes the device already ran "prepare local sync" and already has a `SyncSecretsRecord`. A partner who just tapped an invite link has never done that, so `persistGuestPartnerSession` (`src/sync/sync-client-service.ts`) generates one on the fly with the exact same generator normal setup uses (`createSyncSecretsRecord("", now)`) purely to satisfy the local storage contract. This is inert: the guest capabilities document is built with `syncEnabled` hardcoded to `false` (`buildManagedCapabilitiesDocument(false)`), never inferred from the server response — the guest-accept response carries no entitlement field to read one from in the first place, because the server issues every guest `SyncEntitlement.SyncAllowed = false` (`Source: "guest_partner"`). No sync upload is ever reachable from a guest session: `readPreparedSyncContext` rejects a `syncAllowed: false` session with `sync_not_allowed` before `runSyncUpload`/`runSyncRestore`/device management ever run — the same gate a suspended owner hits. On a device that already prepared local sync (or is already managed-connected), the existing call short-circuits: `persistGuestPartnerSession` only overwrites `authSessionToken`/`managedAuthSessionToken` on top of the existing record, so it can never regenerate keys out from under an already-set-up device.

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

## Managed Session Renewal

The app declares `refresh_supported` on every managed register, login, and TOTP-challenge completion. A managed cloud that understands the flag answers with a short-lived access session plus a refresh token; one that does not simply ignores it and returns the long-lived session as before, so the client works against either.

Both the access token and the refresh token are bearer secrets and live in secure storage beside the other sync material (`SyncSecretsRecord.managedAuthSessionToken` / `managedRefreshToken`), never in broad key-value storage, route params, or logs. The stamped access expiry is stored alongside them so renewal can happen before a request fails rather than after.

`ensureFreshManagedSession` (`src/sync/managed-session-refresh-service.ts`) is the only place that exchanges a refresh token. It renews when the access session is within five minutes of expiry, and it serializes: a refresh token is single-use and the server treats a second use of the same token as a leak — revoking the whole family — so concurrent screens share one in-flight exchange rather than racing. It is called from `loadManagedBillingSnapshot`, the read every premium surface funnels through, so one refresher keeps the stored token fresh for every other consumer.

Failure handling is deliberately asymmetric. A rejected refresh means the chain is dead and the credentials are cleared, because the server has already revoked the family and retrying is pointless. A network failure returns the existing token untouched: being offline must never look like being signed out. A guest-partner session records no refresh state at all — it has no renewal path by design.

## Outbound Fetch Posture

`sync-api-client` and `managed-cloud-api-client` set `redirect: "error"` on every request. The sync API is strictly same-origin, so any 3xx is unambiguously suspicious; following a 307/308 to a different host re-sends the bearer session token because HTTP preserves method + headers on those status codes.

## TLS Pinning Posture

Sync transport (community self-hosted and Ovumcy Cloud SaaS) does not currently pin server certificates. App relies on the platform CA chain plus the outbound-fetch posture above. The pure-TypeScript scaffolding for pinning lives in `src/security/cert-pin-store.ts`, `src/sync/cert-pin-policy.ts`, and `src/sync/sync-endpoint-policy.ts` but is wired into no runtime call site.

Deliberate deferral, not an oversight. The reasons are operational, not technical:

- **Ovumcy Cloud SaaS pinning** requires a release-coordination process: every cert rotation must be preceded by an app release that adds the next pin alongside the old, then followed by a release that drops the old pin after the rotation lands. With Let's Encrypt's 90-day default rotation cadence, the first missed coordination window bricks every install that has not updated. Public-alpha solo-maintainer operations cannot guarantee this dance reliably; standard CA + short-lived session tokens is the safer posture at this stage.
- **Community self-hosted pinning** is operationally cheap on the project side (each owner manages their own server's pin through the app UI), but still needs the setup-form input field, the format validation, the mismatch warning screen, and localized copy across six locales. Not blocking and not urgent — the threat model for self-hosted is dominated by the owner's own infrastructure choices, which they already control.

When to revisit: post-alpha, once cert rotation can be tied to a documented release runbook with an owner.

## Pending Partner Invite Buffer

The `pendingManagedPartnerInviteToken` module-level state must clear on every session boundary that invalidates the prior owner context: explicit disconnect, mode-switch, and forced unauthorized-session clear. Clearing only on successful accept lets the token outlive disconnect and risks redeeming it under a different managed account on the same device.

## Export Artifact Cleanup

Recovery-phrase, cycle CSV/JSON, and doctor-PDF exports write a temporary file under `Paths.cache` and remove it in a `try/finally` after the OS share-sheet returns. Because a JS-process kill mid-share bypasses `finally`, the root layout runs a startup sweep of `Paths.cache` matching the `ovumcy-export-*` and `ovumcy-private-export-*` prefixes. Recovery-phrase artifact body must contain only the phrase bytes — never a self-labeling header — because OS share-sheet recents and receiving-app caches preserve content independently of our cleanup.

## Confirm-Dialog as Destructive Gate

The in-app `ConfirmDialogProvider` is the only UI barrier before destructive privacy actions (delete day-log, revoke partner grant, disconnect sync, restore from cloud, regenerate sync keys, discard unsaved drafts). When a confirmation is already pending, a concurrent `requestConfirmation` must NOT auto-resolve the first to `false`: the unsaved-changes callers treat `false` as "discard", and auto-resolution on race silently destroys user state. Instead the second concurrent caller is dropped: its promise never resolves and no second dialog is queued, leaving the first (visible) dialog to resolve normally.
