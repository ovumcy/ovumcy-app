# Ovumcy App

Privacy-first, local-first mobile client for Ovumcy.

## Principles

- Health data stays on the device by default.
- Core tracking, predictions, and stats must work without sync.
- iOS and Android share one React Native codebase.
- Sync is optional and will be added later as a separate capability.

## Stack

- Expo
- React Native
- TypeScript
- Expo Router

## Structure

- `app/` route files and navigation layouts only
- `src/features/` feature screens and feature-level UI state
- `src/domain/` pure domain models and calculation logic
- `src/storage/` local persistence contracts and adapters
- `src/ui/` shared UI primitives and design tokens
- `src/lib/` app-level helpers and metadata

## Development

```bash
npm install
npm run lint
npm run typecheck
npm test
npx expo-doctor
```

Run the app:

```bash
npm run android
npm run ios
npm run web
```

## Current Scope

This repository currently provides:

- a cross-platform app shell,
- local-first feature boundaries,
- baseline testing and linting,
- mobile-first governance and privacy rules.

Sync, managed hosting, and premium capabilities will come later and must not become a requirement for core local use.
