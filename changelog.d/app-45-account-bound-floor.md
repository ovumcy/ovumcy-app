### Fixed

- **Signing in to a different sync account no longer overwrites its backup without asking.** The device now remembers which account its sync history belongs to. After signing out of one account and into another, the first upload checks the server again and asks before replacing a backup that is already there.
- **Changing the recovery phrase on a newly signed-in phone can no longer replace the account's key.** The change is offered only after the phone has restored or uploaded a backup with its key, so a phone that signed in without the recovery phrase never swaps out the key that opens the existing backup.
- Leaving the backup screen while a disconnect is still finishing no longer offers to save sync settings at the same time.
