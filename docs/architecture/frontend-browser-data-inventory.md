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
| `history.state` login return target | `pathname`, `search`, `hash` | Resume an internal protected deep link after login; navigation lifetime only | Internal, potentially Personal through query values | Current auth route and `RequireAuth` | No version/TTL; browser history lifetime | Structured object checks are distributed; external-target policy is not one codec. | U6 internal-return codec accepts only normalized same-origin path/query/hash and rejects loops/external forms. |
| `history.state` accommodation draft provenance | accommodation ID and `source: created-draft` | Distinguish newly created draft while navigating to editor; reload is not required | Internal | `src/routes/paths.ts`, edit route | Typed shape; history lifetime | ID/source matcher; disappears on refresh, then editor hydrates persisted detail. | U6/U12 keep route-state provenance as an untrusted hint; server detail remains authority. |
| `history.state` reservation checkout handoff | Same `ReservationCheckoutState` fields described below | Primary same-navigation handoff to confirm screen | Personal | Booking hook/checkout handoff; no stable viewer owner in record | Runtime type guard only; history lifetime | Confirm route prefers valid location state. Browser/user ownership is not encoded. | U9/U10 pass a minimal owned handoff document; personal identity fields are omitted unless a gateway request demonstrably needs them. |
| `airbob:reservation-checkout:<accommodationId>` | `reservationUid`, `orderName`, `amount`, `customerEmail`, `customerName`, check-in/out, adult/child/infant/pet counts, coupon name/discount | Fallback reload recovery for reservation confirm | Personal; email/name are Personal, reservation/payment tuple is Sensitive-adjacent | `reservationCheckoutState.ts`; indexed by accommodation, no viewer subject | Unversioned JSON; no created/expiry; tab/session lifetime only | Shape guard and safe storage calls. Cleared on terminal paths or logout via prefix scan; malformed data is ignored but not consistently purged on read. | U10 stores only proven reload fields with purpose, version, stable opaque subject, creation/expiry, field allowlist, purge-on-invalid, and server tuple validation. TTL must be decided in U10 before the new writer ships. |
| `airbob:reservation-checkout-index:<reservationUid>` | accommodation ID string | Locate checkout record from payment callback route | Internal plus reservation correlation | `reservationCheckoutState.ts`; no viewer subject | Unversioned; no created/expiry | Removed with checkout record when cleanup succeeds. A stale index can remain after interrupted writes. | U10 replaces or embeds the index in an owned repository; it cannot authorize payment and expires with the checkout record. |
| `airbob:payment-confirmed:<orderId|paymentKey|amount>` | Sensitive tuple encoded in storage key; value `"1"` | Same-tab duplicate-confirm optimization | Sensitive because the storage key contains paymentKey | `paymentConfirmationAttemptRegistry.ts`; no viewer subject | Unversioned; no timestamp/TTL; tab/session lifetime | Read before confirm and written after success. No production logout-wide cleanup for this prefix. It is not server status. | U10 removes browser marker authority. Any replacement is an owned/versioned callback record and marker hit only triggers server reconciliation; purge on terminal/logout/expiry. |
| In-memory payment attempt `Map` | same confirmation tuple and in-flight Promise | De-duplicate concurrent confirm calls in one JS process | Sensitive | `paymentConfirmationAttemptRegistry.ts` | Process lifetime | Removed in `finally`; does not cover another tab or reload. | U10 workflow instance and operation ID enforce one active command; server confirm/status remains terminal authority. |
| Payment success/fail URL query | `paymentKey`, `orderId`, `amount`, optional failure reason | Receive Toss redirect callback and recover ambiguous confirmation | Sensitive | payment route parser and route query builders; no verified viewer owner | URL/history lifetime; no schema version/TTL | Strict amount/query parsing and tuple comparison are partial; URL remains visible in history and artifacts. | U10 validates owned reservation/order/amount/paymentKey/subject tuple, moves required callback material to session-owned storage, removes sensitive query with replace, and redacts artifacts. |
| Search URL query | destination, dates, guest counts, lat/lng, viewport bounds, page | Shareable/search-restorable state | Internal; destination/dates may reveal user intent | routes plus search feature parsers | URL lifetime | Strict numeric/date parsers for request construction; ownership is split. | U6/U8 single codec owns parse/normalize/serialize; deterministic artifacts use synthetic values. |
| Wishlist URL query | wishlist ID or recently-viewed view | Direct-load and history restoration | Internal | routes plus wishlist route state | URL lifetime | Feature parser with fallback; mirrored into React state. | U6/U7 codec is source of truth; no local persisted mirror. |
| Profile URL query | guest/host mode and tab | Direct-load and history restoration | Internal | routes plus profile route state | URL lifetime | Feature parser with fallback; mirrored into React state. | U6/U13 codec is source of truth; no local persisted mirror. |
| TanStack Query cache | session user, search/detail/wishlist/profile/reservation/review/API results | In-memory server-state cache; reload can refetch | Public through Sensitive depending on query | Singleton QueryClient; manual user-scoped root registry | Process lifetime; Query defaults | U5-era baseline cancels/removes selected roots on identity transition; coverage depends on manual registry. | U5 subject/epoch scopes viewer-dependent options and clears the session boundary. Query data is never serialized to browser storage. |
| React component/form state | login/signup form, search drafts, editor form/images, modal/focus state | Active interaction only; reload generally not required | Internal through Personal | Owning component/hooks | Render/component lifetime | React unmount; selected stale-result refs guard several workflows. | Keep ephemeral state local; payment/editor long transactions move to reducer; never persist by default. |

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
| API domain | `REACT_APP_API_URL` | Public build configuration | Allowed browser-public value; no credentials in URL. U4/U16 expose through explicit allowlist only. |
| Google Maps browser key | `REACT_APP_GOOGLE_MAPS_API_KEY` | Public browser key delivered to Google script | Treat as public-but-restricted. Record presence only; never record the value. Domain/API restrictions are external prerequisites. |
| Toss client key | `REACT_APP_TOSS_CLIENT_KEY` | Public browser payment client key | Allow only client-key category. Secret keys and secret-like names fail build/artifact checks. |
| CloudFront domain | `REACT_APP_CLOUDFRONT_DOMAIN` | Public asset host | Allowed browser-public value. Validate host construction in platform/image adapter. |
| QA email/password and route fixture IDs | `AIRBOB_*` shell variables | Test/integration process only | Never browser build input. Never committed or printed. Use synthetic `.invalid` identities in deterministic tests. |

## Artifact and logging policy

| Artifact | Current behavior | Required migration policy |
| --- | --- | --- |
| Client logs | `clientLogger` suppresses test output and receives arbitrary error objects at call sites | Log codes and safe context, not cookie, auth input, raw API body, paymentKey, email/name, or storage document. |
| Live smoke stdout/report | Script redacts configured credential values and records route evidence | Restricted integration job only; stable IDs and credential values remain out of docs. Missing fixture is unverified. |
| Screenshots | Current live smoke stores route screenshots | Use synthetic data when possible. Real-account screenshots require restricted retention and PII review. |
| Playwright trace/video/screenshot | Not present at U1 | U2 defaults external network to deny, uses synthetic identities, captures on failure only, redacts callback/storage values, scans artifacts, and applies short retention. |
| Built JavaScript/source maps | CRA build exposes `REACT_APP_*` values used by code | U4/U16 explicit browser-public allowlist and secret canary scan; QA/secret values must be absent. |

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
