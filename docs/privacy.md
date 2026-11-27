# Privacy: Data Inventory, Egress, Retention and Deletion

_Part of the [Ovumcy security policy](../SECURITY.md). Trust-boundary detail for sync and the managed cloud lives in [docs/sync-trust-model.md](sync-trust-model.md)._

This document describes what the app stores, what can leave the device, and how data is exported, rectified and erased. It describes behaviour; it is not legal advice and makes no compliance claim. Server-side behaviour (the managed cloud and `ovumcy-sync-community`) is outside this repository; statements about it are limited to what the client sends.

## Scope

Core tracking, predictions, statistics, local CSV/JSON export and offline JSON import work with no account, no sync and no network. Every network path below is opt-in and is triggered by an explicit owner action (connecting an account, uploading a backup, sharing with a partner, opening the privacy policy link). One path is not the app's own: on Android the store's billing library runs when the app checks or sells the pregnancy module (see *Store purchase* under Egress).

## Data Inventory

Health data is anything that reveals cycle, fertility, sexual activity, pregnancy, postpartum or mental-health state. The app holds no data beyond what the owner enters or what the owner's own sync/cloud account requires.

### SQLite (`ovumcy-local.db`, native builds)

Every table keeps its real values in an `encrypted_payload` column, sealed with XChaCha20-Poly1305 under a device-local key, with the table name and a row key bound as associated data. The other columns of `bootstrap_state`, `profile_settings`, `day_logs` and `sync_preferences` exist for schema compatibility and are always written with factory defaults, never the record's values (`src/storage/local/sqlite-app-storage.ts`). The primary key of `day_logs` is an opaque keyed lookup key, not the calendar date.

| Table | Content | Health data | Plaintext besides the ciphertext |
|---|---|---|---|
| `bootstrap_state` | onboarding completion and step | no | defaults only |
| `profile_settings` | cycle and period lengths, last period start, age group, usage goal, tracking toggles, language and theme override, notification and screen-capture preferences, optional crisis-support contact | yes | defaults only |
| `day_logs` | period, flow, mood, sex activity, basal temperature, cervical mucus, LH and pregnancy tests, cycle factors, symptom references, notes | yes | opaque lookup key |
| `symptoms` | symptom catalog (labels, icon, colour, archive flag) | yes (custom labels are free text) | opaque lookup key; label, icon and colour columns hold placeholders |
| `sync_preferences` | sync mode, endpoint, device label, setup status, last sync time and generation; the data-sharing consent record (purpose, consent-text revision, date accepted) | no | defaults only |
| `managed_billing_cache` | bounded offline-grace copy of the managed billing snapshot | no | none |
| `pregnancy_records`, `kick_sessions`, `contraction_sessions`, `postpartum_records`, `screening_responses` | pregnancy, postpartum and mood-screening data (screening answers are the most sensitive class) | yes | `status` enum (records) or `day` (sessions, check-ins) only |

On web builds the app uses an in-memory store that is not persisted. A legacy AsyncStorage backend (`src/storage/local/async-storage-app-storage.ts`) is used only as the migration source for installs that predate SQLite and is cleared on a local-data wipe; new data is not written to it in production code.

### SecureStore (iOS Keychain / Android Keystore)

All entries use `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`.

- Local-data encryption key (`src/security/platform-local-data-key-store.native.ts`).
- Sync secrets (`ovumcy.sync-secrets`): device identity and label, sync master key, wrapped-key metadata, self-hosted and managed session tokens, managed refresh token and expiries.
- Partner-share keys (`ovumcy.partner-share-secrets-v2`): per-grant keys, pending invite keys, anti-replay and generation counters. The retired `ovumcy.partner-share-secrets` entry is deleted on first access.
- Signed entitlement token store (`ovumcy.entitlement-token`).
- Sync certificate pins (`ovumcy.sync-cert-pins`): a store with a SecureStore backend, but no flow writes a pin today; the wipe paths delete the entry regardless.

None of these is health data; they are the keys and credentials that protect it.

### AsyncStorage

No non-secret preferences are written to AsyncStorage by current production code. Preferences, including the theme, language and screen-capture setting, live inside the encrypted `profile_settings` payload.

### Cache directory

Export files (`ovumcy-export-*`, `ovumcy-private-export-*`: CSV, JSON, doctor PDF, recovery-phrase export) and the document picker's copy of an imported backup are health data or key material. They are created only while a share, save or import is in progress, deleted afterwards whether it succeeds or fails, and swept on app boot (`src/services/export-artifact-cleanup.native.ts`). The sweep is limited to those prefixes and the picker subdirectory.

