# Frontend Browser Data Inventory

> Operational supplement to
> [`current-frontend-architecture.md`](./current-frontend-architecture.md).  
> Baseline: production code at `07a1fdf`; recorded 2026-08-29 KST.

This inventory records data that can outlive a render, cross a navigation, or
appear in browser/QA artifacts. It contains no real credential, payment key,
reservation ID, listing ID, email, or member ID.

## Classification

| Class | Meaning | Examples |
| --- | --- | --- |
| Public | Intended for browser delivery and safe to disclose | Route path, public image URL, browser API client key category |
| Internal | Application state that is not a credential | View mode, pagination, accommodation ID |
| Personal | Identifies or describes a user or their activity | Name, email, reservation dates, trip/host records |
| Sensitive | Authentication, payment, authorization, or replay material | Session cookie, payment key, reusable auth state |

Personal and Sensitive values must not be copied into committed fixtures,
documentation, screenshots, traces, videos, console logs, or generated reports.

## Current persistent and navigation data

| Surface / key | Current fields | Purpose and reload necessity | Class | Current owner / subject | Schema and TTL | Current validation and cleanup | Target policy / owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cookie sent with Axios `withCredentials` | Backend session cookie; frontend also attempts to expire `SESSION_ID` | Authenticate API requests; required across reload | Sensitive | Backend/server session; frontend has no reliable readable subject | Server-defined; frontend cannot establish expiry or HttpOnly state | Server `/auth/logout` is authoritative. `document.cookie` deletion is best effort and not revocation evidence. | U5 session state distinguishes local anonymous from verified server revocation; never log or persist cookie material. |
| `history.state` login return target | `pathname`, `search`, `hash` | Resume an internal protected deep link after login; navigation lifetime only | Internal, potentially Personal through query values | `RequireAuth` writes; the app Login adapter validates before the legacy Login body reads | No version/TTL; browser history lifetime | Active U6 codec requires exact data properties, repeatedly validates nested encoding, normalizes same-origin path/query/hash, and rejects external forms, controls, encoded separators, and login/signup loops. | U7 moves the writer/session boundary and removes the legacy Login parser while preserving this codec contract. |
| `history.state` accommodation draft provenance | accommodation ID and `source: created-draft` | Distinguish newly created draft while navigating to editor; reload is not required | Internal | `src/app/router/paths.ts` and edit adapter; legacy path helper remains for old callers | Typed shape; history lifetime | App adapter checks exact ID/source intent; the hint disappears on refresh and never overrides hydrated server detail. | U12 keeps route provenance untrusted and removes the legacy helper with the editor body. |
| `history.state` reservation checkout handoff | Same `ReservationCheckoutState` fields described below | Primary same-navigation handoff to confirm screen | Personal | Booking hook/checkout handoff; no stable viewer owner in record | Runtime type guard only; history lifetime | Confirm route prefers valid location state. Browser/user ownership is not encoded. | U9/U10 pass a minimal owned handoff document; personal identity fields are omitted unless a gateway request demonstrably needs them. |
| `history.state` review partial-success toast | `toastMessage` string | Carry one review-image upload warning from review create to reservation detail | Internal; arbitrary injected text could expose Personal data | Review create route writes; the app detail adapter currently forwards the state to the legacy detail body | Unversioned; attached to one browser history entry and may reappear on reload or back/forward | Only a string check. The detail route does not consume/replace the history value after copying it, so the same toast can reappear. | U9 replaces free-form text with a typed result code, consumes it once, and maps the code to owned UI copy. Review creation remains successful when image upload alone fails. |
| `airbob:reservation-checkout:<accommodationId>` | `reservationUid`, `orderName`, `amount`, `customerEmail`, `customerName`, check-in/out, adult/child/infant/pet counts, coupon name/discount | Fallback reload recovery for reservation confirm | Personal; email/name are Personal, reservation/payment tuple is Sensitive-adjacent | `reservationCheckoutState.ts`; indexed by accommodation, no viewer subject | Unversioned JSON; no created/expiry; tab/session lifetime only | Shape guard and safe storage calls. Cleared on terminal paths or logout via prefix scan; malformed data is ignored but not consistently purged on read. | U10 stores only proven reload fields with purpose, version, stable opaque subject, creation/expiry, field allowlist, purge-on-invalid, and server tuple validation. TTL must be decided in U10 before the new writer ships. |
| `airbob:reservation-checkout-index:<reservationUid>` | accommodation ID string | Locate checkout record from payment callback route | Internal plus reservation correlation | `reservationCheckoutState.ts`; no viewer subject | Unversioned; no created/expiry | Removed with checkout record when cleanup succeeds. A stale index can remain after interrupted writes. | U10 replaces or embeds the index in an owned repository; it cannot authorize payment and expires with the checkout record. |
| `airbob:payment-confirmed:<orderId|paymentKey|amount>` | Sensitive tuple encoded in storage key; value `"1"` | Same-tab duplicate-confirm optimization | Sensitive because the storage key contains paymentKey | `paymentConfirmationAttemptRegistry.ts`; no viewer subject | Unversioned; no timestamp/TTL; tab/session lifetime | Read before confirm and written after success. No production logout-wide cleanup for this prefix. It is not server status. | U10 removes browser marker authority. Any replacement is an owned/versioned callback record and marker hit only triggers server reconciliation; purge on terminal/logout/expiry. |
| In-memory payment attempt `Map` | same confirmation tuple and in-flight Promise | De-duplicate concurrent confirm calls in one JS process | Sensitive | `paymentConfirmationAttemptRegistry.ts` | Process lifetime | Removed in `finally`; does not cover another tab or reload. | U10 workflow instance and operation ID enforce one active command; server confirm/status remains terminal authority. |
| Payment success/fail URL query | `paymentKey`, `orderId`, `amount`, optional failure reason | Receive Toss redirect callback and recover ambiguous confirmation | Sensitive | payment route parser and route query builders; no verified viewer owner | URL/history lifetime; no schema version/TTL | Strict amount/query parsing and tuple comparison are partial. The value remains visible in browser history; U2 deterministic output redacts it and rejects raw callback values in text artifacts. | U10 validates owned reservation/order/amount/paymentKey/subject tuple, moves required callback material to session-owned storage, removes sensitive query with replace, and redacts artifacts. |
| Accommodation booking URL query | `checkIn`, `checkOut`, adult/child/infant/pet occupancy | Preserve a booking draft from search to accommodation detail/confirm and across direct load/back/forward | Internal; dates and party composition describe Personal activity | App path serializer plus legacy accommodation parser/body | URL and browser-history-entry lifetime; no version/TTL | U6 codec fixes key order and strict parsing contract, while current compatibility bodies still consume raw params. Query data is untrusted and does not prove price, availability, or viewer ownership. | U9 makes the typed codec state the controller input and validates the draft against current accommodation/session/server data before reservation creation. |
| Search URL query | destination, dates, guest counts, lat/lng, viewport bounds, page | Shareable/search-restorable state | Internal; destination/dates may reveal user intent | App codec/serializer plus legacy search feature parser/controller | URL lifetime | U6 codec preserves current fallback and canonical order; the U8 body still owns actual parse/push/replace behavior and mirrors selected UI state. | U8 switches the controller to the app codec as the single parse owner; deterministic artifacts use synthetic values. |
| Wishlist URL query | wishlist ID or recently-viewed view | Direct-load and history restoration | Internal | App codec/serializer plus legacy Wishlist route parser | URL lifetime | U6 codec preserves positive-ID precedence and fallback; the current body still mirrors the decoded value into React state. | U7 makes codec output the controller source of truth and removes the local persisted mirror. |
| Profile URL query | guest/host mode and tab | Direct-load and history restoration | Internal | App codec/serializer plus legacy Profile route parser | URL lifetime | U6 codec preserves guest/host fallback; the current body still mirrors the decoded value into React state. | U13 makes codec output the controller source of truth and removes the local persisted mirror. |
| TanStack Query cache | session user, search/detail/wishlist/profile/reservation/review/API results | In-memory server-state cache; reload can refetch | Public through Sensitive depending on query | Singleton QueryClient; manual user-scoped root registry | Process lifetime; Query defaults | U5-era baseline cancels/removes selected roots on identity transition; coverage depends on manual registry. | U5 subject/epoch scopes viewer-dependent options and clears the session boundary. Query data is never serialized to browser storage. |
| React component/form state | login/signup form, search drafts, editor form/images, modal/focus state | Active interaction only; reload generally not required | Internal through Personal | Owning component/hooks | Render/component lifetime | React unmount; selected stale-result refs guard several workflows. | Keep ephemeral state local; payment/editor long transactions move to reducer; never persist by default. |

