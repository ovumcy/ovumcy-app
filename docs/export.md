# Data Export and Import Format

Ovumcy exports the owner's data locally, from the **Export data** section of Settings. Nothing is uploaded: the file is built on the device from the local repositories and handed to the operating system's share sheet (a browser download on the web build). JSON and CSV export and JSON import are Free-tier, need no account, no sync and no network, and are never blocked by the premium or pregnancy-mode state; only the PDF report below is premium.

- **JSON** — a full backup envelope: settings, symptom catalog, per-day records and the pregnancy-mode collections. It is the only format the app can restore.
- **CSV** — one row per logged day, for spreadsheets. Not restorable.
- **PDF** — a premium doctor report, generated on-device. Not a backup and not restorable. See [SECURITY.md](../SECURITY.md) for its entitlement gate and [sync-trust-model.md](sync-trust-model.md) for where it is built. It is out of scope for the rest of this document.

The ovumcy-web counterpart is a different format, and neither product imports the other's file (see [web-parity-checklist.md](web-parity-checklist.md)). Where web differs in a way a consumer could trip over, a line below says so.

## Range and summary

Both formats take a date range, chosen with a preset or two custom dates:

| Preset   | Range                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------- |
| `all`    | Earliest logged day through the upper bound (so a future-dated day extends it past today).           |
| `30`     | The last 30 days ending today, inclusive, clamped to the earliest logged day.                        |
| `90`     | The last 90 days, same rule.                                                                         |
| `365`    | The last 365 days, same rule.                                                                        |
| `custom` | Any `YYYY-MM-DD` pair accepted by the rules below. A range equal to a preset's is reported as that preset. |

The bounds are the earliest logged day and the upper bound, which is the later of the latest logged day and today (device local time). A custom range is refused when either date is not a real calendar date, when `from` is after the upper bound, when `to` falls outside the bounds, or when `to` is before `from`; a `from` earlier than the earliest logged day is accepted. With no logged days there are no bounds: the presets yield an empty range, which fails validation, while a custom pair of real dates is accepted and produces a file with no day records.

Before a file is produced the Settings screen shows a summary of the selected range: the number of logged days, whether any exist, and the earliest and latest logged day inside the range. The range is re-validated against fresh storage when the file is built, so a stale selection never exports a different window than the one validated.

What the range applies to is stated per collection below. Web differs: its range uses `from`/`to` query parameters and covers entries only.

## Delivery and artifact lifecycle

The file is named `ovumcy-export-YYYY-MM-DD.<csv|json|pdf>`, dated by the device's local day. Text formats are UTF-8, with no byte-order mark, and a trailing newline. CSV lines end in `\n`.

On Android and iOS the artifact is written into the app cache directory, handed to the share sheet, and deleted in a `finally` block as soon as the share sheet returns, whether the share succeeded or failed. If the process is killed while the sheet is open, that `finally` never runs, so the root layout sweeps the cache at every app start and deletes files whose names start with `ovumcy-export-` or `ovumcy-private-export-` (the latter belongs to the recovery-phrase export). The sweep never touches other cache entries. It also removes the document picker's cache subdirectory, where a JSON import copy can be left behind by a kill. The sweep is best-effort and silent. The web build creates an in-memory blob, triggers the download, and revokes the object URL half a second later; it writes no file and needs no sweep. The behaviour and its tests are listed in [SECURITY.md](../SECURITY.md#export-and-import-artifact-cleanup).

## JSON export

```json
{
  "app": "ovumcy",
  "formatVersion": 3,
  "exportedAt": "2026-05-17T11:32:01.000Z",
  "preset": "all",
  "range": { "fromDate": "2026-01-01", "toDate": "2026-05-17" },
  "summary": {
    "totalEntries": 142,
    "hasData": true,
    "dateFrom": "2026-01-01",
    "dateTo": "2026-05-17"
  },
  "profile": { "...": "..." },
  "symptoms": [{ "...": "..." }],
  "dayLogs": [{ "...": "..." }],
  "pregnancies": [],
  "kickSessions": [],
  "contractionSessions": [],
  "postpartumRecords": [],
  "screeningResponses": []
}
```

The file is pretty-printed with two-space indentation. Keys are camelCase, in the order above. Web differs: its file is a flat snake_case `{exported_at, entries}` list.