### OS notification store

Local reminders are scheduled with `expo-notifications`. The visible text is generic ("Open Ovumcy to update today's entry", "Open Ovumcy to review your next cycle dates", in the interface language; `src/i18n/reminder-copy.ts`). The notification's data payload carries the reminder kind (`daily_log`, `upcoming_period`, `fertile_window`, `kick_count`), which the operating system holds for the scheduled notification. The OS scheduler also holds each trigger: `upcoming_period` and `fertile_window` are one-shot date triggers at a lead date derived from the prediction, and `kick_count` reminders exist only during an active pregnancy, so the schedule itself reveals predicted dates and pregnancy to anything that can read the OS notification store. Scheduling is derived entirely from on-device data and needs no network.

## Egress

Apart from the store's billing library described under *Store purchase* below, the app ships no analytics, advertising, crash-reporting, attribution or other third-party SDK, and no over-the-air update channel; the code never requests a push token. This was checked against `package.json` (no such dependency, no `expo-updates`) and the source (the only `fetch` callers are the sync, managed-cloud and PDF-font code below; `expo-linking`'s `openURL` is used for the privacy policy only). Nothing is sent unless an owner action below runs.

Explicit consent comes first. Before a connect, phrase recovery or upload to a sync server (Ovumcy Cloud and a self-hosted server are separate purposes), before a managed recovery-phrase rotation uploads the re-wrapped key package, and before issuing a partner invite, the app checks for a stored consent at the current consent-text revision (`DATA_SHARING_CONSENT_REVISION`, `src/services/data-sharing-consent-service.ts`). Without one it shows a dialog that lists what leaves the device, says it is end-to-end encrypted, names the recipient and how to withdraw, and links the privacy policy (six-locale copy in `src/i18n/data-sharing-consent-copy.ts`). Only the explicit "I agree" button proceeds; the decline button, Back or leaving the screen sends nothing. The acceptance is recorded locally (purpose, revision, date) inside the encrypted `sync_preferences` payload before the first request; a new revision asks again, a disconnect or a saved change of sync mode or server address withdraws the old destination's sync consent (for Ovumcy Cloud also the partner-share consent), revoking a partner invite or grant withdraws the partner-share consent, and the local-data wipe deletes it. While a consent is stored, Backup & Sync also shows a standalone withdrawal control that drops every stored consent and says what stops. Without live partner grants it is one tap with no confirm. With a partner-share consent and live grants it shows one confirm naming each partner; dismissing it changes nothing, confirming withdraws the consent locally first and then revokes every grant (the server deletes that partner's copy, and the device drops the grant key), and a revoke that fails is reported, so the user knows that partner can still read the last copy until revoked from the partner list. Account and server backup stay until disconnect or account deletion. The consent is asked after the sync draft is saved, so it always names the destination the request goes to. The partner projection push sends nothing without a current partner-share consent, whichever caller starts it; with live grants and no consent, Backup & Sync asks again once it has rendered.

| Call | When | Carries |
|---|---|---|
| Account auth (`/auth/register`, `/login`, `/refresh`, `/session`, `/sync-session`, password change and reset, recovery-code regeneration, TOTP enrol/verify/challenge/disable) to the self-hosted endpoint or the managed cloud | connecting or maintaining an account | login (on Ovumcy Cloud a server-generated Account ID; no email address), password or recovery credentials, TOTP codes, session and refresh tokens: account metadata, no health data |
| `/sync/capabilities`, `/sync/devices`, `/sync/recovery-key` | preparing and managing sync | device ID and label, wrapped-key metadata (the master key wrapped under the recovery phrase; the phrase and master key themselves stay on the device) |
| `/sync/blob` (upload and restore) | owner uploads or restores a backup | one ciphertext blob (XChaCha20-Poly1305 under sync subkeys) plus size, checksum and generation. The decrypted snapshot contains the bootstrap state, profile, symptoms, day logs, pregnancy, kick and contraction sessions, postpartum and screening data (`SyncSnapshotV3`), so everything health-related travels, but only as ciphertext |
| `DELETE /account` (self-hosted or managed); managed cloud only: `/account/billing`, `/account/entitlements/token`, `/account/upgrade` | opening billing surfaces, upgrading, deleting the account | session token; billing, entitlement and subscription state: no health data |
| Managed cloud partner endpoints (`/account/partner/access`, `/invites`, `/invites/accept`, `/grants/<id>`, `/grants/<id>/projection`) and `/auth/partner/invites/accept` | owner invites, revokes or refreshes a partner share; partner accepts or reads | invite and grant IDs, access level, and the partner projection as ciphertext under a per-grant key |
| PDF font asset | building the doctor PDF from a non-`file:` asset URI (web, Metro dev builds) | nothing from the owner; a request for the app's own bundled font. Release native builds read it from a local file |
| `openURL` to `https://ovumcy.com/privacy` | owner opens the privacy notice | a fixed URL with no account, health or invite context |

