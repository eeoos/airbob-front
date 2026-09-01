---
title: "Airbob frontend independent read-only architecture re-audit"
type: audit
date: 2026-09-01
frontend_revision: cfdb1e470b6fa4461f15a3472797d238d762503e
backend_reference_revision: b2ec09a3cdc8cf86877edf5f222c6a5cd6c2afd1
---

# Airbob frontend independent read-only architecture re-audit

## Executive verdict

The frontend is **partially converged**.

The dependency DAG, route registry, session/query lifetime, props-oriented screens, platform adapters and Vite/Vitest/Playwright toolchain have converged in one direction and should not be replaced. Booking/payment transaction semantics, documentation authority and the remaining pre-design UI boundaries have not converged.

The correct response is therefore not another wholesale rewrite. Preserve the proven boundaries, replace the contract-drifted booking/payment writer, then close only the evidenced editor, state/catalog, page-container, responsive and runtime-token gaps.

This audit was completed before implementation and made no frontend or backend changes. The frontend remained clean at `cfdb1e4`. The read-only backend remained at `b2ec09a`; its existing untracked `docs/ideation/` directory was not modified or cleaned.

## Audit method and limitations

The audit independently inspected:

- Git history and file-level churn from the mainline merge tree to `cfdb1e4`
- all 15 route definitions, lazy adapters, shells and auth/session composition
- screen/controller, workflow, feature, platform and shared dependency ownership
- current local-backend accommodation, quote, reservation, payment-attempt and payment-operation contracts
- browser persistence, callback handling and Toss SDK v2 integration
- editor view contracts, image/state behavior, amenity catalogs, layout/responsive/runtime tokens
- Vite, Vitest, architecture gates, deterministic Playwright and live-smoke structure
- the prior audit and implementation plan as falsifiable hypotheses

The repository requires Node `^22.13.0 || ^24.0.0`. This worktree initially had Node 20 and no installed `dependency-cruiser`, so a fresh full architecture/structure/browser green result was not established during the read-only phase. The partial architecture run passed registry fixtures and baseline checks before stopping on that environment prerequisite. Earlier green claims are historical evidence, not a result newly proven by this audit.

## History and convergence

### Forward structural movement

The history contains high churn but no current structural revert to the retired architecture:

- `34494b4`: removed `pages` ownership and moved routes toward features
- `eb86b31`: moved route ownership to `app/router`
- `80bd654`: removed global `src/api`, `src/routes`, `src/layouts`, feature `appShell`/`publicCache`; introduced the current screens/workflows cutover
- `fb94270`: closed production export surfaces

The retired runtime roots and compatibility seams are absent. Restoring `pages`, feature-owned routes, `appShell`, `publicCache`, CRA, Jest, Axios or the pre-v2 payment writer would be a regression.

### Churn that must not be repeated

Across the 29 relevant commits, `app/router` changed in 15, booking/payment in 9, and architecture tests/docs in 25. The largest commits touched 493, 332, 301, 200 and 196 files. Payment recovery was repeatedly hardened and rebuilt, but the final transaction contract still drifted from the current backend.

This means route and layer ownership converged, while payment semantics did not. Future work must land one contract, read boundary or user-flow owner at a time. Strict-production Knip forbids test-only production adapters/exports, so only production-reachable primitives, read-side and hardening may land independently; quote/checkout adapters must join their first v2 workflow consumer. Only the final writer composition switch must be atomic.

## Existing audit and plan comparison

| Hypothesis                                                            | Independent evidence                                                                      | Disposition                                                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `app → screens/workflows/features/platform/shared` is the correct DAG | Current imports and retired-root absence support it                                       | Keep                                                                                         |
| 15 app-owned lazy routes are stable                                   | Definitions, manifest and literal lazy imports agree                                      | Keep                                                                                         |
| Session and Query lifetime are identity-scoped                        | subject/epoch scopes, keyed QueryClient and stale-effect fences are active                | Keep                                                                                         |
| All feature scopes are strictly registered                            | 11 scopes are discovered but the ratchet registers 10; parent `accommodations` is missing | Correct in U1                                                                                |
| Detail can map `unavailable_dates`                                    | Backend detail has `timeZoneId`; availability is a separate resource                      | Remove assumption in U2                                                                      |
| Direct reservation create remains valid                               | Backend requires quote then idempotent checkout                                           | Replace                                                                                      |
| Payment confirm success is a void 2xx result                          | Backend returns 202 operation receipt; polling is authoritative                           | Replace                                                                                      |
| Current reservation status union is current                           | Frontend retains removed aliases and misses processing/cancellation states                | Replace read-side independently                                                              |
| U3 should be one production mega-unit                                 | Conflicts with churn evidence, small-commit requirement and strict Knip reachability      | Split reachable primitives/read-side; adapters join first consumer; atomic owner switch only |
| Claimed callback credentials may live 15 minutes                      | Toss approval must happen within 10 minutes                                               | Cap operationally at 9 minutes and known hold/attempt expiry                                 |
| State/image/catalog U14 scope is complete                             | Maps info-window fallback and many raw states were omitted                                | Expand inventory or ratchet explicit deferrals                                               |
| Representative PageContainer migration closes ownership               | Page-root width/gutter is distributed across the full screen inventory                    | Inventory every root and migrate by screen family                                            |
| custom-media transformation must be enabled                           | Vite already configures the transform; there are zero production alias consumers          | Fix stale docs and add real consumers/build proof                                            |
| Amenity code, label and glyph can be unified immediately              | Detail and editor use intentionally different current glyphs                              | Unify semantic code/label; preserve context glyphs until design                              |
| U12 can remain after UI cleanup                                       | User priority and integration risk require an attempt after deterministic browser work    | Attempt before U13–U15; record `BLOCKED/UNVERIFIED` if fixtures are absent                   |

