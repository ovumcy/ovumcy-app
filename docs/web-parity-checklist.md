# Ovumcy Web Parity Checklist

## Purpose

`ovumcy-web` is the canonical UX and visual contract for core owner flows in
`ovumcy-app` unless a native platform constraint makes strict parity
impossible.

This checklist captures the exact web contract to compare the app against
before and after UI changes.

## Canonical Sources

- Shared visual tokens and component geometry:
  - `D:\ovumcy\ovumcy-project\web\src\css\input.css`
- Core web templates:
  - `D:\ovumcy\ovumcy-project\internal\templates\onboarding.html`
  - `D:\ovumcy\ovumcy-project\internal\templates\dashboard.html`
  - `D:\ovumcy\ovumcy-project\internal\templates\calendar.html`
  - `D:\ovumcy\ovumcy-project\internal\templates\stats.html`
  - `D:\ovumcy\ovumcy-project\internal\templates\settings.html`

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
  - save row
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
- Account section:
  - profile block
  - change-password block
  - recovery-code block
- Export section:
  - from / to date fields
  - presets
  - optional inline export calendar panel
  - export buttons:
    - CSV
    - JSON
    - PDF
  - summary lines and local data hint
- Danger zone:
  - clear-data path
  - delete-account path

#### Settings Density Rules

- cycle toggles use a short pill plus hint below, not a tall multi-line card
- tracking toggles keep their hint inside the card, but the state text reads as a small badge
- age-group choices stack as one column on narrow mobile widths
- temperature-unit choices stay in a two-column switch
- usage-goal choices remain a compact single-column stack
- export action row keeps `CSV`, `JSON`, then `PDF`

## Allowed App Deviations

- Native date picker implementation may differ, but field copy and hierarchy must
  stay the same.
- Desktop side-by-side layouts may stack on mobile, but the selected-day editor
  should remain close to the month grid and not require a long exploratory
  scroll.
- Native controls may replace browser controls only if geometry, color, and
  density remain aligned with the web contract.
- Until app-level language and theme overrides exist, the mobile app may use a
  read-only `Interface` status section instead of interactive switches.
- Until account-backed sync exists, the mobile app may replace web
  profile/password/recovery/logout controls with a read-only `Account & Sync`
  status section. The absence of auth must be explicit, not silent.
- Until account deletion exists, the mobile app danger zone may expose a
  destructive `Clear all local data` flow instead of `Delete account`.
- Until PDF export exists in the app, the `PDF` action may render as an honest
  disabled affordance rather than disappearing.

## Current App Delta

### Shared Wrapper Drift

- `src/ui/components/ScreenScaffold.tsx`
  - adds a large generic hero stack before every screen body
  - inflates mobile vertical rhythm beyond the web contract
- `src/ui/components/FeatureCard.tsx`
  - adds an extra card wrapper pattern that often duplicates web section chrome

### Onboarding

- `src/ui/screens/OnboardingFlowScreen.tsx`
  - step 1 is too tall and sparse
  - date shell and CTA consume too much height
  - day chips feel larger and more poster-like than web
  - progress shell and overall hero spacing are too loose

### Dashboard

- `src/ui/screens/DashboardOverviewScreen.tsx`
  - adds a snapshot card above the main journal
  - current first fold is less data-first than web

### Calendar

- `src/ui/screens/CalendarOverviewScreen.tsx`
  - wraps month grid in an extra card hierarchy
  - action ordering and hierarchy do not match web
  - day panel is always editable instead of being view-first by default
- `src/ui/components/CalendarMonthGrid.tsx`
  - cells are too tall and capsule-like
  - selected state reads as a long vertical capsule instead of a compact ring
  - markers and today pill density are weaker than web
  - day editor is effectively pushed too far below the grid on mobile
  - prediction states are far simpler than the canonical web state machine

### Stats

- `src/ui/screens/StatsOverviewScreen.tsx`
  - structure is closer to web than calendar or onboarding
  - density still trends too card-heavy and vertically padded

### Settings

- `src/ui/screens/SettingsFlowScreen.tsx`
  - must keep section order, density, and explicit app deviations aligned with
    the checklist above
  - cannot silently omit interface, account, or danger responsibilities once
    the screen aims for web parity

## Blocking Parity Priorities

1. Onboarding density and first-fold hierarchy
2. Calendar cell geometry and selected-day editor placement
3. Shared screen/card wrapper density
4. Dashboard first-fold hierarchy
5. Settings section order and density
6. Stats spacing cleanup after the shared wrapper fix
