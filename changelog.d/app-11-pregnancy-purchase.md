### Added

- **Pregnancy mode can be unlocked with a one-time Google Play purchase.** The locked pregnancy card now opens a purchase screen with the store's price, `Buy` and `Restore purchases`. No subscription and no Ovumcy account are involved; the purchase stays with your Google Play account and is found again after a reinstall. Everything already logged stays readable and exportable whether or not the module is unlocked.

### Security

- **The purchase is decided on the device and stored nowhere by the app.** Ownership is read from Google Play each time it matters; a pending, cancelled or failed purchase unlocks nothing. The store library is used for billing calls only — none of its verification or reporting features is reachable from the app.

### Dependencies

- Added `expo-iap` 6.5.1 (Google Play Billing Library 9.1.0), pinned exactly.
