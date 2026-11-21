### Security

- **Partner summary shares carry computed values only.** A summary-level partner share now ships the cycle day, next-period window and summary metrics computed on the owner's device, with no per-day dates, no symptom records and no last-period date. A partner build that receives an older summary payload still computes the view itself.
- **Partner payload digest is keyed.** The integrity digest stored next to a shared projection is now an HMAC under a key derived from the grant key, so the server can no longer confirm a guessed payload by hashing it. Older shares with the plain digest are still accepted.
- **Less shared data.** The usage goal is no longer part of a shared projection, and shared symptom records carry only the id, label and default flag.

### Fixed

- **Oversized partner uploads back off.** A partner projection the server rejects as too large is no longer retried on every sync, and one that would exceed the server limit is refused before any request is sent.
