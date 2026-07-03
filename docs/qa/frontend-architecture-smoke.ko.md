# Frontend Architecture Smoke QA

## 목적

Airbnb 디자인 리팩터 전에 프론트엔드 아키텍처 변경이 주요 사용자 흐름을 깨뜨리지 않았는지 확인한다.

## 환경

- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- QA 계정: 스레드에서 사용자가 제공한 QA 계정을 사용한다. 실제 이메일, 비밀번호, 닉네임, member_id 같은 자격 증명 값은 문서나 커밋에 남기지 않는다.

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
