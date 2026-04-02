---
name: browser-e2e
description: Use this skill for temporary web-shell and browser-level smoke checks in ovumcy-app until dedicated mobile E2E tooling is introduced.
---

## Workflow

1. Use web smoke only when the change affects shared routing, shared UI primitives, or Expo web output.
2. Prefer `npx expo export -p web` as a fast bundle/regression gate.
3. If interactive browser verification is needed, run the smallest possible local preview and inspect only the changed screens.
4. Do not treat browser smoke as a substitute for Android/iOS manual checks on mobile-specific flows.
5. When mobile-specific behavior matters, explicitly note that manual device or simulator validation is still required.
