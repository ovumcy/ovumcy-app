---
name: frontend-testing
description: Run focused validation for the Ovumcy app client, including lint, typecheck, unit tests, Expo doctor, and manual cross-platform smoke guidance.
---

## Workflow

1. Determine which layers changed:
   - UI only
   - service or model logic
   - storage
   - routing/navigation
   - tooling/dependencies
2. Run the relevant baseline checks:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
3. If dependencies or Expo config changed, also run:
   - `npm run doctor`
4. For navigation or platform-visible changes, recommend manual smoke on:
   - Android
   - iOS
   - web preview if intentionally affected
5. Report failures as product bugs, test drift, or tooling drift instead of mixing them together.
