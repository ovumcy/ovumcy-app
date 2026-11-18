### Fixed

- **Clear messages for partner-access limits.** Creating an invite past the pending-invite limit, or accepting one when the inviting person already shares with the maximum number of partners, now says so instead of showing a generic error; the invite stays usable once a partner is removed.
- **Partner updates back off when Ovumcy Cloud is busy.** When the cloud asks the app to slow down, partner updates pause for the requested time instead of retrying on every screen change, and resume with the latest data afterwards.
- **Revoking partner access also clears pending invites.** Revoking a partner now also revokes pending invite links, and the link shown on screen is cleared with them.
