# Frontend Browser Data Inventory

> Operational supplement to
> [`current-frontend-architecture.md`](./current-frontend-architecture.md).  
> Baseline: U6 routing followed by the U5 session, U19 structural UI, U7 auth/wishlist, and U8 Search cutovers; recorded 2026-08-30 KST.

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
| In-memory auth intent | Opaque monotonic attempt ID, exact route location key/path, and one discriminated primitive payload: wishlist accommodation ID; reservation accommodation/dates/occupancies/nullable coupon ID; or coupon accommodation/coupon ID | Resume the exact anonymous interaction after verified login without retaining an old component closure; reload recovery is intentionally unsupported | Internal; booking dates and party composition may describe Personal intent | `src/workflows/auth-intent/**`; no viewer PII is stored, and a captured opaque subject/epoch exists only on atomic claim | Provider/render lifetime only; no storage, URL, history, log, cache, or BroadcastChannel serialization | Snapshots declared primitive fields, validates positive IDs/counts/calendar dates, keeps latest-one, and clears on exact cancel, route/key departure, logout, revocation, or authenticated-owner departure. Anonymous login failure retains it; the authenticated route owner claims once and rechecks the captured session before effects. | Auth/Wishlist controllers are complete U7 and the owned Search route claims Wishlist intents directly U8. Remove only the Accommodation compatibility body port U9. Never add callbacks, Promises, credentials, viewer records, persistence, or cross-tab propagation. |
| In-memory Wishlist command registry | Subject/epoch plus operation/resource key, per-accommodation lane-tail Promise, normalized wishlist name for create→add, in-flight Promise, `AbortController`, and a created wishlist ID retained from create success until add success/dispose (or across add failure for retry) | Single-flight exact duplicates, serialize membership mutation plus reconciliation for one accommodation, fence A→B session changes, abort on provider disposal, and retry create→add without creating a duplicate list; reload recovery is intentionally unsupported | Internal; wishlist name may contain Personal user text | `src/workflows/wishlist-membership/**`; Search, Detail, and Wishlist lazy route adapters each mount the sole active writer inside the current QueryClient generation | Active route/provider lifetime; route departure or identity-generation replacement disposes it. No storage, URL, history, log, Query value, artifact, or BroadcastChannel serialization | Every command captures an authenticated scope, rechecks before/after awaits and before projection, shares exact duplicates, and orders opposing membership commands. Pending/controller/lane entries clear after settlement; a partial created ID clears after confirmed add success or provider disposal and remains only across add failure. Before retrying add, the workflow reads every membership page: confirmed containment completes without another POST, a missing list is recreated, and an unverified read preserves created-only state. | Keep one workflow writer per active route and keep it out of the initial app chunk. Do not persist the registry, name, or partial ID; app composition sends Search updates to its owned projection and removes the remaining Detail compatibility branch U9. |
| In-memory Google Maps/Places runtime | One active Maps script-load Promise, one Places-readiness Promise, typed status/error codes, per-SearchBar autocomplete session token, raw prediction map, debounce timer, and request version | Deduplicate concurrent SDK activation, activate Places only after an explicit search session, bill related autocomplete requests as one session, and reject stale async completion; reload persistence is unnecessary | Public SDK runtime plus Internal destination intent; the browser key is public-but-restricted and prediction text may describe Personal intent | `src/platform/integrations/{googleMaps,googlePlaces,useGoogleMapsScript}.ts` and `src/features/search/hooks/usePlacesAutocomplete.ts`; no viewer subject | Module/document lifetime for loader/runtime; component lifetime for token/predictions/timer. Readiness is bounded to 5 seconds | Exact HTTPS script identity and query allowlist; duplicate/nonmatching scripts are removed; failures remove the owned script and reset the shared attempt. Places timers, raw predictions, session token, and request versions are cleared/fenced on reset or unmount. No raw provider error reaches the Search screen. | Keep the browser key only in validated public config/script delivery; never persist prediction/session objects or include them in artifacts. A future SDK swap stays behind the platform/feature boundary. |
| `history.state` login return target | `pathname`, `search`, `hash` | Resume an internal protected deep link after login; navigation lifetime only | Internal, potentially Personal through query values | `RequireAuth` writes; the app Login adapter validates the target and navigates after `AuthController` reports success | No version/TTL; browser history lifetime | Active codec validates the return target, while `src/platform/browser/windowNavigation.ts` also requires the exact current Router history key/path/search/hash before a late auth completion may navigate. Alternate navigation invalidates the controller continuation immediately; same-entry Query generation remount remains valid. The legacy Login parser/body is deleted. | Preserve this codec/current-entry contract while `RequireAuth` remains a compatibility writer; remove that writer with its final consumers U22. |
| `history.state` accommodation draft provenance | accommodation ID and `source: created-draft` | Distinguish newly created draft while navigating to editor; reload is not required | Internal | `src/app/router/paths.ts` and edit adapter; legacy path helper remains for old callers | Typed shape; history lifetime | App adapter checks exact ID/source intent; the hint disappears on refresh and never overrides hydrated server detail. | U12 keeps route provenance untrusted and removes the legacy helper with the editor body. |
| `history.state` reservation checkout handoff | Same `ReservationCheckoutState` fields described below | Primary same-navigation handoff to confirm screen | Personal | Booking hook/checkout handoff; no stable viewer owner in record | Runtime type guard only; history lifetime | Confirm route prefers valid location state. Browser/user ownership is not encoded. U5 replaces the current transaction entry during an identity boundary, but cannot enumerate or erase older history entries; Back can therefore replay legacy A input under B until the target contract lands. | U9/U10 pass a minimal subject-owned, one-shot handoff document, reject foreign/expired/consumed entries before rendering or I/O, and omit personal identity fields unless a gateway request demonstrably needs them. This is a release gate. |
| `history.state` review partial-success toast | `toastMessage` string | Carry one review-image upload warning from review create to reservation detail | Internal; arbitrary injected text could expose Personal data | Review create route writes; the app detail adapter currently forwards the state to the legacy detail body | Unversioned; attached to one browser history entry and may reappear on reload or back/forward | Only a string check. The detail route does not consume/replace the history value after copying it, so the same toast can reappear. | U9 replaces free-form text with a typed result code, consumes it once, and maps the code to owned UI copy. Review creation remains successful when image upload alone fails. |
| `airbob:reservation-checkout:<accommodationId>` | `reservationUid`, `orderName`, `amount`, `customerEmail`, `customerName`, check-in/out, adult/child/infant/pet counts, coupon name/discount | Fallback reload recovery for reservation confirm | Personal; email/name are Personal, reservation/payment tuple is Sensitive-adjacent | `reservationCheckoutState.ts`; indexed by accommodation, no viewer subject | Unversioned JSON; no created/expiry; tab/session lifetime only | Shape guard and safe storage calls. Cleared on terminal paths and by U5's injected reservation cleanup on identity change, logout, or revocation; malformed data is ignored but not consistently purged on read. | U10 stores only proven reload fields with purpose, version, stable opaque subject, creation/expiry, field allowlist, purge-on-invalid, and server tuple validation. TTL must be decided in U10 before the new writer ships. |
| `airbob:reservation-checkout-index:<reservationUid>` | accommodation ID string | Locate checkout record from payment callback route | Internal plus reservation correlation | `reservationCheckoutState.ts`; no viewer subject | Unversioned; no created/expiry | Removed with checkout records by terminal cleanup and the U5 identity cleanup port. Interrupted writes can still leave a stale index inside one active identity generation. | U10 replaces or embeds the index in an owned repository; it cannot authorize payment and expires with the checkout record. |
| `airbob:payment-confirmed:<orderId|paymentKey|amount>` | Sensitive tuple encoded in storage key; value `"1"` | Same-tab duplicate-confirm optimization | Sensitive because the storage key contains paymentKey | `paymentConfirmationAttemptRegistry.ts`; no viewer subject | Unversioned; no timestamp/TTL; tab/session lifetime | Read before confirm and written after success. U5 identity cleanup now removes the entire prefix, clears in-flight entries, and advances a generation; a confirmation captured before cleanup cannot recreate its marker afterward. The marker is not server status. | U10 removes browser marker authority. Any replacement is an owned/versioned callback record and marker hit only triggers server reconciliation; purge on terminal/logout/expiry. |
| In-memory payment attempt `Map` and generation | confirmation tuple, captured generation, and in-flight Promise | De-duplicate concurrent confirm calls and fence storage writes after session cleanup | Sensitive | `paymentConfirmationAttemptRegistry.ts` | Process lifetime; monotonic in-memory generation | Matching attempts share one Promise. Identity cleanup increments the generation and clears the map; late completion may settle its caller but cannot write a confirmed marker into the new generation. It does not synchronize another tab. | U10 workflow instance and operation ID enforce one active command; server confirm/status remains terminal authority. |
| Payment success/fail URL query | `paymentKey`, `orderId`, `amount`, optional failure reason | Receive Toss redirect callback and recover ambiguous confirmation | Sensitive | payment route parser and route query builders; no verified viewer owner | URL/history lifetime; no schema version/TTL | Strict amount/query parsing and tuple comparison are partial. The value remains visible in browser history; replacing the currently visible callback on identity cleanup does not remove an older callback entry. U2 deterministic output redacts it and rejects raw callback values in text artifacts. | U10 validates an owned reservation/order/amount/paymentKey/subject tuple before any confirmation request, consumes it once, moves required callback material to session-owned storage, removes the sensitive query with replace, and redacts artifacts. Foreign/history-replayed callbacks must perform no I/O. This is a release gate. |
| Accommodation booking URL query | `checkIn`, `checkOut`, adult/child/infant/pet occupancy | Preserve a booking draft from search to accommodation detail/confirm and across direct load/back/forward | Internal; dates and party composition describe Personal activity | App path serializer plus legacy accommodation parser/body | URL and browser-history-entry lifetime; no version/TTL | U6 codec fixes key order and strict parsing contract, while current compatibility bodies still consume raw params. Query data is untrusted and does not prove price, availability, or viewer ownership. | U9 makes the typed codec state the controller input and validates the draft against current accommodation/session/server data before reservation creation. |
| Search URL query | destination, dates, guest counts, lat/lng, viewport bounds, page | Shareable/search-restorable state | Internal; destination/dates may reveal user intent | App `searchCodec` and `app/router/routes/SearchRoute.tsx`; Header passes SearchBar a typed route port | URL/browser-history-entry lifetime | The app adapter parses once. Destination/date/guest searches push a new entry and remove stale page/bounds/location as applicable; map bounds replace the current entry and remove destination/page/lat/lng. The controller never mirrors committed URL state. Detail links retain only booking-safe date/occupancy keys. | U8 complete. Keep app codec/navigation as the sole committed owner and use synthetic values in deterministic artifacts. Query values never prove availability, price, or viewer authorization. |
| Wishlist URL query | wishlist ID or recently-viewed view | Direct-load and history restoration | Internal | App `wishlistCodec`/serializer and `app/router/routes/WishlistRoute.tsx` | URL lifetime | The app adapter decodes once and passes an index/detail/recently-viewed value to `WishlistController`; the controller does not mirror it into local state. Navigation preserves the current hash and uses replace only for deleted-selection fallback. | U7 complete. Keep the codec as the sole durable view authority; U8/U9 remove only Search/Detail compatibility, not this contract. |
| Profile URL query | guest/host mode and tab | Direct-load and history restoration | Internal | App codec/serializer plus legacy Profile route parser | URL lifetime | U6 codec preserves guest/host fallback; the current body still mirrors the decoded value into React state. | U13 makes codec output the controller source of truth and removes the local persisted mirror. |
| TanStack Query cache | session user, search/detail/wishlist/profile/reservation/review/API results | In-memory server-state cache; reload can refetch | Public through Sensitive depending on query | `SessionProvider` owns one QueryClient per subject/epoch generation; Wishlist and Search own scoped keys/meta/projections, while unmigrated feature hooks retain their current resources | Provider-generation lifetime; default query/mutation meta and Wishlist/Search keys/meta contain current subject/epoch; other legacy keys are not all scoped yet | Every identity boundary cancels and clears the previous client and creates a new one. Search request keys contain the normalized request plus session scope and forward AbortSignal; a late A result cannot replace visible B. App projection predicates require matching subject/epoch before updating Search caches; only Detail retains a legacy Wishlist projection. | U5 is the physical bridge, Wishlist completes per-feature scoping U7, and Search completes U8. U9-U13 migrate remaining resources; U22 removes rollback Query compatibility. Query data is never serialized to browser storage. |
| React component/form and overlay state | login/signup form, SearchBar draft/popover/IME state, search bottom-sheet/map selection state, editor form/images, modal-open/message state, memory-only overlay stack entries and focus targets | Active interaction only; reload is not required | Internal through Personal in owning forms; overlay metadata contains DOM references, opaque registration IDs, and in-memory close callbacks and is never serialized | Owned Auth/Wishlist/Search controllers and feature-local interaction reducers/hooks own domain-local state; `OverlayProvider` owns stack order, close commands, and focus restoration targets | Render/provider lifetime | React unmount clears forms, Search SDK objects/listeners/timers/Object URLs, and overlay registrations. Search interaction state never copies committed URL or Query data. U19 removes portal children and Toast timers on unmount and restores body overflow. | Keep form/domain state local and overlay coordination app-owned/memory-only. Payment/editor long transactions move to reducers; form data is never persisted by default. |

