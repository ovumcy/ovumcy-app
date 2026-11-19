### Fixed

- **A failed account deletion can be finished.** When Ovumcy Cloud or a self-hosted server has already erased the account but clearing this device failed, trying again now clears the device after the usual device check and confirmations, instead of failing on the server's "unauthorized" answer.
- **Account deletion no longer fails on an expired session.** An Ovumcy Cloud session about to expire is renewed before the deletion request.
- **"Clear local data" clears saved sign-in secrets even when the data reset fails.**
