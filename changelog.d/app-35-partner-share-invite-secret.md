### Security

- **Ovumcy Cloud can no longer derive partner-share keys.** The key that encrypts a partner's shared view used to come from the invite token, which the managed server mints and sees. It now comes from a secret your device generates when it creates the invite and adds to the end of the invite link, a part of the link that no server request carries. Partner invites created before this change no longer work, and pairs that accepted one stop syncing: revoke the old invite and send a new one.
