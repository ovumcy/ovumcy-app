### Fixed

- **Sync backups restore on a new phone.** The snapshot encryption context no longer depends on the uploading device, so a device recovered from the recovery phrase can open backups made elsewhere. Backups written earlier still restore on the device that wrote them and are rewritten on the next upload; a backup an older version uploaded from another device cannot be opened until that device uploads again with this version. Update every device on the account: an older app version cannot open a backup this version uploaded.
