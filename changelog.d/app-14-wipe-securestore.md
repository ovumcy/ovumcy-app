### Security

- **Clearing local data and deleting the account remove every stored secret.** Both now also delete the partner-share keys, the signed entitlement token and the sync certificate pins from the device's secure storage, not only the sync secrets. If any of them cannot be deleted, the action reports a failure instead of success. Disconnecting sync and switching sync mode are unchanged.
