### Fixed

- **Removing a device from a self-hosted account says what happens.** The server signs out every session of a removed device, so the confirmation now says so, and removing the device you are using signs this device out of sync right away. With two-factor on, the removal asks for your password and a current code.
- **Turning two-factor off signs this device out too.** The server ends every session of the account, including this one; the app now clears its own session and asks you to sign in again.
- **Too many two-factor setup codes no longer throws the setup away.** A self-hosted server's attempt limit keeps the pending setup; the app asks you to wait instead of starting over.
- **A sign-in, recovery or device removal that hits the server's rate limit shows how long to wait.**
- **A recovery key replaced by another device on a self-hosted server gets its own explanation** instead of the Ovumcy Cloud text.
