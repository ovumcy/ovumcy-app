### Fixed

- **Sync errors name what went wrong.** Too many attempts while connecting, restoring or managing devices now shows a "wait and try again" message, a busy sync server says so (with the wait it asked for, when it sent one) instead of a generic error, a server that does not accept new accounts says so, and an account with sync turned off reads like the managed "no active plan" case.
- **A backup that is too large for the server is named.** The upload stops before any write with a size message instead of a generic upload error.
- **Input limits are checked before sending.** A self-hosted login must be 3 to 254 characters, a device label 2 to 64, and a new password at most 72 bytes; each is named under its field instead of failing on the server.
- **The recovery code issued at registration is never lost.** When a self-hosted account is created but attaching the device fails afterwards, the one-time recovery code is still shown.
