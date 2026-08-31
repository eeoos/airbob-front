# Frontend Refactor Plan Supersession Index

> Recorded: 2026-08-29 KST  
> Updated: 2026-09-01 KST
> Purpose: preserve architectural history without allowing old plans to become
> execution sources again.

## Active sources

- Current production architecture:
  [`docs/architecture/current-frontend-architecture.md`](../architecture/current-frontend-architecture.md)
- Active contract-alignment plan:
  [`docs/plans/2026-09-01-001-refactor-local-backend-contract-alignment-plan.md`](../plans/2026-09-01-001-refactor-local-backend-contract-alignment-plan.md)
- Independent audit evidence for frontend `cfdb1e4` and read-only backend target
  `b2ec09a`:
  [`docs/qa/2026-09-01-frontend-architecture-independent-read-only-reaudit.md`](../qa/2026-09-01-frontend-architecture-independent-read-only-reaudit.md)
- Mutable cutover registry:
  [`docs/architecture/frontend-ownership-matrix.md`](../architecture/frontend-ownership-matrix.md)
- Migration execution rules:
  [`docs/architecture/frontend-migration-rules.md`](../architecture/frontend-migration-rules.md)
- Browser persistence/privacy registry:
  [`docs/architecture/frontend-browser-data-inventory.md`](../architecture/frontend-browser-data-inventory.md)

Only the current architecture, active 2026-09-01 plan, mutable registries and
migration rules may direct new architecture implementation. The audit is
evidence for those decisions, not a second plan. Historical files below explain
why current code exists; their task lists, gates, and future-work sections are
superseded.

## Git lineage summary

The July work converged in one direction rather than repeatedly restoring the
old design:

- `7373ed3`: moved large page behavior toward feature ownership.
- `34494b4`: removed temporary page adapters and lazy-loaded feature routes.
- `fa4e700`: introduced explicit app-shell/public-cache seams.
- `9e192e3`: recorded the July architecture freeze.
- `83d2a1b`, `5184b8e`, `8d70a94`, `07a1fdf`: hardened auth, search,
  payment, and editor race/session behavior after that freeze.

The seams introduced in July were useful migration steps, not the final target.
The completed 2026-08-29 work preserved their behavior while replacing their
cycles and manual ownership. The active 2026-09-01 plan preserves those
converged boundaries while correcting current backend-contract and pre-design
ownership gaps.

## 2026-08-29 — completed overhaul, now historical

- [`frontend architecture overhaul plan`](../plans/2026-08-29-001-refactor-frontend-architecture-overhaul-plan.md)

This plan explains the route, ownership, Vite/Vitest, native HTTP and strict-tool
cutovers that produced frontend base `cfdb1e4`. Its completion claims are not
authority for the read-only backend target `b2ec09a`, booking/payment contract
alignment, amenity consolidation or custom-media consumer migration. Do not
resume its unit numbers; use the active 2026-09-01 plan.

## Current-tree historical plans

Every file in this section has status **superseded / historical evidence**.

### 2026-07-02 — discovery and initial decomposition

- [`airbob-code-architecture-rebuild`](../superpowers/plans/2026-07-02-airbob-code-architecture-rebuild.ko.md)
- [`airbob-final-frontend-architecture-cleanup`](../superpowers/plans/2026-07-02-airbob-final-frontend-architecture-cleanup.ko.md)
- [`airbob-large-page-decomposition`](../superpowers/plans/2026-07-02-airbob-large-page-decomposition.ko.md)
- [`airbob-pre-design-architecture.ko`](../superpowers/plans/2026-07-02-airbob-pre-design-architecture.ko.md)
- [`airbob-pre-design-architecture`](../superpowers/plans/2026-07-02-airbob-pre-design-architecture.md)

These plans established the original pages/features problem and decomposition
direction. Their proposed directory ownership predates the removal of
`src/pages`.

### 2026-07-03 — stabilization phases and closure attempts

