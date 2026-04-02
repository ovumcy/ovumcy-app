---
name: feature-change
description: Plan and implement an Ovumcy app feature using the local-first mobile architecture, keeping route files thin and product logic reusable across iOS, Android, and future web clients.
---

## Workflow

1. Identify the primary product area and affected layers:
   - `routes`
   - `models`
   - `services`
   - `storage`
   - `ui`
   - `sync` if applicable
2. Call out privacy/security-sensitive areas explicitly.
3. Keep route files transport-only: navigation and screen wiring only.
4. Put canonical product types in `src/models/`.
5. Put reusable product logic and view-data assembly in `src/services/`.
6. Put persistence behavior in `src/storage/`.
7. Run the smallest useful verification set:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run doctor` for broader bootstrap or dependency work
8. Propose governance updates if the change introduces new stable patterns.
