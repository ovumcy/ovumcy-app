### Fixed

- **Offline JSON restore no longer adds unused custom symptoms.** A custom symptom from the file is created only when at least one day that references it is written; days skipped because the device already holds data no longer leave their symptoms behind, and the preview shows the same count.
- **Typing in the day notes keeps the space between words.** The notes field is trimmed when the day is saved, no longer on every keystroke.
