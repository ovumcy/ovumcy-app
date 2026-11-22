### Fixed

- **Backup & Sync no longer stays on loading after a corrupt billing cache.** A cached billing
  copy that cannot be decrypted is dropped at startup and read as empty, instead of failing
  every read of it.
- **Local storage survives interruptions more cleanly.** Moving data from the pre-SQLite store
  writes both settings rows together and finishes an interrupted earlier move; erasing pregnancy
  data removes the record and its kick and contraction sessions together or not at all.

### Security

- **The device key check covers every encrypted table.** A key that authenticates none of the
  stored rows now triggers the reset even when only pregnancy, postpartum, screening, sync or
  billing rows hold data.

### Changed

- **Faster cold start.** Day logs and symptoms already stored in the current format are no
  longer re-encrypted on every launch.
