# Ovumcy Web Parity Checklist

## Purpose

`ovumcy-web` is the canonical UX and visual contract for core owner flows in
`ovumcy-app` unless a native platform constraint makes strict parity
impossible.

This checklist captures the exact web contract to compare the app against
before and after UI changes.

## Canonical Sources

All paths are relative to the `ovumcy-web` repository root (the sibling repo
that owns the canonical web UX).

- Shared visual tokens and component geometry:
  - `ovumcy-web/web/src/css/input.css`
- Core web templates:
  - `ovumcy-web/internal/templates/onboarding.html`
  - `ovumcy-web/internal/templates/dashboard.html`
  - `ovumcy-web/internal/templates/calendar.html`
  - `ovumcy-web/internal/templates/stats.html`
  - `ovumcy-web/internal/templates/settings.html`

## Shared Visual Contract

### Tokens

- Background: `#fff9f0`
- Card background: `#ffffff`
- Soft surface: `#fff4e8`
- Text primary: `#5a4a3a`
- Text muted: `#6f5f50`
- Accent primary: `#d4a574`
- Accent secondary: `#e8c4a8`
- Accent strong: `#ba8350`
- Border: `#ecd9c6`

### Cards and Panels

- `.journal-card`
  - border radius: `1rem`
  - border: `1px solid var(--line-soft)`
  - soft hover lift only
- `.journal-hero`
  - border radius: `1.2rem`
  - warm white-to-cream gradient
- `.journal-panel`
  - border radius: `0.95rem`
  - padding: `0.9rem 1rem`

### Typography

- `.journal-title`
  - desktop: `clamp(1.7rem, 2.7vw, 2.25rem)`
  - mobile: `1.55rem`
- `.journal-subtitle`
  - desktop: `1.26rem`
  - mobile: `1.08rem`
- `.journal-kicker`
  - uppercase, compact, amber

### Buttons

- `.btn-primary`
  - min-height: `2.75rem`
  - horizontal padding: `0.58rem 1.12rem`
  - full rounded pill
  - warm amber gradient
- `.btn-secondary`
  - same height and pill geometry
  - white background with soft border
- Buttons should feel compact and dense, not oversized.

### Sliders

- `.range-field`
  - track height: `0.56rem`
  - thumb size: `1.22rem`
  - warm amber track and thumb

### Binary Toggles

- `.period-toggle`
  - inline-flex pill
  - padding: `0.5rem 0.78rem`
  - rounded full card
  - active state uses soft warm highlight
- Toggle switch itself:
  - width: `2.6rem`
  - height: `1.38rem`
  - thumb size: `1.05rem`
- On mobile:
  - width becomes full
  - min-height: `3rem`
  - padding becomes `0.46rem 0.72rem`

### Mobile Tabbar

- `.mobile-tabbar-link`
  - font-size: `0.67rem`
  - padding: `0.42rem 0.28rem`
  - compact, not oversized
- Active tab:
  - warm muted amber fill

## Screen Contract

### Onboarding

#### Step 1

- Container:
  - `section.mx-auto.max-w-4xl`
  - one hero card only
- Hero card:
  - `p-6` mobile
  - `p-8` desktop
- Progress block order:
  - kicker
  - bordered panel
  - thin progress track
- Panel order:
  - title
  - subtitle
  - day-1 tip
  - privacy copy
  - field label
  - localized date field
  - day grid
  - primary CTA
  - status area
- Day grid:
  - max height: `18rem`
  - columns: `3` mobile, `4` tablet, `6` desktop
  - chip min-height: `2.7rem`
  - chip primary text: `0.82rem`
  - chip secondary text: `0.68rem`
  - "Today" chip slightly taller: `3.05rem`

#### Step 2

- Panel order:
  - title
  - cycle slider
  - period slider
  - validation / guidance messages
  - auto-period-fill toggle
  - irregular-cycle toggle
  - age-group choices
  - usage-goal choices
  - back + finish actions
  - status area
