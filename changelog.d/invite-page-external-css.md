### Internal

- **Invite fallback page has no inline styles.** The `invite.ovumcy.cloud/backup-sync` page loads its styles from `/backup-sync/style.css`, so the invite host can serve `style-src 'self'`. The page looks the same.
