### Security

- **Restoring from sync now asks before rolling back to an older backup.** Each backup seals its version number, and the app remembers the newest version it has synced. If the server returns an older backup, or (on a device that has synced before) one made before this change, a second confirmation appears; dismissing it leaves the data on the device untouched. Every device on a sync account needs this version to restore backups uploaded after it.
