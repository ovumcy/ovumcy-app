# Ovumcy App AI Context: Testing

## Baseline Checks

- After UI or feature changes, run:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
- After broader app bootstrap or dependency changes, also run:
  - `npm run doctor`

## Test Rules

- Prefer React Native Testing Library for feature and screen behavior.
- Test screen components from `src/ui/screens/` rather than route files in `app/` whenever possible.
- When a large screen is decomposed into local screen-only sections, keep the existing screen tests as the contract and avoid replacing them with shallow subcomponent tests unless the extracted piece owns a distinct behavior boundary.
- Domain calculations should have focused pure TypeScript tests.
- Storage-sensitive changes should include tests for serialization, migration, or repository behavior before any sync logic is introduced.
- When a web flow is ported to the app, tests should verify web-parity contracts for copy, step progression, warnings, and completion behavior, not only happy-path persistence.
- If a screen loads async local state on mount, split tests into service-orchestration tests and presentational screen tests. Prefer this over suppressing React `act(...)` warnings in screen tests.
- When app branding assets are introduced or changed, include one web export smoke to confirm favicon or shell assets are emitted from the canonical app config.
- When local persistence moves from a key/value store to a database-backed repository, add tests for default seeding, one-time migration from legacy storage, and service behavior through the new repository boundary.
- If web uses a temporary storage fallback while native uses the primary repository, keep at least one web smoke to confirm routing and onboarding gates still work through the shared service layer.
- Keep one temporary Playwright web-smoke lane for the exported app shell until dedicated native mobile E2E is introduced.
- When platform-visible behavior changes, update `docs/manual-smoke.md` if the acceptance path changes.
- When the web storage contract changes, keep one browser smoke assertion that proves sensitive health state does not persist across a browser reload unless that persistence is explicitly approved.
- When settings toggles affect dashboard visibility or prediction wording, cover the contract at three levels: service tests, screen tests, and the temporary Playwright web smoke.
- When a daily-log change affects both dashboard and calendar, cover the contract at three levels: storage/service tests, screen tests, and the temporary Playwright web smoke that proves a saved day entry is visible after navigation.
- When a local-history threshold unlocks a new owner flow, cover both the locked empty state and the unlocked state in service tests, screen tests, and the temporary Playwright web smoke using deterministic relative dates.
- When export range or delivery behavior changes, cover the contract at three levels: policy or service tests, settings screen tests, and the temporary Playwright web smoke for browser download behavior.
- When interface-language support expands, add one runtime normalization test for locale tags and one settings view-data test that proves every selectable language appears in the language picker.
- When mobile layout depends on safe-area insets, keep a deterministic safe-area mock in `jest.setup.ts` so screen tests do not depend on implicit providers.
- For dashboard and day-editor assertions, prefer stable test IDs over duplicated visible copy when the same label can appear in both page chrome and form content.
- When locale-sensitive dashboard, stats, or shell copy changes, cover one pure copy or runtime assertion and one screen-level assertion. Prefer stable test IDs over hard-coded English text in screen tests when the active language can vary by environment.
- Destructive local-data flows need both service/storage regression tests and at least one platform acceptance pass, because emulator input tooling can hide real native reset bugs behind flaky interaction behavior.
- When a parity pass changes user-facing feedback copy or brand assets, keep browser smoke and screen tests aligned to the canonical status messages and canonical web-derived brand files.
- When a new insight section unlocks from local history, cover both locked and unlocked states at three levels: service projections, screen visibility, and the temporary Playwright web smoke seeded with the minimum local cycle history needed to reveal the section.
- When security-sensitive app features add ESM-only crypto dependencies, keep Jest transform allowlists in sync and cover the flow at both service and screen level so crypto-backed settings UIs stay testable locally.
- For privacy-sensitive browser smoke lanes, prefer CI settings that disable screenshots, traces, and videos by default or upload only the minimum failure report needed for diagnosis. Recovery-phrase and export flows should not leave rich failure artifacts behind by default.
- Encrypted-at-rest storage changes need storage-level tests for encrypted roundtrips, plaintext scrubbing of legacy columns or payload slots, and the lost-key reset path before the app-level suite can be treated as trustworthy.
- On Windows Expo toolchains, run `expo-doctor` sequentially instead of in parallel with Jest or Playwright-heavy commands. The dependency-check subprocess can fail nondeterministically under concurrent load even when the project is healthy.
- Keep one opt-in live sync smoke test that runs ovumcy-app sync services against a locally running ovumcy-sync-community instance via `OVUMCY_SYNC_LIVE_BASE_URL`. It should stay skipped by default in normal Jest runs.
- When sync setup introduces user-facing async preparation such as recovery-phrase generation, keep one focused screen or component test that proves the preparing state is visible and understandable before the happy-path completion state appears.
- When a settings subflow moves to its own route, keep Settings screen tests focused on summary and navigation, and move interactive behavior coverage to the extracted screen.
- When calendar UX or day-log editing changes, cover add, edit, and delete at two levels: React Native screen tests and one live Android Expo acceptance pass. Treat raw adb interaction failures as tooling noise unless the same behavior also fails in the product state or test contract.
- When cycle predictions become overdue, tests must prove the UI degrades to an explicit unknown state rather than continuing to show stale ovulation, next-period dates, or calendar markers.
- When settings can leave the screen with dirty form state, cover three escape paths in Settings tests: back navigation, tab switch, and navigation into a child subflow such as `Backup & sync`.
- Settings flows with immediate language or theme preview must test preview/render parity and all dirty-exit paths, including Android hardware back in addition to route, tab, and child-subflow navigation.
- When a native privacy control such as screenshot protection becomes user-configurable, cover three layers: persisted interface settings, app-shell security-hook behavior for enabled and disabled modes, and one manual release-build check on Android or iOS.

## Manual Verification

- For navigation or platform-visible changes, recommend manual smoke checks on:
  - Android
  - iOS
  - web preview when web is intentionally touched
- When local-first flows change, manual verification should include offline-friendly behavior, persisted local state after reload, and absence of cloud assumptions.
