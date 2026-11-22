### Fixed

- **Opening local data recovers after a failed startup write.** When a startup write could not be undone, the next attempt to open local data no longer fails until the app is restarted.
