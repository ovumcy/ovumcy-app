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
11. The Settings tab opens as a hub of section entries (cycle, custom symptoms, tracking, reminders, interface, export/restore, danger zone) plus the `Backup & sync` summary and privacy cards; each entry opens its own section screen with a back action to the hub. The `Cycle Parameters` screen saves cycle parameters locally, the dashboard snapshot reflects the new values after returning, and the `Reminders` screen schedules device-only reminders (toggles, time, lead days) without an account while only the email-delivery block shows a premium lock, with clear permission feedback.
12. Changing a value on a settings section screen and then switching tabs, leaving the section (back action or hardware Back), or opening `Backup & sync` shows a three-way confirmation (`Save and leave`, `Discard changes`, `Keep editing`); `Save and leave` persists before leaving, `Discard changes` leaves without saving, and `Keep editing` — or dismissing the dialog via hardware Back, tap-outside, or Escape — keeps the unsaved edit and stays on the screen.
13. Interface settings can toggle screenshot protection; enabling it blocks screenshots and recent-app previews on supported release builds, while disabling it allows captures again after saving.
14. Tracking toggles in settings update dashboard visibility correctly:
  - `Show intimacy section` keeps intimacy visible when on and hides it when off
  - `Track BBT` shows the BBT section with the selected temperature unit; a decimal reading (e.g. `36.50`) keeps the typed value instead of snapping to `0.00`, non-numeric characters are rejected, and switching the unit between °C and °F recalculates the shown value to the same temperature instead of relabelling the raw number
  - `Track cervical mucus` shows the cervical-mucus section
15. Enabling `Unpredictable cycle` switches dashboard copy to facts-only mode instead of showing fake predictions.
16. After two completed cycles exist in local history, the `Insights` tab stops showing the empty state and renders reliability plus cycle-length cards.
17. Settings allows creating a custom symptom, and the new symptom appears in the dashboard and calendar day editor for new entries.
18. Archiving a custom symptom removes it from new-entry symptom pickers without breaking older day entries that already used it.
19. The settings export/restore screen shows the current entry summary; `Export as CSV` and `Export as JSON` always open a local share or save flow without leaking data into a URL, while `Export as PDF` stays locked unless the current managed cloud account has an active plan.
20. The settings hub shows a `Backup & sync` summary card with real status, destination, and last-sync details, and opens a dedicated `Backup & sync` screen for recovery phrase, account, plan, and sync actions.
21. If managed `Partner access` is unlocked, owner-side controls create a link-only invite without asking for partner email, show the canonical invite URL, and allow revoke of pending or accepted access.
22. On the dedicated `Backup & sync` screen, `Managed` mode keeps cloud account and billing outside the sync endpoint, while `Self-hosted` mode still exposes server endpoint plus inline account registration or login on the owner's server.
23. With a connected managed or self-hosted account, `Backup & sync` shows a `Delete account` action alongside sync/restore/disconnect. Tapping it prompts a device-security challenge, then a standard destructive confirm; if the managed account has an active or canceling plan, a second, distinctly-worded confirm warns that deleting the account does NOT cancel an active Ovumcy Cloud subscription and requires a separate acknowledgment. Confirming deletes the account and its data on the connected server, wipes local data, and returns the app to onboarding; dismissing any step (device challenge, either confirm) leaves the account and local data untouched.
24. The danger-zone section screen requires typed confirmation before clearing local data, and a confirmed clear returns the app to onboarding.
25. Bottom tabs render and switch without broken icons or duplicate labels, and stay clearly above the Android system navigation buttons.
26. No account, sync, or cloud requirement is shown for core local use.
27. Pregnancy test field appears in the day editor with `None`, `Negative`, and `Positive` options. Selecting `Positive` autosaves locally and, after returning to dashboard, replaces the cycle hero prediction copy with the localized "predictions paused" banner. Calendar stops painting predicted period and fertile-window cells for the upcoming weeks until a new period is logged.
28. Without an Ovumcy Cloud plan, stats premium sections render as unified paywall lock cards (PREMIUM eyebrow, section title, description, `Open Ovumcy Cloud` CTA) instead of disappearing. Tapping the CTA navigates to `Backup & sync` so the upgrade path stays discoverable.
29. With an active Ovumcy Cloud plan, the same stats sections render real advanced-fertility, advanced-insight, and extended-report cards driven by canonical local history.
30. With a valid partner invite link opened on a device that has no managed session, the `Backup & sync` screen shows the accept card immediately — no `Advanced` toggle, no onboarding wizard — with an explicit `Accept as guest` choice beside sign-in; nothing is redeemed until the guest button is tapped, and after accepting, the read-only shared view opens while owner tabs still require onboarding.

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
11. The Settings tab opens as a hub of section entries (cycle, custom symptoms, tracking, reminders, interface, export/restore, danger zone) plus the `Backup & sync` summary and privacy cards; each entry opens its own section screen with a back action to the hub. The `Cycle Parameters` screen saves cycle parameters locally, the dashboard snapshot reflects the new values after returning, and the `Reminders` screen schedules device-only reminders (toggles, time, lead days) without an account while only the email-delivery block shows a premium lock, with clear permission feedback.
12. Changing a value on a settings section screen and then switching tabs, leaving the section (back action or hardware Back), or opening `Backup & sync` shows a three-way confirmation (`Save and leave`, `Discard changes`, `Keep editing`); `Save and leave` persists before leaving, `Discard changes` leaves without saving, and `Keep editing` — or dismissing the dialog via hardware Back, tap-outside, or Escape — keeps the unsaved edit and stays on the screen.
13. Interface settings can toggle screenshot protection; enabling it blocks screenshots and app-switcher previews on supported release builds, while disabling it allows captures again after saving.
14. Tracking toggles in settings update dashboard visibility correctly:
  - `Show intimacy section` keeps intimacy visible when on and hides it when off
  - `Track BBT` shows the BBT section with the selected temperature unit; a decimal reading (e.g. `36.50`) keeps the typed value instead of snapping to `0.00`, non-numeric characters are rejected, and switching the unit between °C and °F recalculates the shown value to the same temperature instead of relabelling the raw number
  - `Track cervical mucus` shows the cervical-mucus section
