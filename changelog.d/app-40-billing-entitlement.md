### Security

- **Ovumcy Cloud premium follows billing answers more closely.** A plan the server has explicitly refused no longer comes back from the offline cache on the next network blip, a refused entitlement token is dropped instead of being kept for offline use, and a signed token that grants nothing now locks the doctor PDF and advanced insights rather than leaving the older plan state in place. Billing answers that arrive after you sign out or switch accounts are discarded, and moving the device clock back no longer extends the 72-hour offline grace once it has been used.

### Fixed

- **Settings and plan details match the rest of the app offline.** While offline, Settings unlocks the doctor PDF on the same 72-hour grace as the other premium screens, and sync actions still wait for a live plan check. The plan banner no longer says a plan will renew when its status is past due, canceled, expired or in a payment grace period, and an offer stops showing at its end time instead of one moment later.

### Internal

- **Release checks.** The entitlement public-key guard rejects an empty key map or a key that is not a 32-byte Ed25519 key in hex, and the release account smoke checks that account deletion asks for the current password.
