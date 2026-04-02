---
name: contract-change
description: Use when an Ovumcy task spans more than one active repository and needs an explicit contract for ownership, boundaries, rollout order, and safe implementation split.
---

# Contract Change

Use this skill before implementing any cross-repo change that affects shared behavior, shared user flows, or a backend/frontend boundary.

## Read First

Before planning a cross-repo change, read:

- `../../../AI_CONTEXT.md`
- `../../../ACTIVE_REPOS.md`
- `../../../ECOSYSTEM_CONTEXT.md`
- `../../../DOMAIN_AUTHORITY_MATRIX.md`
- `../../../ORCHESTRATION_PROTOCOL.md`

Then read the affected repos':

- `AGENTS.md`
- `AI_CONTEXT.md`
- local context files
- API, route, sync, or template files relevant to the boundary

## When To Use

Use this skill for:

- `ovumcy-cloud-site <-> ovumcy-managed`
- `ovumcy-app <-> ovumcy-sync-community`
- `ovumcy-site <-> ovumcy-app-site`
- `ovumcy-site <-> ovumcy-cloud-site`
- `ovumcy-app <-> ovumcy-web` parity or divergence work
- any task where two repos could both plausibly claim ownership

## Workflow

1. Name the affected domain and the authority repo.
2. Name every consumer repo that must align.
3. Write a short contract memo covering:
   - problem statement
   - authority repo
   - consumer repos
   - ownership of UI
   - ownership of API or transport contract
   - ownership of domain rules
   - trust-sensitive or security-sensitive boundaries
   - rollout order
4. Split implementation into disjoint write scopes.
5. Call out what must not move across layers or repos for convenience.
6. Define the minimum verification set per repo before any commit or push.

## Output

Use this structure:

- `Contract Summary`
- `Authority Repo`
- `Consumer Repos`
- `Ownership Split`
- `Risks`
- `Implementation Order`
- `Verification Plan`

## Guardrails

- Do not start with parallel coding when the contract is still ambiguous.
- Do not let consumers rewrite authority-repo truth without an explicit product decision.
- Do not treat temporary proxies or glue layers as acceptable long-term architecture unless the user explicitly approves debt.
- Treat auth, session, sync, privacy, export, and marketing-truth boundaries as high-risk by default.