### Browser history lifetime rule

`history.state` and URL query values belong to a browser history entry, not to a
React render. They can survive rerenders, back/forward traversal, and—in browser-
dependent cases—a reload or tab restoration. They disappear only when that
history entry is replaced or discarded, so “navigation-only” never means
“single-render” or “already validated.” Writers must keep fields minimal;
readers must validate every entry and explicitly consume transient commands
such as a one-time toast. U6 owns the canonical codec contracts and activates
safe return-target validation without changing existing push/replace behavior.
U7-U13 switch the remaining legacy parsers/controllers; those later workflow
units remain responsible for server/session authority.

### Checkout fallback fields at U1

The current checkout object is stored as one document, but its fields do not
have equal reload or privacy value. “Consumed after reload” describes reachable
current code; it does not approve the field for the U10 schema.

| Field(s) | Current purpose | Consumed after reload | Class | U10 decision |
| --- | --- | --- | --- | --- |
| `reservationUid` | Server lookup, Toss `orderId`, callback correlation | Yes | Sensitive-adjacent correlation ID | Keep only with verified session subject and server tuple |
| `orderName` | Toss payment request display field | Yes | Internal | Re-derive from verified reservation when possible; otherwise justify storage |
| `amount` | Toss request amount and callback tuple comparison | Yes | Sensitive-adjacent payment value | Keep only with server validation; browser value never authorizes confirm |
| `customerEmail`, `customerName` | Toss v1 request customer fields | Yes | Personal | Prefer authenticated/server re-fetch; persist only if U10 proves gateway reload need |
| `checkIn`, `checkOut` | Confirmation summary and night calculation | Yes | Personal activity | Prefer verified reservation re-fetch; otherwise minimal owned record |
| `adultOccupancy`, `childOccupancy`, `infantOccupancy`, `petOccupancy` | Confirmation guest summary | Yes | Personal activity | Prefer verified reservation re-fetch; not needed for callback authorization |
| `couponName`, `couponDiscount` | Confirmation discount display and summary | Yes when present | Personal activity / Internal price | Prefer verified reservation re-fetch; not needed for callback authorization |

