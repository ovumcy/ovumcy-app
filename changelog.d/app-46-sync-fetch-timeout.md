### Fixed

- **Self-hosted sync no longer waits forever on a stalled server.** Requests to a self-hosted sync server now give up after 30 seconds (2 minutes for backup upload and download) and report a connection problem instead of hanging.
