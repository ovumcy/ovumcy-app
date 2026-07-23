# Changelog

All notable changes to the Ovumcy app are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Accessibility coverage across the remaining screens: interactive controls now
  carry a role, an accessible name taken from the localized copy already on
  screen, and the state that matters (disabled, selected, checked, expanded).
  Option groups are named by their field label, informational rows that read as
  one fact are announced as one element, screen and section titles expose the
  header role, and decorative chrome is kept out of the accessibility tree.
- Dynamic Type support: OS font scaling stays enabled everywhere, and the
  fixed-geometry surfaces (calendar month grid, stats bar chart, dashboard cycle
  hero, compact one-line chrome) cap their scaling at a named tier so a very
  large system font shrinks-to-fit instead of overlapping. The bottom tab band
  now grows with the OS font scale on the platforms that scale tab labels.
- A Playwright lane that walks onboarding, day logging, calendar, insights, and
  settings at an enlarged font scale, failing on clipped calendar cells or
  horizontal overflow, plus a policy test pinning the font-scaling caps and
  per-surface screen assertions on names, roles, and states.

### Changed

- The `production` EAS build profile now supplies the production entitlement
  verification key through `EXPO_PUBLIC_ENTITLEMENT_PUBKEYS`, so a production
  artifact verifies managed-issued entitlement tokens instead of falling back to
  the placeholder key and the billing-snapshot boolean. Only the public half of
  the key pair ships in the client — it is embedded in every artifact by
  construction; the managed signing seed stays server-side. Development and
  preview builds keep the placeholder default, and the existing release guard
  still fails any production build or web deploy that would ship it.

### Added

- Premium lock placeholders on the Stats and Settings surfaces that route to the
  managed-cloud upgrade flow, so the free tier renders an explicit, additive
  paywall instead of hiding sections.
- Advanced premium insights: seasonal cycle-length pattern, anomalous-cycle
  detection against the prior-window median, pattern-drift over a full baseline
  window, per-phase mood contrast, and a short-luteal-phase hint anchored on the
  observed thermal shift or LH peak.
- Two-factor authentication for sync/managed accounts: TOTP enrollment,
  verification, disable, and the post-login TOTP challenge, surfaced through a
  dedicated account-security section.
- Account-security UX for sync accounts: change password, forgot-password reset,
  and recovery-code regeneration, wired to both the community and managed backends.
- Doctor-friendly PDF export with a multi-locale sample-rendering harness and a
  visual sweep across all shipped languages.
- Formal German and French localizations and a runtime localization layer.
- Italian (`it`) interface localization across every copy catalog, reaching
  six-locale parity with the web app; Italian is selectable in the settings
  language picker.
- In-app privacy notice on its own screen, reachable from onboarding before the
  first cycle date is stored and from a settings card, with a button that opens
  the published policy on the website.
- Right-of-withdrawal and refund wording on the cloud-plan step, covering the
  14-day EU/EEA consumer withdrawal period and where to send the request.
- Managed session renewal: the app declares refresh support on sign-in, keeps
  the refresh token in secure storage beside the session token, and renews the
  short-lived managed access session before it expires instead of asking for
  the password again. Concurrent renewals share one exchange, because a refresh
  token is single-use and a second use is treated as a leak server-side. A
  managed cloud without refresh support is unaffected: its long-lived sessions
  keep working unchanged.

### Changed

- Brought cycle prediction, onboarding, and statistics behavior to parity with
  the Ovumcy web app, including the data-driven prediction-range explainer and
  the empty-state locked-section copy.
- Reworked the partner-shared projection so summary access is data-minimized
  (detailed day fields collapsed to neutral defaults) and full access still
  honors the owner's privacy toggles.
- Reminder scheduling now resolves against the device timezone and the
  managed reminder-email schedule.
- Russian copy uses proper plural forms throughout.
- CSV export gained the trailing `Pregnancy test`, `Cycle start`, and
  `Uncertain` columns of the web contract, and the doctor PDF now reports
  recorded pregnancy tests plus the pause they cause; both previously dropped
  the field that stops predictions.

### Fixed

- Fertility-signal correctness: luteal-phase anchoring prefers the BBT thermal
  shift over a later LH peak, mucus-only cycles are excluded from luteal
  observation sets, and the anomalous-cycle baseline uses an unweighted median
  rather than a weighted average.
- Doctor-PDF content honesty: predictions render as conservative estimates with
  their qualifiers intact, matching the documented algorithm.
- Onboarding and stats flags that are computed correctly now reliably reach the
  rendered screen rather than being dropped from the view model.

### Security

- Neutralized CSV formula injection in exports: notes, custom symptom labels, and
  cycle factors beginning with `=`, `+`, `-`, or `@` are prefixed so spreadsheet
  software cannot execute them, with RFC 4180 quoting preserved.
- Hardened partner-shared privacy: the pregnancy-test field is stripped from
  every partner projection regardless of access level, and staleness is surfaced
  when a snapshot ages out.
- Hardened the client TOTP path: codes are validated to six digits locally
  before any network call, the challenge id is required, and challenge/replay
  errors from the backend are mapped to stable client error codes.
- Symptom icon validation rejects markup (`<`, `>`), control characters, and
  over-long input, and custom labels cannot collide with built-in symptoms in
  any locale.
- Partner invite tokens are scrubbed from the web URL during module-level bundle
  execution, before the first paint, narrowing the leak window.

[Unreleased]: https://github.com/ovumcy/ovumcy-app/commits/main
