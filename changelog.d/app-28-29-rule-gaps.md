### Fixed

- **Saving a day log reports a storage error instead of crashing.** When reading the profile, symptoms or neighbouring days fails during a save, the editor now shows the usual save failure rather than an unhandled error.

### Security

- **A pending partner invite token expires after 15 minutes.** An invite token waiting to be used for partner pairing is dropped if it is not consumed within 15 minutes, in addition to the existing clears on disconnect, account deletion and data reset.
