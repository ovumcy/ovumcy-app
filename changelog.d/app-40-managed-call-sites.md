### Fixed

- **Ovumcy Cloud no longer signs you out on an expired access session.** Sync, restore, device
  management, the cloud capabilities read and the guest-account upgrade now renew the session and
  retry once when the server rejects it; you are signed out only when the renewal itself is
  refused, and a renewal that fails for another reason shows an error and keeps you signed in.
