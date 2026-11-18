### Fixed

- **Deleting an Ovumcy Cloud account works again.** Ovumcy Cloud now re-confirms the account password, and the current two-factor code when two-factor is on, before it erases an account. The app asks for both after the device check and the confirmations, sends them only in the request body, never logs or stores them, and keeps the form open with its own message after a wrong password or code. A guest partner session still deletes without a password.
