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
6. Dashboard shows a real cycle snapshot and today-journal surface, not shell placeholder copy, with a distinct ovulation marker and four equal-sized phase cards under the cycle hero.
7. Editing a today-journal entry on the dashboard autosaves locally, shows save feedback, and persists after returning to the app.
8. Calendar opens the current month with all visible weeks fitting above the tab bar on a narrow screen, and any extra calendar help stays secondary instead of pushing the month grid off-screen.
9. Selecting a marked day in the calendar opens the same saved day details instead of an empty editor.
10. Empty days open directly in the editor, existing entries can still be edited from summary mode, and switching days or deleting an entry does not lose the last saved local state or leave the editor stuck half-open.
11. Settings screen saves cycle parameters locally, the dashboard snapshot reflects the new values after returning, and the reminders section keeps device-only reminder choices local with clear locked or permission feedback.
12. Changing a settings value and then switching tabs, leaving the screen, or opening `Backup & sync` shows a save-or-discard confirmation; `Save` persists the change before leaving, `Discard` leaves without saving, and `Cancel` stays on the screen.
13. Interface settings can toggle screenshot protection; enabling it blocks screenshots and recent-app previews on supported release builds, while disabling it allows captures again after saving.
14. Tracking toggles in settings update dashboard visibility correctly:
  - `Show intimacy section` keeps intimacy visible when on and hides it when off
  - `Track BBT` shows the BBT section with the selected temperature unit
  - `Track cervical mucus` shows the cervical-mucus section
15. Enabling `Unpredictable cycle` switches dashboard copy to facts-only mode instead of showing fake predictions.
16. After two completed cycles exist in local history, the `Insights` tab stops showing the empty state and renders reliability plus cycle-length cards.
17. Settings allows creating a custom symptom, and the new symptom appears in the dashboard and calendar day editor for new entries.
18. Archiving a custom symptom removes it from new-entry symptom pickers without breaking older day entries that already used it.
19. Settings export section shows the current entry summary; `Export as CSV` and `Export as JSON` always open a local share or save flow without leaking data into a URL, while `Export as PDF` stays locked unless the current managed cloud account has an active plan.
20. Settings shows a `Backup & sync` summary card with real status, destination, and last-sync details, and opens a dedicated `Backup & sync` screen for recovery phrase, account, plan, and sync actions.
21. If managed `Partner access` is unlocked, owner-side controls create a link-only invite without asking for partner email, show the canonical invite URL, and allow revoke of pending or accepted access.
22. On the dedicated `Backup & sync` screen, `Managed` mode keeps cloud account and billing outside the sync endpoint, while `Self-hosted` mode still exposes server endpoint plus inline account registration or login on the owner's server.
23. Danger zone requires typed confirmation before clearing local data, and a confirmed clear returns the app to onboarding.
24. Bottom tabs render and switch without broken icons or duplicate labels, and stay clearly above the Android system navigation buttons.
25. No account, sync, or cloud requirement is shown for core local use.
26. Pregnancy test field appears in the day editor with `None`, `Negative`, and `Positive` options. Selecting `Positive` autosaves locally and, after returning to dashboard, replaces the cycle hero prediction copy with the localized "predictions paused" banner. Calendar stops painting predicted period and fertile-window cells for the upcoming weeks until a new period is logged.
27. Without an Ovumcy Cloud plan, stats premium sections render as unified paywall lock cards (PREMIUM eyebrow, section title, description, `Open Ovumcy Cloud` CTA) instead of disappearing. Tapping the CTA navigates to `Backup & sync` so the upgrade path stays discoverable.
28. With an active Ovumcy Cloud plan, the same stats sections render real advanced-fertility, advanced-insight, and extended-report cards driven by canonical local history.

## iOS

Run on an iOS simulator or physical device.

1. Fresh install opens onboarding, not dashboard.
2. Step 1 day-chip date selection works and stays compact on a narrow screen.
3. Step 2 renders without clipped sliders, toggles, or buttons.
4. Finish redirects to dashboard.
5. Relaunch keeps the completed onboarding state.
6. Dashboard shows a real cycle snapshot and today-journal surface, not shell placeholder copy, with a distinct ovulation marker and four equal-sized phase cards under the cycle hero.
7. Editing a today-journal entry on the dashboard autosaves locally, shows save feedback, and persists after returning to the app.
8. Calendar opens the current month with all visible weeks fitting above the tab bar on a narrow screen, and any extra calendar help stays secondary instead of pushing the month grid off-screen.
9. Selecting a marked day in the calendar opens the same saved day details instead of an empty editor.
10. Empty days open directly in the editor, existing entries can still be edited from summary mode, and switching days or deleting an entry does not lose the last saved local state or leave the editor stuck half-open.
11. Settings screen saves cycle parameters locally, the dashboard snapshot reflects the new values after returning, and the reminders section keeps device-only reminder choices local with clear locked or permission feedback.
12. Changing a settings value and then switching tabs, leaving the screen, or opening `Backup & sync` shows a save-or-discard confirmation; `Save` persists the change before leaving, `Discard` leaves without saving, and `Cancel` stays on the screen.
13. Interface settings can toggle screenshot protection; enabling it blocks screenshots and app-switcher previews on supported release builds, while disabling it allows captures again after saving.
14. Tracking toggles in settings update dashboard visibility correctly:
  - `Show intimacy section` keeps intimacy visible when on and hides it when off
  - `Track BBT` shows the BBT section with the selected temperature unit
  - `Track cervical mucus` shows the cervical-mucus section
