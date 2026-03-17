# Ovumcy App Manual Smoke Checklist

This checklist is the minimum manual acceptance pass for `ovumcy-app`.

## When To Run It

- before opening the repository to public review
- before tagging a release
- after changes to onboarding, navigation, local persistence, branding, or platform-visible shell behavior

## Android

Run on an Android emulator or physical device.

1. Fresh install opens onboarding, not dashboard.
2. Step 1 day-chip date selection works and stays compact on a narrow screen.
3. Step 2 renders without clipped sliders, toggles, or buttons.
4. Finish redirects to dashboard.
5. Relaunch keeps the completed onboarding state.
6. Bottom tabs render and switch without broken icons or duplicate labels.
7. No account, sync, or cloud requirement is shown for core local use.

## iOS

Run on an iOS simulator or physical device.

1. Fresh install opens onboarding, not dashboard.
2. Step 1 day-chip date selection works and stays compact on a narrow screen.
3. Step 2 renders without clipped sliders, toggles, or buttons.
4. Finish redirects to dashboard.
5. Relaunch keeps the completed onboarding state.
6. Bottom tabs render and switch without broken icons or duplicate labels.
7. No account, sync, or cloud requirement is shown for core local use.

## Web Smoke

Run when web support, branding, or app-shell navigation is touched.

1. `npm run e2e:web`
2. Manual browser check:
   - `/` opens onboarding on a clean local state
   - onboarding finish leads to dashboard
   - favicon is visible on a fresh browser session
   - no broken tab icons or shell glyphs appear

## Privacy Checks

During the same pass, confirm:

- onboarding completion works without an account
- no sensitive values appear in URLs
- no debug logging prints health-related onboarding data
- app behavior still makes sense with sync absent
