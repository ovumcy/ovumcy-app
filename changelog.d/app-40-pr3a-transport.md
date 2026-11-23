### Fixed

- **Disconnecting tells you when the server did not confirm the sign-out.** The app still signs you out on this device, but if the server could not be reached or refused, it now says the server session ends when it expires instead of claiming it was removed.
- **Ovumcy Cloud sign-in and sign-up show how long to wait after too many attempts**, as self-hosted sync already did.
- **A sign-up Ovumcy Cloud cannot start a trial for no longer reads as a connection problem.**
- **Signing in to a self-hosted server no longer undoes an Ovumcy Cloud session renewal that happened at the same moment**, which could end the cloud session.
