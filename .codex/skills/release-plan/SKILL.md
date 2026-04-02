---
name: release-plan
description: Create an Ovumcy app release regression plan covering lint, typecheck, tests, Expo doctor, and platform smoke checks.
---

## Workflow

1. Identify changed domains and platform impact.
2. Build a release gate matrix:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run doctor`
   - Android smoke
   - iOS smoke
   - optional web smoke if web is affected
3. Highlight privacy/security-sensitive flows that need explicit review.
4. Call out what is validated automatically versus manually.
