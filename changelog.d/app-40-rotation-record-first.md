### Changed

- **Write down the new recovery phrase before it is sent.** Changing the recovery phrase of an Ovumcy Cloud account now shows the new phrase first and asks you to confirm that you wrote it down before the password step can be submitted. The phrase becomes active only once Ovumcy Cloud confirms the change, and a retry sends the same phrase you wrote down.

### Fixed

- **Clearer recovery-phrase change errors.** When Ovumcy Cloud cannot change the phrase at the moment, the app now says that nothing was changed instead of a general failure, and when a two-factor code was used up without changing anything it asks for a new code instead of suggesting the change may already have happened.
