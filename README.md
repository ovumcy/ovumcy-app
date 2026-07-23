[![CI](https://github.com/ovumcy/ovumcy-app/actions/workflows/ci.yml/badge.svg)](https://github.com/ovumcy/ovumcy-app/actions/workflows/ci.yml)
[![Security](https://github.com/ovumcy/ovumcy-app/actions/workflows/security.yml/badge.svg)](https://github.com/ovumcy/ovumcy-app/actions/workflows/security.yml)
[![CodeQL](https://github.com/ovumcy/ovumcy-app/actions/workflows/codeql.yml/badge.svg)](https://github.com/ovumcy/ovumcy-app/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/ovumcy/ovumcy-app/badge)](https://securityscorecards.dev/viewer/?uri=github.com/ovumcy/ovumcy-app)
[![Coverage](https://codecov.io/gh/ovumcy/ovumcy-app/graph/badge.svg)](https://app.codecov.io/gh/ovumcy/ovumcy-app)
[![Tested](https://img.shields.io/badge/tested-property%20%C2%B7%20web--e2e-2ea44f)](https://github.com/ovumcy/ovumcy-app/blob/main/TESTING.md)
[![Status](https://img.shields.io/badge/Status-alpha-c7756d)](https://github.com/ovumcy/ovumcy-app)
[![Expo SDK](https://img.shields.io/badge/Expo%20SDK-54-000020?logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react)](https://reactnative.dev/)
[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm%20NC%201.0.0-blue.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
[![iOS%20%2B%20Android](https://img.shields.io/badge/iOS%20%2B%20Android-shared-2ea44f)](https://github.com/ovumcy/ovumcy-app)
[![Local-first](https://img.shields.io/badge/Local--first-yes-2ea44f)](https://github.com/ovumcy/ovumcy-app#privacy-and-security)
[![Sync](https://img.shields.io/badge/Sync-optional-6f42c1)](https://github.com/ovumcy/ovumcy-app#architecture)
[![Telemetry](https://img.shields.io/badge/Telemetry-none-2ea44f)](https://github.com/ovumcy/ovumcy-app#privacy-and-security)

# Ovumcy App

Ovumcy App is the local-first mobile client for Ovumcy on iOS and Android.
It brings Ovumcy's cycle tracking, symptom logging, insights, settings, exports, and backup flows onto the device without making an account, sync, or managed hosting mandatory for core use.

Core health data stays on-device by default.
Optional sync is designed as encrypted transport, whether the owner connects a self-hosted community server or a managed Ovumcy Cloud account later.

## Contents

- [Quick Start](#quick-start)
- [Product Snapshot](#product-snapshot)
- [Tiers](#tiers)
- [How Ovumcy App Differs](#how-ovumcy-app-differs)
- [Short FAQ](#short-faq)
- [Current Scope](#current-scope)
- [Public Alpha Expectations](#public-alpha-expectations)
- [Privacy and Security](#privacy-and-security)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Testing and Quality](#testing-and-quality)
- [Roadmap](#roadmap)
- [Related Repositories](#related-repositories)
- [License](#license)

## Quick Start

Requirements:

- Node.js 22+
- npm
- Android Studio for Android emulator work
- Xcode on macOS for iOS simulator work

```bash
git clone https://github.com/ovumcy/ovumcy-app.git
cd ovumcy-app
npm ci
```

Run the app:

```bash
npm run android
npm run ios
npm run web
```

## Product Snapshot

- local-first daily tracking with no account required for core use
- native encrypted-at-rest storage for privacy-sensitive health data
- dashboard, calendar, insights, settings, exports, and optional backup flows
- custom symptom catalog and journal-style day logging
- pregnancy test field with automatic prediction pause on a positive result
- free local device reminders (daily log, upcoming period, fertile window) scheduled entirely on-device
- local CSV/JSON export and strictly additive offline JSON import/restore (preview, then confirm; existing days are never overwritten)
- optional encrypted backup and sync instead of cloud-first dependence
- optional Ovumcy Cloud upgrade for advanced fertility signals, premium insights, doctor-friendly PDF, partner sharing, and reminder emails

## Screens

Current light-theme mobile-view screenshots below reflect the latest dashboard, calendar, settings, and backup/sync UI contracts.

| Today | Calendar |
| --- | --- |
| ![Today screen](docs/readme/dashboard-current-light.png) | ![Calendar screen](docs/readme/calendar-current-light.png) |

| Settings | Backup & sync |
| --- | --- |
| ![Settings screen](docs/readme/settings-current-light.png) | ![Backup and sync screen](docs/readme/backup-sync-current-light.png) |

## How It Fits Into Ovumcy

- [`ovumcy-web`](https://github.com/ovumcy/ovumcy-web) is the canonical self-hosted web product.
- [`ovumcy-sync-community`](https://github.com/ovumcy/ovumcy-sync-community) is the optional self-hosted encrypted sync backend for the app.
- Ovumcy Cloud is the managed hosted backend behind the paid tier (auth, billing, partner sharing).
- `ovumcy-app` is the mobile client that keeps the core experience usable even when sync is turned off.

## Tiers

Ovumcy is layered so each level adds capability without taking anything away from the one below.

| Tier | Backend | Cost | What you get |
| --- | --- | --- | --- |
| **Free (local)** | none | free | Core tracking, custom symptoms, pregnancy test, basic predictions, local device reminders, local CSV/JSON export, offline JSON import |
| **Community Sync** | self-hosted `ovumcy-sync-community` | free, your hosting | Everything in Free + encrypted backup/restore between your own devices |
| **Ovumcy Cloud** | managed hosted service | paid, 30-day trial on signup | Everything above + advanced fertility signals, premium cycle insights, extended cycle reports, doctor-friendly PDF, partner sharing, reminder emails |

Health data stays end-to-end encrypted across all three tiers. The cloud only sees opaque ciphertext, account session metadata, and billing snapshot signals.

## Current Status

This README describes the current `main` branch.
The app is still an early public alpha, but the main local-first slices already work on-device: onboarding, dashboard, calendar, insights, settings, custom symptoms, local export, encrypted-at-rest native storage, and optional backup/sync flows.

## How Ovumcy App Differs

| Capability | Free | Community Sync | Ovumcy Cloud |
| --- | --- | --- | --- |
| Works without an account | :white_check_mark: | :x: (server account) | :x: (cloud account) |
| Local-first device storage | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Cycle tracking + predictions | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Pregnancy test + auto-pause | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| CSV / JSON export | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Offline JSON import / restore (additive) | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Encrypted backup between devices | :x: | :white_check_mark: | :white_check_mark: |
| Advanced fertility signals (LH, BBT shift, ovulation confirmation) | :x: | :x: | :white_check_mark: |
| Premium cycle insights (weighted average, drift, anomalies, seasonal, short luteal warning) | :x: | :x: | :white_check_mark: |
| Extended cycle reports | :x: | :x: | :white_check_mark: |
| Doctor-friendly PDF with colored calendar | :x: | :x: | :white_check_mark: |
| Local device reminder notifications | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Partner sharing (one-way, read-only view for a free guest) | :x: | :x: | :white_check_mark: |
| Reminder emails | :x: | :x: | :white_check_mark: |

## Short FAQ

### Does Ovumcy App require an account?

No. Core onboarding, daily tracking, stats, local CSV/JSON export, and offline JSON import all work without an account.

### Where is the data stored?

On the device by default. Native platforms use a local SQLite-backed repository with encrypted-at-rest payloads for privacy-sensitive health records. Web preview uses a session-only in-memory adapter and should not be treated as durable secure storage for health data.

### Is sync required?

No. Core tracking stays local-first. Sync is optional. The app now supports self-hosted community sync and managed-cloud sync as alpha integrations, but core tracking does not depend on either.

### Can the sync server read health data?

The sync transport is designed so the server stores ciphertext, not readable health records. The server may still see account/session metadata, attached device metadata, blob-size metadata, and timestamps. See [docs/sync-trust-model.md](docs/sync-trust-model.md).

### Does Ovumcy App use telemetry or ad trackers?

No. The app is being built with no telemetry by default.

### Is there a free trial of Ovumcy Cloud?

Yes. Signing up for Ovumcy Cloud starts a 30-day trial that unlocks all premium features. The trial runs for roughly one cycle so the doctor PDF, advanced insights, and partner sharing can be evaluated on real data before any billing.

### How does partner sharing work?

Partner sharing is owner-paid only — the partner never pays and never tracks their own cycle through the share. The owner picks an access level (summary or full) in backup-and-sync settings and generates a single-use invite link, which can also be displayed as a QR code. The partner installs the app, opens the link or scans the QR, and lands in a read-only shared view shaped by the chosen access level — they see exactly what was shared, nothing more, and the cloud only stores ciphertext plus grant metadata.

A no-account guest accept path is implemented on both the app and managed sides: one tap provisions a passwordless, read-only guest session with no card and no subscription. It is deliberately **not enabled in production yet** — it stays gated until platform-verified deep links (Android App Links / iOS Universal Links) are live, so an intercepted invite link cannot be redeemed by a stranger. Until that gate lifts, invite acceptance uses a free Ovumcy Cloud sign-in step. See [docs/sync-trust-model.md](docs/sync-trust-model.md#guest-partner-access) and [docs/deep-links.md](docs/deep-links.md).

### Is Ovumcy App a medical product?

No. Ovumcy provides tracking and estimates based on recorded data. It is not a medical device and should not be treated as diagnostic or treatment advice.

## Current Scope

The current `main` branch provides:

- an Expo and React Native foundation for iOS and Android;
- a local-first onboarding flow with web-parity structure and copy;
- native SQLite-backed bootstrap, profile, symptom-catalog, and day-log persistence;
- local-first dashboard, calendar, settings, stats, custom symptom management, and export flows backed by the same canonical repositories;
- strictly additive offline JSON import/restore (`import-service.ts`): parse, preview, then explicit confirm; it never overwrites an existing day or symptom and restores the profile only onto a pristine install, all Free-tier with no account required;
- pregnancy test logging with automatic prediction pause when the latest test is positive and no subsequent period start has been recorded;
- free local device reminders (daily log, upcoming period with a configurable lead, fertile window) scheduled on-device;
- Ovumcy Cloud premium gates with unified paywall placeholders for advanced fertility, advanced insights, extended reports, doctor PDF, partner sharing, and reminder emails;
- doctor-friendly PDF export with colored monthly calendar, advanced fertility signals, cycle comparison, and short luteal phase warning;
- six-locale interface coverage (English, Russian, German, French, Spanish, Italian) for paywall, day-log, calendar, dashboard, and PDF surfaces;
- route, service, storage, and UI boundaries aligned with the long-term client architecture;
- baseline CI, security scanning, dependency automation, and browser smoke automation for the web shell.

## Public Alpha Expectations

`ovumcy-app` can now be reviewed publicly as an early alpha repository.

What is already true on `main`:

- core local use does not require an account, sync, or managed hosting;
- the main owner flows already exist as working local-first slices instead of shells;
- Ovumcy Cloud premium gates are wired client-side with unified paywall placeholders; premium surfaces show as cleanly locked (never a silent hide, never an error) without an active plan, and the underlying premium analytics and doctor PDF sections render correctly when the managed billing snapshot reports premium features active;
- community sync and managed cloud sync have encrypted round-trip integration suites, including the pregnancy test field, but those live suites run only against a configured server (`OVUMCY_SYNC_LIVE_BASE_URL` / `OVUMCY_MANAGED_LIVE_BASE_URL`) and are skipped by default — they are not part of the routine CI signal;
- CI, browser smoke, and security automation baselines aligned with the current GitHub hosting mode are in place;
- web preview is available for fast review, but it is not the durable storage path for sensitive health data.

What this repository still does **not** claim yet:

- completed Android and iOS manual smoke discipline for every release candidate;
- in-app purchase integration that drives a real Ovumcy Cloud subscription into the managed billing snapshot — the decided monetization channel order is Google Play Billing first, then Lemon Squeezy web checkout, then App Store (see [ovumcy-managed/docs/adr-monetization.md](https://github.com/ovumcy/ovumcy-managed/blob/main/docs/adr-monetization.md)); premium UI is wired, but in-app premium purchase is **not possible** on-device until Google Play Billing lands;
- a *production-enabled* no-account guest landing for partner sharing — the guest-accept flow is built on both the app and managed sides but stays disabled in production until platform-verified deep links land (see [docs/sync-trust-model.md](docs/sync-trust-model.md#guest-partner-access)), so today invite acceptance still uses a free Ovumcy Cloud sign-in step;
- release-store readiness for broad end-user distribution;
- a standalone sync server in this repository.

## Privacy and Security

- No telemetry or ad trackers by default.
- Core onboarding and future tracking flows must work without sync or cloud access.
- Sensitive health baseline data is stored locally on-device.
- Native bootstrap, profile, day-log, and symptom data now live behind a SQLite-backed repository boundary with encrypted-at-rest payloads and secure local key storage. The device-local key uses `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` accessibility, so at-rest encryption protects a powered-off or not-yet-unlocked device — not an already-unlocked, seized, or otherwise compromised device (see [SECURITY.md](SECURITY.md)).
- Web preview uses a non-persistent in-memory storage adapter so browser reloads do not retain health data as durable local storage.
- Local encrypted sync setup keeps non-secret preferences in canonical local storage and stores wrapped secrets only in secure storage.
- Recovery phrases are shown only during explicit local setup or rekey flows and are exported through an explicit local artifact flow instead of clipboard copy.
- Self-hosted and managed sync transports are designed so health payloads are encrypted before upload. Sync servers should store ciphertext, device metadata, and auth/session metadata, not decrypted health content.
- Transport uses standard TLS with platform CA-chain trust; certificate pinning is scaffolded but not yet wired. Payload confidentiality against a CA-compromise adversary (one able to obtain a fraudulent but chain-valid certificate) therefore relies on the end-to-end payload encryption above, not on pinning — while connection metadata and auth tokens would be exposed to such an adversary. Rationale and revisit criteria: [docs/sync-trust-model.md](docs/sync-trust-model.md#tls-pinning-posture).
- Managed cloud auth and billing are a separate plane from sync transport. The sync endpoint should not become the place where email/password billing identity is handled.
- Cloud accounts (managed and self-hosted) support optional TOTP two-factor authentication for login; enrollment, recovery, and the login challenge are described in [docs/two-factor.md](docs/two-factor.md).
- Local CSV, JSON, and PDF exports are privacy-sensitive artifacts and should be handled like health-data backups.
- Auth tokens, recovery secrets, and future sync credentials must not be stored in plain AsyncStorage or other broadly readable key/value stores.
- Security checks in GitHub Actions cover production dependency audit and Trivy filesystem scanning.
- CodeQL analysis is enabled while the repository remains public on GitHub.
- Dependabot monitors app dependencies and GitHub Actions updates.

## Architecture

```text
iOS App / Android App / Web Preview
                 |
                 v
          App Services Layer
                 |
                 v
         Local Storage Boundary
                 |
                 v
 Native SQLite / Web session-only memory storage

Future optional sync:
Local Sync Setup -> Account/Auth Transport -> Self-hosted or managed sync service
```

- `app/`: Expo Router route files and navigation only.
- `src/models/`: canonical domain types and product shapes.
- `src/services/`: reusable product logic and view-data assembly.
- `src/storage/`: local repositories, persistence contracts, and migrations.
- `src/ui/`: shared design tokens and visual primitives.
- `src/ui/screens/`: screen-level presentation and feature-local screen sections.
- `src/sync/`: optional sync contracts, endpoint policy, and setup orchestration.
- `src/security/`: device, secure-storage, and crypto policy for local-data, sync, and partner-share envelopes.
- `src/i18n/`: localized copy catalogs and the language runtime (en, ru, de, fr, es, it).

The app sync trust model is documented in [docs/sync-trust-model.md](docs/sync-trust-model.md).

## Tech Stack

- Expo
- React Native
- Expo Router
- TypeScript
- pdf-lib for client-side doctor PDF generation
- expo-sqlite for native local persistence
- @noble/ciphers (XChaCha20-Poly1305) for sync envelope encryption
- React Native Testing Library
- Playwright for temporary web-shell smoke

## Testing and Quality

Common local commands:

```bash
npm run lint
npm run typecheck
npm test
npm run doctor
npm run e2e:web
```

Current automated baseline:

- `lint`
- `typecheck`
- `jest` screen, service, and storage tests
- `fast-check` property tests for the payload and partner-share crypto (`src/security/*.property.test.ts`)
- opt-in live sync E2E round-trips (`src/sync/*.live.test.ts`) that run only when a live server is configured (`OVUMCY_SYNC_LIVE_BASE_URL` / `OVUMCY_MANAGED_LIVE_BASE_URL`) and are otherwise skipped by default
- `expo-doctor`
- Playwright web smoke for onboarding and app shell
- production dependency audit
- Trivy filesystem scan
- Dependabot version updates for `npm` and `github-actions`

Deployment tooling:

- `npm run deploy` pins `eas-cli` to an explicit version via npx (`eas-cli@18.4.0`), not `@latest`. (eas-cli is not a project dependency, so it is not in the lockfile.)
- The `production` EAS build profile carries `EXPO_PUBLIC_ENTITLEMENT_PUBKEYS` (the entitlement `kid -> public key` map — public by construction; it ships inside every client artifact anyway). Native production builds pick it up from `eas.json`; a web deploy runs outside that profile, so export the same value in the deploy shell — otherwise the release guard stops the deploy rather than let the placeholder key ship.

Manual acceptance guidance lives in [docs/manual-smoke.md](docs/manual-smoke.md).

## Development

Recommended working model:

- implement product logic in `src/services/` and `src/models/`
- keep persistence in `src/storage/`
- keep route files thin
- use `ovumcy-web` as the canonical UX reference for core owner flows

## Roadmap

Done on `main`:

- Ovumcy Cloud premium tier wired client-side with paywall UX and six gated feature surfaces;
- pregnancy test logging with prediction pause across dashboard, calendar, and stats;
- doctor PDF with colored calendar and premium analytic sections (advanced fertility, cycle comparison, short luteal warning);
- partner sharing with summary and full access levels and 7-day invite token TTL;
- community and managed sync transports with encrypted round-trip integration suites covering the new fields (env-gated live suites, skipped by default).

Near-term:

- Google Play Billing integration (the decided first monetization channel — see [ovumcy-managed/docs/adr-monetization.md](https://github.com/ovumcy/ovumcy-managed/blob/main/docs/adr-monetization.md)) so a real subscription drives the managed billing snapshot, with in-app premium purchase not possible until this lands; Lemon Squeezy web checkout (already built server-side, second channel, not active in production) and App Store integration (third channel) follow in later phases;
- enabling the already-built no-account guest acceptance flow in production so a partner can redeem an invite link straight into the read-only shared view without an Ovumcy Cloud sign-in step — this is gated on platform-verified deep links (Android App Links / iOS Universal Links) so an intercepted invite cannot be redeemed by a stranger;
- TestFlight and Google Play internal-testing readiness so end-to-end premium can be validated on real devices with sandbox purchases;
- clearer backup and restore ergonomics building on the shipped offline JSON import;
- repeatable Android and iOS manual smoke discipline per release candidate;
- growing local data models beyond cycle baseline, day logs, and symptom catalog without changing the zero-knowledge sync contract.

## Related Repositories

- [`ovumcy-web`](https://github.com/ovumcy/ovumcy-web) — the self-hosted web and server product
- [`ovumcy-sync-community`](https://github.com/ovumcy/ovumcy-sync-community) — the self-hosted encrypted sync backend for Ovumcy app
## License

Ovumcy App is source-available under the **PolyForm Noncommercial License 1.0.0**.
You may view, self-host, use, and modify it for any noncommercial purpose, and
share it noncommercially. Commercial use — selling it, offering it as a paid
service, or bundling it into a paid product — is not granted; contact Ovumcy for
a commercial license.
See [LICENSE](LICENSE).

Third-party attribution notices are recorded in [NOTICE.md](NOTICE.md).
