# Frontend Architecture Smoke QA

## 목적

Airbnb 디자인 리팩터 전에 프론트엔드 아키텍처 변경이 주요 사용자 흐름을 깨뜨리지 않았는지 확인한다.

## 환경

- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- QA 계정: 스레드에서 사용자가 제공한 QA 계정을 사용한다. 실제 이메일, 비밀번호, 닉네임, member_id 같은 자격 증명 값은 문서나 커밋에 남기지 않는다.

## 자동화 실행

`npm run verify:design-ready`는 정적 pre-redesign gate와 strict frontend smoke gate를 순서대로 실행한다. 정적 gate만 확인할 때는 `npm run verify:pre-redesign`, 브라우저 smoke만 확인할 때는 `npm run smoke:frontend`를 사용한다. 디자인 착수 전 최종 gate는 반드시 `npm run smoke:frontend:strict` 또는 `npm run verify:design-ready`로 실행한다.

`npm run smoke:frontend`은 `scripts/smoke/frontend-smoke.mjs`를 실행해 gstack browse로 데스크톱 `1280x720`과 모바일 `375x812` 라우트 스모크를 수행한다. 스크립트는 자격 증명 값을 출력하지 않고, 리포트와 스크린샷을 `.gstack/qa-reports` 아래에 남긴다. `npm run smoke:frontend:strict`는 dynamic reservation route UID가 없으면 브라우저를 실행하기 전에 실패한다.

| 환경 변수 | 필수 여부 | 값 |
| --- | --- | --- |
| `AIRBOB_API_BASE_URL` | UID 추출 시 필수 | `http://localhost:8080/api/v1` 예시 |
| `AIRBOB_FRONTEND_URL` | 선택 | `http://localhost:3000` 기본값 |
| `AIRBOB_QA_EMAIL` | 필수 | `[provided out-of-band]` |
| `AIRBOB_QA_PASSWORD` | 필수 | `[provided out-of-band]` |
| `GSTACK_BROWSE_BIN` | 필수 | `/absolute/path/to/browse` |
| `AIRBOB_SMOKE_ACCOMMODATION_ID` | 선택 | accommodation detail 전용 ID. 없으면 edit ID fallback 사용 |
| `AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID` | 선택 | `3` 기본값 |
| `AIRBOB_SMOKE_RESERVATION_UID` | strict 필수 | guest reservation detail route UID |
| `AIRBOB_SMOKE_HOST_RESERVATION_UID` | strict 필수 | host reservation detail route UID |

```bash
export AIRBOB_API_BASE_URL="${AIRBOB_API_BASE_URL:-http://localhost:8080/api/v1}"
export AIRBOB_FRONTEND_URL="${AIRBOB_FRONTEND_URL:-http://localhost:3000}"
export GSTACK_BROWSE_BIN="${GSTACK_BROWSE_BIN:-/absolute/path/to/browse}"
# export AIRBOB_QA_EMAIL="<provided-out-of-band>"

: "${AIRBOB_QA_EMAIL:?Set AIRBOB_QA_EMAIL in the shell before running smoke}"
: "${AIRBOB_QA_PASSWORD:?Set AIRBOB_QA_PASSWORD in the shell before running smoke}"

cookie_jar="$(mktemp)"
trap 'rm -f "$cookie_jar"' EXIT

login_body="$(
  node -e 'const body = {}; body["email"] = process.env.AIRBOB_QA_EMAIL; body["password"] = process.env.AIRBOB_QA_PASSWORD; process.stdout.write(JSON.stringify(body));'
)"

curl -fsS \
  -c "$cookie_jar" \
  -b "$cookie_jar" \
  -H "Content-Type: application/json" \
  -d "$login_body" \
  "$AIRBOB_API_BASE_URL/auth/login" >/dev/null

guest_reservation_uid="$(
  curl -fsS -b "$cookie_jar" "$AIRBOB_API_BASE_URL/profile/guest/reservations?size=1" |
    node -e 'let data = ""; process.stdin.on("data", (chunk) => data += chunk); process.stdin.on("end", () => { const json = JSON.parse(data); const uid = json.data?.reservations?.[0]?.reservation_uid; if (uid) process.stdout.write(uid); });'
)"

host_reservation_uid="$(
  curl -fsS -b "$cookie_jar" "$AIRBOB_API_BASE_URL/profile/host/reservations?size=1" |
    node -e 'let data = ""; process.stdin.on("data", (chunk) => data += chunk); process.stdin.on("end", () => { const json = JSON.parse(data); const uid = json.data?.reservations?.[0]?.reservation_uid; if (uid) process.stdout.write(uid); });'
)"

: "${guest_reservation_uid:?No guest reservation UID returned for smoke}"
: "${host_reservation_uid:?No host reservation UID returned for smoke}"

export AIRBOB_SMOKE_RESERVATION_UID="$guest_reservation_uid"
export AIRBOB_SMOKE_HOST_RESERVATION_UID="$host_reservation_uid"
export AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID="${AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID:-3}"

npm run smoke:frontend:strict
```

