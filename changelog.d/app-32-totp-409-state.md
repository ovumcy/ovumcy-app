### Fixed

- **Two-factor screen recovers from a stale state.** On a self-hosted server, disabling two-factor that was already turned off elsewhere now reloads the account state and returns to the Enable tab, and verifying a setup that is no longer pending asks you to start setup again, instead of reporting a server fault.
