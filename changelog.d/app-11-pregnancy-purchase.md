### Added

- **Pregnancy mode can be unlocked with a one-time Google Play purchase.** The locked pregnancy card now opens a purchase screen with the store's price, `Buy` and `Restore purchases`. No subscription and no Ovumcy account are involved; the purchase stays with your Google Play account and is found again after a reinstall. Everything already logged stays readable and exportable whether or not the module is unlocked.

### Security

- **The purchase is decided on the device and stored nowhere by the app.** Ownership is read from Google Play each time it matters; a pending, cancelled or failed purchase unlocks nothing. The store library is used for billing calls only — none of its verification features is reachable from the app.
- **Google's billing component is disclosed, and started only for pregnancy mode.** Buying through Google Play requires Google's own billing library inside the Android app; it can send Google diagnostics about its own operation. Ovumcy starts it only when the app checks or sells pregnancy mode — after a positive pregnancy test is logged, or when pregnancy mode or its purchase screen is opened — and gives it no health data. The privacy notice has a new section, "Buying through Google Play", and its date is updated.

### Dependencies

- Added `expo-iap` 6.5.1 (Google Play Billing Library 9.1.0), pinned exactly.
