---
title: Frontend Architecture Verification Loop Before Design Work
date: 2026-07-03
category: workflow-issues
module: frontend-architecture
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - Frontend architecture refactors must be verified before Airbnb design styling
  - Verification needs static contract tests plus authenticated desktop and mobile browser QA
  - QA credentials are needed for smoke testing but must not be committed or documented
tags: [frontend-architecture, verification-loop, browser-qa, contract-tests, credential-hygiene, responsive-qa]
related_components: [testing_framework, documentation, tooling]
---

# Frontend Architecture Verification Loop Before Design Work

## Context

Airbob needed a behavior-preserving frontend architecture refactor before applying the Airbnb `design.md` styling pass. The important sequence was architecture first, visual redesign second. The architecture work had to stabilize URL ownership, auth/layout policy, domain state boundaries, shared UI primitives, and overlay tokens before broad visual changes could hide regressions.

The target architecture was:

- `routes/*` owns route paths, URL builders, auth requirements, and layout policy.
- `pages/*` composes route-level screens without owning reusable domain state.
- `features/*` owns domain hooks, API state, and mapping logic.
- `shared/ui/*` owns domain-free primitives such as `Dialog`.
- `styles/tokens.css` owns shared overlay and z-index tokens.
- The verification gate and QA smoke doc block unsafe design work until typecheck, tests, build, and browser smoke coverage agree.

The final gate was verified at HEAD: `npm run verify` passed with 76 suites and 288 tests, and the build exited 0. Final architecture and testing reviews approved the split. Browser QA ran against a fresh dev server with the thread-provided QA account.

The loop also surfaced process failures worth preserving. A credential-safety test initially used real QA credential strings, the QA doc initially missed mobile Reservation/Profile/Host listing checkpoints, a stale default-port dev server showed old CRA compile overlay errors after HEAD was already clean, browser QA caught mobile Profile overflow, map QA was limited by Google Maps localhost referer restrictions and empty search results, and several legacy modals still need migration to the shared `Dialog` primitive.

## Guidance

Run an explicit architecture verification loop before starting visual design work. Treat the loop as a release gate, not as a best-effort checklist.

First, freeze the architecture ownership rules in tests. Route tests should prove that URL/auth/layout policy is centralized in `routes/*`. Domain hook tests should prove that API state lives under `features/*`. Shared primitive tests should prove that reusable UI remains domain-free. Token tests should prevent legacy app-level z-index literals from returning after `styles/tokens.css` becomes the overlay source of truth.

Second, make the QA smoke doc part of the gate. The doc should cover both desktop and mobile sections, and tests should check the sections independently. Do not only assert that terms appear somewhere in the file, because that allows a desktop-only checklist to satisfy a mobile requirement by accident.

Third, protect secrets by testing for patterns, not by embedding known secret strings. The verification gate should reject email-looking strings and explicit `email`, `password`, or `member_id` assignments in docs. For repo-wide safety, run exact credential scans outside docs and tests using the actual thread-provided values, but never commit those values into the repository or generated docs.

Fourth, verify against the current HEAD, not whatever a browser tab happens to show. If a dev server on the default frontend port reports stale CRA overlay errors, treat that as environment state until confirmed against a freshly started server on an unused port.

Fifth, let browser QA feed back into architecture contracts. The Profile guest mobile horizontal overflow was not just a visual bug. It showed that desktop sidebar spacing and dividers were leaking into tablet/mobile layout. The fix reset the Profile sidebar padding, border, divider, and main width at the tablet/mobile breakpoint, then locked the contract with `profile-responsive-contracts.test.ts`.

Finally, record design-phase limitations instead of pretending coverage is complete. Search map QA was limited by `RefererNotAllowedMapError`, and live search queries returned zero results. The design phase should use an authorized Google Maps referer and a seeded result query before treating map styling as verified.

## Why This Matters

Architecture work before visual design creates a stable surface for design changes. Without this gate, a redesign can mix layout regressions, auth routing mistakes, modal stacking issues, API-state bugs, and missing mobile flows into one large diff. That makes browser QA slower and root causes harder to isolate.

The loop also prevents two common forms of false confidence. Passing unit tests alone does not prove that mobile route screens still fit or that stale browser servers reflect HEAD. Browser QA alone does not prove that route ownership, token ownership, and secret hygiene are durable. The architecture verification loop joins both sides: automated contracts for boundaries, plus browser smoke checks for the user flows most likely to break during design work.

