### Changed

- **Ovumcy Cloud signs in with an Account ID instead of an email.** Creating an account, or
  keeping a guest partner's access, asks only for a password; the cloud generates a 16-character
  Account ID (shown as `xxxx-xxxx-xxxx-xxxx`) and the app shows it once with the recovery code.
  Sign-in and password recovery take the Account ID in any spelling (with or without dashes, any
  case), and Account security shows it for the signed-in account. Self-hosted sync keeps its login.
