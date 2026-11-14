### Fixed

- **Backup restore keeps the settings of a device that already has logged days.** A restore no longer replaces the cycle settings, including the last period start, when the device still has default settings but already holds day logs; the days in the file are still added.
- **Clearing a day uses the screen's own date.** The Dashboard and Calendar now repoint the stored period start against the date they render for, not the system clock.
