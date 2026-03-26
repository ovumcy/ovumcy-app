# Ovumcy App AI Context: Architecture

## App Layers

- `app/`
  - Expo Router route files and navigation layouts only.
  - No business rules, persistence logic, or large view-model assembly.
- `src/models/`
  - Shared domain types and canonical product shapes.
- `src/services/`
  - The app equivalent of the web service layer.
  - Owns reusable product logic, screen view-data assembly, and future tracking policies that should not live in route files or screen components.
- `src/storage/`
  - Local-first persistence contracts, repositories, and migrations for on-device data.
  - Future sync metadata persistence also belongs here, but sync transport stays separate.
- `src/ui/`
  - Shared components, tokens, and visual primitives.
- `src/ui/screens/`
  - Screen-level presentation for onboarding, dashboard, calendar, stats, settings, and future sync UX.
- `src/i18n/`
  - Shared app copy and future i18n helpers.
- `src/security/`
  - Local device and secure-storage policy helpers.
- `src/sync/`
  - Reserved for future optional sync client logic. It must remain isolated from pure domain rules.

## Product Domains

- Onboarding
  - Local-first setup of cycle baseline and owner preferences.
- Dashboard
  - Current cycle context, quick logging entrypoints, and owner-only daily tracking surface.
- Calendar
  - Day-by-day tracking view, cycle markers, and prediction presentation.
- Stats
  - Reliability messaging, factor context, and history summaries.
- Settings
  - Tracking preferences, symptom management, export, privacy, and future sync/account configuration.

## Architecture Rules

