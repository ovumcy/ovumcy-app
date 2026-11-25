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
- The account recovery code is **replaced**, on Ovumcy Cloud and on a self-hosted (community) server alike: the code from registration or your last regeneration stops working (on a self-hosted server any pending password-reset token dies with it). The app shows the new code exactly once in the *Save this recovery code* dialog. It is held only in screen memory until you tap *I have saved it* (the system back gesture does not close the dialog) or leave the screen — never written to storage, logs, the clipboard, or a URL. A self-hosted server too old to rotate the code sends none, and then no dialog appears.
- If the response is lost on the way back (network drop) the server has still turned two-factor on and replaced the code. The app re-checks the account and, when two-factor is on, says the new code never arrived; use *Regenerate recovery code* to get one (see below).

## Regenerating The Recovery Code With Two-Factor On

With two-factor on, *Regenerate recovery code* asks for a current 6-digit code next to your password, on Ovumcy Cloud and on a self-hosted (community) server alike. A recovery-code reset turns two-factor off, so the server will not hand out a new recovery code for the password alone. The app shows the code field whenever it knows two-factor is on, and also after the server refuses a regeneration for a missing or wrong code (for example when the two-factor status could not be loaded). A wrong code counts toward a per-account attempt limit (on a community server the same one as login and disable codes; on Ovumcy Cloud one shared with disable), and a code already used once is refused until the next one appears in your authenticator. The code travels in the request body only, is sent only when the field is shown, and is cleared from the screen after a successful regeneration.

With or without two-factor, the server replaces the recovery code before it answers a regeneration. If that answer never reaches the app (a network drop or an unreadable reply), the app warns that the old code may no longer work and asks you to regenerate again; a refusal the server did answer, such as a wrong password, keeps its own message.

On Ovumcy Cloud a regeneration also ends every session of the account, on every device, this one included. The app shows the new code first and clears the local session once the server has answered; after you confirm the code is saved it says to sign in again. A self-hosted (community) server keeps its sessions, so nothing is signed out there.

## Changing The Password On A Self-Hosted Server

A self-hosted (community) server replaces the recovery code whenever the password changes, and the old code stops working at once. The app shows the new code once, in the same *Save this recovery code* window as a regeneration; save it before closing. With two-factor on, *Change password* also asks for a current 6-digit code, because the new recovery code could otherwise reset the password and turn two-factor off. The code field appears whenever the app knows two-factor is on, and also after the server refuses the change for a missing or wrong code. A wrong code and a code already used each keep their own message. If the answer never reaches the app, it warns that the password and the recovery code may already have changed; generate a new recovery code with whichever password works. Ovumcy Cloud does not ask for a code here.

Deleting an account asks for your account password after the device check and the confirmations, and — with two-factor on — a current 6-digit code; the server erases nothing until both are right. This holds for Ovumcy Cloud and for a self-hosted (community) server alike; a self-hosted delete is never sent without the password, since the server would refuse it and still count it against the account's attempt limit. The code field shows whenever two-factor is on or its status could not be loaded; an empty code is not sent. A wrong password or code, a code already used, or too many attempts keep the form open with their own message, and nothing on the device is touched. Codes count toward the same per-account attempt limit as disable and regenerate. The password and code travel in the request body only and are cleared from the form on every submit. A guest partner session has no password, so it deletes without the form.

If verification fails:

- *Code is incorrect* — besides a mistyped or expired code, this is also what you see when setup was started again on another device: only the newest pending secret counts. Finish setup on that device, or tap *Cancel* and start again here.
- *This setup is no longer pending* — the server allows 10 codes per pending secret and then discards it (a 409 answer). The app returns you to the password step to start setup again with a fresh secret.
- *Too many attempts* — the server's per-account rate limit (a 429 answer) is not a discard: the pending setup stays, so wait a moment and enter a new code on the same screen.

## Removing A Device On A Self-Hosted Server

Removing a device from a self-hosted (community) server's device list asks for confirmation first. With two-factor on, the server then asks for your account password and a current 6-digit code; the app shows a prompt for them under the device list and retries the removal once you confirm. A wrong password or code, a code already used, or too many attempts keep the prompt open with that message; a rate limit hit before the prompt shows how long to wait. The password and code travel in the request body only and are cleared from the screen afterwards. Removing this device signs this install out of the server, since the server revokes every session bound to the removed device. Ovumcy Cloud binds no session to a device and never asks for the prompt.

## Replacing The Recovery-Key Backup On A Self-Hosted Server

When an upload would replace the recovery-key package your self-hosted (community) server holds — typically the first upload after *Set up sync on this device* created a new phrase — the server asks for your password and, with two-factor on, a current 6-digit code. The app shows a prompt for them and retries the upload once you confirm. A wrong password or code, or a code already used, keeps the prompt open with that message. Both values travel in the request body only and are cleared from the screen afterwards.

The server cannot write the package and the backup in one step, so the app checks the backup first: before replacing the package it makes sure the encrypted backup fits the server's size limit and is newer than the stored one. An unchanged package is never rewritten. A device that has already uploaded under its own key never replaces a different package: another device changed it, and this device should be recovered with the current phrase instead.

## Changing The Recovery Phrase On Ovumcy Cloud

On a connected Ovumcy Cloud account, *Change recovery phrase* asks you to confirm, checks the device lock, and then asks for your account password and, with two-factor on, a current 6-digit code. The new phrase appears only after Ovumcy Cloud confirms the change; until then the current phrase stays active. If the change cannot be confirmed (for example the sync service is briefly unavailable), the prompt stays open and asks you to try again with a new code — the app resends the same new phrase, never a second one. A wrong password or code, a code already used, or too many attempts keep the prompt open with that message. The password and code travel in the request body only and are cleared from the screen afterwards.

## Logging In With Two-Factor

When you sign in to a TOTP-enabled account, the password step still works the same way. As soon as the password is verified the app shows a dedicated *Enter your 6-digit code* screen instead of completing the login. Type the current code from your authenticator app and tap *Verify*.

Recovering a self-hosted account with the recovery phrase works the same way: after the password the app asks for the code, then finishes the recovery with the phrase you entered. The phrase stays on the form only until the recovery completes. If the code is accepted but the recovery still fails (for example a mistyped phrase), the code is spent and the app returns to the recovery form.

A login challenge lives for **5 minutes**. After **5 wrong codes** on the same challenge it is burnt and you have to sign in from the password screen again — this is what keeps an attacker who steals a challenge id from brute-forcing the 6-digit code.

## Disabling

1. Open *Account Security*.
2. In the *Two-factor authentication* card, switch to the *Disable* tab.
3. Type your current sync-account password and a current 6-digit code.
4. Tap *Disable two-factor*.

Disable revokes every session of this account. You will need to sign back in on every device, including this one.

If two-factor was already turned off elsewhere, the server (self-hosted or Ovumcy Cloud) says so and the app reloads the account state and switches back to the *Enable* tab instead of reporting a server fault. Likewise, verifying a setup that is no longer pending (it expired, or a newer setup replaced it) asks you to start setup again. "Two-factor is not configured on this server" now means only that the server itself lacks its field-encryption key.

## Lost Authenticator App

Treat your account-level recovery code as your **only** backup for a lost authenticator:

1. On the login screen, tap *Account Security → Forgot password*.
2. Enter your Account ID (Ovumcy Cloud) or login (self-hosted) and the recovery code you saved last — shown once at registration, after the last reset or regeneration, when you turned two-factor on, or (self-hosted) when you changed the password.
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
