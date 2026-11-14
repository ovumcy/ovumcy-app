### Internal

- Removed the unused plaintext AsyncStorage storage adapter (only the legacy-migration reader and scrubbing clear remain), bound the sync envelope and recovery-phrase wrap to tests in the security matrix, corrected stale comments, and reused the shared calendar-day difference and Russian plural helpers.

### Fixed

- Russian guest-upgrade copy now uses the formal register consistently.
- Premium lock cards in stats no longer show a call to action that does nothing when no upgrade handler is supplied.
