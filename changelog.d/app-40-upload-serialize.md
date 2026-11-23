### Fixed

- **Partner updates no longer arrive out of order.** Saves, screen refreshes and app resumes that trigger a partner update at nearly the same time now run one after the other, so the partner's shared view never falls back to an older copy. An update the server refuses as malformed now pauses further partner updates for a minute instead of being resent on every sync.