| Key                                     | Contents                                                                                                                                              | Range applied                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `app`, `formatVersion`                  | The literal `"ovumcy"` and the schema version `3`.                                                                                                    | n/a                                |
| `exportedAt`                            | UTC instant of the export, ISO 8601 with milliseconds. Web differs: it writes local time with an offset.                                              | n/a                                |
| `preset`, `range`, `summary`            | The selection and its summary as validated. `range` holds `YYYY-MM-DD` strings; `summary.dateFrom`/`dateTo` are `null` when empty.                    | n/a                                |
| `profile`                               | The whole settings record: cycle and tracking settings, reminders, appearance, the screen-capture-protection preference, the stored cycle start, and the optional crisis-support contact name and phone. | No, always complete                |
| `symptoms`                              | The whole symptom catalog, built-in and custom, including archived entries: `id`, `slug`, `label`, `icon`, `color`, `isArchived`, `sortOrder`, `isDefault`. | No, always complete                |
| `dayLogs`                               | Stored day records inside the range, ascending by date.                                                                                                | Yes                                |
| `pregnancies`                           | Every pregnancy record on the device.                                                                                                                 | No, episodic                       |
| `kickSessions`, `contractionSessions`   | Kick-count and contraction sessions.                                                                                                                  | Yes, by session date               |
| `postpartumRecords`                     | Every postpartum record on the device.                                                                                                                | No, episodic                       |
| `screeningResponses`                    | Mood-screening (EPDS) responses, including the answer vector.                                                                                         | Yes, by completion date            |

Not exported: sync credentials and device keys, the premium entitlement state and any recovery phrase. The recovery phrase has its own, separate export.

A `dayLogs` entry has the fields below. Enum values are lowercase strings, exactly the stored values.

| Field                                        | Type                | Notes                                                                                                                                   |
| -------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `date`                                       | `YYYY-MM-DD`        | Local calendar day.                                                                                                                     |
| `isPeriod`, `cycleStart`, `isUncertain`      | boolean             | Period day, manually marked cycle start, day flagged as uncertain.                                                                      |
| `flow`                                       | string              | `none`, `spotting`, `light`, `medium`, `heavy`.                                                                                         |
| `mood`                                       | integer             | Mood rating; `0` means unset.                                                                                                           |
| `sexActivity`                                | string              | `none`, `protected`, `unprotected`.                                                                                                     |
| `bbt`                                        | number              | Basal body temperature in Celsius, always, whatever the display unit; `0` means not measured. Accepted range on input is 34 to 43.       |
| `cervicalMucus`                              | string              | `none`, `dry`, `moist`, `creamy`, `eggwhite`.                                                                                           |
| `lhTest`                                     | string              | `none`, `negative`, `high`, `peak`. Web has no LH test.                                                                                 |
| `pregnancyTest`                              | string              | `none`, `negative`, `positive`.                                                                                                         |
| `cycleFactorKeys`                            | array of strings    | From `stress`, `illness`, `travel`, `sleep_disruption`, `medication_change`.                                                            |
| `symptomIDs`                                 | array of strings    | Ids into the file's own `symptoms` list.                                                                                                |
| `notes`                                      | string              | Free text, at most 2000 characters.                                                                                                     |
| `weightKg`, `bpSystolic`, `bpDiastolic`      | number, optional    | Pregnancy-mode metrics; the key is absent when not logged.                                                                              |

Web differs: it emits `symptoms` as a fixed object of booleans and custom names as `other_symptoms`. The app keeps ids and the catalog so a restore can rebuild custom symptoms. Pregnancy, postpartum and screening records follow the shapes in `src/models/pregnancy.ts`, `src/models/postpartum.ts` and `src/models/screening.ts`.

## CSV export

One header row, then one row per logged day inside the range, ascending by date. Fields containing a comma, a double quote or a newline are quoted per RFC 4180. Columns, in order:

```
Date, Period, Flow, Mood rating, Sex activity, BBT (C) | BBT (F), Cervical mucus,
LH test, Cramps, Headache, Acne, Mood, Bloating, Fatigue, Breast tenderness,
Back pain, Nausea, Spotting, Irritability, Insomnia, Food cravings, Diarrhea,
Constipation, Cycle factors, Other, Notes, Pregnancy test, Cycle start, Uncertain,
Weight (kg), BP systolic (mmHg), BP diastolic (mmHg), Kick count
```

Cell semantics:

- `Date` is `YYYY-MM-DD`.
- Boolean cells (`Period`, the 15 symptom columns, `Cycle start`, `Uncertain`) are `Yes` when set and empty otherwise. Web differs: it writes `Yes`/`No`.
- `Flow`, `Sex activity`, `Cervical mucus`, `LH test` and `Pregnancy test` carry the lowercase stored value, and are empty for `none`. Web differs: it writes capitalized labels.
- `Mood rating`, the weight and blood-pressure columns and `Kick count` are empty when unset. `Kick count` is the total of that day's kick-count sessions.
- `BBT` is empty when not measured. Unlike the JSON export, the CSV converts the stored Celsius value to the account's display unit, rounded to two decimals, and the header says which: `BBT (C)` or `BBT (F)`. Web differs: it always writes Celsius under `BBT (C)`.
- The 15 symptom columns are filled from the day's symptoms by label. `Mood swings` counts as `Mood`. Every other symptom, built-in or custom, is listed by name in `Other`, sorted alphabetically and joined with `; `. Web has a sixteenth built-in column, `Swelling`, that the app does not.
- `Cycle factors` is a `; `-joined list of the stored lowercase keys, for example `sleep_disruption`. Web writes display labels.
- Formula injection: `Cycle factors`, `Other` and `Notes` are the cells built from free text. A value that starts, after leading spaces, with `=`, `+`, `-`, `@`, a tab, CR or LF gets a leading `'`.

Collections that do not fit one row per day are JSON-only: pregnancies, contraction sessions, postpartum records and screening responses. Settings, the symptom catalog and the crisis contact are JSON-only too. The CSV carries no version marker.

## Import (restore)

The **Restore from backup** section of Settings restores a JSON export made by this app. It is free, offline and runs entirely on the device, in three steps: pick, preview, confirm.

1. **Pick.** The system document picker offers JSON files. A file over 10 MiB is refused before it is read. The picker's cache copy is deleted after the read attempt, whatever its outcome.
2. **Preview.** The file is parsed and a dry run counts what the restore would do, per category, without writing anything. The preview and the apply share one code path, so the confirmed counts match the previewed ones.
3. **Confirm.** Only after an explicit confirmation is the file applied.

Because the restore is additive, it asks for the preview and the confirmation only; it does not request device authentication. Restoring a sync backup is a different action and does.

The restore is strictly additive. Nothing already on the device is overwritten, merged into or deleted, so importing the same file twice changes nothing the second time.

- **Day logs.** A date that already holds data is skipped. A date without data receives the imported record, after it has been passed through the same normalization as a save from the day screen: unknown enum values fall back to `none`, notes are cut to 2000 characters, out-of-range values are dropped. A record with no parseable `date` is counted as rejected; a record that is empty after normalization is counted as skipped.
- **Custom symptoms.** Only user-created symptoms are restored. Built-in ones are never duplicated. A custom symptom whose label already exists is not created again, and days in the file that referenced it are remapped to the existing one. New symptoms get new local ids.
- **Profile.** Restored only on a pristine install: every field of the current profile must equal the default profile, and the imported profile must differ from the defaults. A single user-entered value, even the interface language, keeps the current profile as it is. The imported values are re-validated field by field.
- **Pregnancy, kick, contraction, postpartum and screening records.** Each record is sanitized and skipped when invalid or when its id already exists. An imported active pregnancy or active postpartum record is skipped while a different one is already active. The score and self-harm flag of a screening response are recomputed from its answers, never taken from the file.

Rejected as a whole, with nothing written:

| Cause                                                                                | Error                 |
| ------------------------------------------------------------------------------------ | --------------------- |
| Not valid JSON, or a top-level value that is not an object                           | `malformed`           |
| `app` is not `"ovumcy"`, or `formatVersion` is not `1`, `2` or `3` (this includes a web export) | `unrecognized_format` |
| More than 20 000 day logs, kick sessions, contraction sessions or screening responses, more than 200 symptoms, pregnancies or postpartum records | `too_large`           |

A missing collection is read as empty, so a version 1 or 2 file restores as before. CSV files cannot be imported.

## Stability

- The JSON envelope is versioned by `formatVersion`. Version 1 held profile, symptoms and day logs; version 2 added the pregnancy collections; version 3 added postpartum records and screening responses. New collections have so far been introduced under a new version, and the importer keeps reading every earlier version unchanged; optional per-day fields are added without one. Renaming or removing a key, or changing a value vocabulary, is a breaking change and ships with a migration note in `CHANGELOG.md`.
- CSV columns are stable by position. New columns are appended at the end only; existing columns are not reordered or removed. The `BBT` header text follows the display unit by design.
- A file with an unknown `formatVersion` is refused rather than partly applied, so a newer export never half-restores on an older app.