The U10 writer cannot ship until this table is resolved to an explicit field
allowlist and TTL. The U1 fact is that the legacy object has no stable subject,
version, creation time, or explicit TTL beyond session-storage lifetime.

## Browser-public configuration and SDK data

| Value | Current source | Exposure | Policy |
| --- | --- | --- | --- |
| API domain | `REACT_APP_API_URL` through `src/platform/config` | Public build configuration | Production requires one explicit HTTPS origin with no credentials, path, query, or fragment; development keeps the CRA proxy. |
| Google Maps browser key | `REACT_APP_GOOGLE_MAPS_API_KEY` through `src/platform/config` | Public browser key delivered to Google script | Treat as public-but-restricted. Record presence only; never record the value. Percent encoding and non-browser-key characters are rejected; domain/API restrictions remain external prerequisites. |
| Toss client key | `REACT_APP_TOSS_CLIENT_KEY` through `src/platform/config` | Public browser payment client key | Only `test_ck_`/`live_ck_` browser-client categories are accepted. Missing/invalid API origins and misplaced `*_sk_*` server-key categories fail before the production compiler; hostile build/artifact checks prove the boundary without printing the value. |
| CloudFront domain | `REACT_APP_CLOUDFRONT_DOMAIN` through `src/platform/config` | Public asset host | Exact validated HTTPS host consumed by the platform image resolver. |
| QA email/password and route fixture IDs | `AIRBOB_*` shell variables | Test/integration process only | Never browser build input. Never committed or printed. Use synthetic `.invalid` identities in deterministic tests. |

## Artifact and logging policy

