### Security

- **Disconnecting the managed cloud ends this device's refresh family.** A token renewal already in flight is settled first so the logout revokes the newest refresh token, a logout that fails on the network is retried once, and every managed credential, the refresh token included, is wiped from secure storage.
