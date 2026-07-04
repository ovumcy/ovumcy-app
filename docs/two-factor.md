# Two-Factor Authentication

`ovumcy-app` supports an optional TOTP (RFC 6238) second factor on top of the account password. It applies to both managed sync (Ovumcy Cloud) and self-hosted community sync — the in-app flow is identical for both backends.

Two-factor is **off by default** and **opt-in per account**. Even on servers that have TOTP enabled, individual owners must explicitly turn it on.

## Enabling

1. Open *Backup & Sync* and sign in to your sync account.
2. Tap *Account Security*.
3. In the *Two-factor authentication* card, leave the *Enable* tab selected.
4. Type your current sync-account password and tap *Start setup*.
5. The server returns a fresh secret. Add it to an authenticator app — Google Authenticator, 1Password, Authy, Aegis, etc. — either by scanning the QR code URI or by typing the manual setup code.
6. Read the current 6-digit code from your authenticator app and tap *Verify and enable*.

After verification:

- Two-factor is on for this account.
- Every other session of this account is signed out — only the device that completed enrollment stays connected.
- The next login on any device will ask for a 6-digit code in addition to the password.

## Logging In With Two-Factor

When you sign in to a TOTP-enabled account, the password step still works the same way. As soon as the password is verified the app shows a dedicated *Enter your 6-digit code* screen instead of completing the login. Type the current code from your authenticator app and tap *Verify*.

A login challenge lives for **5 minutes**. After **5 wrong codes** on the same challenge it is burnt and you have to sign in from the password screen again — this is what keeps an attacker who steals a challenge id from brute-forcing the 6-digit code.

## Disabling

1. Open *Account Security*.
2. In the *Two-factor authentication* card, switch to the *Disable* tab.
3. Type your current sync-account password and a current 6-digit code.
4. Tap *Disable two-factor*.

Disable revokes every session of this account. You will need to sign back in on every device, including this one.

## Lost Authenticator App

Treat your account-level recovery code as your **only** backup for a lost authenticator:

1. On the login screen, tap *Account Security → Forgot password*.
2. Enter your login/email and the recovery code that was shown once at registration (or after the last reset).
3. Set a new password.

A successful recovery-code-driven reset does three things together:

- rotates the password,
- rotates the recovery code (the new code is shown exactly once — save it again),
- **disables two-factor on the account**.

After reset you sign in with the new password only, and you can re-enroll an authenticator on your new device. If you lose both the authenticator and the recovery code there is no app-side path back — keep at least one of them somewhere durable.

## What The Server Stores

The two backends store the same shape:

- TOTP secrets are AES-256-GCM encrypted at rest under a server-wide key, AEAD-bound to the account id so a swapped database row cannot be decrypted into another account.
- Each successful verification advances a per-account `last_used_step` counter; the same 30-second TOTP window cannot be replayed.
- Pending login challenges are persisted only as SHA-256 hashes, expire after 5 minutes, are single-use on success, and are destroyed after 5 wrong codes.

The plaintext shared secret is surfaced exactly once during enrollment, never logged, and never re-sent by the server. If you re-enroll later you get a fresh secret.

## Where The Code Lives

- API clients: [`src/sync/sync-api-client.ts`](../src/sync/sync-api-client.ts), [`src/sync/managed-cloud-api-client.ts`](../src/sync/managed-cloud-api-client.ts)
- Service wrapper: [`src/sync/sync-totp-service.ts`](../src/sync/sync-totp-service.ts)
- Account Security UI: [`src/ui/screens/sync-account-security/`](../src/ui/screens/sync-account-security/)
- Login challenge UI: [`src/ui/screens/backup-sync/BackupSyncTOTPChallengeSection.tsx`](../src/ui/screens/backup-sync/BackupSyncTOTPChallengeSection.tsx)
- i18n strings: [`src/i18n/totp-copy.ts`](../src/i18n/totp-copy.ts)

The server side lives in the managed cloud service and in `ovumcy-sync-community` (self-hosted). See the self-hosted repository for backend behaviour, deployment knobs (`FIELD_ENCRYPTION_KEY`, `TOTP_ISSUER`), and operator-facing observability.