### Browser history lifetime rule

`history.state` and URL query values belong to a browser history entry, not to a
React render. They can survive rerenders, back/forward traversal, and—in browser-
dependent cases—a reload or tab restoration. They disappear only when that
history entry is replaced or discarded, so “navigation-only” never means
“single-render” or “already validated.” Writers must keep fields minimal;
readers must validate every entry and explicitly consume transient commands
such as a one-time toast. U6 owns the canonical codec contracts and activates
safe return-target validation without changing existing push/replace behavior.
U8 switches Search; U9-U13 switch the remaining legacy parsers/controllers. Those later workflow
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
| Login or `/me` refresh to a different viewer | U5 enters identity-change checking, advances epoch, clears checkout/index/payment marker/in-flight registry, cancels and clears the old QueryClient, remounts the authenticated boundary, and only then publishes B in a new client generation. U7 Wishlist commands abort/discard their generation-local registries; U8 Search keys/meta and projections are scope-fenced. | U9-U13 finish subject/epoch key/meta and captured-command fences for the remaining features. |
| Logout | Local state becomes anonymous/revocation-unverified immediately; U5 clears checkout/index/payment marker/in-flight registry and replaces the QueryClient before serialized server logout settles. Success marks verified; failure stores a safe error and shows retry. No cookie is read or deleted. | U10 replaces the legacy storage writers; backend logout remains cookie revocation authority. |
| Authentication revocation or another-tab invalidation | Exact non-PII broadcast invalidates first; U5 advances the boundary, clears identity-owned browser/Query state, then verifies `/me`. Duplicate events share the pending verification; a newer phase/401 during the actual probe aborts it and replays one fresh boundary/probe; an unpaired invalidate receives a bounded 1.5-second recovery probe; terminal reducer transitions are idempotent. Wishlist command capture is complete U7 and Search read/projection scope is complete U8. | Remaining feature commands adopt captured session scopes in U9-U13; BroadcastChannel and its recovery timer remain advisory rather than cookie authority. |
| Payment confirmed | Checkout/index is best-effort cleared; confirmed marker remains for same-generation tab dedupe until terminal/session cleanup | U10 clears owned checkout/callback after server terminal; no browser marker acts as authority. |
| Invalid or terminal payment callback | Checkout may be cleared depending on retry classification | U10 transition table owns exact preserve/clear decision. |
| Retryable/ambiguous payment failure | Checkout and callback values may be preserved in URL/storage | U10 preserves only validated owned records until explicit terminal or expiry. |
| Route/session change during Search/wishlist/review/editor/payment | U5 remounts the authenticated Query boundary; U7 Wishlist commands abort/discard on provider replacement and re-check scope before every projection; U8 Search forwards cancellation and fences result/projection by key and scope; review submission re-checks its captured scope; the legacy payment generation blocks a late marker write. Other legacy feature commands still rely on current local refs. | U9-U13 add captured subject/epoch command fences to remaining slices; U9 moves the early review guard into the owned workflow, while U10/U12 reducers own payment/editor operation IDs. |
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
