### Fixed

- **Cloud sync status no longer overstates a locked sync.** The settings-hub `Backup & sync` card
  says the cloud plan does not include sync, instead of "Ovumcy Cloud is active", when the server
  refuses sync under an active plan, and shows the plan-check message when that answer is missing;
  signing in to a managed account whose plan or sync permission could not be confirmed shows the
  plan-check message instead of "connected".
