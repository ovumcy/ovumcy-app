### Fixed

- **Deleting your account no longer leaves reminders firing.** Account deletion now clears the local reminder schedule right after wiping local data, including when a secret clear fails after the wipe; "Delete all data" does the same in that case, instead of keeping reminders planned from the deleted history until the next launch.