- Route files must stay thin. They import screen components from `src/ui/screens/` and pass only navigation or route-level data.
- Shared product logic must be implemented once in `src/services/` and reused by dashboard, calendar, stats, and settings.
- Storage adapters must not become the place where business decisions are made.
- `src/storage/` is the only layer allowed to know whether persistence is backed by SQLite, AsyncStorage fallback, or a future sync-aware repository.
- UI components should prefer explicit props over global mutable state.
- Shared UI components should receive precomputed presentation state from services or screen-local presentation helpers. Do not let shared components parse dates, derive visibility state, or map domain error codes on their own.
- Screen components may hold local form state, but persisted state loading, completion gating, and route-target decisions should live in `src/services/`.
- When a flow mixes async local persistence with a large UI contract, prefer splitting it into a container screen and a presentational screen instead of letting one file own storage, orchestration, and rendering together.
- When a screen grows beyond a single clear responsibility, prefer extracting local screen-only subcomponents or controller helpers under `src/ui/screens/<feature>/` before moving UI orchestration into shared UI or service layers.
- Core tracking must stay offline-capable by default; future sync is an additive capability, not the source of truth.
- When porting an existing Ovumcy flow from web to app, preserve the web interaction contract first and adapt only the rendering primitives.
- Platform-specific deviations are allowed only when required by native constraints, and they should stay thin around the same underlying service and view-state contract.
- When a new interface language becomes selectable in settings, extend every shared copy catalog in the same change set. Do not rely on partial English fallback once the language is exposed as a first-class option.
- One-time migration from legacy local storage into a database belongs in the storage layer and must complete before services treat the new repository as the source of truth.
- Web-only storage fallbacks are acceptable as a bridge when native and web runtimes have different persistence constraints, but the fallback must remain hidden behind the same repository contract.
- Incomplete onboarding progress must be persisted explicitly in bootstrap state. Do not infer the current onboarding step from `lastPeriodStart` or any other profile field, because relaunch and reset flows must reopen the exact unfinished step.
- Onboarding, settings, and dashboard must share one canonical profile repository. Do not keep separate persisted records for onboarding-only values once the app has a broader local profile model.
- Dashboard, calendar, and any future stats flow must read and write the same canonical day-log repository. Do not introduce screen-specific local journal stores once daily tracking exists.
- Stats, dashboard, and calendar must derive cycle history from the same day-log repository and shared cycle-history helpers. Do not reimplement completed-cycle detection or phase projection separately per screen.
- Export and backup features must read from the canonical local repositories for profile, day logs, and symptom catalog. Do not assemble export payloads from screen state or derived view caches.
- For web-parity passes on core owner flows, capture the canonical ovumcy-web contract first in a repo-local checklist and use it as the comparison baseline before changing app UI.
- Do not keep a generic screen hero or header on app screens when the canonical web flow starts directly with data-first cards or status lines.
- In account-free app flows, use an explicit local-data danger action instead of faking logout. Destructive local reset should recreate the canonical storage backend cleanly rather than relying on screen-local state resets.
- Owner-facing save, delete, and export feedback should come from shared status-banner primitives instead of ad hoc plain text messages in individual screens.
- Canonical Ovumcy icon assets for the app should be generated from the ovumcy-web source artwork rather than maintained as independently drifting PNG variants.
- Stats charts, symptom patterns, and phase summaries must be derived from shared cycle-history and day-log services. Do not compute analytics directly inside screen components or persist a second insights cache.
- Manual cycle start is a shared owner flow across dashboard and calendar. Keep the conflict policy in services and expose only thin screen-specific triggers; do not reimplement confirmation rules per screen.
- Calendar day details should stay summary-first by default. Even empty days should open a no-entry summary panel before edit mode unless the canonical web flow changes.
- When a concept appears as a first-class tab, screen title, or empty-state heading, localize that concept consistently across shell copy, screen copy, and feature copy in every supported language. Do not leave English holdouts in shipped German or French surfaces once those languages are selectable in settings.
- Locale-dependent service view-data builders must receive the active app language from the screen or controller layer. Do not rely on implicit English defaults for owner-facing action labels or confirmations.
- On narrow mobile screens, the calendar month grid takes priority over always-visible legend copy. Secondary calendar help should collapse behind an explicit affordance instead of shrinking the grid below a full-month view.
- Calendar selection styling must never erase the underlying day-state meaning. Selected-day chrome is additive; it cannot replace the actual period, fertility, or ovulation visual contract.
- Sync setup must keep non-secret preferences such as mode, endpoint input, device label, and setup status in canonical local storage, while wrapped keys, device secrets, and auth session material live only behind the secure secret-store boundary.
- Account and sync setup must separate four concepts in the UI: device recovery materials, account connection, managed-cloud plan state, and sync actions. Do not collapse them into one generic “encrypted sync” block.
- Managed cloud sync actions must stay locked until server capabilities confirm that the signed-in account has an active cloud plan. Do not unlock upload or restore from local auth state alone.
- Settings should expose backup and sync as a summary entrypoint only. The full recovery, account, plan, and sync-action flow belongs on a dedicated screen so settings persistence and sync orchestration do not collapse back into one owner component.
- Settings screens with unsaved owner preferences must guard route, tab, and subflow exits with an explicit save-or-discard confirmation instead of silently dropping edits.
- Native export delivery should treat cache files as temporary transport artifacts. Create them only inside the delivery boundary and delete them again after the share or save attempt completes, whether it succeeds or fails.
- Native SQLite storage may use encrypted payload columns for privacy-sensitive records while keeping only the minimum plaintext metadata needed for repository queries. Services and screens must still consume the same repository contract and must not branch on encrypted-vs-plaintext persistence details.
- When a previously approved web-parity deviation is closed in the app, update the repo-local parity checklist in the same change so old exceptions do not linger as stale product guidance.
- Native expo-sqlite access must be serialized per connection. Do not rely on overlapping Promise.all query bursts against one database handle during screen bootstrap or sync hydration.
- Native SQLite destructive reset should wipe and reseed the existing database on the same connection instead of deleting and reopening the database file. Android Expo runtimes can reject freshly reopened handles during bootstrap and reset.
- Calendar legend and calendar cells must use the same visual contract. Do not introduce a second metaphor in the legend that differs from the grid’s actual fill, border, and marker states.
- Device-shell privacy controls such as screenshot protection belong to canonical interface settings and app-shell security helpers. Do not reintroduce ad hoc runtime flags or screen-local toggles for the same policy.
