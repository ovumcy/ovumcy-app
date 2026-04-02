# Ovumcy App Context

This file is the entry point for the local Ovumcy app AI context set. Read it together with:

- `.agents/context/architecture.md`
- `.agents/context/security.md`
- `.agents/context/deployment.md`
- `.agents/context/testing.md`
- `.agents/context/ownership.md`
- `.agents/context/forbidden_changes.md`

## Core Principles

- Project: `ovumcy-app` — privacy-critical, local-first mobile client for sensitive health-related data.
- Goal: clean, maintainable Expo/React Native client architecture that supports iOS and Android first, with future web-client compatibility.
- Core tracking, predictions, and stats must remain usable without sync or managed hosting.

## Architecture Boundaries

- Route files live in `app/`.
- Shared domain types live in `src/models/`.
- Reusable product logic and view-data assembly live in `src/services/`.
- Local persistence and repositories live in `src/storage/`.
- Screen components live in `src/ui/screens/`, while shared UI primitives and theme tokens live in `src/ui/`.
- App-level copy and app metadata helpers live in `src/i18n/`.
- Local device and secure-storage policies live in `src/security/`.
- Future sync code belongs in `src/sync/` and must remain optional for core local use.
- Async local-first orchestration belongs in `src/services/`, not in screen components. When a screen needs persisted bootstrap or onboarding state, prefer a service-backed container plus a presentational screen contract.

## Cross-Platform UX Parity

- For core owner flows, the web product is the canonical UX contract unless a platform constraint makes parity impossible.
- Mobile screens should preserve the same step structure, information hierarchy, copy, and behavioral states as the web client so users do not need to relearn the product across platforms.
- For core owner flows, visual parity should include canonical Ovumcy brand assets as well as flow structure unless a platform constraint forces a deviation.
- Until a separate app design system is explicitly approved, `ovumcy-web` is also the canonical visual token source for core owner flows.

## Security Invariants

- Health data is sensitive on-device data.
- Default app behavior must avoid telemetry and avoid leaking health data through logs, route params, notification payloads, or insecure storage.
- Device-level privacy controls such as screenshot protection must stay secure by default and remain backward-compatible with older local profiles that do not yet store the preference explicitly.
- Secrets and long-lived credentials belong in platform-secure storage, not general-purpose local key/value stores.
- Native local-first persistence should prefer a repository-backed database boundary over direct key/value storage once app state becomes long-lived product data.
- Platform storage differences are allowed only behind `src/storage/` boundaries. Native may use SQLite while web temporarily uses a narrower fallback, but services and screens must not branch on storage technology.
- See `.agents/context/security.md` for details.

## Deployment Invariants

- This repository builds client apps, not the sync backend.
- The supported baseline is a local-first client that can run without an account or cloud dependency.
- Managed sync and self-hosted sync are later optional integrations and must not become required for core tracking flows.
- See `.agents/context/deployment.md` for build and environment detail.

## Testing Rules

- UI and feature changes should be covered with React Native tests plus manual Android/iOS smoke checks when appropriate.
- TypeScript and lint gates are required for non-trivial changes.
- See `.agents/context/testing.md` for test expectations and audit rules.

## Cross-Repo Governance

- For cross-repo authority, active-repo status, and orchestration rules, read:
  - `D:\ovumcy-governance\ACTIVE_REPOS.md`
  - `D:\ovumcy-governance\DOMAIN_AUTHORITY_MATRIX.md`
  - `D:\ovumcy-governance\ORCHESTRATION_PROTOCOL.md`
  - `D:\ovumcy-governance\REPO_STRUCTURE_STANDARD.md`
  - `D:\ovumcy-governance\SKILL_CATALOG.md`
  - `D:\ovumcy-governance\CONTEXT_LOADING_ORDER.md`
- This repository remains the local source of truth for app implementation and app-domain behavior.
- Cross-repo consumers should align to app-domain authority through the governance layer instead of inferring ownership ad hoc.
