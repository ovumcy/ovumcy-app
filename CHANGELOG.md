# Changelog

All notable changes to the Ovumcy app are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
