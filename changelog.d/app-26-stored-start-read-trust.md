### Fixed

- **Restoring a JSON backup keeps the last period start consistent.** A restored spotting day, or a cycle start marked uncertain, on the date of your last period start now moves that start to the latest cycle start left, as saving the same day does. Before, the old start was only hidden while that day stayed spotting or uncertain.
- **The app no longer waits forever on a stuck start-up check.** If the one-time check of the last period start takes longer than ten seconds, the app opens anyway.
