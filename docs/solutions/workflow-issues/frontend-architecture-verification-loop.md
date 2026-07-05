---
title: Frontend Architecture Verification Loop Before Design Work
date: 2026-07-03
last_updated: 2026-07-05
category: workflow-issues
module: frontend-architecture
problem_type: workflow_issue
component: development_workflow
severity: medium
applies_when:
  - Frontend architecture refactors must be verified before Airbnb design styling
  - Verification needs static contract tests plus authenticated desktop and mobile browser QA
  - QA credentials are needed for smoke testing but must not be committed or documented
tags: [frontend-architecture, verification-loop, browser-qa, contract-tests, credential-hygiene, responsive-qa, route-boundaries, public-barrels, dto-boundaries]
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

The first final gate was verified at HEAD: `npm run verify` passed with 76 suites and 288 tests, and the build exited 0. Browser QA ran against a fresh dev server with the thread-provided QA account. A later final audit pass found that a green verify was still insufficient: stale async paths, card semantics, modal focus restoration, and test-contract gaps can survive unless specialized reviewers attack the diff after the first green run. After those review-loop fixes, `npm run verify` passed with 83 suites and 318 tests, and the build exited 0.

The loop also surfaced process failures worth preserving. A credential-safety test initially used real QA credential strings, the QA doc initially missed mobile Reservation/Profile/Host listing checkpoints, a stale default-port dev server showed old CRA compile overlay errors after HEAD was already clean, browser QA caught mobile Profile overflow, map QA was limited by Google Maps localhost referer restrictions and empty search results, and several legacy modals still need migration to the shared `Dialog` primitive. The later review pass also caught several mistakes that tests did not initially cover: pagination bypassed the search stale-response guard, reservation `loadMore` could start duplicate same-cursor requests before state committed, Dialog autofocus handling skipped focus restoration, and migrated modal CSS still contained dead pre-`Dialog` selectors.

A final architecture-closure pass converted the highest-risk review findings into contracts before visual work: Header logo navigation became a semantic home link, Map InfoWindow raw HTML received typed global callbacks plus accessible button labels, stale rejected async requests gained regression coverage, AccommodationEdit final publish now confirms missing detail address before pending image upload, Search wishlist reconciliation stopped leaking a raw React state setter, touched design-entry CSS moved to tokens, and Auth/Reservation modals moved onto `shared/ui/Dialog`.

The post-merge readiness pass extended the same loop to the remaining design blockers. Payment confirmation recovery now keeps retry state across confirm failures and clears checkout state only after a verified terminal path. Reservation status labels and tones moved behind one helper. Route containers now own their CSS under feature-owned paths, and route/API boundary tests prevent page, layout, and shared UI layers from reaching through feature internals. Header and UserMenu now depend on explicit feature app-shell entry points. SearchBar suggestions and primary actions use semantic buttons with keyboard activation, while IconButton keeps compact visual sizes and provides touch target affordance through its hit area instead of widening every small control.

The profile/reservation closure pass exposed two more architecture escape hatches that a green static gate initially missed. First, reservations and reviews pages imported route containers from public feature barrels, but those barrels still re-exported hooks. A page could therefore reintroduce workflow logic indirectly through the "public" path while avoiding deep-import checks. Second, several feature route containers still imported CSS modules from `pages/**`, and the contract had an allowlist for those violations. The fix was to make public feature barrels route-only, move route CSS modules into the owning feature folders, remove the feature-to-page allowlist, and update token fixtures so moved shells remained covered.

The design-ready gate also became stricter about browser smoke truthfulness. `verify:design-ready` runs the static pre-redesign gate and then the authenticated strict smoke wrapper. The smoke wrapper covers home, search, wishlist, profile host listings, accommodation detail, accommodation edit, reservation detail, and host reservation detail. Reservation detail and host reservation detail require stable reservation UIDs supplied out of band; non-strict smoke may list missing dynamic routes as skipped, but the design-ready gate fails until those UIDs are supplied.

The final DTO-boundary review found one more false-confidence mode: a presentation boundary test can pass while only scanning the obvious card components. Map integrations, raw HTML builders, index views, and detail route containers can still read server-shaped fields directly. The corrective action was to map Search cards and Search map items separately, add host reservation detail and wishlist index/recent-view view models, and expand the DTO-mapped presentation allowlist to every production presentation file that must not import server DTO types.

## Guidance

Run an explicit architecture verification loop before starting visual design work. Treat the loop as a release gate, not as a best-effort checklist.

