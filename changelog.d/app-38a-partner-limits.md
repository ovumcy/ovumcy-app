### Fixed

- **Clear messages for partner-access limits.** Trying to create an invite past the pending-invite limit, or to accept one when the inviting person already shares with the maximum number of partners, now explains the limit instead of showing a generic error.
- **Partner updates back off when Ovumcy Cloud is busy.** When the cloud asks the app to slow down, partner updates pause for the requested time instead of retrying on every screen change, then resume with the latest data.
- **Revoking partner access also clears pending invites.** Revoking a partner now also revokes pending invite links, and the link shown on screen is cleared with them.