## Structure to preserve

- Route definitions, manifest, literal lazy adapters, public paths and the sole-main shell contract
- Auth guard states and preservation of pathname/search/hash return targets
- `app → screens/workflows/features/platform/shared` dependency direction
- props-oriented screens and app/controller composition boundaries
- subject/epoch session scopes, stale-effect fences and identity-keyed QueryClient lifecycle
- native HTTP envelope/error boundary with a narrow validated idempotency capability
- versioned purpose/owner/TTL storage drivers and session cleanup
- Toss Payments SDK v2 platform adapter and preload boundary
- default-deny deterministic browser fixtures, artifact redaction and current live smoke until local Playwright parity exists
- shared overlay/focus/escape primitives, `StateView`, semantic CSS token layers and domain-neutral pictograms

## Structure to remove or narrow

- detail wire/model dependence on embedded `unavailable_dates`
- direct accommodation/date `POST /reservations` writer
- post-reservation checkout journal meaning and locally invented payment `operationId`
- payment flow without payment-attempt issuance
- provider-read reconciliation and `Promise<void>` confirm
- any `202`-means-success browser fixture
- obsolete `PAYMENT_COMPLETED`/`COMPLETED` reservation aliases
- callback parsing/scrub delayed until authenticated success/fail routes
- editor `Dispatch`/`SetStateAction`, draft-wide setters and modal setters exposed to views
- duplicate amenity semantic taxonomies
- direct sibling style mutation on image errors
- unowned page-width/gutter rules, zero-consumer custom-media claims and raw browser design literals

## Current backend contract evidence

### Detail and availability

Accommodation detail exposes `timeZoneId`. Availability is fetched from `/api/v1/accommodations/{id}/availability` and contains a booking window plus unavailable `[startDate, endDateExclusive)` ranges. Availability absence, malformed data, network error or R026 must leave detail visible but make quote creation fail closed with retry. Availability is a UX guard; quote remains the inventory/price authority.

### Quote and checkout

Quote creation is `POST /reservation-quotes`. It does not hold inventory and currently expires after five minutes. Checkout is `POST /reservations` with `{quoteUid, requestMessage}` plus an `Idempotency-Key` of 8–128 allowed characters. An exact body/key replay resolves to the same reservation; a key/body mismatch is R016 and must not trigger a new key.

Paid checkout creates a `PAYMENT_PENDING` hold, currently fifteen minutes. Amount 0 confirms without payment. Current frontend positive-only journal validation would fail after a valid complimentary response and must be replaced.

### Payment attempt and operation

The backend issues payment attempts per reservation and allows exact recovery of an existing unconsumed attempt while the hold permits it. Confirm requires `paymentAttemptId` and returns HTTP 202 with an operation ID/status receipt. The only success authority is operation `SUCCEEDED`.

Current operation states are `PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED` and `REQUIRES_REVIEW`; actions include `POLL`, `START_NEW_CHECKOUT`, `RETRY_CANCELLATION`, `CONTACT_SUPPORT` and `NONE`. Raw status URL, backend/provider messages and internal failure details are transport-only.

Current reservation statuses are `PAYMENT_PENDING`, `PAYMENT_PROCESSING`, `CONFIRMED`, `CANCELLATION_PENDING`, `CANCELLED`, `CANCELLATION_FAILED` and `EXPIRED`.

## High-risk decisions fixed before implementation