15. Enabling `Unpredictable cycle` switches dashboard copy to facts-only mode instead of showing fake predictions.
16. After two completed cycles exist in local history, the `Insights` tab stops showing the empty state and renders reliability plus cycle-length cards.
17. Settings allows creating a custom symptom, and the new symptom appears in the dashboard and calendar day editor for new entries.
18. Archiving a custom symptom removes it from new-entry symptom pickers without breaking older day entries that already used it.
19. The settings export/restore screen shows the current entry summary; `Export as CSV` and `Export as JSON` always open a local share or save flow without leaking data into a URL, while `Export as PDF` stays locked unless the current managed cloud account has an active plan.
20. The settings hub shows a `Backup & sync` summary card with real status, destination, and last-sync details, and opens a dedicated `Backup & sync` screen for recovery phrase, account, plan, and sync actions.
21. If managed `Partner access` is unlocked, owner-side controls create a link-only invite without asking for partner email, show the canonical invite URL, and allow revoke of pending or accepted access.
22. On the dedicated `Backup & sync` screen, `Managed` mode keeps cloud account and billing outside the sync endpoint, while `Self-hosted` mode still exposes server endpoint plus inline account registration or login on the owner's server.
23. With a connected managed or self-hosted account, `Backup & sync` shows a `Delete account` action alongside sync/restore/disconnect. Tapping it prompts a device-security challenge, then a standard destructive confirm; if the managed account has an active or canceling plan, a second, distinctly-worded confirm warns that deleting the account does NOT cancel an active Ovumcy Cloud subscription and requires a separate acknowledgment. Confirming deletes the account and its data on the connected server, wipes local data, and returns the app to onboarding; dismissing any step (device challenge, either confirm) leaves the account and local data untouched.
24. The danger-zone section screen requires typed confirmation before clearing local data, and a confirmed clear returns the app to onboarding.
25. Bottom tabs render and switch without broken icons or duplicate labels, and stay clearly above the iOS home indicator or system navigation area.
26. No account, sync, or cloud requirement is shown for core local use.
27. Pregnancy test field appears in the day editor with `None`, `Negative`, and `Positive` options. Selecting `Positive` autosaves locally and, after returning to dashboard, replaces the cycle hero prediction copy with the localized "predictions paused" banner. Calendar stops painting predicted period and fertile-window cells for the upcoming weeks until a new period is logged.
28. Without an Ovumcy Cloud plan, stats premium sections render as unified paywall lock cards (PREMIUM eyebrow, section title, description, `Open Ovumcy Cloud` CTA) instead of disappearing. Tapping the CTA navigates to `Backup & sync` so the upgrade path stays discoverable.
29. With an active Ovumcy Cloud plan, the same stats sections render real advanced-fertility, advanced-insight, and extended-report cards driven by canonical local history.
30. With a valid partner invite link opened on a device that has no managed session, the `Backup & sync` screen shows the accept card immediately — no `Advanced` toggle, no onboarding wizard — with an explicit `Accept as guest` choice beside sign-in; nothing is redeemed until the guest button is tapped, and after accepting, the read-only shared view opens while owner tabs still require onboarding.

