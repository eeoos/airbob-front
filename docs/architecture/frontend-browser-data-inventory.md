# Frontend Browser Data Inventory

> Operational supplement to
> [`current-frontend-architecture.md`](./current-frontend-architecture.md).  
> Baseline: U6 routing followed by the U5 session and U19 structural UI cutovers; recorded 2026-08-29 KST.

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
| Cookie sent with Axios `withCredentials` | Backend session cookie; frontend neither reads nor deletes it | Authenticate API requests; required across reload | Sensitive | Backend/server session; frontend derives only an opaque subject after verified `/me` | Server-defined; frontend cannot establish expiry or HttpOnly state | Server `/auth/logout` is authoritative. Local logout becomes anonymous before the request; failure remains revocation-unverified with a safe notice/retry. There is no `document.cookie` deletion path. | Keep backend cookie authority outside frontend state; never log, broadcast, or persist cookie material. |
| `airbob-session-v1` BroadcastChannel message | Exact keys: `version: 1`, `type: session-transition`, random tab `sourceId`, positive monotonic `sequence`, and `phase` equal to `invalidate` or `revalidate` | Same-origin tabs fence current identity state before another `/me` verification; no reload persistence | Internal; deliberately non-PII | `src/platform/session/sessionBroadcast.ts`; source identifies a random tab, not a viewer | Channel/process lifetime; versioned exact envelope | Rejects extra/missing keys, invalid source/phase/sequence, same-source messages, and duplicate/out-of-order sequences. Payload never includes viewer ID, subject, epoch, email, cookie, credentials, or API data. | Keep invalidate-before-revalidate ordering and exact non-PII payload; BroadcastChannel remains advisory, never session authority. |
| In-memory auth intent | Opaque monotonic attempt ID, exact route location key/path, and one discriminated primitive payload: wishlist accommodation ID; reservation accommodation/dates/occupancies/nullable coupon ID; or coupon accommodation/coupon ID | Resume the exact anonymous interaction after verified login without retaining an old component closure; reload recovery is intentionally unsupported | Internal; booking dates and party composition may describe Personal intent | `src/workflows/auth-intent/**`; no viewer PII is stored, and a captured opaque subject/epoch exists only on atomic claim | Provider/render lifetime only; no storage, URL, history, log, cache, or BroadcastChannel serialization | Snapshots declared primitive fields, validates positive IDs/counts/calendar dates, keeps latest-one, and clears on exact cancel, route/key departure, logout, revocation, or authenticated-owner departure. Anonymous login failure retains it; the new authenticated route owner claims once and rechecks the captured session before effects. | Finish U7 by moving remaining auth/wishlist screens to owned controllers, then remove compatibility body ports in U8/U9. Never add callbacks, Promises, credentials, viewer records, persistence, or cross-tab propagation. |
| `history.state` login return target | `pathname`, `search`, `hash` | Resume an internal protected deep link after login; navigation lifetime only | Internal, potentially Personal through query values | `RequireAuth` writes; the app Login adapter validates before the legacy Login body reads | No version/TTL; browser history lifetime | Active U6 codec requires exact data properties, repeatedly validates nested encoding, normalizes same-origin path/query/hash, and rejects external forms, controls, encoded separators, login/signup loops, checkout routes, and payment callback routes. | U7 moves the writer/session boundary and removes the legacy Login parser while preserving this codec contract. |
| `history.state` accommodation draft provenance | accommodation ID and `source: created-draft` | Distinguish newly created draft while navigating to editor; reload is not required | Internal | `src/app/router/paths.ts` and edit adapter; legacy path helper remains for old callers | Typed shape; history lifetime | App adapter checks exact ID/source intent; the hint disappears on refresh and never overrides hydrated server detail. | U12 keeps route provenance untrusted and removes the legacy helper with the editor body. |
| `history.state` reservation checkout handoff | Same `ReservationCheckoutState` fields described below | Primary same-navigation handoff to confirm screen | Personal | Booking hook/checkout handoff; no stable viewer owner in record | Runtime type guard only; history lifetime | Confirm route prefers valid location state. Browser/user ownership is not encoded. U5 replaces the current transaction entry during an identity boundary, but cannot enumerate or erase older history entries; Back can therefore replay legacy A input under B until the target contract lands. | U9/U10 pass a minimal subject-owned, one-shot handoff document, reject foreign/expired/consumed entries before rendering or I/O, and omit personal identity fields unless a gateway request demonstrably needs them. This is a release gate. |
| `history.state` review partial-success toast | `toastMessage` string | Carry one review-image upload warning from review create to reservation detail | Internal; arbitrary injected text could expose Personal data | Review create route writes; the app detail adapter currently forwards the state to the legacy detail body | Unversioned; attached to one browser history entry and may reappear on reload or back/forward | Only a string check. The detail route does not consume/replace the history value after copying it, so the same toast can reappear. | U9 replaces free-form text with a typed result code, consumes it once, and maps the code to owned UI copy. Review creation remains successful when image upload alone fails. |
| `airbob:reservation-checkout:<accommodationId>` | `reservationUid`, `orderName`, `amount`, `customerEmail`, `customerName`, check-in/out, adult/child/infant/pet counts, coupon name/discount | Fallback reload recovery for reservation confirm | Personal; email/name are Personal, reservation/payment tuple is Sensitive-adjacent | `reservationCheckoutState.ts`; indexed by accommodation, no viewer subject | Unversioned JSON; no created/expiry; tab/session lifetime only | Shape guard and safe storage calls. Cleared on terminal paths and by U5's injected reservation cleanup on identity change, logout, or revocation; malformed data is ignored but not consistently purged on read. | U10 stores only proven reload fields with purpose, version, stable opaque subject, creation/expiry, field allowlist, purge-on-invalid, and server tuple validation. TTL must be decided in U10 before the new writer ships. |
| `airbob:reservation-checkout-index:<reservationUid>` | accommodation ID string | Locate checkout record from payment callback route | Internal plus reservation correlation | `reservationCheckoutState.ts`; no viewer subject | Unversioned; no created/expiry | Removed with checkout records by terminal cleanup and the U5 identity cleanup port. Interrupted writes can still leave a stale index inside one active identity generation. | U10 replaces or embeds the index in an owned repository; it cannot authorize payment and expires with the checkout record. |
| `airbob:payment-confirmed:<orderId|paymentKey|amount>` | Sensitive tuple encoded in storage key; value `"1"` | Same-tab duplicate-confirm optimization | Sensitive because the storage key contains paymentKey | `paymentConfirmationAttemptRegistry.ts`; no viewer subject | Unversioned; no timestamp/TTL; tab/session lifetime | Read before confirm and written after success. U5 identity cleanup now removes the entire prefix, clears in-flight entries, and advances a generation; a confirmation captured before cleanup cannot recreate its marker afterward. The marker is not server status. | U10 removes browser marker authority. Any replacement is an owned/versioned callback record and marker hit only triggers server reconciliation; purge on terminal/logout/expiry. |
| In-memory payment attempt `Map` and generation | confirmation tuple, captured generation, and in-flight Promise | De-duplicate concurrent confirm calls and fence storage writes after session cleanup | Sensitive | `paymentConfirmationAttemptRegistry.ts` | Process lifetime; monotonic in-memory generation | Matching attempts share one Promise. Identity cleanup increments the generation and clears the map; late completion may settle its caller but cannot write a confirmed marker into the new generation. It does not synchronize another tab. | U10 workflow instance and operation ID enforce one active command; server confirm/status remains terminal authority. |
| Payment success/fail URL query | `paymentKey`, `orderId`, `amount`, optional failure reason | Receive Toss redirect callback and recover ambiguous confirmation | Sensitive | payment route parser and route query builders; no verified viewer owner | URL/history lifetime; no schema version/TTL | Strict amount/query parsing and tuple comparison are partial. The value remains visible in browser history; replacing the currently visible callback on identity cleanup does not remove an older callback entry. U2 deterministic output redacts it and rejects raw callback values in text artifacts. | U10 validates an owned reservation/order/amount/paymentKey/subject tuple before any confirmation request, consumes it once, moves required callback material to session-owned storage, removes the sensitive query with replace, and redacts artifacts. Foreign/history-replayed callbacks must perform no I/O. This is a release gate. |
| Accommodation booking URL query | `checkIn`, `checkOut`, adult/child/infant/pet occupancy | Preserve a booking draft from search to accommodation detail/confirm and across direct load/back/forward | Internal; dates and party composition describe Personal activity | App path serializer plus legacy accommodation parser/body | URL and browser-history-entry lifetime; no version/TTL | U6 codec fixes key order and strict parsing contract, while current compatibility bodies still consume raw params. Query data is untrusted and does not prove price, availability, or viewer ownership. | U9 makes the typed codec state the controller input and validates the draft against current accommodation/session/server data before reservation creation. |
| Search URL query | destination, dates, guest counts, lat/lng, viewport bounds, page | Shareable/search-restorable state | Internal; destination/dates may reveal user intent | App codec/serializer plus legacy search feature parser/controller | URL lifetime | U6 codec preserves current fallback and canonical order; the U8 body still owns actual parse/push/replace behavior and mirrors selected UI state. | U8 switches the controller to the app codec as the single parse owner; deterministic artifacts use synthetic values. |
| Wishlist URL query | wishlist ID or recently-viewed view | Direct-load and history restoration | Internal | App codec/serializer plus legacy Wishlist route parser | URL lifetime | U6 codec preserves positive-ID precedence and fallback; the current body still mirrors the decoded value into React state. | U7 makes codec output the controller source of truth and removes the local persisted mirror. |
| Profile URL query | guest/host mode and tab | Direct-load and history restoration | Internal | App codec/serializer plus legacy Profile route parser | URL lifetime | U6 codec preserves guest/host fallback; the current body still mirrors the decoded value into React state. | U13 makes codec output the controller source of truth and removes the local persisted mirror. |
| TanStack Query cache | session user, search/detail/wishlist/profile/reservation/review/API results | In-memory server-state cache; reload can refetch | Public through Sensitive depending on query | `SessionProvider` owns one QueryClient per subject/epoch generation; existing feature hooks remain the resource owners | Provider-generation lifetime; default query/mutation meta contains the current subject/epoch, while legacy feature keys are not all scoped yet | Every identity boundary cancels and clears the previous client and creates a new one. Leaving an authenticated identity also key-remounts the Query subtree, fencing late old-tree mutation callbacks. There is no production singleton or manual query-root registry. | U5 is the physical isolation bridge. U7-U13 add subject/epoch to each viewer-dependent feature key/meta and make commands capture/re-check session scope; U22 removes rollback Query compatibility. Query data is never serialized to browser storage. |
| React component/form and overlay state | login/signup form, search drafts, editor form/images, modal-open/message state, memory-only overlay stack entries and focus targets | Active interaction only; reload is not required | Internal through Personal in owning forms; overlay metadata contains DOM references, opaque registration IDs, and in-memory close callbacks and is never serialized | Owning component/hooks hold domain interaction state; `OverlayProvider` holds stack order, close commands, and focus restoration targets | Render/provider lifetime | React unmount clears forms and overlay registrations. U19 removes portal children and Toast timers on route/provider unmount, restores body overflow, and never copies stack/focus metadata into storage, URL, logs, Query, or BroadcastChannel. U5 preserves the anonymous Query subtree across a failed login verification so modal intent, inputs, and the exact error remain visible. | Keep form/domain state local; keep overlay coordination app-owned and memory-only. U7 moves resumable auth intent to its workflow owner, payment/editor long transactions move to reducers, and form data is never persisted by default. |

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
units remain responsible for server/session authority. A session cleanup can
replace only the current entry; it cannot enumerate the browser's Back stack,
so checkout and callback readers themselves must enforce subject ownership,
expiry, and one-shot consumption.

