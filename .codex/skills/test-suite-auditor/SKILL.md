---
name: test-suite-auditor
description: Audit and improve tests in ovumcy-app, focusing on behavior-based React Native tests, service or model tests, and fragile or missing local-first edge cases.
---

## Workflow

1. Identify changed layers and existing tests.
2. Prefer:
   - pure service or model tests for calculations and shared product rules
   - React Native Testing Library for feature screens
3. Flag brittle tests that overfit route structure or incidental markup.
4. Look for missing coverage around:
   - offline-first behavior
   - local persistence
   - privacy-sensitive UI states
5. Report findings first, then propose improvements.
