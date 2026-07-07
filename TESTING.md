# Testing & Quality

Ovumcy stores sensitive reproductive-health data on the user's own device, so
correctness and privacy are treated as features, not afterthoughts. This document
describes how the app is tested — and, just as importantly, how we keep the tests
honest. Every claim here is backed by code in the repository and by CI.

## Layers

| Layer | What it checks | Where |
|-------|----------------|-------|
| **Unit (policy)** | Pure domain logic — cycle math, prediction policy, validation, export shaping | `src/services/*-policy.test.ts`, `src/services/*-service.test.ts` |
| **Service** | View-model / orchestration services against in-memory storage mocks (settings, stats, calendar, sync, partner) | `src/services/*.test.ts`, `src/sync/*.test.ts` |
| **Component / screen** | React Native screens and components via React Native Testing Library, asserting behavior and rendered hooks | `src/ui/**/*.test.tsx` (`@testing-library/react-native`) |
| **Crypto property** | AEAD invariants (round-trip, key/AAD binding) over thousands of generated inputs | `src/security/*.property.test.ts` (`fast-check`) |
| **Storage** | SQLite / AsyncStorage / web adapters behind the storage contract | `src/storage/local/*.test.ts` |
| **End-to-end (web)** | Real onboarding → log → stats → export → clear-data flows in a browser | `e2e/web-smoke.spec.ts` (Playwright) |
| **Live smoke (opt-in)** | Encrypted upload/restore against a real sync/managed server | `src/sync/*.live.test.ts` (env-gated) |
| **PDF sample harness (opt-in)** | Doctor-PDF rendered to disk per locale for visual inspection | `src/services/export-pdf-service.sample.test.ts` (env-gated) |

The suite currently spans **1000+ Jest test cases across 100+ test files**
(`it(` / `test(` declarations plus the parameterized `it.each` blocks),
covering the security, services, sync, storage, i18n, and UI trees. For the
exact current file count, run `npx jest --listTests | wc -l`. Tests favor
behavior and persisted/encrypted state over markup or implementation details.

## Running the suite

The canonical commands are the ones in `package.json`:

```bash
# Static checks
npm run lint          # expo lint (eslint)
npm run typecheck     # tsc --noEmit

# Jest: unit + service + component + crypto property + storage
npm test              # jest --runInBand

# A single file or pattern
npx jest src/security/local-data-crypto.test.ts
npx jest partner-shared-projection

# End-to-end web smoke (builds the web export, serves dist/, drives Chromium)
npm run e2e:web       # playwright test  (web-smoke.spec.ts only)
```

`npm test` runs `--runInBand` deliberately: several suites exercise stateful
SQLite/storage adapters, and serial execution keeps them deterministic.

### Opt-in suites (env-gated)

Some tests reach a real server or write files and therefore stay skipped unless
you opt in. They use `describe.skip` / early-return guards keyed on environment
variables, so a normal `npm test` never depends on external services:

```bash
# Live sync against a running ovumcy-sync-community server
OVUMCY_SYNC_LIVE_BASE_URL=http://127.0.0.1:8080 npx jest sync-client-service.live

# Live managed + community bridge (needs all three set)
OVUMCY_MANAGED_LIVE_BASE_URL=... \
OVUMCY_SYNC_LIVE_BASE_URL=... \
OVUMCY_MANAGED_LIVE_ADMIN_TOKEN=... \
  npx jest sync-client-service.managed.live

# Render the doctor PDF to e2e/screenshots/ per locale (en/ru/de/fr/es)
OVUMCY_PDF_SAMPLE=1 npx jest export-pdf-service.sample
```

The Playwright `web-smoke.spec.ts` also contains visual-sweep specs (locale
paywall/reminders screenshots, PDF rasterization) that skip cleanly when their
generated artifacts are not present, so the smoke run stays green on a clean
checkout.

## We test our tests

High coverage proves code *ran*, not that a test would *fail if the code broke*.
We hold the security- and privacy-critical paths to that higher bar deliberately,
rather than chasing a coverage percentage:

- **Crypto is property-tested, not just example-tested.** The AEAD round-trip,
  AAD-binding, and wrong-key rejection are asserted over thousands of `fast-check`
  inputs (`payload-crypto.property.test.ts`,
  `partner-share-crypto.property.test.ts`), so a regression that only breaks on
  some payload lengths or AAD shapes still fails the build.
- **Negative paths are first-class.** The matrix in [SECURITY.md](SECURITY.md)
  lists, for nearly every protective claim, a test that asserts the *refusal* —
  a wrong key, a mismatched AAD, a non-6-digit TOTP code, a below-floor grant
  generation, a duplicate symptom label, an injection-prefixed CSV cell, a failed
  reset that must **not** wipe local secrets. A claim with only a happy-path test
  is treated as under-tested.
- **View flags are pinned at the render path, not just the predicate.** A premium
  lock or a prediction qualifier that is computed correctly but dropped from the
  view model never reaches the user. Screen tests and the Playwright smoke assert
  the rendered hooks (`stats-advanced-fertility-lock`, the paused-prediction
  banner, the disabled PDF button) so a correctly-computed-but-unrendered flag
  fails.

Where a claim genuinely cannot be exercised by Jest — native TLS pin enforcement,
the OS keystore behind `expo-secure-store`, the no-telemetry posture — we say so
explicitly under *Policy / Planned* in [SECURITY.md](SECURITY.md) rather than
papering over it with a brittle test. We do not chase a fake 100%.

## Transparency

The cycle-prediction and fertility-signal behavior is documented and mirrored by
tests rather than left implicit: prediction-range copy, luteal-phase anchoring
(thermal shift preferred over a later LH peak), and anomaly/drift thresholds each
have explicit reference cases (`stats-premium-insights-service.test.ts`,
`cycle-prediction-policy.test.ts`, `observed-ovulation-service.test.ts`). The
doctor-PDF sample harness renders the real export per locale so the on-page
content can be inspected against the documented, conservative prediction copy.

## Honest limits

- The Jest suite mocks the OS keystore, the native screen-capture module, and the
  network; it proves the app *asks* for the right protection and *fails closed*
  on the right errors, but the ultimate enforcement is the platform's.
- Certificate pinning has a tested pure policy but no wired native enforcement
  yet, so the end-to-end pinning behavior is not exercised in the app suite.
- Predictions are calendar-and-signal estimates, not medical advice or
  contraception; the tests pin the algorithm, not its clinical validity.
