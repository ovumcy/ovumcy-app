### Fixed

- **Uploads to a self-hosted server no longer fail after setting up sync on a new device.** When an upload would replace the recovery-key backup your server holds, the app now asks for your account password, plus a current two-factor code when two-factor is on, and retries. Creating an account sends its password for this check automatically; signing in to an existing account leaves the replacement to the first upload, which asks before overwriting the backup on your server. Re-uploading the same recovery key needs nothing.

### Security

- **The recovery-key replacement is re-authenticated.** The password and code travel in the request body only and are never stored or logged.
