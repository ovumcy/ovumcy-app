### Security

- **A damaged record no longer erases all local data.** The check that the encryption key still matches the stored data now resets the database only on a real key mismatch, not when one record cannot be parsed or the database read fails. The reset itself is all-or-nothing, so a crash midway leaves the data as it was. A record whose encrypted part has been removed is discarded instead of being accepted from its unencrypted columns.