### Store purchase (Android)

The pregnancy module is sold through Google Play, and any Google Play purchase requires Google's Play Billing Library (9.1.0, brought in by `expo-iap`). The app starts it only when it needs to know whether the module is owned or when it sells it: on the dashboard after a positive pregnancy test with no pregnancy record, on the pregnancy start screen, on the postpartum start check, and on the purchase screen (`src/billing/store-client.native.ts`). The launch tasks never start it; the dashboard, being the home screen, does on every load while a positive test is logged and no pregnancy record exists, app start included. A user who has logged no positive test and opened no pregnancy screen never starts it, and neither does any iOS or web build, where no store is wired.

Once started, the library talks to the Play Store app on the device about the product's price and the purchase. It is Google's code and declares Google's log uploader as a dependency, so it may also send Google diagnostics about its own operation; the app cannot switch that off. What it sends has not been captured and is not asserted here. The app hands it the product id `pregnancy_module` and nothing else — no health data and no account identifier — and stores neither the purchase, nor its token, nor its state.

Default hosts: `https://sync.ovumcy.cloud` (self-hosted protocol default) and `https://managed.ovumcy.cloud` (managed cloud); a build can override them with `EXPO_PUBLIC_OVUMCY_SYNC_BASE_URL` and `EXPO_PUBLIC_OVUMCY_MANAGED_BASE_URL`, and the owner can point sync at their own server.

Transport rules: managed-cloud and self-hosted sync requests both refuse redirects in the native network stack before a redirected request is sent, and fail closed on any response from another origin. Cleartext HTTP is blocked on Android (release builds allow none; only debug builds and the `local` EAS profile exempt the emulator and loopback hosts) and rejected for non-private hosts by the endpoint policy. Certificate pinning is scaffolded but not enforced natively; TLS relies on the platform CA store (see Accepted Residual Risks in `SECURITY.md`). Server-visible network metadata (IP address, timing, request sizes) is inherent to any request and is not controlled by the app.

The only deliberate exception to "no secret in a URL" is the managed partner invite token carried by an invite link; it is never persisted or logged and is scrubbed from route state immediately after capture.

## What the Managed Cloud Sees

The cloud sees a randomly generated Account ID (no email address), billing and entitlement state, device IDs and labels, wrapped-key metadata, blob size, checksum and generation, partner invite and grant metadata, and request metadata. It stores ciphertext for the sync blob and each partner projection and does not hold the master key or any grant key. See [docs/sync-trust-model.md](sync-trust-model.md) for the planes, key hierarchy and what a malicious or compromised cloud can and cannot do.

## Partner Share Minimization

A partner never reads the owner's store. The owner's device builds a separate projection (`src/services/partner-shared-projection-service.ts`) by naming each kept field; nothing is copied by spreading a record, so a field added to the owner model later is excluded by default.

- Every projection carries the owner and grant ids and a shared profile picked field by field: age group, usage goal, cycle and period length, last period start, irregular- and unpredictable-cycle flags, temperature unit, and the BBT, cervical-mucus, sex-chip and notes visibility toggles. The crisis-support contact is never included.
- `summary` access keeps only period, cycle-start and uncertainty markers on day logs; flow, mood, sex activity, temperature, mucus, LH test, cycle factors, symptoms and notes are neutral defaults.
- `full` access adds flow, mood, LH test, cycle factors, symptoms and notes, and honours the owner's toggles: sex activity, basal temperature, cervical mucus and notes are blanked when hidden or untracked.
- The pregnancy test is forced to `none` at every level. Pregnancy, postpartum and screening data, the crisis-support contact, weight and blood-pressure fields are never part of the projection. Predictions are suppressed in the projection while the owner has an active pregnancy record or a pregnancy-test pause, by sharing `unpredictableCycle` as true; the partner then sees the same facts-only view as for an owner who set that flag.
- The projection is encrypted under a per-grant key before upload; the owner can revoke a grant.

## Data-Subject Rights Mapped to Features