First, freeze the architecture ownership rules in tests. Route tests should prove that URL/auth/layout policy is centralized in `routes/*`. Domain hook tests should prove that API state lives under `features/*`. Shared primitive tests should prove that reusable UI remains domain-free. Token tests should prevent legacy app-level z-index literals from returning after `styles/tokens.css` becomes the overlay source of truth.

Second, make the QA smoke doc part of the gate. The doc should cover both desktop and mobile sections, and tests should check the sections independently. Do not only assert that terms appear somewhere in the file, because that allows a desktop-only checklist to satisfy a mobile requirement by accident.

Third, protect secrets by testing for patterns, not by embedding known secret strings. The verification gate should reject email-looking strings and explicit `email`, `password`, or `member_id` assignments in docs. For repo-wide safety, run exact credential scans outside docs and tests using the actual thread-provided values, but never commit those values into the repository or generated docs.

Fourth, verify against the current HEAD, not whatever a browser tab happens to show. If a dev server on the default frontend port reports stale CRA overlay errors, treat that as environment state until confirmed against a freshly started server on an unused port.

Fifth, let browser QA feed back into architecture contracts. The Profile guest mobile horizontal overflow was not just a visual bug. It showed that desktop sidebar spacing and dividers were leaking into tablet/mobile layout. The fix reset the Profile sidebar padding, border, divider, and main width at the tablet/mobile breakpoint, then locked the contract with `profile-responsive-contracts.test.ts`.

Sixth, run a review pass after the first green verify and treat reviewer findings as new test obligations. The high-value pattern is: add a failing regression test for the reviewer claim, fix the smallest code path, rerun the targeted test, then rerun the full gate. This caught the search pagination race, duplicate reservation `loadMore`, Dialog autofocus focus-restore regression, ErrorToast announcement gap, card keyboard-accessibility gap, and stale modal CSS selectors.

Seventh, close architecture escape hatches explicitly before design. Raw HTML integration points such as Google Maps InfoWindow may remain outside React, but they need typed global callbacks, escaped API data, accessible action names, and token-owned values. Page-level hooks should expose intent methods such as `updateAccommodationWishlistStatus`, not raw state setters. Modals touched by design should enter through `shared/ui/Dialog` so focus, backdrop, Escape, and body scroll-lock behavior stay centralized.

Eighth, force cross-layer dependencies through public seams. Layouts can use route helpers, shared UI, hooks, and explicit feature app-shell entry points, but they should not import deep feature internals just because a header menu or top-level shell needs one small behavior. Route boundary tests should include the route container files themselves so feature-owned screens do not quietly drift back into page-owned CSS or page-owned orchestration.

Ninth, make public route barrels route-only. A page adapter importing from `features/reservations` or `features/reviews` should receive route containers, not hooks, helpers, panels, constants, or internal component building blocks. Feature-owned composition can still import internal panels directly from sibling modules, but that should happen inside the feature boundary. If a route barrel exports `useSomething`, `Panel`, `components`, `hooks`, or `lib`, the page layer has an easy path back into orchestration.

Tenth, treat CSS ownership as part of the architecture boundary. A route container that lives under `features/*` should not import a CSS module from `pages/**`; the stylesheet moves with the route container or into a shared UI primitive. When moving CSS, update token and high-risk fixtures at the same time. Otherwise the design refactor can lose coverage over the exact shell that now owns the route.

Eleventh, treat every temporary architecture allowlist as unresolved debt. The durable loop is: move orchestration, move ownership-adjacent CSS/API seams with it, delete the exception, and assert zero violations. An allowlist can be useful while sequencing a refactor, but it should not survive the readiness gate.

Twelfth, use semantic UI fixes as architecture readiness work, not as visual polish. When converting clickable `div` rows to buttons, prove mouse and keyboard activation. When adding touch target rules to a shared primitive, preserve existing visual size contracts unless the redesign intentionally changes them. This avoids turning accessibility cleanup into a layout regression source immediately before page-level styling.

Thirteenth, make DTO-boundary tests follow every presentation surface, not just the first component touched by a refactor. If a route maps an API list into `CardViewModel[]`, also check map markers, InfoWindow HTML helpers, summary/index cards, and detail route containers. A server DTO import in any of those files means a future backend field rename can still break the design pass in a place reviewers are less likely to inspect.

