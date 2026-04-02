---
name: commit
description: Prepare a clean, well-scoped commit for Ovumcy app work without mixing unrelated bootstrap, routing, service, UI, or tooling changes.
---

## Workflow

1. Confirm commit scope and changed layers.
2. Review the selected diff for:
   - route/service/storage mixing
   - duplicated product rules
   - hidden privacy/security regressions
3. Ensure the relevant checks were run.
4. Build a commit message with:
   - concise imperative subject
   - short why-focused body
5. Do not run `git commit` or `git push` unless the user explicitly asks.
