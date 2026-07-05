# Frontend Architecture Smoke QA

## 목적

Airbnb 디자인 리팩터 전에 프론트엔드 아키텍처 변경이 주요 사용자 흐름을 깨뜨리지 않았는지 확인한다.

## 환경

- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- QA 계정: 스레드에서 사용자가 제공한 QA 계정을 사용한다. 실제 이메일, 비밀번호, 닉네임, member_id 같은 자격 증명 값은 문서나 커밋에 남기지 않는다.

## 자동화 실행

`npm run verify:design-ready`는 정적 pre-redesign gate와 frontend smoke gate를 순서대로 실행한다. 정적 gate만 확인할 때는 `npm run verify:pre-redesign`, 브라우저 smoke만 확인할 때는 `npm run smoke:frontend`를 사용한다.

`npm run smoke:frontend`은 `scripts/smoke/frontend-smoke.mjs`를 실행해 gstack browse로 데스크톱 `1280x720`과 모바일 `375x812` 라우트 스모크를 수행한다. 스크립트는 자격 증명 값을 출력하지 않고, 리포트와 스크린샷을 `.gstack/qa-reports` 아래에 남긴다.

| 환경 변수 | 필수 여부 | 값 |
| --- | --- | --- |
| `AIRBOB_QA_EMAIL` | 필수 | `[provided out-of-band]` |
| `AIRBOB_QA_PASSWORD` | 필수 | `[provided out-of-band]` |
| `GSTACK_BROWSE_BIN` | 필수 | `/absolute/path/to/browse` |
| `AIRBOB_FRONTEND_URL` | 선택 | `http://localhost:3000` 기본값 |
| `AIRBOB_SMOKE_ACCOMMODATION_ID` | 선택 | accommodation detail 전용 ID. 없으면 edit ID fallback 사용 |
| `AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID` | 선택 | `3` 기본값 |
| `AIRBOB_SMOKE_RESERVATION_UID` | 선택 | 제공하면 guest reservation detail route를 smoke 한다 |
| `AIRBOB_SMOKE_HOST_RESERVATION_UID` | 선택 | 제공하면 host reservation detail route를 smoke 한다 |

```bash
read -r AIRBOB_QA_EMAIL
read -rsp "AIRBOB_QA_PASSWORD" AIRBOB_QA_PASSWORD
printf '\n'
export AIRBOB_QA_EMAIL AIRBOB_QA_PASSWORD

AIRBOB_FRONTEND_URL=http://localhost:3000 \
GSTACK_BROWSE_BIN=/absolute/path/to/browse \
AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID=3 \
npm run smoke:frontend
```

자동화 라우트 커버리지:

- `home`: `/`
- `search-seoul`: `/search?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`
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
- Browser smoke command: `npm run smoke:frontend`
- Smoke report evidence: each run writes `.gstack/qa-reports/frontend-smoke-<timestamp>.md`; attach the latest generated path when recording a run.

### Route-specific assertions

- `/`: `#root` contains `특별한 숙소`.
- `/search?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`: `main, #root` contains `숙소`.
- `/wishlist`: `main, #root` contains `위시리스트`.
- `/wishlist?view=recently-viewed`: `main, #root` contains `최근`.
- `/profile?mode=host&tab=listings`: `main, #root` contains `호스트`.
- `/accommodations/:id`: `main, #root` contains `숙소`.
- `/accommodations/:id/edit`: `main, #root` contains `숙소`.
- `/reservations/:reservationUid`: `main, #root` contains `예약` when `AIRBOB_SMOKE_RESERVATION_UID` is supplied.
- `/profile/host/reservations/:reservationUid`: `main, #root` contains `예약` when `AIRBOB_SMOKE_HOST_RESERVATION_UID` is supplied.

### Skipped Dynamic Routes

- Profile/Reservations route-boundary refactor must pass `npm run verify:design-ready`.
- If `AIRBOB_SMOKE_RESERVATION_UID` and `AIRBOB_SMOKE_HOST_RESERVATION_UID` are unavailable, the generated smoke report must list those routes under `Skipped Dynamic Routes`; this is residual QA scope, not tested coverage.
- If `AIRBOB_SMOKE_RESERVATION_UID` is not supplied, `reservation-detail` is skipped and the generated smoke report lists the skipped route and required env name.
- If `AIRBOB_SMOKE_HOST_RESERVATION_UID` is not supplied, `host-reservation-detail` is skipped and the generated smoke report lists the skipped route and required env name.
- Skipped dynamic routes are not counted as tested route coverage.

### Output guards

- stdout/stderr are redacted before printing and before report generation.
- Route loop clears console/network state before each navigation.
- Route assertions poll for rendered root text and route-specific expected text before screenshots.
- Redacted browser output containing console errors/warnings, browse `[js] ERROR`/`ERROR: evaluate` output, or API 4xx/5xx network failures fails the wrapper.
