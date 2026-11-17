### Fixed

- **Restoring from sync drops a cycle start dated after today.** A snapshot from a device with a wrong clock could set your last period start to a future date, which predictions then anchored on. Sync restore now refuses it the same way JSON import, Settings and onboarding do.