| Artifact | Current behavior | Required migration policy |
| --- | --- | --- |
| Client logs | `clientLogger` suppresses test output and receives arbitrary error objects at call sites | Log codes and safe context, not cookie, auth input, raw API body, paymentKey, email/name, or storage document. |
| Live smoke stdout/report | Script redacts configured credential values and records route evidence | Restricted integration job only; stable IDs and credential values remain out of docs. Missing fixture is unverified. |
| Screenshots | Current live smoke stores route screenshots | Use synthetic data when possible. Real-account screenshots require restricted retention and PII review. |
| Deterministic Playwright output | U2 disables trace, video, screenshot, and HTML reports; uses synthetic identities and default-deny network; redacts stdout/stderr; and scans the current text artifact directory at teardown. | Keep binary artifacts disabled until an explicit synthetic-only retention policy exists. Any future artifact type must be allowlisted and privacy-scanned before activation. |
| Built HTML/JavaScript/source maps | CRA exposes four values read by the explicit app platform adapter and separately interpolates build-only `PUBLIC_URL` into HTML/asset paths | A hostile production build requires the four approved app-runtime public canaries, permits only empty or percent-free root-relative/HTTPS-path asset bases, and rejects unsafe `PUBLIC_URL`, secret, QA, cookie/token, private-key, and unpredictable unknown `REACT_APP_*` canaries. |

## Cleanup events

| Event | Current cleanup | Target owner |
| --- | --- | --- |
| Login or `/me` refresh to a different viewer | Selected Query roots are canceled/removed; checkout storage is not cleared on successful login | U5 changes subject/epoch, cancels old work, clears session-owned Query/storage before B becomes active. |
| Logout | Checkout/index prefixes and selected Query roots are cleared; server logout is attempted; payment marker prefix is not included | U5 owns local terminal and verified/unverified server revocation; U10 repository clears checkout/callback/marker. |
| Payment confirmed | Checkout/index is best-effort cleared; confirmed marker remains for tab dedupe | U10 clears owned checkout/callback after server terminal; no browser marker acts as authority. |
| Invalid or terminal payment callback | Checkout may be cleared depending on retry classification | U10 transition table owns exact preserve/clear decision. |
| Retryable/ambiguous payment failure | Checkout and callback values may be preserved in URL/storage | U10 preserves only validated owned records until explicit terminal or expiry. |
| Route/session change during editor/payment | Local refs ignore several late completions | U5/U10/U12 captured epoch and operation ID prevent cache/navigation/storage mutation. |
| Storage parse/version/owner failure | Current helpers generally return null; cleanup varies | Target repository purges invalid, expired, foreign-owner, unknown-field, and failed-migration records. |

## Legacy and rollback compatibility

- U4 introduces the safe raw-storage driver and a generic versioned repository
  only. It does not mount a new checkout/payment writer and does not reinterpret
  any legacy record. U5 supplies the authenticated subject/epoch boundary; U10
  alone decides the checkout field allowlist and TTL and activates migration.
  The generic engine refuses a legacy allowlist without an epoch provider and
  requires every migration call to prove that its captured subject is still
  current before verification results, writes, or cleanup can mutate storage.
  The named `legacySessionStorageCompatibility` seam is removed in U10 only
  after both legacy readers/writers, terminal cleanup, and server-verified
  migration have moved to the owned repository.
- Pre-U10 unversioned checkout records are never accepted solely because their
  TypeScript shape parses. U10 may one-way migrate only after authenticated
  server data proves the reservation/order/amount owner tuple.
- Migration deletes the accepted legacy source. Rejected legacy records are
  purged.
- U11 changes only the Toss gateway adapter. It does not change U10 checkout,
  callback, or confirmation contracts.
- A U11 rollback uses an immutable U10 build that understands the same U10
  records. V1 and v2 writers are not mounted together.
- No compatibility reader survives the removal unit named in
  [`frontend-ownership-matrix.md`](./frontend-ownership-matrix.md).

## Change rule

A code change that adds a browser record, query exposure, URL callback field,
artifact type, or public environment value must update this inventory in the
same implementation unit. If purpose, minimal fields, subject, TTL, validation,
cleanup, or artifact policy is unknown, the new writer is not ready to ship.
