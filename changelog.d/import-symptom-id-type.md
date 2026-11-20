### Fixed

- **Restoring a JSON backup no longer aborts on a malformed symptom entry.** A day whose symptom list holds something other than text (a number, an empty value or an object) now skips just that entry and still imports the rest of the day, and the preview counts match the restore.
