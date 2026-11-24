### Changed

- **Regenerating the recovery code on Ovumcy Cloud signs this device out.** The server now ends
  every session of the account on a regeneration, this one included. The app shows the new code
  first, clears the local session, and asks you to sign in again once the code is confirmed.
  Self-hosted servers keep their sessions and are unaffected.