자동화 라우트 커버리지:

- `home`: `/`
- `search-seoul`: `/search?destination=Albany&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`
- `wishlist`: `/wishlist`
- `wishlist-recently-viewed`: `/wishlist?view=recently-viewed`
- `profile-host-listings`: `/profile?mode=host&tab=listings`
- `accommodation-detail`: `/accommodations/:id` (`AIRBOB_SMOKE_ACCOMMODATION_ID` 값 또는 edit ID fallback)
- `accommodation-edit`: `/accommodations/:id/edit` (`AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID` 값 또는 기본값 `3`)
- `reservation-detail`: `/reservations/:reservationUid` (`AIRBOB_SMOKE_RESERVATION_UID` 제공 시)
- `host-reservation-detail`: `/profile/host/reservations/:reservationUid` (`AIRBOB_SMOKE_HOST_RESERVATION_UID` 제공 시)

## Architecture Checkpoints

### query route contract

- Steps: open saved deep links for `/search`, `/profile?mode=host&tab=reservations`, `/wishlist?view=recently-viewed`, `/wishlist?id=<wishlistId>`, and the payment redirect pages with safe QA data.
- Expected: page state, selected tab/view, pagination, reservation/payment state, and browser back/forward behavior match the URL without resetting to defaults.
- Evidence: record the tested URL, expected state, actual state, and whether refresh/back/forward preserved it.

### server-state auth boundary

- Steps: test login, logout, focus refresh, and a protected route after an expired or rejected session.
- Expected: Header/UserMenu, auth modal, protected route redirects, wishlist/reservation actions, and 401 handling all reflect the same authenticated or unauthenticated state.
- Evidence: record the auth state before/after the action, visible Header/UserMenu state, route/modal result, and any 401 network response.

### components ownership boundary

- Steps: inspect affected UI during Search, Wishlist, Reservation, Auth, and Accommodation detail flows after running `npm run test:ci:no-cache`.
- Expected: shared UI primitives behave consistently across flows, and workflow containers remain under features or pages without leaking domain-specific behavior into shared components.
- Evidence: record the component/flow checked, the interaction performed, the expected shared behavior, and any boundary violation found.

### design system entry contracts

- Steps: run `npm run test:ci -- --runTestsByPath src/styles/design-system-contracts.test.ts src/styles/tokens.test.ts`, then smoke Header, mobile Search popovers, Search bottom sheet, cards, and modal overlays at desktop and mobile widths.
- Expected: header height, mobile search popover position, page width, card media ratio, modal z-index, and bottom-sheet z-index follow shared tokens without visual overlap or clipped controls.
- Evidence: record the command result, viewport size, screen/flow checked, screenshot path, and any token/layout mismatch.

## Desktop 1280px 체크리스트

- [ ] Header logo 가 키보드 포커스를 받고 Enter 로 Home 이동이 가능하다.
- [ ] Home search 입력 후 /search 로 이동한다.
- [ ] Search list 가 렌더링되고 page query 가 유지된다.
- [ ] Search 에서 위시리스트 modal 을 열고 닫은 뒤 card 의 wishlist 상태가 갱신된다.
- [ ] Search map marker 또는 bounds update 후 결과가 새로고침된다.
- [ ] Accommodation detail 에서 date/guest, coupon, reservation button 이 정상 동작한다.
- [ ] Auth modal 은 dialog 로 열리고 close button, Escape, backdrop 으로 닫힌다.
- [ ] 로그인 상태에서 Reservation confirm page 가 열린다.
- [ ] Reservation modal 은 dialog 로 열리고 결제 진입 전 focus/scroll lock 이 깨지지 않는다.
- [ ] ReservationConfirm 에서 Toss 결제 진입 후 PaymentSuccess 를 거쳐 ReservationDetail 로 이동한다.
- [ ] AccommodationEdit 에서 image upload, 저장, publish 흐름이 정상 동작한다.
- [ ] AccommodationEdit 최종 publish 에서 상세주소가 비어 있으면 image upload 전에 확인 modal 이 먼저 열린다.
- [ ] Host reservation detail 이 host tab/list 에서 정상 진입된다.
- [ ] Wishlist page 에서 list/detail/modal open-close 흐름이 동작한다.
- [ ] Profile guest tab 과 host tab 을 전환할 수 있다.
- [ ] Host listing 에서 infinite scroll 또는 empty state 가 정상 표시된다.

