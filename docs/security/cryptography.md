# Cryptography: Operation Inventory

_Part of the [Ovumcy security policy](../../SECURITY.md)._

This document is the structured inventory of every cryptographic operation in the app. It describes what each operation uses and where its key lives; the claims themselves are bound to named tests in the [Test Enforcement Matrix](../../SECURITY.md#test-enforcement-matrix), which this document links to instead of restating. The trust model behind the sync and partner-share operations is in [sync-trust-model.md](../sync-trust-model.md).

## Primitives and Libraries

| Primitive | Library | Used by |
| --- | --- | --- |
| XChaCha20-Poly1305 (AEAD) | `@noble/ciphers` | local-data, sync, partner-share envelopes, recovery wrap |
| HKDF-SHA256 | `@noble/hashes` | recovery wrapping key and fingerprint, partner-share keys |
| SHA-256 | `@noble/hashes` | partner-share and sync blob checksums; opaque row lookup keys for `day_logs` and `symptoms` |
| BIP-39 mnemonic and seed | `@scure/bip39` (English wordlist) | recovery phrase |
| Ed25519 verification | `@noble/curves` | entitlement token |
| Random bytes | `expo-crypto` `getRandomBytes` | every key and nonce, the device id and secret, recovery-phrase entropy |

All AEAD calls go through `encryptPayload` / `decryptPayload` in `src/security/payload-crypto.ts`, which takes the associated data as a required argument. The recovery wrap is the one AEAD call that builds the cipher directly in `src/security/sync-crypto.ts`, with the same algorithm.

## Shared Envelope Shape

`EncryptedPayloadEnvelope` is `{ algorithm: "xchacha20poly1305", nonceHex, ciphertextHex }`: a 32-byte key, a fresh 24-byte nonce per encryption from `getRandomBytes`, and the 16-byte Poly1305 tag appended to the ciphertext. The envelope carries no version field. Format versioning is carried by the AAD label (`...-v1`, `ovumcy-sync-v2` for sync snapshots) and, for sync and partner-share, by the outer `schemaVersion`. A change to the format therefore fails authentication under the old label instead of being parsed ambiguously.

Keys are 32 random bytes held as 64-character lowercase hex strings.

## Inventory

### 1. Local-data at-rest envelope

| Aspect | Detail |
| --- | --- |
| Purpose | Confidentiality and integrity of every on-device health record in SQLite (`encrypted_payload` columns). |
| Algorithm / library | XChaCha20-Poly1305 via `src/security/local-data-crypto.ts`; payload is `JSON.stringify(record)`, stored as the JSON-serialized envelope. |
| Key source | `createLocalDataKeyHex()`: 32 random bytes, generated on first use by `resolveLocalDataKey` (`src/storage/local/sqlite-local-data-key.ts`). |
| Key storage | `expo-secure-store` under `ovumcy.local-data-key`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (`src/security/platform-local-data-key-store.native.ts`). On web preview the key is held in memory only. |
| Nonce | Random 24 bytes per write; never derived or reused deliberately. |
| AAD | `ovumcy-local-v1\|<table>\|<row key>`, built by `buildLocalDataAad`. Row key is the `id` value, `"1"` for singleton tables, or, for `day_log` and `symptom` rows, the opaque lookup key: hex SHA-256 of `<namespace>:<local-data key>:<day or id>` (`buildOpaqueLookupKey` in `src/storage/local/sqlite-app-storage.ts`), which is also the row's primary key so the plaintext date or id is not stored. Encrypt and decrypt sites build the identical string. |
| Envelope version | AAD label `ovumcy-local-v1`; no field in the envelope. |
| Rotation / rekey | There is no in-place rotation. When the stored key no longer authenticates the canary row (`bootstrap_state`, then `profile_settings`), or a key is absent while encrypted rows exist, `resolveLocalDataKey` deletes every local table, generates a new key and writes it: a deterministic reset, never a crash. |
| Platform note | Native builds use SQLite with this envelope. Web preview uses volatile in-memory storage (`volatile-web-app-storage.ts`), which is not encrypted and is lost on reload. |

Enforcement rows: [Local-data encryption at rest](../../SECURITY.md#local-data-encryption-at-rest).

### 2. Sync envelope

| Aspect | Detail |
| --- | --- |
| Purpose | End-to-end encryption of the sync snapshot before upload, so the server stores ciphertext only. |
| Algorithm / library | XChaCha20-Poly1305 via `encryptSyncPayload` / `decryptSyncPayload` (`src/security/sync-crypto.ts`). The ciphertext uploaded is the base64 of the JSON-serialized envelope; `checksumSHA256` is SHA-256 over those bytes. |
| Key source | Master key: 32 random bytes from `createSyncSecretsRecord`, or recovered from the wrapped key on a new device. |
| Key storage | `SyncSecretsRecord` (master key, device secret, wrapped key, session tokens) as one JSON value in `expo-secure-store` under `ovumcy.sync-secrets`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`. On web preview, memory only. |
| Nonce | Random 24 bytes per upload. |
| AAD | `ovumcy-sync-v2\|<schemaVersion>`, built by `buildSyncPayloadAad` from the blob's `schemaVersion`; no device id, so a recovered device with a fresh id opens a snapshot another device uploaded. Restore (`decryptSyncSnapshotPayload`) falls back to the legacy `ovumcy-sync-v1\|<deviceID>` built from the local device id, which opens only blobs this device wrote earlier; the next upload rewrites them under v2. |
| Envelope version | AAD label `ovumcy-sync-v2` (`ovumcy-sync-v1` read-only fallback); outer `schemaVersion` (currently 3; versions 1 and 2 are still read and upgraded, anything else is refused). |
| Rotation / rekey | Setting up sync again (`src/sync/sync-setup-service.ts`) generates a new master key, device identity and recovery phrase; the next upload encrypts under the new key. There is no re-encryption of an existing remote blob under a rotated key. |

Enforcement: the test matrix has no row for the sync envelope; its behaviour is covered by [src/security/sync-crypto.test.ts](../../src/security/sync-crypto.test.ts) and [src/sync/sync-client-service.test.ts](../../src/sync/sync-client-service.test.ts). The generic AEAD properties are pinned under [Local-data encryption at rest](../../SECURITY.md#local-data-encryption-at-rest).

### 3. Partner-share envelope

| Aspect | Detail |
| --- | --- |
| Purpose | Owner-to-partner read-only projection, opaque to the managed cloud. |
| Algorithm / library | XChaCha20-Poly1305 via `src/security/partner-share-crypto.ts`; envelope JSON is base64-encoded into `ciphertextBase64`; `checksumSHA256` is SHA-256 over the plaintext payload and is re-checked after decryption. |
| Key source | Two-step derivation, both HKDF-SHA256: `K_invite = HKDF(invite token, salt none, info "ovumcy-partner-share-v1")`, then `K_grant = HKDF(K_invite, salt "ovumcy-partner-share-grant-v1", info "<grantID>\|<ownerAccountID>\|<sourceInviteID>")`. Projections are encrypted under `K_grant`. The invite token must be at least 22 characters after trimming; empty context fields are refused. |
| Key storage | `PartnerShareSecretsRecord` (grant keys, pending invite keys, consumed-invite markers, generation counters) in `expo-secure-store` under `ovumcy.partner-share-secrets`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`; memory only on web preview. The partner discards `K_invite` as soon as `K_grant` is derived; the owner keeps it under the pending invite keys until the grant is reconciled. |
| Nonce | Random 24 bytes per upload. |
| AAD | `ovumcy-partner-share-v1\|<grantID>\|<accessLevel>\|<schemaVersion>`. After decryption the inner payload's `grantID` and `accessLevel` must equal the envelope's, and `generation` must be an integer at or above the initial generation. |
| Envelope version | AAD label `ovumcy-partner-share-v1` plus `PARTNER_SHARE_SCHEMA_VERSION`; a mismatching `schemaVersion` is refused. |
| Rotation / rekey | Invite key to grant key rotation at accept time; `consumedInviteIDs` prevents a second grant from being keyed from the same invite. A new grant derives a new key. Freshness is protected by a monotonic owner `generation` inside the encrypted payload and a partner-side last-seen marker. |

Enforcement rows: [Partner-share crypto and projection privacy](../../SECURITY.md#partner-share-crypto-and-projection-privacy). Rotation and replay rationale: [Partner-Share Key Rotation](../sync-trust-model.md#partner-share-key-rotation).

### 4. Recovery phrase and key derivation

| Aspect | Detail |
| --- | --- |
| Purpose | Backs up the sync master key so a new device can recover it. Covered by [src/security/sync-crypto.test.ts](../../src/security/sync-crypto.test.ts); the test matrix has no row for it. |
| Algorithm / library | 16 random bytes encoded as a 12-word BIP-39 English mnemonic (`@scure/bip39`). Wrapping key = `HKDF-SHA256(BIP-39 seed, no salt, info "ovumcy-sync-wrap", 32 bytes)`. The master key is wrapped with XChaCha20-Poly1305. The only stretching is the BIP-39 seed derivation itself (PBKDF2-HMAC-SHA512, 2048 rounds, inside `@scure/bip39`); the app chooses no KDF parameters of its own, and the phrase carries 128 bits of entropy. |
| Key source | The phrase is generated on device and shown to the user. It is not written to SecureStore or SQLite; it stays in screen state until acknowledged, and the optional recovery-phrase export writes it to a transient `ovumcy-private-export-*` file that follows the [export artifact cleanup](../../SECURITY.md#export-and-import-artifact-cleanup) lifecycle. |
| Key storage | The wrapped key metadata (`algorithm`, `kdf: "bip39_seed_hkdf_sha256"`, `mnemonicWordCount`, `wrapNonceHex`, `wrappedMasterKeyHex`, `phraseFingerprintHex`) is part of `SyncSecretsRecord` and is uploaded to the sync server where the backend supports recovery-key storage. |
| Nonce | Random 24 bytes per wrap. |
| AAD | `ovumcy-sync-wrap-v1\|<phraseFingerprintHex>\|<mnemonicWordCount>`. The fingerprint is `HKDF-SHA256(seed, info "ovumcy-sync-fingerprint", 8 bytes)` and is compared before the unwrap attempt. |
| Envelope version | `ovumcy-sync-wrap-v1` label; unwrap refuses metadata whose `algorithm`, `kdf` or word count differ from the single supported value. |
| Rotation / rekey | A new phrase is created only when sync keys are created again; the old wrapped key stays valid for the old master key. Regenerating keys when sync secrets already exist sits behind a confirm dialog and device authentication (see [Sensitive-action re-authentication](../../SECURITY.md#sensitive-action-re-authentication)). The phrase shown at first-time setup, and its export while still on screen, are not behind a separate challenge. |

### 5. Entitlement token signature verification

| Aspect | Detail |
| --- | --- |
| Purpose | Verify a managed-cloud signed entitlement token before any claim is trusted. Verification only; the app never signs. |
| Algorithm / library | Compact JWS, `alg` must be `EdDSA`, verified with `ed25519.verify` from `@noble/curves` over the exact received `<header>.<payload>` bytes. Claims checked: `iss = "ovumcy-managed"`, `aud = "ovumcy-app"`, non-empty `sub` (and equal to the active session when `expectedSub` is supplied), numeric `exp` strictly after now, string-array `entitlements`. Every failure returns `{ valid: false, reason }` without throwing. |
| Key source | Public keys by `kid` (hex, 32 bytes) from `EXPO_PUBLIC_ENTITLEMENT_PUBKEYS`, falling back to the embedded map in `src/security/entitlement-token.ts`. The embedded entry is a test placeholder; `scripts/verify-entitlement-pubkeys.mjs` fails production builds that would ship it. |
| Key storage | Public keys are build-time constants, not secrets. The token itself is cached in `expo-secure-store` under `ovumcy.entitlement-token`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`. |
| Nonce / AAD | Not applicable (signature, not AEAD). |
| Envelope version | JWS header `alg` and `kid`; an unknown `kid` is refused. |
| Rotation | Ship two `kid` entries (current and next), let the signer move to the next, retire the old one in a later release. |
| Scope | The gate is built on the production premium-features path (`loadManagedPremiumFeaturesForCurrentSession`, `settings-state-service`), but it is inert until the managed cloud issues tokens: with no fetched or cached token it falls back to the managed billing snapshot, which decides premium today. Verification is bypassable by a forked client by design. See the Accepted Residual Risks and the *Policy / Planned* list in [SECURITY.md](../../SECURITY.md). |

Enforcement rows: [Signed entitlement-token verification](../../SECURITY.md#signed-entitlement-token-verification-purely-local-premium).

### 6. TOTP

The app performs no TOTP computation. There is no HMAC-SHA1 or code-generation code and no TOTP library in the dependency list. The sync server generates the shared secret and validates codes. Client-side behaviour is limited to:

- receiving `secretBase32` and the `otpauth://` provisioning URI once at enrollment (`src/sync/sync-totp-service.ts`) for display and QR handoff to an authenticator app;
- submitting the six-digit code the user types: with the challenge id on login, alone on enable, and with the current password on disable;
- not persisting the secret or codes in SecureStore or local storage.

Server-side secret storage and replay protection are described in [two-factor.md](../two-factor.md). Client validation rows: [Client TOTP validation, challenge, and replay handling](../../SECURITY.md#client-totp-validation-challenge-and-replay-handling).

### 7. Randomness source

Security-relevant randomness comes from `getRandomBytes` of `expo-crypto`, the platform CSPRNG, imported in `src/security/payload-crypto.ts` and `src/security/sync-crypto.ts`. It supplies every AEAD nonce, the local-data key, the sync master key, device secret and device id, and the recovery-phrase entropy. Non-secret record ids (pregnancy, postpartum, screening, contraction sessions) use `crypto.randomUUID()`, with a time-and-counter fallback where it is unavailable; they are identifiers, not key material. `Math.random` does not appear anywhere under `src/`.

## Related Non-Cryptographic Secret Handling

- Managed session and refresh tokens live inside `SyncSecretsRecord` (item 2).
- `src/security/cert-pin-store.ts` defines a store for pinned certificate fingerprints, but no production code wires it to a storage backend and pinning is not enforced at runtime; see [sync-trust-model.md](../sync-trust-model.md).
- `keychainAccessible` is an iOS Keychain option; its value is the same for every store listed above.
