# Editable booking review — 2026-09-08

## Browser observations

Airbnb was inspected directly in Chrome at mobile (390 × 844) and desktop
(1440 × 1000) widths using this public
[listing](https://www.airbnb.co.kr/rooms/1730146303578649154).

- Mobile presented review, payment method, host-message and final request views.
  Dates and guest counts were editable, including from the final request view.
  Guest edits used a bottom sheet; date edits used a vertically arranged calendar.
- Desktop used a payment/review column and a persistent listing/price summary.
  Date editing opened a centered two-month calendar.
- Selecting KakaoPay allowed inspection of the later review. The final request
  action was never submitted, and no payment was made. A required host-message
  draft was cleared before leaving; no message was sent.
- Editable dates, refreshed totals and a persistent order reference do not reveal
  whether Airbnb holds inventory internally. No timer or observable behavior
  established a 15-minute hold at the review stage. This implementation makes no
  claim about Airbnb's internal locking policy.

## Implemented behavior

1. Accommodation Detail creates a non-holding quote and opens the existing
   confirmation route.
2. Review and final confirmation both permit date, guest and coupon edits. Save
   obtains a new server quote. Failed edits preserve the accepted quote; Cancel
   discards the local draft. The server remains authoritative for availability,
   price and coupon eligibility.
3. Next changes the visible step only. Final confirmation is the sole entry into
   idempotent checkout. Paid checkout then opens the existing Toss card flow;
   zero-amount checkout still requires explicit final confirmation.
4. Unheld review survives reload. Expired quotes can be explicitly refreshed.
   Prepared/submitted checkout terms are immutable, and ambiguous checkout
   requests retain their original body and idempotency key.
5. Reload of a held/payment flow restores the existing recovery screen without
   automatically opening Toss. Cancellation and hold release use the existing
   workflow.

The host-message step is omitted because Airbob does not provide that feature.
Payment-method selection stays in the existing supported Toss card flow. No
Airbnb-only cancellation promise or alternative payment method was added.

Desktop uses a sticky summary column. Mobile uses a fixed total/action bar and
shared dialogs with a visible save footer. The compact header removes unrelated
search controls from the transaction route. Manual browser inspection included
390px and 320px dialogs plus desktop review.

## Inventory boundary

Backend behavior and duration are unchanged: a quote does not consume inventory;
checkout revalidates and creates the existing 15-minute inventory hold. That
15-minute period is logical inventory ownership, not a database transaction kept
locked for 15 minutes. The frontend now reaches that boundary only on the final
confirmation action. Removing or shortening the backend hold would be a separate
server policy change, not something established by the Airbnb observations.

## Validation and limits

Before rebasing, `npm run verify:design-ready` passed at `05d3e8f`: 292 test files / 2,621 unit and integration
tests, 112 deterministic browser tests, type checks, lint, architecture checks,
artifact privacy checks and the production build budget gate. Production
dependency audit reported zero vulnerabilities. Initial JavaScript was 130.76 kB
gzip against the 131.40 kB budget; the largest lazy route was 79.03 kB against
80.00 kB. Updated mobile and desktop review screenshots were inspected.

The work was then rebased onto `origin/main` at `038f5d0` (PR #15). Both the new
detail-header policy and the review's compact-header policy were retained. The
new mobile booking-bar test now follows the editable review and verifies return
to the inline calendar without checkout. Post-rebase validation passed: 230
focused unit/integration tests, 34 reservation-payment and mobile-detail browser
tests, application/test/browser TypeScript checks, and source/browser lint. The
full pre-rebase gate above was not rerun after this integration.

New deterministic browser cases cover edits at mobile/desktop widths, restoration,
failed-edit preservation, coupon repricing, expired-quote refresh, a single Toss
launch after the final action, and no automatic payment on reload. Existing
checkout response-loss and complimentary-reservation cases now traverse review.
Workflow/repository cases cover stale revisions, identity changes, pending-edit
serialization and refusal to revise prepared/submitted/held requests.

The interactive local preview uses synthetic listing/session/quote responses and
blocks reservation creation. Browser payment tests use a synthetic Toss adapter;
they do not prove live provider popup behavior or a live backend checkout. No
production deployment, real reservation or real payment was performed.