Finally, record design-phase limitations instead of pretending coverage is complete. Search map QA was limited by `RefererNotAllowedMapError`, and live search queries returned zero results. Reservation detail smoke coverage also depends on stable guest and host reservation UIDs. The design phase should use an authorized Google Maps referer, a seeded result query, and valid out-of-band reservation UIDs before treating map and reservation-detail styling as verified. The strict smoke script turns the UID requirement into a gate instead of a note.

## Why This Matters

Architecture work before visual design creates a stable surface for design changes. Without this gate, a redesign can mix layout regressions, auth routing mistakes, modal stacking issues, API-state bugs, and missing mobile flows into one large diff. That makes browser QA slower and root causes harder to isolate.

The loop also prevents two common forms of false confidence. Passing unit tests alone does not prove that mobile route screens still fit or that stale browser servers reflect HEAD. Browser QA alone does not prove that route ownership, token ownership, and secret hygiene are durable. The architecture verification loop joins both sides: automated contracts for boundaries, plus browser smoke checks for the user flows most likely to break during design work.

A third false-confidence mode is "green verify before adversarial review." A broad architecture branch can pass typecheck, tests, and build while still carrying untested alternate async paths, inaccessible interactive elements, or dead design-system CSS. The corrective action is not to distrust the test suite; it is to let review findings become new tests so the suite permanently learns the missed edge.

The credential mistake is the strongest warning. A safety test that embeds the exact QA email, password, nickname, or member id becomes a credential leak. The correct pattern is to use generic detection in committed tests and run exact-value scans only as local verification against the thread-provided QA account.

The dynamic-route smoke gate adds a similar warning about coverage claims. If a route needs live data that cannot be safely hardcoded, skip reporting is better than a fake default for exploratory smoke, and strict design-ready smoke should fail until the data is supplied. A smoke report that says "skipped; set this env var" creates honest residual risk. A report that silently omits the route or points at a made-up UID creates false confidence.

## When to Apply

- Before any broad frontend visual pass, especially when the design work will touch route screens, layout wrappers, modal systems, responsive behavior, maps, date pickers, or shared CSS tokens.
- After a behavior-preserving architecture refactor that moves responsibilities between `routes`, `pages`, `features`, `shared/ui`, and `styles`.
- When browser QA reports an issue that looks visual but may indicate a missing contract.
- When an external service blocks local verification. Record the limitation and define the exact condition required for the next phase.
- After a merge into `main` changes the baseline. Re-run the audit and readiness plan against the merged tree before starting broad styling, even if a previous branch already passed.

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

A design-ready script should join static and browser gates so a broad visual pass cannot skip either side:

```json
{
  "verify:pre-redesign": "npm run typecheck && npm run test:ci:no-cache -- --runInBand && npm run build",
  "smoke:frontend:strict": "AIRBOB_SMOKE_STRICT_DYNAMIC_ROUTES=true node scripts/smoke/frontend-smoke.mjs",
  "verify:design-ready": "npm run verify:pre-redesign && npm run smoke:frontend:strict"
}
```

Public route barrels should reject workflow internals, not only deep import paths:

```ts
// Good: the page adapter sees only route containers.
export { PaymentSuccessRoute } from "./PaymentSuccessRoute";
export { PaymentFailRoute } from "./PaymentFailRoute";

// Bad: a broad barrel lets pages re-import internals indirectly.
export { usePaymentConfirmation } from "./hooks";
export { GuestTripsPanel } from "./GuestTripsPanel";
```

The contract should assert the barrel surface directly:

```ts
featureRouteAdapters.forEach(({ publicImport, routeContainer }) => {
  const publicBarrel = readFileSync(resolvePublicBarrel(publicImport), "utf8");

  expect(publicBarrel).toContain(routeContainer);
  expect(publicBarrel).not.toMatch(
    /(?:\.\/(?:components|hooks|lib)|Panel|use[A-Z]|REVIEW_IMAGE_UPLOAD_ERROR_MESSAGE)/,
  );
});
```

The feature-to-page import contract should have no route-container CSS allowlist:

```ts
const violations = collectSourceFiles(featuresRoot)
  .filter((filePath) =>
    /from\s+["'](?:\.\.\/)+pages(?:\/[^"']*)?["']/.test(
      readFileSync(filePath, "utf8"),
    ),
  )
  .map((filePath) => relative(projectRoot, filePath));

expect(violations).toEqual([]);
```

Feature route CSS should stay enrolled after it moves:

```ts
const highRiskPreRedesignCssFiles = [
  "src/features/reviews/ReviewCreateRoute.module.css",
  "src/features/profile/components/ProfileShell.module.css",
];
```

Dynamic smoke routes should report missing live identifiers explicitly:

