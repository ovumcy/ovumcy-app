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

Ovumcy Cloud premium gates (advanced fertility, advanced insights, extended reports, doctor PDF, partner sharing, premium reminders) read from the managed billing snapshot, not from the sync transport.

What this means in practice:

- premium feature flags arrive over an authenticated managed cloud channel and are never persisted to broad key/value storage on the device;
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

## AEAD Envelope Discipline

Every AEAD encrypt/decrypt boundary in the app — local SQLite payloads, sync snapshot blobs, partner-share projections, recovery-phrase wrap — must thread context-specific associated data (AAD) into the auth tag. This prevents ciphertext blobs from being swapped between rows, devices, or grants without invalidating the tag.

- Local data uses `buildLocalDataAad(tableName, rowKey)` — both encrypt and decrypt sites construct identical context.
- Sync snapshots use `buildSyncPayloadAad(deviceID)`.
- Partner-share envelopes bind `(grantID, accessLevel, schemaVersion)` and additionally verify inner payload matches the envelope on those fields after decrypt.
- Recovery-phrase wrap binds `(phraseFingerprintHex, mnemonicWordCount)`.

The `payload-crypto.encryptPayload` / `decryptPayload` primitive requires AAD as a non-optional argument; passing `new Uint8Array(0)` is legal cryptographically but defeats the purpose, so helpers exist to force the choice at every call site.

## Local Data Key Lifecycle

When SecureStore returns a key that no longer authenticates the on-disk ciphertext (Android Auto Backup restoring SQLite without the SecureStore key, key truncation during migration), `resolveLocalDataKey` must canary-decrypt a singleton row before trusting the key. On auth-tag failure it wipes and reseeds with a fresh key, never returning the mismatched key to callers. This is the deterministic-reset behavior promised by the broader security invariants — the alternative (propagating the wrong key) bricks the app on every read.

## Partner-Share Token Floor

The managed cloud mints the partner-share invite token, and the owner derives the symmetric share key from it via HKDF. Without a client-side entropy floor, a compromised server could hand the owner a weak token (`"ab"`), derive the same key, and decrypt the supposedly opaque ciphertext. The client therefore enforces a minimum length (≥ 22 chars after trim) in `derivePartnerShareKeyHex` before accepting the token. Per-grant subkey rotation on accept and revoke is a planned follow-up.

## Outbound Fetch Posture

`sync-api-client` and `managed-cloud-api-client` set `redirect: "error"` on every request. The sync API is strictly same-origin, so any 3xx is unambiguously suspicious; following a 307/308 to a different host re-sends the bearer session token because HTTP preserves method + headers on those status codes. Self-hosted TLS pinning / TOFU is a planned follow-up.

## Pending Partner Invite Buffer

The `pendingManagedPartnerInviteToken` module-level state must clear on every session boundary that invalidates the prior owner context: explicit disconnect, mode-switch, and forced unauthorized-session clear. Clearing only on successful accept lets the token outlive disconnect and risks redeeming it under a different managed account on the same device.

## Export Artifact Cleanup

Recovery-phrase, cycle CSV/JSON, and doctor-PDF exports write a temporary file under `Paths.cache` and remove it in a `try/finally` after the OS share-sheet returns. Because a JS-process kill mid-share bypasses `finally`, the root layout runs a startup sweep of `Paths.cache` matching the `ovumcy-export-*` and `ovumcy-private-export-*` prefixes. Recovery-phrase artifact body must contain only the phrase bytes — never a self-labeling header — because OS share-sheet recents and receiving-app caches preserve content independently of our cleanup.

## Confirm-Dialog as Destructive Gate

The in-app `ConfirmDialogProvider` is the only UI barrier before destructive privacy actions (delete day-log, revoke partner grant, disconnect sync, restore from cloud, regenerate sync keys, discard unsaved drafts). When a confirmation is already pending, a concurrent `requestConfirmation` must NOT auto-resolve the first to `false`: the unsaved-changes callers treat `false` as "discard", and auto-resolution on race silently destroys user state. The bridge keeps the second caller's promise pending until the visible dialog resolves.