15. Enabling `Unpredictable cycle` switches dashboard copy to facts-only mode instead of showing fake predictions.
16. After two completed cycles exist in local history, the `Insights` tab stops showing the empty state and renders reliability plus cycle-length cards.
17. Settings allows creating a custom symptom, and the new symptom appears in the dashboard and calendar day editor for new entries.
18. Archiving a custom symptom removes it from new-entry symptom pickers without breaking older day entries that already used it.
19. Settings export section shows the current entry summary; `Export as CSV` and `Export as JSON` always open a local share or save flow without leaking data into a URL, while `Export as PDF` stays locked unless the current managed cloud account has an active plan.
20. Settings shows a `Backup & sync` summary card with real status, destination, and last-sync details, and opens a dedicated `Backup & sync` screen for recovery phrase, account, plan, and sync actions.
21. If managed `Partner access` is unlocked, owner-side controls create a link-only invite without asking for partner email, show the canonical invite URL, and allow revoke of pending or accepted access.
22. On the dedicated `Backup & sync` screen, `Managed` mode keeps cloud account and billing outside the sync endpoint, while `Self-hosted` mode still exposes server endpoint plus inline account registration or login on the owner's server.
23. Danger zone requires typed confirmation before clearing local data, and a confirmed clear returns the app to onboarding.
24. Bottom tabs render and switch without broken icons or duplicate labels, and stay clearly above the iOS home indicator or system navigation area.
25. No account, sync, or cloud requirement is shown for core local use.
26. Pregnancy test field appears in the day editor with `None`, `Negative`, and `Positive` options. Selecting `Positive` autosaves locally and, after returning to dashboard, replaces the cycle hero prediction copy with the localized "predictions paused" banner. Calendar stops painting predicted period and fertile-window cells for the upcoming weeks until a new period is logged.
27. Without an Ovumcy Cloud plan, stats premium sections render as unified paywall lock cards (PREMIUM eyebrow, section title, description, `Open Ovumcy Cloud` CTA) instead of disappearing. Tapping the CTA navigates to `Backup & sync` so the upgrade path stays discoverable.
28. With an active Ovumcy Cloud plan, the same stats sections render real advanced-fertility, advanced-insight, and extended-report cards driven by canonical local history.

## Web Smoke

Run when web support, branding, or app-shell navigation is touched.

1. `npm run e2e:web`
2. Manual browser check:
   - `/` opens onboarding on a clean local state
   - onboarding finish leads to dashboard
   - dashboard renders cycle snapshot with a distinct ovulation marker, uniform phase cards, and the today-journal editor section
   - editing a day entry on the dashboard autosaves and updates local state without a page error
   - calendar shows markers for the saved entry and opens the same day details when that day is selected
   - after two completed cycles exist, insights render reliability and cycle-length cards instead of the empty unlock state
   - settings can create a custom symptom and that symptom appears in dashboard and calendar day editors for new entries
   - changing a settings value and then switching tabs or opening `Backup & sync` shows a save-or-discard confirmation with working `Save`, `Discard`, and `Cancel` outcomes
   - interface settings can save and re-open a screenshot-protection toggle without throwing runtime errors in the browser shell
   - settings shows explicit `Interface` controls plus a `Backup & sync` summary card, and the dedicated `Backup & sync` screen supports local encrypted sync preparation with a one-time recovery phrase while keeping `Managed` cloud auth separate from the sync endpoint
   - settings reminders section renders without runtime errors, stays device-local, and shows a locked state until a managed premium entitlement is present
   - settings export summary reflects the current logged range, CSV/JSON downloads succeed with local file downloads instead of opening sensitive data in the URL, and PDF stays disabled until an active managed cloud plan is present
   - if managed `Partner access` is unlocked, the owner can create a link-only invite without entering partner email, copy the canonical invite URL, and still revoke pending or accepted access
   - the day editor includes a pregnancy test field with `None`, `Negative`, `Positive` choices; logging `Positive` from the dashboard quick action surfaces the localized predictions-paused banner on dashboard reload and removes predicted period and fertility cells from the calendar grid for the upcoming weeks
   - without an Ovumcy Cloud plan, stats premium sections render as unified `PREMIUM` lock cards with an `Open Ovumcy Cloud` CTA that routes to `Backup & sync`, instead of silently disappearing
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
- recovery phrase is only available through the explicit backup and export flow, not direct text selection or clipboard copy
