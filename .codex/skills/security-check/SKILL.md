---
name: security-check
description: Perform a repository-wide security review of ovumcy-app as a privacy-critical local-first mobile client.
---

## Scope

- Local data handling
- secret storage
- sync/auth surfaces
- telemetry/logging
- route/deep-link leakage
- export/backup behavior
- dependency and build-surface risk

## Output

- threat model summary
- findings with severity
- remediation guidance

## Constraints

- Do not apply fixes automatically.
- Surface findings and explain clean remediation paths.
