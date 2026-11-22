### Fixed

- **An upload no longer overwrites a backup another device made.** If another device uploaded since this one last synced, the upload stops and asks you to restore that backup first. An upload whose reply was lost is recognised on the next try instead of failing.

### Security

- **Self-hosted sync refuses redirects.** Requests to a self-hosted sync server no longer follow a redirect to another address, so the session and your data never reach a host you did not configure.