- Form rhythm:
  - overall `space-y-6`
  - fields compact, no extra wrapper chrome

### Dashboard

- First fold order:
  - status line
  - prediction explainer and warnings
  - factor hint or missed-days prompt when needed
  - today editor card
- Today editor:
  - quick actions
  - period toggle
  - symptoms
  - mood
  - cycle factors
  - flow if period
  - intimacy
  - cervical mucus if enabled
  - BBT if enabled
  - note disclosure
  - autosave status row, with an explicit save action shown only as retry on failure
- No extra summary card should push the editor down before the main journal.

### Calendar

- Header card:
  - month label and title on the left
  - actions on the right
  - button order:
    - prev
    - next
    - today
- Main layout:
  - `grid gap-6`
  - desktop: `2fr 1fr`
  - month grid and day editor should share the first usable fold
- Calendar grid:
  - weekday row above cells
  - `7` columns
  - gap: `0.5rem`
- `.calendar-cell`
  - min-height: `5.2rem`
  - mobile min-height: `4.9rem`
  - padding: `0.5rem`
  - mobile padding: `0.42rem`
  - border radius: `0.9rem`
- Selected day:
  - blue selection ring, not a tall pillar-like column
- Today pill:
  - compact
  - hidden inside the cell on mobile when it harms density
- Legend:
  - sits directly under the grid
- Day editor:
  - separate aside/card
  - should not be pushed far below the month grid on mobile
  - defaults to view-first summary mode for days that already have data
  - empty past or current days may open directly in edit mode
  - summary mode shows `Edit entry` / `Add entry`, not a permanently open editor

### Stats

- Top order:
  - title + subtitle
  - empty state hero when insights are locked
  - otherwise notice panels
  - top cards
  - cycle overview
  - factor context
- Empty state:
  - one hero illustration block
  - compact progress meter
- Top cards:
  - `3` or `4` columns on desktop depending on reliability card
  - compact `stat-card` geometry
- Unlock thresholds:
  - `< 2 completed cycles`: empty hero only
  - `2 completed cycles`: top cards, cycle overview, trend, symptom frequency
  - `3+ completed cycles`: stronger reliability state and deeper stats sections as data allows

### Settings

- Top order:
  - page title + subtitle
  - cycle section
  - symptoms section
  - tracking section
  - reminders section
  - interface section
  - account / recovery blocks
  - data / export section
  - danger zone
- Cycle section:
  - sliders
  - last period start field
  - messages
  - auto-period-fill
  - irregular cycle
  - unpredictable cycle
  - age group
  - usage goal
  - save action
- Tracking section:
  - full-width toggle list
  - state text inside toggles
  - temperature unit switch
  - secondary save action
- Interface section:
  - language block
  - theme block
- Backup & sync section:
  - local encrypted sync setup block
  - managed account status block
  - recovery phrase block
  - plan and sync status block
- Export section:
  - from / to date fields
  - presets
  - optional inline export calendar panel
  - export buttons:
    - CSV
    - JSON
  - app-owned managed export perk:
    - PDF only when the current managed cloud account has an active plan
  - summary lines and local data hint
