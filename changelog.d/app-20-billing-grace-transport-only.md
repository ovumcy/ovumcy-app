### Security

- **Offline premium grace is served on transport failure only.** The 72-hour cached billing snapshot and cached entitlement token are no longer served after an explicit server refusal (unauthorized or any other client error); they apply only when the server could not be reached or reported temporary unavailability. Partner projection sync and the backup-sync partner-access pre-check read billing live-only and never the cache.