| Right | Feature |
|---|---|
| Access, portability | Settings export, over a chosen date range: JSON (the full backup, including pregnancy, postpartum and screening data), CSV (day logs plus a per-day kick count), doctor PDF. Export files follow the cache lifecycle above. |
| Rectification | Editable in place: day logs, profile and cycle settings, symptoms. For pregnancy and postpartum: an active pregnancy's due date, the pregnancy's end date (entered when it is ended), and an active postpartum record's birth date and delivery mode; changing the postpartum birth details also updates the source pregnancy record's end date and delivery mode. JSON import restores from a backup file. |
| Erasure, device | Settings danger zone, "Clear local data": requires the confirmation word and device authentication (a web bypass applies in the browser preview); it wipes local data, then deletes every SecureStore entry except the regenerated local-data key: sync secrets, partner-share keys, entitlement token, certificate pins. The SecureStore entries are deleted even when the local wipe fails. |
| Erasure, account | Delete account: calls the connected backend's account deletion first (renewing a managed session about to expire) and aborts without local change on failure; then deletes the same SecureStore entries and the pending invite token, and wipes local data. If a SecureStore entry cannot be deleted, the others are still deleted, local data is still wiped and the deletion reports a failure. When the backend has already erased the account and only the local part failed, a retry (after the same device check and confirmations) repeats only the local part. With no connected session it is local-only. |
| Erasure, by domain | Separate device-authenticated hard deletes for pregnancy, postpartum and screening data, on the manage screen that Settings links to while any such data is saved (the link reads no module unlock). |

Whether and how long the backend retains data after account deletion is determined server-side and is not documented here.

## Retention and Deletion Behaviour

- Data stays on the device until the owner deletes it; the app applies no automatic expiry to health data.
- "Clear local data" and account deletion run `clearAllLocalData`: they delete every row of all eleven tables listed above, clear the legacy AsyncStorage data, delete the local-data encryption key and seed fresh rows under a newly generated key. Both paths also delete the sync secrets, partner-share keys, entitlement token and certificate pins from SecureStore (`clearWipeScopeSecrets`, `src/security/wipe-scope-secrets.ts`); each deletion is attempted even when another fails, and any failure makes the action report failure. Disconnect and sync-mode switch keep the partner-share keys, the entitlement token and the pins.
- If the stored key no longer authenticates the stored rows, the storage layer wipes and reseeds rather than failing or exposing partial data.
- Restoring a sync snapshot replaces local data (it wipes first, then writes the snapshot).
- Cloud backups can only be removed through the backend: account deletion, or a self-hoster's own server controls.

## OS Backups

- Android: `android.allowBackup` is `false` in `app.json`, and a config plugin (`plugins/withAndroidExcludeDataFromBackup.js`) sets backup and data-extraction rules that exclude every app data domain; Auto Backup, cloud backup and device-to-device transfer (which `allowBackup` alone no longer stops on Android 12+) do not copy app data. To move to a new device, use JSON export/import or sync.
- iOS: a config plugin (`plugins/withIosExcludeDataFromICloudBackup.js`) marks `Documents` (SQLite files) and `Library/Application Support` (legacy AsyncStorage) as excluded from backup at every launch. The exclusion is applied at runtime and is best-effort: a failure to set the flag is logged, not fatal. Keychain items use a this-device-only class that is not synced to other devices or restored from backup.
- Export files are written to the cache directory, which is not part of OS backups, and are deleted after use.

## Screenshots and Screen Capture

In production native builds, screenshots and screen recording are blocked while the app shell is mounted (`expo-screen-capture`), and on iOS the app-switcher snapshot is blurred. The owner can switch this off in settings; it is disabled in development and does nothing on web. It is best-effort hardening and does not defend a compromised device.

## Notifications

Reminders are local notifications, scheduled only after the owner grants permission; after permission is withdrawn, the app cancels its scheduled reminders at the next schedule rebuild (a day-log save, a cycle start or a settings save). No push token is requested and no remote notification content exists. See the OS notification store entry for what the notification holds.

## Known Gaps

- A managed disconnect clears the partner-share secret store, and every end of a managed session clears the entitlement token; an unauthorized sign-out, a self-hosted disconnect and a sync-mode switch keep the partner-share store. Outside those paths and the wipe paths only a single grant key can be cleared (`clearManagedPartnerGrantKey`).
- The TLS pin store (`src/security/cert-pin-store.ts`) has a SecureStore backend, but no flow writes a pin yet; the wipe paths delete its entry.
- Certificate pinning is not enforced natively (see `SECURITY.md`).
