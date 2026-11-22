### Fixed

- **Renaming the device no longer disconnects sync.** Editing the device label while connected keeps the sync keys, the session and the backup history; only a change of sync mode or server starts over.
- **A restore that cannot save everything stops instead of reporting success.** If saving a pregnancy, kick, contraction, postpartum or screening record fails, the restore stops with the device still marked mid-restore, so the next upload cannot push the reduced set over the backup. Records that fail validation are still skipped.
- **Creating a new recovery phrase keeps you signed in.** On a self-hosted or cloud account the session survives new local keys, so account deletion still reaches the server afterwards.