```js
if (!reservationUid) {
  skippedDynamicRoutes.push({
    name: "reservation-detail",
    pathTemplate: "/reservations/:reservationUid",
    envName: "AIRBOB_SMOKE_RESERVATION_UID",
  });
}
```

Shared compact controls should separate visual size from touch affordance:

```css
.iconButton::before {
  content: "";
  position: absolute;
  width: var(--control-touch-target);
  height: var(--control-touch-target);
}
```

A responsive contract should encode the browser QA fix, not just the symptom:

```ts
const tabletBlock = getMediaBlock(css, "(max-width: 1024px)");

expect(tabletBlock).toMatch(/\.sidebar\s*{[^}]*padding-right:\s*0;/s);
expect(tabletBlock).toMatch(/\.sidebar\s*{[^}]*border-right:\s*none;/s);
expect(tabletBlock).toMatch(/\.sidebar::after\s*{[^}]*display:\s*none;/s);
expect(tabletBlock).toMatch(/\.main\s*{[^}]*width:\s*100%;/s);
```

Async state review findings should become race tests that resolve requests out of order:

```ts
await act(async () => {
  resolveNewerSearch(newerResponse);
});

await waitFor(() => {
  expect(result.current.accommodations[0]?.id).toBe(newerId);
});

await act(async () => {
  resolveOlderSearch(olderResponse);
});

expect(result.current.accommodations[0]?.id).toBe(newerId);
```

Load-more hooks need a synchronous ref guard, not only `isLoadingMore` state, because two calls can happen before React commits the loading state:

```ts
if (!hasNext || isLoadingMore || loadingMoreRef.current || !cursor) return;

loadingMoreRef.current = true;
setIsLoadingMore(true);
```

Dialog tests should cover both initial focus and focus restoration. Supporting autofocus children is not enough if the close path fails to return focus to the opener:

```tsx
await userEvent.click(openButton);
expect(screen.getByLabelText("이름")).toHaveFocus();

await userEvent.click(screen.getByRole("button", { name: "닫기" }));
expect(openButton).toHaveFocus();
```

The design handoff should preserve known limitations:

- Start a fresh dev server on an unused port before browser QA if the default port may be stale.
- Authorize the Google Maps localhost referer used for QA before validating search map visuals.
- Seed or choose a query known to return results before assessing search list and map design.
- Keep legacy modals rendering and closeable, but migrate them to `role="dialog"` and `shared/ui/Dialog` when their visuals are touched. Auth and Reservation are already on `shared/ui/Dialog`; Review and AccommodationAction are the known remaining legacy modal debt.
- Remove dead pre-migration CSS selectors when a modal is moved to `shared/ui/Dialog`; otherwise the design pass may style selectors the component no longer renders.
- Before applying broad Airbnb `design.md` styles, run the token contract so touched component CSS cannot reintroduce core color, radius, shadow, or overlay literals.
- Treat skipped reservation-detail smoke routes as unresolved QA scope until valid guest and host reservation UIDs are supplied through environment variables.

## Related

- `docs/superpowers/plans/2026-07-02-airbob-pre-design-architecture.md` describes the pre-design architecture plan and the reason design work was deferred.
- `docs/superpowers/plans/2026-07-04-airbob-profile-reservation-boundary-refactor.ko.md` describes the profile, reservation, payment, and review route-boundary refactor that produced the route-only barrel and feature-owned CSS rules.
- `docs/qa/frontend-architecture-smoke.ko.md` is the browser smoke checklist for desktop and mobile verification with the thread-provided QA account.
- `scripts/smoke/frontend-smoke.mjs` implements the authenticated smoke wrapper, route-specific assertions, credential redaction, and skipped dynamic route reporting.
- `src/verification-gate.test.ts` locks the verification scripts, QA checklist coverage, and credential-safety checks.
- `src/routes/routeConfig.test.tsx` locks route/auth/layout ownership in `routes/*`.
- `src/routes/route-boundary-contracts.test.ts` locks page/layout/shared UI imports against feature-internal coupling.
- `src/styles/tokens.test.ts` locks global token import order, overlay z-index tokens, and legacy z-index literal prevention.
- `src/pages/Profile/profile-responsive-contracts.test.ts` locks the Profile mobile overflow fix.
- `src/features/profile/index.ts`, `src/features/reservations/index.ts`, and `src/features/reviews/index.ts` are route-only public barrels for page adapters.
- `src/shared/ui/Dialog/*` is the target primitive for modal migrations during future visual work.