The credential mistake is the strongest warning. A safety test that embeds the exact QA email, password, nickname, or member id becomes a credential leak. The correct pattern is to use generic detection in committed tests and run exact-value scans only as local verification against the thread-provided QA account.

## When to Apply

- Before any broad frontend visual pass, especially when the design work will touch route screens, layout wrappers, modal systems, responsive behavior, maps, date pickers, or shared CSS tokens.
- After a behavior-preserving architecture refactor that moves responsibilities between `routes`, `pages`, `features`, `shared/ui`, and `styles`.
- When browser QA reports an issue that looks visual but may indicate a missing contract.
- When an external service blocks local verification. Record the limitation and define the exact condition required for the next phase.

## Examples

Credential-safe QA doc assertions should look for unsafe patterns, not known secret values:

```ts
expect(qaDoc).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
expect(qaDoc).not.toMatch(/(?:email|password|member[_ -]?id)\s*[:=]/i);
expect(qaDoc).not.toMatch(/(?:이메일|비밀번호)\s*[:=：]/);
```

Use synthetic names in fixtures and test descriptions:

```ts
const fixtureAccount = {
  displayName: "Synthetic QA Member",
  role: "host",
};
```

Then run a local exact-value scan outside committed docs/tests using the thread-provided QA account values. The command should not be copied into committed documentation with the actual values:

```bash
rg --fixed-strings "<thread-provided-value>" src docs package.json
```

Section-scoped QA coverage prevents desktop terms from satisfying mobile requirements:

```ts
const desktopSection = getSection(qaDoc, "Desktop 1280px checklist");
const mobileSection = getSection(qaDoc, "Mobile 375px checklist");

desktopTerms.forEach((term) => expect(desktopSection).toContain(term));
mobileTerms.forEach((term) => expect(mobileSection).toContain(term));
```

A route architecture contract should make ownership visible:

```ts
const protectedPaths = appRoutes
  .filter((route) => route.requiresAuth)
  .map((route) => route.path);

expect(protectedPaths).toEqual([
  ROUTE_PATHS.accommodationConfirm,
  ROUTE_PATHS.accommodationEdit,
  ROUTE_PATHS.wishlist,
  ROUTE_PATHS.profile,
  ROUTE_PATHS.hostReservationDetail,
  ROUTE_PATHS.reservationDetail,
  ROUTE_PATHS.reviewCreate,
  ROUTE_PATHS.paymentSuccess,
  ROUTE_PATHS.paymentFail,
]);
```

A responsive contract should encode the browser QA fix, not just the symptom:

```ts
const tabletBlock = getMediaBlock(css, "(max-width: 1024px)");

expect(tabletBlock).toMatch(/\.sidebar\s*{[^}]*padding-right:\s*0;/s);
expect(tabletBlock).toMatch(/\.sidebar\s*{[^}]*border-right:\s*none;/s);
expect(tabletBlock).toMatch(/\.sidebar::after\s*{[^}]*display:\s*none;/s);
expect(tabletBlock).toMatch(/\.main\s*{[^}]*width:\s*100%;/s);
```

The design handoff should preserve known limitations:

- Start a fresh dev server on an unused port before browser QA if the default port may be stale.
- Authorize the Google Maps localhost referer used for QA before validating search map visuals.
- Seed or choose a query known to return results before assessing search list and map design.
- Keep legacy modals rendering and closeable, but migrate them to `role="dialog"` and `shared/ui/Dialog` when their visuals are touched.

## Related

- `docs/superpowers/plans/2026-07-02-airbob-pre-design-architecture.md` describes the pre-design architecture plan and the reason design work was deferred.
- `docs/qa/frontend-architecture-smoke.ko.md` is the browser smoke checklist for desktop and mobile verification with the thread-provided QA account.
- `src/verification-gate.test.ts` locks the verification scripts, QA checklist coverage, and credential-safety checks.
- `src/routes/routeConfig.test.tsx` locks route/auth/layout ownership in `routes/*`.
- `src/styles/tokens.test.ts` locks global token import order, overlay z-index tokens, and legacy z-index literal prevention.
- `src/pages/Profile/profile-responsive-contracts.test.ts` locks the Profile mobile overflow fix.
- `src/shared/ui/Dialog/*` is the target primitive for modal migrations during future visual work.