## Mobile 375px 체크리스트

- [ ] Header logo 가 포커스 가능한 Home link 로 동작한다.
- [ ] Home search UI 가 viewport 안에 맞는다.
- [ ] Search mobile bottom sheet 의 closed/half/full behavior 가 동작한다.
- [ ] Search mobile 에서 위시리스트 modal open-close 후 card 상태가 유지된다.
- [ ] Detail booking panel/modal 이 viewport 안에 맞는다.
- [ ] Reservation confirm page 의 CTA 와 결제 이동 영역이 viewport 안에 맞는다.
- [ ] Wishlist modal, auth modal, reservation modal 이 close button, Escape, backdrop 으로 닫힌다.
- [ ] Profile guest tab 과 host tab 을 전환할 수 있고 내용이 viewport 안에 맞는다.
- [ ] Host listing infinite scroll 또는 empty state 가 정상 표시된다.

## Recording

- failed step:
- console error:
- network failed request:
- screenshot path:

## 2026-07-04 KST Redesign Readiness Smoke Gate

- 목적: Airbnb 스타일 redesign 전에 라우트가 단순 load 되는지만 보지 않고, 각 route shell 이 lazy chunk 렌더링 후 기대하는 핵심 visible text 를 렌더링하는지 확인한다.
- Static gate command: `npm run verify:pre-redesign`
- Combined gate command: `npm run verify:design-ready`
- Wrapper validation command: `env -u AIRBOB_QA_EMAIL -u AIRBOB_QA_PASSWORD -u GSTACK_BROWSE_BIN node scripts/smoke/frontend-smoke.mjs`
- Wrapper validation expected status: exit 1, missing environment variable names only, no credential values.
- Non-strict browser smoke command: `npm run smoke:frontend`
- Strict browser smoke command: `npm run smoke:frontend:strict`
- Smoke report evidence: each run writes `.gstack/qa-reports/frontend-smoke-<timestamp>.md`; attach the latest generated path when recording a run.

### Route-specific assertions

- `/`: `#root` contains `특별한 숙소`.
- `/search?destination=Albany&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`: `main, #root` contains `숙소`, search button exists, and wishlist/save action exists when the local search index returns cards. If the local ES-backed search index has no hits, the explicit `검색 결과가 없습니다.` empty state is acceptable smoke coverage.
- `/wishlist`: `main, #root` contains `위시리스트`.
- `/wishlist?view=recently-viewed`: `main, #root` contains `최근`.
- `/profile?mode=host&tab=listings`: `main, #root` contains `호스트`.
- `/accommodations/:id`: `main, #root` contains `숙소`, reservation CTA exists, and gallery trigger buttons exist.
- `/accommodations/:id/edit`: `main, #root` contains `숙소`.
- `/reservations/:reservationUid`: `main, #root` contains `예약` when `AIRBOB_SMOKE_RESERVATION_UID` is supplied.
- `/profile/host/reservations/:reservationUid`: `main, #root` contains `예약` when `AIRBOB_SMOKE_HOST_RESERVATION_UID` is supplied.

### Skipped Dynamic Routes

- Profile/Reservations route-boundary refactor must pass `npm run verify:design-ready`.
- In non-strict `npm run smoke:frontend`, unavailable dynamic route UIDs are listed under `Skipped Dynamic Routes`; this is residual QA scope, not tested coverage.
- In strict `npm run smoke:frontend:strict`, missing `AIRBOB_SMOKE_RESERVATION_UID` or `AIRBOB_SMOKE_HOST_RESERVATION_UID` fails the wrapper before browser launch.
- Skipped dynamic routes are not counted as tested route coverage.

### Output guards

