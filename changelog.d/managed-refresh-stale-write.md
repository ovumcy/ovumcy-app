### Fixed

- **Managed session renewal no longer reverts concurrent changes.** A token refresh finishing after a disconnect, a recovery-phrase rotation or a sync-session change now re-reads the stored secrets and writes only the renewed managed credentials, instead of restoring an older copy of the whole record. A refresh whose session was cleared or replaced meanwhile writes nothing.