| Decision                | Conservative implementation decision                                                                                                                                                           | Evidence/limit                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Credential lifetime     | Memory-only before subject claim; then dedicated exact-replay record until `min(first capture + 9m, known hold/attempt expiry)`; delete only after operation receipt write/read-back           | Toss confirmation authorization is limited to ten minutes; nine minutes leaves boundary margin                             |
| Callback URL exposure   | Success and fail search/hash are captured in memory and fully scrubbed before auth/session/telemetry children; add no-referrer document/host policy where supported                            | SPA scrub cannot erase pre-bootstrap hosting/access logs; deployment review remains required                               |
| Fail callback authority | Current fail redirect lacks the success paymentKey/amount tuple, so scrub it before children and never use provider code/message/orderId to claim a journal or authorize retry/release/confirm | Converge to backend-owned reservation status; only an already-authorized pre-callback route may offer same-attempt actions |
| paymentKey shape        | Maximum 200 characters, matching the current backend request contract                                                                                                                          | Reject oversized callback values before domain/storage/API use                                                             |
| V2 rollback             | Record cutover SHA and a verified v2-compatible rollback SHA; never restore the direct-create/pre-v2 writer                                                                                    | If no prior compatible build exists, fail closed and roll forward                                                          |
| Availability failure    | Keep detail visible, disable quote/checkout and show retry                                                                                                                                     | Never interpret missing coverage as “all available”                                                                        |
| Provider minimum        | CARD/KRW amount 0 is complimentary; 1–99 KRW or non-KRW fails before checkout                                                                                                                  | Current adapter is fixed to CARD/KRW; card minimum is 100 KRW                                                              |
| Operation route state   | Carry only exact-version credential-free `{flowId, operationId, reservationUid}` as a receipt locator after Accepted                                                                           | Receipt identity, owner, TTL, route and a freshly claimed lease—not route state—authorize polling                          |
| Support path            | Show allowlisted “additional review” state, reservation/operation identifiers and reservation-detail navigation                                                                                | No support route/email/phone exists; this work must not invent one                                                         |
| Long review             | Keep credential-free operation receipt for at most 24 hours/final acknowledgment; after expiry use reservation detail only and never reconstruct confirm/poll                                  | Backend exposes no public reservation→operation lookup; cross-device/indefinite operation recovery cannot be promised      |

## Pre-design boundary evidence

- The editor view contract exposes React setters and leaf components directly mutate draft arrays/modal state.
- Parent `accommodations` is missing from the architecture ratchet, so a parent-owned catalog must follow U1 registration and be injected into nested presentations without a reverse dependency.
- Semantic amenity code/label is duplicated. Current detail/editor glyphs differ and should remain visually stable until design.
- React image fallbacks mutate sibling styles in Search/Wishlist; Maps info-window HTML has a separate imperative path that must retain escaping.
- `PageContainer` does not exist. Every page root needs an explicit `edge/full`, `wide`, `content` or `narrow` owner before claiming closure.
- Vite already transforms custom media, but production has zero named-alias consumers and about 65 raw media rules. CRA-era comments and “complete” ownership claims are stale.
- Runtime colors/geometry remain in Recently Viewed and Maps helpers. Data-URI SVG requires deterministic resolved/default values rather than unresolved CSS variables.

## User flows that must survive

- direct entry, refresh, history and lazy loading for all 15 routes
- Search URL codec, map/card/wishlist state and the 1024px layout transition
- login return target, session retry and logout/account-switch cleanup
- same-subject reservation intent resume without cross-subject claim
- detail gallery/reviews/wishlist/coupon/guest/date behavior
- explicit quote review on the existing confirmation route
- complimentary checkout and paid attempt/Toss/callback routes
- callback scrub before child render and exact same-tab recovery
- guest/host reservation list/detail authorization and current profile modes
- editor five-step ordering, address confirmation, image upload/order/delete/recovery, save/exit and publish
- overlay focus/Escape, reduced motion, unique main landmark and accessible image fallback

## Primary risks

- Styling payment routes before contract cutover would entangle visual and transaction regressions.
- A PageContainer applied at shell level would break full-viewport Search, guest reservations or editor scrolling.
- Catalog consolidation can accidentally create a nested-feature-to-parent reverse dependency.
- Custom-media conversion can introduce 1023/1024/1025 off-by-one behavior.
- A generic image fallback shared between React and vendor HTML could weaken accessibility or escaping.
- A large U3 commit would recreate the history’s review/bisect problem.
- A “passed” local profile without backend-owned disposable fixtures would be false evidence.

## Execution order approved by evidence

1. Fix contract/document authority and exact feature registry.
2. Split detail and availability.
3. Land reservation/payment contracts, read-side, storage and callback hardening in small green commits; activate the writer only when the full flow is ready.
4. Audit the deterministic booking/payment matrix.
5. Attempt the real local-backend profile; record a real pass or explicit `BLOCKED/UNVERIFIED` evidence without touching backend data/code.
6. Replace editor setters, inventory state/image/catalog owners, then inventory/migrate PageContainer, responsive and runtime-token boundaries.
7. Decompose only evidenced visual surfaces and keep Airbnb styling deferred until all applicable gates are green.

## Sources

- Prior audit: `docs/qa/2026-09-01-frontend-architecture-local-backend-readiness-audit.md`
- Corrected execution plan: `docs/plans/2026-09-01-001-refactor-local-backend-contract-alignment-plan.md`
- Frontend route/session/workflow/feature/platform source and architecture/browser tests at `cfdb1e4`
- Read-only backend accommodation/reservation/payment controllers, DTOs, services, errors and integration tests at `b2ec09a`
- [Toss Payments payment-window integration](https://docs.tosspayments.com/guides/v2/payment-widget/integration-window), [payment flow](https://docs.tosspayments.com/guides/v2/get-started/payment-flow), [minimum-payment FAQ](https://docs.tosspayments.com/resources/faq), [API reference](https://docs.tosspayments.com/reference) and [callback URL guidance](https://docs.tosspayments.com/blog/what-is-successurl)
