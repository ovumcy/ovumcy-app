### Fixed

- **An upload no longer overwrites a backup another device made.** If another device uploaded since this one last synced, the upload stops and asks you to restore that backup first. When an upload's reply is lost, the app checks whether the backup landed before reporting a failure.

### Security

- **Self-hosted sync refuses redirects.** Requests to a self-hosted sync server no longer follow a redirect to another address, so the session and your data never reach a host you did not configure.
