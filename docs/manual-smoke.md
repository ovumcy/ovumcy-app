# Ovumcy App Manual Smoke Checklist

This checklist is the minimum manual acceptance pass for `ovumcy-app`.

## When To Run It

- before opening the repository to public review
- before tagging a release
- after changes to onboarding, navigation, local persistence, branding, or platform-visible shell behavior

## Android

Run on an Android emulator or physical device.

1. Fresh install opens onboarding, not dashboard.
2. Step 1 day-chip date selection works and stays compact on a narrow screen.
3. Step 2 renders without clipped sliders, toggles, or buttons.
4. Finish redirects to dashboard.
5. Relaunch keeps the completed onboarding state.
6. Dashboard shows a real cycle snapshot and today-journal surface, not shell placeholder copy.
7. Saving a today-journal entry on the dashboard persists locally after returning to the app.
8. Calendar opens the current month with visible day markers for logged data and intimacy after saving a today-journal entry.
9. Selecting a marked day in the calendar opens the same saved day details instead of an empty editor.
10. Settings screen saves cycle parameters locally, and the dashboard snapshot reflects the new values after returning.
11. Tracking toggles in settings update dashboard visibility correctly:
   - `Hide intimacy` hides the intimacy section
   - `Track BBT` shows the BBT section with the selected temperature unit
   - `Track cervical mucus` shows the cervical-mucus section
12. Enabling `Unpredictable cycle` switches dashboard copy to facts-only mode instead of showing fake predictions.
13. After two completed cycles exist in local history, the `Insights` tab stops showing the empty state and renders reliability plus cycle-length cards.
14. Settings allows creating a custom symptom, and the new symptom appears in the dashboard and calendar day editor for new entries.
15. Archiving a custom symptom removes it from new-entry symptom pickers without breaking older day entries that already used it.
16. Settings export section shows the current entry summary, and `Export as CSV`, `Export as JSON`, and `Export as PDF` open a local share or save flow without leaking data into a URL.
17. Settings shows explicit `Interface` and `Account & Sync` status sections instead of silently missing web-only account controls.
18. Danger zone requires typed confirmation before clearing local data, and a confirmed clear returns the app to onboarding.
19. Bottom tabs render and switch without broken icons or duplicate labels.
20. No account, sync, or cloud requirement is shown for core local use.

## iOS

Run on an iOS simulator or physical device.

1. Fresh install opens onboarding, not dashboard.
2. Step 1 day-chip date selection works and stays compact on a narrow screen.
3. Step 2 renders without clipped sliders, toggles, or buttons.
4. Finish redirects to dashboard.
5. Relaunch keeps the completed onboarding state.
6. Dashboard shows a real cycle snapshot and today-journal surface, not shell placeholder copy.
7. Saving a today-journal entry on the dashboard persists locally after returning to the app.
8. Calendar opens the current month with visible day markers for logged data and intimacy after saving a today-journal entry.
9. Selecting a marked day in the calendar opens the same saved day details instead of an empty editor.
10. Settings screen saves cycle parameters locally, and the dashboard snapshot reflects the new values after returning.
11. Tracking toggles in settings update dashboard visibility correctly:
   - `Hide intimacy` hides the intimacy section
   - `Track BBT` shows the BBT section with the selected temperature unit
   - `Track cervical mucus` shows the cervical-mucus section
12. Enabling `Unpredictable cycle` switches dashboard copy to facts-only mode instead of showing fake predictions.
13. After two completed cycles exist in local history, the `Insights` tab stops showing the empty state and renders reliability plus cycle-length cards.
14. Settings allows creating a custom symptom, and the new symptom appears in the dashboard and calendar day editor for new entries.
15. Archiving a custom symptom removes it from new-entry symptom pickers without breaking older day entries that already used it.
16. Settings export section shows the current entry summary, and `Export as CSV`, `Export as JSON`, and `Export as PDF` open a local share or save flow without leaking data into a URL.
17. Settings shows explicit `Interface` and `Account & Sync` status sections instead of silently missing web-only account controls.
18. Danger zone requires typed confirmation before clearing local data, and a confirmed clear returns the app to onboarding.
19. Bottom tabs render and switch without broken icons or duplicate labels.
20. No account, sync, or cloud requirement is shown for core local use.

## Web Smoke

Run when web support, branding, or app-shell navigation is touched.

1. `npm run e2e:web`
2. Manual browser check:
   - `/` opens onboarding on a clean local state
   - onboarding finish leads to dashboard
   - dashboard renders cycle snapshot and the today-journal editor section
   - saving a day entry on the dashboard updates local state without a page error
   - calendar shows markers for the saved entry and opens the same day details when that day is selected
   - after two completed cycles exist, insights render reliability and cycle-length cards instead of the empty unlock state
   - settings can create a custom symptom and that symptom appears in dashboard and calendar day editors for new entries
   - settings shows explicit `Interface` and `Account & Sync` status blocks
  - settings export summary reflects the current logged range, and CSV/JSON/PDF downloads succeed with local file downloads instead of opening sensitive data in the URL
   - danger zone requires typed confirmation before clearing local data, and a confirmed clear returns the browser shell to onboarding
   - reloading the web preview resets the app to onboarding instead of retaining health data as durable browser storage
   - settings saves local profile and dashboard visibility changes follow the saved toggles
   - enabling `Unpredictable cycle` changes dashboard to facts-only copy
   - favicon is visible on a fresh browser session
   - no broken tab icons or shell glyphs appear

## Privacy Checks

During the same pass, confirm:

- onboarding completion works without an account
- no sensitive values appear in URLs
- no debug logging prints health-related onboarding data
- app behavior still makes sense with sync absent
- web preview does not retain health data after a browser reload or a new session
- exported filenames stay generic and do not include notes, symptom names, or user identifiers
