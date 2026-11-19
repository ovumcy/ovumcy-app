### Security

- **Disconnecting from Ovumcy Cloud revokes the session even after it went idle, and never hangs.** Disconnect now sends the stored refresh token with the logout, so the server ends the whole session family without the app first renewing an expired access session. The server step is capped at ten seconds; after it, every Ovumcy Cloud credential is erased from the device whatever the server answered. The refresh token is sent only in the request body and never logged.
