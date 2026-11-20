### Fixed

- **A restore that fails partway no longer raises the sync rollback floor.** The floor now rises only after the restored data is fully written, so an interrupted restore cannot make the next upload look current and overwrite the full backup with partial data.
