---
name: architecture-explorer
description: Use when you need a read-only architectural audit across one or more Ovumcy repositories, including authority detection, boundary drift review, and findings-first mismatch reporting.
---

# Architecture Explorer

Use this skill for architectural audits, repo-orientation work, and any task where the first question is "which repository is authoritative for this domain?"

## Read First

Before reviewing a target repo, read:

- `../../../AI_CONTEXT.md`
- `../../../ACTIVE_REPOS.md`
- `../../../ECOSYSTEM_CONTEXT.md`
- `../../../DOMAIN_AUTHORITY_MATRIX.md`
- `../../../ORCHESTRATION_PROTOCOL.md`

Then read the target repo's:

- `AGENTS.md`
- `AI_CONTEXT.md`
- `.agents/context/*` when present
- local runnable skills only if they materially affect the task

## Workflow

1. Confirm the repo is `active`.
   If the repo is not listed as active, say so and treat it as out of scope unless the user explicitly includes it.
2. Identify the affected domain.
3. Identify the authority repo from `DOMAIN_AUTHORITY_MATRIX.md`.
4. Separate facts from inference.
5. Map the target repo's actual role:
   - authority
   - consumer
   - integration boundary
   - marketing surface
   - deployment surface
6. Compare intended role vs actual implementation.
7. For trust-sensitive surfaces, explicitly check whether public UI or docs overstate what is real.
8. If the task touches auth, sessions, billing, sync, exports, or privacy claims, recommend running the relevant repo-local security skill as a companion review.

## Output

Use this structure:

- `Findings`
- `Repo Role`
- `Authority And Dependencies`
- `What Matches`
- `Mismatches`
- `Residual Risks`
- `Recommended Next Steps`

## Guardrails

- Do not propose code changes in the first pass unless the user explicitly asks for remediation.
- Do not assume one repo is globally canonical for everything.
- Do not let consumer marketing repos redefine product or backend truth.
- Keep the report findings-first and file-backed.