- Reminders section:
  - appears between tracking and interface
  - keeps local-only privacy copy visible
  - stores reminder preferences locally
  - local device reminders (toggles, reminder time, lead-days control) are
    free-tier, mirroring web's free reminder settings (`reminder_lead_days`,
    web #123: 0–14, default 3, clamped never rejected)
  - shows a managed-premium locked state on the email-delivery block only,
    until the reminders entitlement is active
  - reminder **delivery channels differ by product and this is intentional**,
    not a parity gap: web delivers reminders server-side — the dashboard
    reminder banner, an outbound webhook (web #124), and a subscribable `.ics`
    calendar feed — whereas the app delivers on-device through local
    notifications (`expo-notifications`), scheduled purely from local data with
    no server round-trip. Managed reminder **email** is a premium extension
    beyond the web baseline. No code change closes this difference; it follows
    from the app being local-first and owning its own notification channel.
- Danger zone:
  - clear-data path

#### Settings Density Rules

- cycle toggles use a short pill plus hint below, not a tall multi-line card
- tracking toggles keep their hint inside the card, but the state text reads as a small badge
- age-group choices stack as one column on narrow mobile widths
- temperature-unit choices stay in a two-column switch
- usage-goal choices remain a compact single-column stack
- export action row keeps `CSV` and `JSON`, with `PDF` appearing as a managed-only perk when available

## Allowed App Deviations

- Native date picker implementation may differ, but field copy and hierarchy must
  stay the same.
- Desktop side-by-side layouts may stack on mobile, but the selected-day editor
  should remain close to the month grid and not require a long exploratory
  scroll.
- Native controls may replace browser controls only if geometry, color, and
  density remain aligned with the web contract.
- Until account-backed sync transport exists, the mobile app may replace web
  profile/password/recovery/logout controls with a real local encrypted sync
  setup section that covers mode selection, endpoint input, device label, and
  one-time recovery phrase preparation. The absence of live account auth must be
  explicit, not silent.
- Mobile bottom tabs remain a platform-specific navigation deviation from the
  web nav chrome.
- Cross-product backup portability between the app and web is an intentional
  non-goal, not a discovered gap (app #104): JSON export/backup schemas are
  deliberately separate, and neither product's import path accepts the
  other's export file, in either direction, CSV included (web exposes no CSV
  import route). The app's JSON export format (`ExportBackupEnvelope` in
  `src/models/export.ts:76`, with structure `{app, formatVersion, exportedAt,
  preset, range, summary, profile, symptoms, dayLogs}`) is the app-canonical
  backup/restore format; `parseImportEnvelope`
  (`src/services/import-service.ts`) restores only this shape, explicitly
  rejecting any file whose `app`/`formatVersion` fields don't match
  (`unrecognized_format`) so a wrong-product file fails closed instead of
  partially applying. Web's JSON export (`ExportJSONEntry` in
  `ovumcy-web/internal/services/export_service.go`) is a flat snake_case
  `{entries: [...]}` list of per-day records with no profile/settings and no
  envelope metadata; web's own `POST /api/v1/imports/json`
  (`ovumcy-web/internal/api/handlers_import_json.go`) likewise restores only
  an owner's own prior web export back into their own account. Business
  reason: web is the Free-tier reference implementation, built around its own
  server-side storage model and single-owner request/response import; the app
  is the mobile-first, local-first baseline, and its structured envelope
  exists for the app's own backup/restore, not cross-product migration. Both
  CSV and JSON remain Free-tier local-first exports on each side, but a CSV or
  JSON file produced by one product is not a supported input to the other's
  import flow. Review rule: a future feature must not add a web-compatible
  export output, a converter, or an import path that accepts the other
  product's file — that would silently re-open this gap; revisiting the
  decision (Option B/C in app #104) requires an explicit product call, not an
  incidental parity change.

## Current App State

- Core onboarding, dashboard, calendar, insights, settings, and export flows
  now align closely with the canonical web contract.
- Remaining deviations are intentional product-capability gaps, not silent UI
  drift:
  - dashboard and calendar journals use autosave with explicit retry-only save
    affordances instead of a permanent save row;
  - local device reminders are free-tier (web parity: reminders shipped in
    web's free owner flow — lead-days setting #123, webhook delivery #124,
    daily scheduler #125): the on-device channel derives purely from local
    data and reads no billing state, and the upcoming-period reminder honors
    the shared lead-days setting; the app-only fertile-window reminder keeps
    a fixed 1-day pre-window lead because its anchor (window start) already
    precedes ovulation, unlike web's ovulation-date anchor; web's dashboard
    reminder banner (`dashboard_reminder_banner.go`) needs no app equivalent
    because the app dashboard hero already surfaces the next-period estimate
    persistently; managed EMAIL delivery remains a premium extension beyond
    the web baseline, gated by the billing snapshot;
  - managed partner access is a link-only owner-management flow under `Backup & sync`;
    the app shares the canonical invite URL returned by the managed cloud and
    does not ask for partner email or promise partner email delivery;
  - account-backed auth and recovery flows are replaced by local encrypted sync
    setup only;
  - PDF export is an app-managed perk gated by an active managed cloud plan,
    while CSV and JSON remain local-first exports;
  - in-app account deletion (`src/sync/account-deletion-service.ts`, shipped in
    commit `07af34b`) permanently deletes the connected managed or self-hosted
    account and all its server data, then wipes local data the same way the
    danger-zone `Clear all local data` flow does; a live managed subscription
    still requires a separate, distinctly-worded acknowledgment that deleting
    the account does not cancel an active Ovumcy Cloud subscription;
  - free offline JSON import (`src/services/import-service.ts` + the settings
    `Restore from backup` section) mirrors web's `POST /api/v1/imports/json`
    settings-import capability with the same strictly additive semantics; the
    app adds a two-phase preview → confirm step on top of web's one-shot form,
    and additionally restores the backup's profile when the local profile is
    still pristine (untouched defaults);
  - mobile bottom tabs remain platform-native chrome;
  - Stats "Current phase" detection (`detectCurrentPhase` in
    `src/services/cycle-history-service.ts`) now matches web's phase
    precedence (`resolveCyclePhase` / owner-surface `DetectCurrentPhase` in
    `ovumcy-web/internal/services/cycles.go` and `cycle_baseline.go`):
    `StatsPhase` gained a `fertile` member covering the fertility window
    excluding the ovulation day itself, and an unlogged day still inside the
    projected period window (cycle day within the period length of the
    current anchor) now reads as `menstrual` instead of falling through to
    `follicular`/`unknown`. `phaseLabels.fertile` / `phaseIcons.fertile`
    (already shipped in all six locales) are reachable from the Stats screen.
  - Dashboard cycle projection (`buildCurrentCycleProjection` in
    `src/services/cycle-history-service.ts`) now mirrors web's
    `DashboardUpcomingPredictions` forward-roll. After projecting the logged
    anchor forward to the current cycle (`ProjectCycleStart`), the ovulation is
    rolled forward by whole cycles (`ShiftCycleStartToFutureOvulation`) into a
    separate `upcomingOvulationDate`, so a "next ovulation" value never resolves
    to a past date. The current-cycle `ovulationDate` (phase ring, calendar and
    doctor-PDF markers) and the logged anchor stay untouched — web keeps
    `stats.OvulationDate` and `stats.LastPeriodStart` the same way. Pinned by the
    shared golden-vector fixture's additive `projection` section
    (`cycle-projection-reference.test.ts` ↔ web
    `cycle_projection_reference_test.go`). The upcoming-ovulation **date** (web
    `DisplayOvulationDate`, `dashboard.html:122`) now renders on the dashboard
    hero next to the existing next-period line
    (`DashboardCycleHeroViewData.upcomingOvulationLabel`,
    `src/services/dashboard-view-service.ts`, rendered by
    `src/ui/screens/dashboard/DashboardCycleHero.tsx`), reusing the
    already-present `dashboardCopy.ovulation` label and the hero's existing
    `formatDisplayDate` helper: present whenever `upcomingOvulationDate` is
    non-null, absent entirely under the pregnancy-pause and unpredictable-cycle
    branches (and any other null-producing path), never a separate "unavailable"
    string. Decision (2026-07-20): the low-reliability softening of
    `DisplayOvulationDate` is now ported (medical-safety: avoid a falsely precise
    ovulation day for a sparse/irregular history). The shared projection
    (`buildCurrentCycleProjection` -> `resolveUpcomingOvulationDisplay`,
    `src/services/cycle-history-service.ts`) mirrors web's
    `dashboardNeedsOvulationData` and `DashboardOvulationRange`
    (`dashboard_cycle.go:169-341`): an irregular cycle with fewer than three
    completed cycles hides the concrete date and surfaces
    `dashboardCopy.ovulationNeedsMoreCycles`
    (`upcomingOvulationNeedsMoreCycles`), and an irregular cycle with a reliable
    trend shows the next-period range shifted back by the luteal phase as an
    ovulation range (`upcomingOvulationWindowStart/EndDate`, rendered via
    `dashboardCopy.ovulationRange`). Regular cycles still show one concrete date,
    now appending `dashboardCopy.ovulationApproximate` when the luteal phase was
    clamped (web `DisplayOvulationExact`). Residual deviation: web's
    `impossible`/`DisplayOvulationUnavailable` text state and the "blank ovulation
    but keep an approximate next-period date" stale-hero path are not modeled —
    the app keeps hiding the ovulation element entirely (never a separate
    "Cannot be calculated" string), which is conservative (no false info) rather
    than a false-precision risk.
  - Projected period length now matches web's rolling `AveragePeriodLength`
    instead of the profile-configured `periodLength`, closing the former allowed
    deviation. `cycle-history-service.resolveProjectedPeriodLength` averages the
    logged period-day counts of the last six observed cycles — including the
    current in-progress cycle, exactly as web `buildCycles(observedStarts)` spans
    every observed start (`cycles.go` `populateObservedCycleStats` /
    `recentPositivePeriodLengths`) — folds the mean through `predictedPeriodLength`
    (round-half-up, default 5), and falls back to the configured period length
    only until the first cycle completes (web `ApplyUserCycleBaseline` bootstrap,
    `cycle_baseline.go:49-63`). The figure is computed once and carried on
    `StatsCycleProjection.projectedPeriodLength`, so the `detectCurrentPhase`
    menstrual boundary (web `resolveCyclePhase`, `cycles.go:424`), the calendar
    current/predicted/historical period painting (web `calendar_days.go`), and
    the dashboard cycle-hero menstrual phase card (web `dashboard_cycle_hero.go:54`)
    all read one value. Consecutive period-day counting now caps at 11 days,
    matching web's inclusive `buildCycles` `start..start+10` loop
    (`countLoggedPeriodLength` in `cycle-history-service.ts` vs web `cycles.go`),
    closing the former 10-day divergence. Residual pre-existing app behavior,
    unchanged by this port: cycle starts derive from the app's observed-cluster
    detection plus `profile.lastPeriodStart` (web's bootstrap gate uses log-only
    `DetectCycleStarts`) — a detection-source difference that surfaces only on
    clinically extreme inputs. Regression: `cycle-history-service.test.ts`
    ("projected period length" suite) plus the updated dashboard hero phase-card
    expectation.

## Remaining Product Gaps

1. Account-backed sync transport and multi-device restore
2. A future non-mobile nav model if the app ever stops using native tabs

## App-Only Extensions Beyond Web Parity

The following surfaces are intentionally richer in the app than on the canonical web product. They are app-domain extensions, not parity targets.

- Pregnancy test day-log field with automatic prediction pause across dashboard, calendar, and stats.
- Unified premium paywall placeholders (`PremiumLockCard`) on stats premium sections, the settings reminder email-delivery block, settings PDF export, and the backup-sync partner area.
- Short luteal phase warning in advanced insights, derived from the same canonical local cycle history.
- Doctor PDF with a colored month-grid calendar (period, fertile window, observed ovulation marker, predicted ovulation solid gray border) and three premium analytic sections (advanced fertility signals, cycle comparison, short luteal warning).
- Six-locale interface coverage for paywall, day-log, calendar, dashboard, and PDF surfaces (English, Russian, German, French, Spanish, Italian).
- Medical-safety prediction disclaimer on the managed-only partner shared cycle view (`src/ui/screens/PartnerSharedScreen.tsx`), reusing the shared `PredictionDisclaimer` and the same `predictionDisclaimer` copy as the owner surfaces. Web's partner view carries no disclaimer; the app renders it unconditionally (populated and empty states alike) so the "estimates, not medical advice or contraception" invariant holds on every surface showing a next-period/ovulation window.