## Web Smoke

Run when web support, branding, or app-shell navigation is touched.

1. `npm run e2e:web`
2. Manual browser check:
   - `/` opens onboarding on a clean local state
   - the onboarding step-1 privacy line links to `/privacy` before any date is saved, and browser back returns to the unfinished step
   - onboarding finish leads to dashboard
   - dashboard renders cycle snapshot with a distinct ovulation marker, uniform phase cards, and the today-journal editor section
   - editing a day entry on the dashboard autosaves and updates local state without a page error
   - enabling `Track BBT` shows the BBT field; a decimal reading is accepted and preserved, and switching the BBT unit between °C and °F recalculates the displayed value to the same temperature
   - calendar shows markers for the saved entry and opens the same day details when that day is selected
   - after two completed cycles exist, insights render reliability and cycle-length cards instead of the empty unlock state
   - the settings tab opens as a hub with one navigation row per section route (`/settings/cycle`, `/settings/symptoms`, `/settings/tracking`, `/settings/reminders`, `/settings/interface`, `/settings/data`, `/settings/danger`) and each section screen offers a back action to the hub
   - the settings symptoms screen can create a custom symptom and that symptom appears in dashboard and calendar day editors for new entries
   - changing a settings value and then switching tabs, leaving the section, or opening `Backup & sync` shows a three-way confirmation with working `Save and leave`, `Discard changes`, and `Keep editing` outcomes, where dismissing the dialog keeps editing
   - the interface section screen can save and re-open a screenshot-protection toggle without throwing runtime errors in the browser shell
   - the settings hub shows a `Backup & sync` summary card, the interface screen shows explicit `Interface` controls, and the dedicated `Backup & sync` screen supports local encrypted sync preparation with a one-time recovery phrase while keeping `Managed` cloud auth separate from the sync endpoint
   - the settings reminders screen renders without runtime errors, stays device-local, keeps the reminder toggles, time, and lead-days controls usable without any account, and shows a locked state on the email-delivery block only until a managed premium entitlement is present
   - the settings export/restore screen reflects the current logged range, CSV/JSON downloads succeed with local file downloads instead of opening sensitive data in the URL, and PDF stays disabled until an active managed cloud plan is present
   - if managed `Partner access` is unlocked, the owner can create a link-only invite without entering partner email, copy the canonical invite URL, and still revoke pending or accepted access
   - opening a valid partner invite link in a fresh browser session (no managed session) lands on `Backup & sync` with the accept card visible immediately — no onboarding wizard, token scrubbed from the URL bar — and nothing is redeemed until `Accept as guest` or sign-in is explicitly chosen
   - the day editor includes a pregnancy test field with `None`, `Negative`, `Positive` choices; logging `Positive` from the dashboard quick action surfaces the localized predictions-paused banner on dashboard reload and removes predicted period and fertility cells from the calendar grid for the upcoming weeks
   - without an Ovumcy Cloud plan, stats premium sections render as unified `PREMIUM` lock cards with an `Open Ovumcy Cloud` CTA that routes to `Backup & sync`, instead of silently disappearing
   - the danger-zone section screen requires typed confirmation before clearing local data, and a confirmed clear returns the browser shell to onboarding
   - reloading the web preview resets the app to onboarding instead of retaining health data as durable browser storage
   - settings saves local profile and dashboard visibility changes follow the saved toggles
   - enabling `Unpredictable cycle` changes dashboard to facts-only copy
   - favicon is visible on a fresh browser session
   - no broken tab icons or shell glyphs appear

