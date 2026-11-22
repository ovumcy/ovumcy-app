### Fixed

- **A backup with a malformed day no longer stops the restore partway.** Wrong-typed fields in an
  imported day fall back to their defaults, and the days after it are still restored.
- **A backup of a large symptom list can be restored.** Settings and the restore share one limit
  of 200 symptoms; a backup over it is accepted, and the symptoms that no longer fit are named in
  the preview and the result instead of the whole file being refused.
- **Exporting no longer hangs when the share sheet is unavailable.** A failing availability check
  now reports that sharing is unavailable.

### Security

- **Restore never stores ids chosen by the file.** Pregnancy, kick, contraction, postpartum and
  screening records get new random ids; a repeated import is still recognised by content.
- **Restore cannot quietly change device protections.** Screen-capture protection can only be
  turned on by a restore, and reminders from a backup are turned on only through an explicit
  option in the preview, off by default.
- **The preview shows what will be applied.** The backup range comes from the file's day logs,
  not its summary, and confirming re-checks the counts and asks again if the device changed.
- **The native file size check reads the copy that is imported**, not only the size the picker
  reports.
