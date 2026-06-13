# Ovumcy App Maestro E2E Flows

[Maestro](https://maestro.mobile.dev/) drives the real, built app on a device
or emulator using declarative YAML flows. It was chosen over Detox because the
flows are plain YAML with no native build configuration to maintain.

> [!IMPORTANT]
> **These flows are authored scaffolding and have NOT yet been validated against
> a running device or emulator in this repository.** They were written against
> verified `testID`s in the source (and the existing Playwright web-smoke spec),
> but no Maestro run has confirmed they pass end to end. Treat them as a starting
> point: expect to tune selectors, waits, and especially slider gestures on the
> first real device run, then update this note once they are green.

## Flows

All flows live in `.maestro/` and target real `testID`s present in `src/`.

| Flow | What it does | Key `testID`s used |
| --- | --- | --- |
| `onboarding.yaml` | Completes the 2-step onboarding and lands on the dashboard. | `onboarding-day-option-*`, `onboarding-next-button`, `onboarding-cycle-length-slider`, `onboarding-age-group-under_40`, `onboarding-finish-button`, `dashboard-quick-action-period` |
| `dashboard-log-day.yaml` | Opens today's quick log, marks a period day + a symptom, confirms persistence. | `dashboard-quick-action-period`, `day-log-flow-none`, `day-log-period-toggle`, `day-log-symptom-cramps`, `day-log-status-banner` |
| `navigation.yaml` | Tabs between Today / Calendar / Insights / Settings. | tab labels `Today`/`Calendar`/`Insights`/`Settings`, `dashboard-quick-actions-title`, `calendar-day-panel`, `stats-screen-title`, `settings-interface-section` |
| `settings-cycle.yaml` | Adjusts the cycle-length slider, saves, confirms the success banner. | `settings-cycle-section`, `settings-cycle-length-slider`, `settings-save-all-button`, `settings-cycle-status-banner` |

`onboarding.yaml` and `navigation.yaml` assume the **English** shell copy for
the tab labels (`Today`/`Calendar`/`Insights`/`Settings`, from
`src/i18n/shell-copy.ts`). The other flows assume onboarding is already
complete; run `onboarding.yaml` first, or rely on persisted state.

## Install Maestro

```sh
curl -Ls "https://get.maestro.mobile.dev" | bash
# then add to PATH (zsh/bash):
export PATH="$PATH:$HOME/.maestro/bin"
maestro --version
```

See the [official install docs](https://maestro.mobile.dev/getting-started/installing-maestro)
for Windows (WSL) and troubleshooting.

## Build the app

Maestro needs an installed, built app — not the Metro dev bundle on its own.

### Android (emulator or device)

```sh
# starts an emulator/device build and installs it
npm run android
```

The Android application id is `app.ovumcy.mobile` (see `app.json`).

### iOS (simulator, macOS only)

```sh
npm run ios
```

The iOS bundle identifier is not pinned in `app.json`, so Expo derives it from
the project. Confirm the actual value with `npx expo config --type prebuild`
(look for `ios.bundleIdentifier`) and use that as the `APP_ID` below.

## Run the flows locally

The flows read the application id from an `APP_ID` environment variable so the
same YAML works for Android and iOS.

```sh
# Android
maestro test .maestro --env APP_ID=app.ovumcy.mobile

# iOS (substitute the bundle id reported by `expo config`)
maestro test .maestro --env APP_ID=<ios.bundleIdentifier>

# single flow
maestro test .maestro/onboarding.yaml --env APP_ID=app.ovumcy.mobile

# interactive authoring / debugging
maestro studio
```

`onboarding.yaml` runs with `clearState: true` so it always starts fresh; the
other flows reuse whatever state is on the device.

## CI

`.github/workflows/e2e-maestro.yml` is **`workflow_dispatch` only** and opt-in.
Its `validate-flows` job just lists the flows (no device needed); the
`run-flows` job is gated behind a manual `confirm: yes` input because the
default GitHub-hosted runners provide neither an emulator nor a built app. Wire
in an emulator action and a build step there before depending on it.

## Maestro output

Maestro writes run logs and debug artifacts under `~/.maestro` (per-user, not in
the repo). If you generate local reports/screenshots into the project (e.g.
`maestro test --format junit --output ...`), keep them out of git — `.gitignore`
ignores `.maestro-output/` for that purpose.
