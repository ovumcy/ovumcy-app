### Security

- **Disconnecting the managed cloud ends this device's refresh family.** An expired access session is renewed first so the logout is accepted, a rolled-back logout is retried once, and every managed credential, the refresh token included, is wiped from secure storage.
