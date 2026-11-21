### Added

- **Partner invite link can be shared from the app.** The owner's invite link is now selectable and has a Share action that opens the system share sheet. The link is still shown only once.

### Changed

- **Invite link hint no longer says an Ovumcy Cloud sign-in is required.** A partner can accept as a guest; the hint is corrected in all six languages.
- **A newer invite link replacing a pending one is announced** on the accept card.

### Fixed

- **A malformed invite link no longer burns the single-use invite.** The link is checked on the device before the invite is redeemed, for both guest and signed-in accept.

### Security

- **Revoking a pending invite drops its link from the screen,** and the raw inbound link is no longer kept in screen state after the invite secret is read.
