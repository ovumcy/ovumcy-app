[![CI](https://github.com/ovumcy/ovumcy-app/actions/workflows/ci.yml/badge.svg)](https://github.com/ovumcy/ovumcy-app/actions/workflows/ci.yml)
[![CodeQL](https://github.com/ovumcy/ovumcy-app/actions/workflows/codeql.yml/badge.svg)](https://github.com/ovumcy/ovumcy-app/actions/workflows/codeql.yml)
[![Status](https://img.shields.io/badge/Status-bootstrap-c7756d)](https://github.com/ovumcy/ovumcy-app)
[![Expo SDK](https://img.shields.io/badge/Expo%20SDK-54-000020?logo=expo)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react)](https://reactnative.dev/)
[![iOS%20%2B%20Android](https://img.shields.io/badge/iOS%20%2B%20Android-shared-2ea44f)](https://github.com/ovumcy/ovumcy-app)
[![Local-first](https://img.shields.io/badge/Local--first-yes-2ea44f)](https://github.com/ovumcy/ovumcy-app#privacy-and-security)
[![Sync](https://img.shields.io/badge/Sync-optional-6f42c1)](https://github.com/ovumcy/ovumcy-app#architecture)
[![Telemetry](https://img.shields.io/badge/Telemetry-none-2ea44f)](https://github.com/ovumcy/ovumcy-app#privacy-and-security)

# Ovumcy App

Ovumcy App is the privacy-first, local-first mobile client for Ovumcy.
It is built for people who want the same Ovumcy onboarding and tracking model on iOS and Android without requiring an account, sync, or managed hosting for core use.

This README describes the current `main` branch.
The app is still in the foundation stage: onboarding and local persistence are implemented, while the broader dashboard, calendar, stats, and settings surfaces are still evolving from shell screens into full product flows.

The self-hosted web and server product lives in [`ovumcy-web`](https://github.com/ovumcy/ovumcy-web).

## Why Ovumcy App Exists

The web product proves the Ovumcy model in a self-hosted, privacy-first environment.
The app exists to bring that same product contract onto devices while keeping core tracking local-first.

Ovumcy App is designed around three constraints:

- health data should stay on the device by default;
- onboarding, tracking, and predictions must still make sense without sync;
- future sync must be optional, whether self-hosted by the user or managed later.

## How Ovumcy App Differs

| Capability | Ovumcy App | Ovumcy Web |
| --- | --- | --- |
| Works without an account | :white_check_mark: | :white_check_mark: |
| Local-first device storage | :white_check_mark: | :x: |
| Self-hosted by the user or operator | Future sync layer | :white_check_mark: |
| iOS and Android client | :white_check_mark: | Browser only |
| Server required for core onboarding and tracking | :x: | :white_check_mark: |
| Optional sync planned | :white_check_mark: | Not applicable |

## Short FAQ

### Does Ovumcy App require an account?

No. Core onboarding and future tracking flows are designed to work without an account.

### Where is the data stored?

On the device by default. Native platforms now use a local SQLite-backed repository for bootstrap and onboarding state.

### Is sync required?

No. Sync is planned as an optional later capability, not a dependency for core use.

### Does Ovumcy App use telemetry or ad trackers?

No. The app is being built with no telemetry by default.

### Is Ovumcy App a medical product?

No. Ovumcy provides tracking and estimates based on recorded data. It is not a medical device and should not be treated as diagnostic or treatment advice.

## Current Scope

The current `main` branch provides:

- an Expo and React Native foundation for iOS and Android;
- a local-first onboarding flow with web-parity structure and copy;
- native SQLite-backed bootstrap and onboarding persistence;
- route, service, storage, and UI boundaries aligned with the long-term client architecture;
- baseline CI, CodeQL, and browser smoke automation for the web shell.

## Privacy and Security

- No telemetry or ad trackers by default.
- Core onboarding and future tracking flows must work without sync or cloud access.
- Sensitive health baseline data is stored locally on-device.
- Native bootstrap and onboarding data now live behind a SQLite-backed repository boundary.
- Auth tokens, recovery secrets, and future sync credentials must not be stored in plain AsyncStorage or other broadly readable key/value stores.
- Security checks in GitHub Actions cover CodeQL, production dependency audit, and Trivy filesystem scanning.

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
 Native SQLite / Web fallback storage

Future optional sync:
Client Sync Layer -> Self-hosted or managed sync service
```

- `app/`: Expo Router route files and navigation only.
- `src/models/`: canonical domain types and product shapes.
- `src/services/`: reusable product logic and view-data assembly.
- `src/storage/`: local repositories, persistence contracts, and migrations.
- `src/ui/`: shared design tokens, components, and screen presentation.
- `src/sync/`: reserved for future optional sync.

## Tech Stack

- Expo
- React Native
- Expo Router
- TypeScript
- React Native Testing Library
- Playwright for temporary web-shell smoke

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
- `expo-doctor`
- Playwright web smoke for onboarding and app shell

Manual acceptance guidance lives in [docs/manual-smoke.md](docs/manual-smoke.md).

## Development

Recommended working model:

- implement product logic in `src/services/` and `src/models/`
- keep persistence in `src/storage/`
- keep route files thin
- use `ovumcy-web` as the canonical UX reference for core owner flows

## Roadmap

Near-term work focuses on:

- replacing dashboard, calendar, stats, and settings shells with real local-first product slices;
- growing local data models beyond onboarding;
- adding repeatable Android and iOS smoke discipline;
- preparing the app for optional future sync without making sync mandatory.

## Related Repositories

- [`ovumcy-web`](https://github.com/ovumcy/ovumcy-web) — the self-hosted web and server product

