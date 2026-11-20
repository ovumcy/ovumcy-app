### Fixed

- **Backup restore no longer duplicates a day.** A day-log date padded with whitespace in an imported file is now matched to the day it names, so an already-logged day is skipped and a new day is stored under its trimmed date. Custom-symptom ids padded in the file are remapped too.
