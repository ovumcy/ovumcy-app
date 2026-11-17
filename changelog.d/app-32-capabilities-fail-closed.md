### Security

- **An upload stops when the server's capabilities cannot be read.** It no longer goes ahead without them, so a backup under a new recovery key never lands beside the old recovery-key backup on the server.
- **Signing in to a self-hosted account no longer touches its recovery-key backup.** Only creating an account stores one at connect; after a sign-in, with or without a two-factor code, the first upload replaces it after asking for your password.
