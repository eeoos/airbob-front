# Frontend Architecture Smoke QA

## 목적

Airbnb 디자인 리팩터 전에 프론트엔드 아키텍처 변경이 주요 사용자 흐름을 깨뜨리지 않았는지 확인한다.

## 환경

- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- QA 계정: 스레드에서 사용자가 제공한 QA 계정을 사용한다. 실제 이메일, 비밀번호, 닉네임, member_id 같은 자격 증명 값은 문서나 커밋에 남기지 않는다.

## 자동화 실행

`npm run smoke:frontend`은 `scripts/smoke/frontend-smoke.mjs`를 실행해 gstack browse로 데스크톱 `1280x720`과 모바일 `375x812` 라우트 스모크를 수행한다. 스크립트는 자격 증명 값을 출력하지 않고, 리포트와 스크린샷을 `.gstack/qa-reports` 아래에 남긴다.

| 환경 변수 | 필수 여부 | 값 |
| --- | --- | --- |
| `AIRBOB_QA_EMAIL` | 필수 | `[provided out-of-band]` |
| `AIRBOB_QA_PASSWORD` | 필수 | `[provided out-of-band]` |
| `GSTACK_BROWSE_BIN` | 필수 | `/absolute/path/to/browse` |
| `AIRBOB_FRONTEND_URL` | 선택 | `http://localhost:3000` 기본값 |
| `AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID` | 선택 | `3` 기본값 |

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

- `/`
- `/search?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`
- `/wishlist`
- `/wishlist?view=recently-viewed`
- `/profile?mode=host&tab=listings`
- `/accommodations/:id/edit` (`AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID` 값 또는 기본값 `3`)

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
- Static gate status: PASS in final verification. See `2026-07-04 KST Redesign Readiness Final Verification`.
- Wrapper validation command: `env -u AIRBOB_QA_EMAIL -u AIRBOB_QA_PASSWORD -u GSTACK_BROWSE_BIN node scripts/smoke/frontend-smoke.mjs`
- Wrapper validation expected status: exit 1, missing environment variable names only, no credential values.
- Browser smoke command: `npm run smoke:frontend`
- Browser smoke status: PASS in final verification.
- Smoke report evidence: `.gstack/qa-reports/frontend-smoke-2026-07-04T09-54-13-980Z.md`.

### Route-specific assertions

- `/`: `#root` contains `특별한 숙소`.
- `/search?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`: `main, #root` contains `숙소`.
- `/wishlist`: `main, #root` contains `위시리스트`.
- `/wishlist?view=recently-viewed`: `main, #root` contains `최근`.
- `/profile?mode=host&tab=listings`: `main, #root` contains `호스트`.
- `/accommodations/:id/edit`: `main, #root` contains `숙소`.

### Output guards

- stdout/stderr are redacted before printing and before report generation.
- Route loop clears console/network state before each navigation.
- Route assertions poll for rendered root text and route-specific expected text before screenshots.
- Redacted browser output containing console errors/warnings, browse `[js] ERROR`/`ERROR: evaluate` output, or API 4xx/5xx network failures fails the wrapper.

## 2026-07-04 KST Redesign Readiness Final Verification

- `git diff --check`: PASS.
- `npm run typecheck`: PASS.
- `npm run test:ci:no-cache -- --runInBand`: PASS, 128 suites / 588 tests.
- `npm run build`: PASS. Existing `baseline-browser-mapping` and `caniuse-lite` freshness warnings remain.
- Reviewer-fix focused suite: PASS, 4 suites / 63 tests.
- `node --check scripts/smoke/frontend-smoke.mjs`: PASS.
- `npm run test:ci:no-cache -- --runTestsByPath src/verification-gate.test.ts --runInBand`: PASS, 1 suite / 4 tests.
- `npm run smoke:frontend`: PASS. Report: `.gstack/qa-reports/frontend-smoke-2026-07-04T09-54-13-980Z.md`.
- Smoke process result: exit status `0`, output guard failures `none`.
- QA credential value scan across docs, scripts, source, package metadata, and `.gstack/qa-reports`: PASS. A historical local QA report from 2026-07-02 was redacted.

