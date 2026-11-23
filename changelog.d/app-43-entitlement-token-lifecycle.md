### Security

- **Signing out of Ovumcy Cloud now removes the cached premium token.** The signed-out account's premium token no longer stays on the device, so a later session can never read it while offline.
- **A new Ovumcy Cloud sign-in drops the previous account's cached plan first.** If the app is closed in the middle of signing in, the offline plan cache can no longer carry the previous account's plan into the new session.