## Accessibility Checks

Screen readers and OS text scaling cannot be verified from CI: the automated
suites assert that names, roles, states, and font-scaling caps are present, but
only a device pass shows what a user actually hears and sees. Run this on both
platforms, on the narrowest phone available.

Screen reader (VoiceOver on iOS, TalkBack on Android):

1. Swipe through onboarding step 1 and step 2. The step title is announced as a
   heading, the progress line as a progress indicator, every day chip as a
   button that says whether it is selected, and each option group announces the
   question it answers before its options.
2. On the dashboard, the quick actions announce their word (not their emoji) and
   report whether today is already marked. Every day-log field announces its own
   label; the notes and BBT inputs are named, not bare text fields.
3. On the calendar, move through the month grid: each day announces its date and
   what is recorded or predicted for it, and the selected day says so. The
   legend entries announce the state each swatch stands for. The calendar-key
   toggle announces expanded or collapsed.
4. On insights, each stat panel is announced as one sentence (title, figure,
   qualifier) instead of loose fragments, and each chart announces its summary.
5. On the settings hub, every navigation row announces its destination, and each
   section screen announces its heading first. Confirm the save action reports
   its disabled state.
6. On backup and sync, the mode picker announces what it switches, and the
   recovery, account, plan, and sync actions each announce a role and a state.
7. Nothing decorative is in the reading order: the background glow/stripes, the
   calendar state swatches, and the insights skeleton placeholders are skipped.

OS text size (iOS Settings → Accessibility → Display & Text Size → Larger Text
at the largest non-accessibility size, then the largest accessibility size;
Android Settings → Display → Font size at maximum):

8. The calendar month grid keeps all six week rows on screen with every day
   still tappable, no clipped day numbers, and no cell overlapping another.
9. The insights bar charts keep their value and axis labels readable and inside
   the chart card, with no label overlapping a bar.
10. The dashboard cycle hero keeps the phase cards legible without text spilling
    outside the card, and the ring stays intact.
11. The bottom tab bar keeps all four labels readable and unclipped, and stays
    clear of the system navigation area.
12. Every screen's primary action stays reachable — nothing is pushed off the
    bottom or sideways, and no screen scrolls horizontally.

## Privacy Checks

During the same pass, confirm:

- onboarding completion works without an account
- the privacy notice is reachable from onboarding and from settings, and its policy button opens `https://ovumcy.com/privacy` in the platform browser (a device without a browser shows the address instead of failing silently)
- no sensitive values appear in URLs
- no debug logging prints health-related onboarding data
- app behavior still makes sense with sync absent
- web preview does not retain health data after a browser reload or a new session
- exported filenames stay generic and do not include notes, symptom names, or user identifiers
- recovery phrase is only available through the explicit backup and export flow, not direct text selection or clipboard copy