### Final Smoke Screenshots

- desktop `1280x720` `/`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T09-54-13-980Z-desktop-home.png`
- desktop `1280x720` `/search?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T09-54-13-980Z-desktop-search-seoul.png`
- desktop `1280x720` `/wishlist`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T09-54-13-980Z-desktop-wishlist.png`
- desktop `1280x720` `/wishlist?view=recently-viewed`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T09-54-13-980Z-desktop-wishlist-recently-viewed.png`
- desktop `1280x720` `/profile?mode=host&tab=listings`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T09-54-13-980Z-desktop-profile-host-listings.png`
- desktop `1280x720` `/accommodations/3/edit`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T09-54-13-980Z-desktop-accommodation-edit.png`
- mobile `375x812` `/`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T09-54-13-980Z-mobile-home.png`
- mobile `375x812` `/search?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T09-54-13-980Z-mobile-search-seoul.png`
- mobile `375x812` `/wishlist`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T09-54-13-980Z-mobile-wishlist.png`
- mobile `375x812` `/wishlist?view=recently-viewed`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T09-54-13-980Z-mobile-wishlist-recently-viewed.png`
- mobile `375x812` `/profile?mode=host&tab=listings`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T09-54-13-980Z-mobile-profile-host-listings.png`
- mobile `375x812` `/accommodations/3/edit`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T09-54-13-980Z-mobile-accommodation-edit.png`

## 2026-07-04 KST 구조 리팩터 스모크 결과 (Pre-Task7/Stale)

이 섹션은 현재 Task 7 `scripts/smoke/frontend-smoke.mjs` 강화 이전의 과거 증거다. 현재 smoke PASS 로 해석하지 않는다. 최신 full browser smoke 결과는 위 `2026-07-04 KST Redesign Readiness Final Verification` 섹션을 기준으로 본다.

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- Browser QA: gstack browse, authenticated with the thread-provided QA account. 자격 증명 값은 기록하지 않는다.
- Static verification: `npm run typecheck`, `npm run test:ci:no-cache -- --runInBand`, `npm run build`, `git diff --check` 통과.
- Known tooling warnings: `baseline-browser-mapping` and `caniuse-lite` freshness warnings only. Build/test failure는 아니다.

### 확인한 흐름

- Home unauthenticated load:
  - Result: page loaded.
  - Note: initial `/api/v1/auth/me` returned 401 and logged session-expired warning before login. 비로그인 세션 확인 동작으로 분류.
  - Screenshot: `.gstack/qa-reports/screenshots/airbob-home-initial.png`

- Auth modal login:
  - Result: login modal opened, QA account login completed, header switched to authenticated state.
  - Screenshot: `.gstack/qa-reports/screenshots/airbob-login-success.png`

- Search route:
  - URL: `/search?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1&page=1`
  - Result: route loaded, auth/me 200, search API 200, Google map loaded, no new console errors.
  - Note: app normalized URL by dropping `page=1`.
  - Screenshot: `.gstack/qa-reports/screenshots/airbob-search-results.png`

- Search route with Albany fixture:
  - URL: `/search?destination=Albany&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1&page=1`
  - Result: route loaded, search API 200, no new console errors.
  - Limitation: current backend response was empty, so search result card rendering was not browser-verified in this pass.
  - Screenshot: `.gstack/qa-reports/screenshots/airbob-search-results-albany.png`

- Wishlist index:
  - URL: `/wishlist`
  - Result: recently viewed and wishlist lists loaded with API 200 responses, no console errors.
  - Screenshot: `.gstack/qa-reports/screenshots/airbob-wishlist-index.png`

- Wishlist detail:
  - URL after click: `/wishlist?id=1001`
  - Result: detail query loaded with API 200, cards and memo controls rendered, no console errors.
  - Screenshot: `.gstack/qa-reports/screenshots/airbob-wishlist-detail.png`

