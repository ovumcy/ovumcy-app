### Fixed

- **Ovumcy Cloud no longer signs you out by accident, and never hangs.** Two screens renewing your Ovumcy Cloud session at the same moment could reuse a renewal key that had already been used, which ends the session on the server and signs you out. Only one renewal now runs at a time, and it always uses the newest key. Every Ovumcy Cloud request now gives up after 30 seconds instead of waiting forever.

### Security

- **A server error no longer unlocks offline premium.** Premium features keep working for up to 72 hours when Ovumcy Cloud cannot be reached. An internal error answered by the server no longer counts as "cannot be reached", so it no longer opens that offline window.

### Internal

- Managed calls can go through one helper that renews the session on a 401 and retries once. A rejected access token alone never clears the refresh token.