### U5 identity-cleanup and generation rule

`src/app/providers/clearIdentityOwnedFrontendState.ts` composes the narrow
reservation cleanup port with current-route cleanup and injects it into the app
session owner. Before a different viewer is published, and on
logout/revocation, the session owner advances its epoch, clears the legacy
checkout document and UID index, clears payment-confirmed markers and in-flight
registry entries, replaces a currently visible checkout/payment entry with the
home route, and replaces the QueryClient generation. The payment registry also
advances its own in-memory generation so a pre-cleanup confirmation cannot write
a marker after the boundary. This is best-effort current-entry cleanup, not
approval of the unversioned storage/history shapes; U9/U10 still own their
subject envelope, one-shot reader, schema, TTL, server verification, and
removal. The full branch is not release-ready before those gates pass.

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
| Login or `/me` refresh to a different viewer | U5 enters identity-change checking, advances epoch, clears checkout/index/payment marker/in-flight registry, cancels and clears the old QueryClient, remounts the authenticated boundary, and only then publishes B in a new client generation | U7-U13 finish per-feature subject/epoch key/meta and captured-command fences for final R14/R15. |
| Logout | Local state becomes anonymous/revocation-unverified immediately; U5 clears checkout/index/payment marker/in-flight registry and replaces the QueryClient before serialized server logout settles. Success marks verified; failure stores a safe error and shows retry. No cookie is read or deleted. | U10 replaces the legacy storage writers; backend logout remains cookie revocation authority. |
| Authentication revocation or another-tab invalidation | Exact non-PII broadcast invalidates first; U5 advances the boundary, clears identity-owned browser/Query state, then verifies `/me`. Duplicate events share the pending verification; a newer phase/401 during the actual probe aborts it and replays one fresh boundary/probe; an unpaired invalidate receives a bounded 1.5-second recovery probe; terminal reducer transitions are idempotent. | Feature commands adopt captured session scopes in U7-U13; BroadcastChannel and its recovery timer remain advisory rather than cookie authority. |
| Payment confirmed | Checkout/index is best-effort cleared; confirmed marker remains for same-generation tab dedupe until terminal/session cleanup | U10 clears owned checkout/callback after server terminal; no browser marker acts as authority. |
| Invalid or terminal payment callback | Checkout may be cleared depending on retry classification | U10 transition table owns exact preserve/clear decision. |
| Retryable/ambiguous payment failure | Checkout and callback values may be preserved in URL/storage | U10 preserves only validated owned records until explicit terminal or expiry. |
| Route/session change during review/editor/payment | U5 remounts the authenticated Query boundary, review submission now re-checks its captured authenticated scope after each async stage, and the legacy payment generation blocks a late marker write; other legacy feature commands still rely on their current local refs | U7-U13 add captured subject/epoch command fences by slice; U9 moves the early review guard into the owned workflow, while U10/U12 reducers own payment/editor operation IDs. |
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
- U5 deletes the former `useSessionQuery` and `sessionLifecycle` owners. The
  surviving `QueryProvider` and `sessionCacheBoundary` sources are not production
  owners; they are rollback/test compatibility until U22. Their presence does
  not reintroduce a singleton QueryClient or a manual session-root registry.
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