- Wishlist recently viewed:
  - URL: `/wishlist?view=recently-viewed`
  - Result: recently viewed query and wishlist lists loaded with API 200 responses, no console errors.
  - Screenshot: `.gstack/qa-reports/screenshots/airbob-wishlist-recent.png`

- Profile host listings:
  - URL: `/profile?mode=host&tab=listings`
  - Result: host listings query loaded with API 200, published listings rendered, no console errors.
  - Screenshot: `.gstack/qa-reports/screenshots/airbob-profile-host-listings.png`

- Accommodation edit:
  - URL after host listing edit action: `/accommodations/3/edit`
  - Result: edit page chunk loaded, accommodation detail API 200, wizard shell rendered, no console errors.
  - Screenshot: `.gstack/qa-reports/screenshots/airbob-accommodation-edit.png`

## 2026-07-04 KST 최종 안정화 검증 (Pre-Task7/Stale)

이 섹션은 현재 Task 7 smoke wrapper guard 강화 이전의 과거 증거다. 아래 PASS 항목은 historical result 이며, 현재 smoke script 에 대한 full browser smoke PASS 는 위 `2026-07-04 KST Redesign Readiness Final Verification` 섹션을 기준으로 본다.

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8080`
- Browser QA: `npm run smoke:frontend`, gstack browse, thread-provided QA account via environment variables only. 자격 증명 값은 기록하지 않는다.
- Smoke report: `.gstack/qa-reports/frontend-smoke-2026-07-04T05-26-37-958Z.md`
- Historical result: PASS before the current Task 7 smoke wrapper guard update. Current full browser smoke PASS is pending rerun.

### Commands

- `git diff --check`: PASS
- `npm run typecheck`: PASS
- `npm run test:ci:no-cache -- --runInBand`: PASS, 128 suites / 566 tests.
- `npm run test:ci:no-cache -- --runTestsByPath src/contexts/AuthContext.test.tsx src/features/reservations/lib/paymentRouteState.test.ts src/features/search/hooks/useSearchBarState.test.tsx src/features/search/lib/searchParams.test.ts src/features/wishlist/hooks/useWishlistData.test.ts src/styles/tokens.test.ts src/styles/design-system-contracts.test.ts --runInBand`: PASS, 7 suites / 79 tests.
- `npm run build`: PASS, `Compiled successfully.` Existing `baseline-browser-mapping` and `caniuse-lite` freshness warnings remain.
- `npm run smoke:frontend`: PASS.

### Browser Smoke Coverage

- desktop `1280x720` `/`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T05-26-37-958Z-desktop-home.png`
- desktop `1280x720` `/search?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T05-26-37-958Z-desktop-search-seoul.png`
- desktop `1280x720` `/wishlist`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T05-26-37-958Z-desktop-wishlist.png`
- desktop `1280x720` `/wishlist?view=recently-viewed`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T05-26-37-958Z-desktop-wishlist-recently-viewed.png`
- desktop `1280x720` `/profile?mode=host&tab=listings`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T05-26-37-958Z-desktop-profile-host-listings.png`
- desktop `1280x720` `/accommodations/3/edit`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T05-26-37-958Z-desktop-accommodation-edit.png`
- mobile `375x812` `/`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T05-26-37-958Z-mobile-home.png`
- mobile `375x812` `/search?destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=1`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T05-26-37-958Z-mobile-search-seoul.png`
- mobile `375x812` `/wishlist`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T05-26-37-958Z-mobile-wishlist.png`
- mobile `375x812` `/wishlist?view=recently-viewed`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T05-26-37-958Z-mobile-wishlist-recently-viewed.png`
- mobile `375x812` `/profile?mode=host&tab=listings`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T05-26-37-958Z-mobile-profile-host-listings.png`
- mobile `375x812` `/accommodations/3/edit`: `.gstack/qa-reports/screenshots/frontend-smoke-2026-07-04T05-26-37-958Z-mobile-accommodation-edit.png`