- stdout/stderr are redacted before printing and before report generation.
- Route loop clears console/network state before each navigation.
- Route assertions poll for rendered root text and route-specific expected text before screenshots.
- Redacted browser output containing console errors/warnings, browse `[js] ERROR`/`ERROR: evaluate` output, or API 4xx/5xx network failures fails the wrapper.

## 2026-07-05 KST Architecture Stabilization Verification

- Static gate command: `npm run verify:pre-redesign`
- Static gate result: PASS. `typecheck`, full no-cache Jest, and production build completed successfully.
- Jest result: 154 suites passed, 711 tests passed.
- Build result: `Compiled successfully.` Freshness notices for `baseline-browser-mapping` and `caniuse-lite` remain environment maintenance warnings, not build failures.
- Targeted DTO-boundary recheck: PASS. Search map, wishlist index/recent views, host reservation detail view-model tests, and `src/api/ui-api-boundary-contracts.test.ts` passed.
- Frontend dev server: `http://localhost:3000`
- Backend server: `http://localhost:8080`
- Non-strict browser smoke command used for preliminary route evidence:

```bash
AIRBOB_FRONTEND_URL=http://localhost:3000 \
GSTACK_BROWSE_BIN=/Users/jaehoonchoi/gstack/browse/dist/browse \
AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID=3 \
npm run smoke:frontend
```

- Non-strict browser smoke result: PASS for static route subset.
- Strict browser smoke result: deferred until `AIRBOB_SMOKE_RESERVATION_UID` and `AIRBOB_SMOKE_HOST_RESERVATION_UID` are exported through the credential-safe UID extraction flow above.
- QA credentials: supplied out-of-band through environment variables; no account values were written to this document.
- Smoke report: `.gstack/qa-reports/frontend-smoke-2026-07-05T04-04-18-698Z.md`
- Screenshot directory: `.gstack/qa-reports/screenshots/`
- Desktop coverage: `/`, `/search?destination=Albany&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`, `/wishlist`, `/wishlist?view=recently-viewed`, `/profile?mode=host&tab=listings`, `/accommodations/3`, `/accommodations/3/edit`.
- Mobile coverage: `/`, `/search?destination=Albany&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`, `/wishlist`, `/wishlist?view=recently-viewed`, `/profile?mode=host&tab=listings`, `/accommodations/3`, `/accommodations/3/edit`.
- Skipped dynamic routes: `/reservations/:reservationUid` and `/profile/host/reservations/:reservationUid`; stable route UIDs were not supplied in this run, so the smoke report lists them under `Skipped Dynamic Routes`.
- Observed environment warning: Google Maps API key warning appears during route loads. The smoke wrapper still exited `0`; no API 4xx/5xx route assertion failure was reported.

## 2026-07-05 KST Architecture Readiness Closure

- Static gate command: `npm run verify:pre-redesign`
- Static gate result: PASS. `typecheck`, full no-cache Jest, and production build completed successfully.
- Jest result: 164 suites passed, 758 tests passed.
- Build result: `Compiled successfully.` Freshness notices for `baseline-browser-mapping` and `caniuse-lite` remain environment maintenance warnings, not build failures.
- Strict browser smoke command: `npm run smoke:frontend:strict`
- Strict browser smoke result: PASS.
- Dynamic reservation route IDs: guest and host PAST reservation UIDs were extracted through the credential-safe API flow above and supplied via environment variables. Actual UID values are intentionally not recorded in this document.
- Smoke report: `.gstack/qa-reports/frontend-smoke-2026-07-05T07-37-20-134Z.md`
- Screenshot directory: `.gstack/qa-reports/screenshots/`
- Desktop coverage: `/`, `/search?destination=Albany&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`, `/wishlist`, `/wishlist?view=recently-viewed`, `/profile?mode=host&tab=listings`, `/accommodations/3`, `/accommodations/3/edit`, `/reservations/:reservationUid`, `/profile/host/reservations/:reservationUid`.
- Mobile coverage: `/`, `/search?destination=Albany&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`, `/wishlist`, `/wishlist?view=recently-viewed`, `/profile?mode=host&tab=listings`, `/accommodations/3`, `/accommodations/3/edit`, `/reservations/:reservationUid`, `/profile/host/reservations/:reservationUid`.
- Skipped dynamic routes: none.
- Search route note: local `/api/v1/search/accommodations` returned an empty result set for the Albany smoke query, so this run verified the explicit search empty state rather than search result cards. Search result card styling should still be visually checked after the local ES search index is seeded or a fallback search fixture is available.