- [`architecture-stabilization-phase-2`](../superpowers/plans/2026-07-03-airbob-architecture-stabilization-phase-2.ko.md)
- [`architecture-stabilization-phase-3`](../superpowers/plans/2026-07-03-airbob-architecture-stabilization-phase-3.ko.md)
- [`architecture-stabilization-phase-4`](../superpowers/plans/2026-07-03-airbob-architecture-stabilization-phase-4.ko.md)
- [`architecture-stabilization-phase-5`](../superpowers/plans/2026-07-03-airbob-architecture-stabilization-phase-5.ko.md)
- [`current-architecture-remediation`](../superpowers/plans/2026-07-03-airbob-current-architecture-remediation.ko.md)
- [`final-architecture-closure`](../superpowers/plans/2026-07-03-airbob-final-architecture-closure.ko.md)
- [`final-audit-fixes`](../superpowers/plans/2026-07-03-airbob-final-audit-fixes.ko.md)
- [`frontend-architecture-blockers`](../superpowers/plans/2026-07-03-airbob-frontend-architecture-blockers.ko.md)
- [`frontend-structural-refactor-phase-1`](../superpowers/plans/2026-07-03-airbob-frontend-structural-refactor-phase-1.ko.md)
- [`overlay-primitive-stabilization-phase-6`](../superpowers/plans/2026-07-03-airbob-overlay-primitive-stabilization-phase-6.ko.md)
- [`pre-design-qa-overlay-token-phase-8`](../superpowers/plans/2026-07-03-airbob-pre-design-qa-overlay-token-phase-8.ko.md)
- [`pre-design-structural-refactor`](../superpowers/plans/2026-07-03-airbob-pre-design-structural-refactor.ko.md)
- [`search-map-decomposition-phase-7`](../superpowers/plans/2026-07-03-airbob-search-map-decomposition-phase-7.ko.md)

These files contain useful regression history for search, overlays, route
boundaries, and verification. Their repeated “final” labels are not current
completion claims.

### 2026-07-04 — post-audit and boundary readiness

- [`frontend-post-audit-stabilization`](../superpowers/plans/2026-07-04-airbob-frontend-post-audit-stabilization.ko.md)
- [`frontend-redesign-readiness-closure`](../superpowers/plans/2026-07-04-airbob-frontend-redesign-readiness-closure.ko.md)
- [`post-merge-frontend-architecture-readiness`](../superpowers/plans/2026-07-04-airbob-post-merge-frontend-architecture-readiness.ko.md)
- [`profile-reservation-boundary-refactor`](../superpowers/plans/2026-07-04-airbob-profile-reservation-boundary-refactor.ko.md)

These plans are evidence for the existing route/query/cache contracts and smoke
workflow. They do not account for the August session/race hardening.

### 2026-07-05 — pre-design closure

- [`frontend-pre-airbnb-design-structure-closure`](../superpowers/plans/2026-07-05-airbob-frontend-pre-airbnb-design-structure-closure.ko.md)

This plan records a historical readiness claim. The active 2026-09-01 plan
supersedes its remaining-work and design-entry decision.

### 2026-07-06 — freeze and full-audit hardening

- [`frontend-architecture-freeze`](../superpowers/plans/2026-07-06-airbob-frontend-architecture-freeze.ko.md)
- [`frontend-full-audit-hardening`](../superpowers/plans/2026-07-06-airbob-frontend-full-audit-hardening.ko.md)
- [`frontend-structure-first-refactor`](../superpowers/plans/2026-07-06-airbob-frontend-structure-first-refactor.ko.md)
- [`post-merge-frontend-architecture-cleanup`](../superpowers/plans/2026-07-06-airbob-post-merge-frontend-architecture-cleanup.ko.md)

These plans produced the July freeze and executable source contracts. The
active plan keeps the behavior/tests that still protect real flows and replaces
the freeze's app-shell/public-cache endpoint with a strict runtime DAG.

## Sibling-branch diagnosis

Commit `2d1c2d9` on the sibling frontend-structure branch recorded a broad
architecture diagnosis and a 21-task plan with nearly the same pre-design
scope. Those files are not present in the current tree, so this index references
the commit rather than copying them:

- `docs/architecture/2026-08-03-airbob-frontend-architecture-diagnosis.ko.md`
- `docs/superpowers/plans/2026-08-03-airbob-frontend-structure-before-design.ko.md`

That diagnosis is input evidence for the active plan, not another plan to run.
Resolved August work is represented by current production code; unresolved
delta is listed in the canonical architecture document.

## Use policy

- Do not resume a historical checklist.
- Do not copy old “remaining work” into a new plan without verifying current
  production reachability.
- Link a historical file when it explains a regression test or prior decision.
- If a historical rule conflicts with the canonical current architecture, the
  canonical document and production graph win.
- New implementation units update the ownership matrix rather than adding
  another architecture-freeze plan.
