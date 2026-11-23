### Fixed

- **Resetting another account's password no longer signs this device out.** After a password reset the app checks whether this device's own sync session was actually ended by it, and signs the device out only then. Resetting the password of a different account from the forgot-password form leaves this device connected.
