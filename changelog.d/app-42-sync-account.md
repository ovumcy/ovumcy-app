### Fixed

- **Deleting a self-hosted sync account works again.** The app now asks for the account password (and the current two-factor code when two-factor is on) and sends it with the request, as the sync server requires; before, every attempt was refused and counted against the server's attempt limit.
- **Changing a self-hosted password no longer leaves a dead recovery code.** The server replaces the recovery code when the password changes; the app now shows the new code once, asks for the two-factor code on accounts that have it on, and names a wrong or reused code instead of a generic error.
- **Recovering a self-hosted account with the recovery phrase works when two-factor is on.** The app asks for the two-factor code and then finishes the recovery, instead of failing with "not connected".
- **A failed upload can no longer strand the previous backup.** Before replacing the recovery-key package on a self-hosted server, the app checks that the backup will fit the server's size limit and is newer than the stored one, never rewrites an unchanged package, and refuses to overwrite a package another device replaced.
- Too many attempts during upload, phrase recovery and account deletion now show a "wait and try again" message instead of a generic error.
