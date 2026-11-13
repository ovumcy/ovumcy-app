### Fixed

- **Sync backups restore on a new phone.** The snapshot encryption context no longer depends on the uploading device, so a device recovered from the recovery phrase can open backups made elsewhere. Backups written earlier by the same device still restore and are rewritten on the next upload. Update every device on the account: an older app version cannot open a backup this version uploaded.
