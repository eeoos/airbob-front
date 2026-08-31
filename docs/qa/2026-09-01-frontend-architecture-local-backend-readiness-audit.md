---
title: "Airbob frontend architecture and local-backend readiness re-audit"
type: docs
date: 2026-09-01
frontend_revision: fb94270
backend_reference_revision: b2ec09a
---

# Airbob frontend architecture and local-backend readiness re-audit

## Executive verdict

현재 프론트엔드는 다시 전면 재작성해야 하는 상태가 아니다. 7월 이후 같은 영역을 여러 번 수정한 것은 사실이지만, `pages → feature route → app route adapter + screens`와 CRA/Jest/Axios 제거는 이전 구조로 되돌아간 반복이 아니라 목표 구조로 수렴한 과정이었다.

현재 `app → screens/workflows/features/platform/shared` 의존 방향, 15개 lazy route, session-scoped Query, props 기반 screen, 외부 I/O adapter와 architecture gate는 유지할 가치가 있다. 확인된 가장 큰 문제는 내부 레이어가 아니라 최신 로컬 백엔드 계약과 예약·결제 workflow가 어긋난 것이다.

따라서 판정은 다음과 같다.

- 로컬 백엔드 연동은 지금 진행할 수 있으며 OCI 연결을 기다릴 이유가 없다.
- Airbnb 스타일 디자인 리팩터링에는 아직 바로 들어가면 안 된다.
- 먼저 예약 가능일, quote/checkout, payment-attempt, 비동기 payment operation 계약을 맞춰야 한다.
- 그 다음 editor command, shell/container, responsive token, runtime design token, amenity catalog 경계를 닫아야 한다.
- 백엔드/API/DB/서버 코드는 이번 범위에서 수정하지 않는다.

이번 감사에서는 프론트나 백엔드 runtime 코드를 수정하지 않았다. 백엔드 저장소의 기존 untracked `docs/ideation/`도 건드리지 않았다.

## Audit basis

### Revisions and scope

- Frontend: `codex/architecture-stabilization` at `fb94270`
- Backend read-only reference: `../airbob` at `b2ec09a`
- Frontend areas: commit history, bootstrap, routes, screens, feature components, workflows, state, API adapters, storage, styling, build, unit tests, architecture tests, browser tests, smoke tooling and documentation
- Backend areas: accommodation availability, reservation quote/checkout, hold, payment-attempt, payment confirm/operation read contracts, error codes and local infrastructure documentation

백엔드는 아직 작업 중인 별도 저장소이므로 `b2ec09a`는 영구 고정 버전이 아니라 이번 감사의 기준점이다. 구현을 시작할 때 backend HEAD가 바뀌었다면 공개 V1 계약 차이만 다시 확인하고, 프론트가 backend source를 runtime import하거나 backend를 수정해서 맞추지 않는다.

### Fresh verification evidence

- `verify:architecture`: 통과, 520 modules / 1,356 dependencies / dependency violation 0 / production Knip issue 0
- `verify:structure`: 통과, 265 test files / 1,879 tests / coverage 87.97% statements, 79.59% branches, 90.23% functions, 90.05% lines
- `verify:browser`: loopback deterministic browser 52/52 통과
- Stylelint report: warning 0
- Frontend runtime source: 감사 시작 시 clean; 이번 감사 결과물은 문서 2개로만 추가

이번 재감사에서 `npm audit`은 별도로 재실행하지 않았다. 따라서 위 결과는 구조와 deterministic browser baseline을 증명하지만 aggregate `verify:design-ready` 전체를 새로 증명했다는 뜻은 아니다. OCI, Vercel, 실제 Maps 설정과 운영 CORS도 접촉하지 않았다.

## Commit-history diagnosis

### What changed repeatedly

| Period       | Direction                                                                 | Interpretation                     |
| ------------ | ------------------------------------------------------------------------- | ---------------------------------- |
| July         | `pages` 제거, feature route container, `appShell`/`publicCache` 임시 경계 | 전환기 호환 구조                   |
| August       | app-owned route adapter, `screens`, `workflows`, `platform` 도입          | 목표 ownership으로 이동            |
| Late August  | CRA→Vite, Jest→Vitest, Axios→native HTTP, Toss SDK v2                     | toolchain과 external boundary 정리 |
| Current HEAD | compatibility와 broad export 제거, design-ready gate                      | 목표 구조 closure                  |

같은 파일을 자주 수정했다는 체감에는 근거가 있다. `package.json`, `src/app/router`, `src/workflows/booking-payment`, `src/shared/ui`, `tests/architecture`, `docs/architecture`는 많은 commit에서 반복해 변경됐고, 300~500개 파일을 건드린 대형 commit도 있었다. 이는 review와 bisect를 어렵게 만들었다.

그러나 구조를 예전 상태로 되돌린 commit은 확인되지 않았다. 현재 global runtime root는 `app`, `features`, `platform`, `screens`, `shared`, `workflows`로 수렴했고 `appShell`과 `publicCache`는 사라졌다. 앞으로는 같은 churn 인상을 반복하지 않도록 한 contract 또는 한 사용자 흐름 단위로 작게 land해야 한다.

## Current frontend structure

| Layer                 | Current owner                                                     | Assessment                                                            |
| --------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/app`             | bootstrap, providers, session, router, route adapters, shells     | 유지. route/session composition 경계가 명확하다.                      |
| `src/screens`         | controller, view model, props-oriented screen                     | 유지. 일부 큰 screen과 editor setter 누수만 정리한다.                 |
| `src/workflows`       | auth intent와 cross-feature booking/payment transaction           | 유지. 최신 backend state machine에 맞게 재작성한다.                   |
| `src/features`        | domain model, API adapter, query, narrow UI and ports             | 유지. wire contract drift와 parent feature registry 누락을 고친다.    |
| `src/platform`        | HTTP, config, session/storage driver, browser and SDK integration | 유지. arbitrary header가 아닌 좁은 idempotency capability만 추가한다. |
| `src/shared`          | domain-free library, UI, style and assets                         | 유지. accommodation taxonomy를 이곳으로 올리지 않는다.                |
| `tests` and `scripts` | architecture, deterministic browser, live smoke and policy        | 유지. 실제 local-backend profile을 Playwright 쪽으로 통합한다.        |

### Pages and routing

강점:

- 15개 route가 definitions, lazy component, manifest로 분리돼 있다.
- auth guard는 checking, retryable error, anonymous, authenticated를 구분한다.
- return target과 pathname/query/hash를 보존한다.
- URL builder와 codec ownership이 `src/app/router`에 집중돼 있다.
- payment success credential은 session child보다 먼저 claim하고 URL에서 제거한다.

문제:

- `AccommodationDetailRoute`, `ReservationConfirmRoute`, `PaymentSuccessRoute`, `PaymentFailRoute`가 결제 orchestration을 많이 포함한다.
- 현재 `/accommodations/:id/confirm`은 예약 생성 뒤 payment handoff만 받지만 최신 backend는 quote 확인 뒤 checkout해야 한다.
- route logic을 디자인 변경과 동시에 옮기면 기능 회귀 원인을 분리하기 어렵다.

판정: route 체계는 교체하지 않는다. 기존 path와 codec을 보존하고 booking/payment workflow cutover 때만 adapter 책임을 조정한다.

### Components and screens

강점:

- screen은 Router, QueryClient, platform singleton을 대체로 직접 import하지 않는다.
- shared overlay와 UI public surface가 좁게 관리된다.
- accommodation detail, search, wishlist, editor와 reservation 화면에 이미 domain component 경계가 있다.

문제:

- editor view contract가 `setFormData`, `setOpenTimePicker` 같은 React setter와 전체 draft를 노출한다.
- `ReservationDetailScreen`, `SearchScreen`, `InfoStep`, `AccommodationBookingCardSections`, `AccommodationHero`와 Wishlist shared CSS가 시각 변경에 큰 blast radius를 만든다.
- image fallback이 DOM sibling style 조작에 의존하고 loading/error/empty 표현이 공용 recipe와 raw markup으로 나뉜다.
- 상세와 editor가 amenity label/icon registry를 별도로 가진다.
- raw button, form control과 inline SVG가 여전히 많지만 이를 일괄 primitive화하면 domain semantics를 잃을 수 있다.

판정: 먼저 semantic command와 view section 경계를 만든 뒤 필요한 primitive만 도입한다.

### State management

강점:

- URL은 shareable search/booking intent를 소유한다.
- TanStack Query는 server resource를 소유한다.
- session provider는 identity epoch와 Query lifetime을 묶는다.
- booking/payment는 typed workflow와 subject-owned session storage를 사용한다.
- 새 Redux/Zustand가 없어도 owner를 설명할 수 있다.

문제:

- 현재 booking storage는 서버 reservation 생성 이후에만 기록돼 checkout 응답 유실을 복구할 수 없다.
- local `operationId`가 backend payment operation ID와 이름이 충돌한다.
- 현재 payment machine은 `confirm → 즉시 성공 또는 read reconciliation` 모델이며 202 Accepted 작업을 표현하지 못한다.
- 0원 예약은 `amount > 0` storage invariant 때문에 서버 성공 뒤 handoff가 실패할 수 있다.
- same-tab recovery는 가능하지만 operation ID를 잃은 다른 탭/브라우저에서 active operation을 찾는 공개 API는 없다.

판정: 전역 store를 추가하지 않고, subject-owned versioned booking journal과 짧은 callback credential record를 분리한다.

### API and external boundaries

강점:

- HTTP core가 native transport, envelope parsing, typed `AppError`, abort와 credential을 소유한다.
- wire contracts와 mappers가 feature에 있다.
- Toss/Maps/browser storage가 platform 또는 feature adapter 뒤에 있다.
- Vite development API base `/api/v1`와 `/api → http://localhost:8080` proxy가 이미 맞물린다.

Critical drift:

1. Accommodation detail
   - Frontend는 detail에 `unavailable_dates`가 있다고 가정한다.
   - Backend detail은 `timeZoneId`를 반환하고 availability를 별도 endpoint로 분리했다.
   - 현재 local detail mapper는 spread 대상이 `undefined`여서 실패할 수 있다.

2. Reservation creation
   - Frontend는 accommodation/date/guest/coupon으로 `POST /reservations`를 직접 호출한다.
   - Backend는 `POST /reservation-quotes` 뒤 `{quoteUid, requestMessage}`와 `Idempotency-Key`로 `POST /reservations`를 호출한다.

3. Payment attempt
   - Backend는 Toss 직전에 `POST /reservations/{uid}/payment-attempts`를 요구한다.
   - Frontend storage와 confirm payload에는 `paymentAttemptId`가 없다.

4. Async payment
   - Backend confirm은 202와 `{operationId,status,statusUrl}`를 반환한다.
   - Frontend port는 `Promise<void>`이고 응답을 버린 뒤 성공으로 잠근다.
   - 실제 성공은 payment operation의 `SUCCEEDED`뿐이다.

5. Reservation read model
   - Backend 상태는 `PAYMENT_PENDING`, `PAYMENT_PROCESSING`, `CONFIRMED`, `CANCELLATION_PENDING`, `CANCELLED`, `CANCELLATION_FAILED`, `EXPIRED`다.
   - Frontend는 제거된 `PAYMENT_COMPLETED`와 `COMPLETED`를 포함하고 새 processing/cancellation 상태를 모른다.

판정: API client 전체를 교체하지 않는다. accommodation, reservation, payment feature adapter와 booking-payment workflow만 current V1 contract로 교체한다.

### Styling and design-system readiness

강점:

- CSS Modules, semantic token, Stylelint, PostCSS custom-media toolchain과 visual foundation test가 있다.
- current style gate는 warning 0이다.
- app shell variant와 shared UI surface가 이미 존재한다.

문제:

- 다섯 shell이 거의 같은 빈 wrapper이며 실제 max-width/gutter가 screen CSS에 흩어져 있다.
- custom media token은 선언돼 있지만 raw `@media`가 65곳이고 token 사용은 사실상 없다.
- TSX, Google Maps marker SVG, info-window CSSOM의 raw color/geometry는 CSS policy가 잡지 못한다.
- accommodation amenity 시각 catalog가 detail과 editor에 중복된다.
- 큰 screen/CSS를 그대로 전면 restyle하면 visual regression 범위가 너무 크다.

판정: token이 존재한다는 이유만으로 디자인 준비 완료라고 보지 않는다. container ownership, custom-media consumption, runtime token adapter, semantic catalog와 stable visual section을 먼저 정리한다.

### Build and tests

강점:

- Node `^22.13.0 || ^24.0.0`, Vite, Vitest, Playwright, strict TypeScript, ESLint, dependency-cruiser, Knip, Stylelint, Prettier가 canonical scripts로 묶였다.
- architecture, structure, deterministic browser, live integration gate가 분리돼 있다.
- browser harness는 unhandled network를 default-deny한다.
- bundle budgets와 build output contract가 자동 검증된다.

문제:

- deterministic reservation E2E가 현재 잘못된 `202 null → 즉시 성공` 동작을 characterization하고 있다.
- harness header allowlist가 `Idempotency-Key`를 허용하거나 안전하게 검증하지 못한다.
- 760줄이 넘는 custom live smoke가 Playwright와 별도 실행 모델을 가진다.
- 현재 `verify:live-integration`은 기본 localhost 흐름인데 이름이 OCI/production evidence처럼 읽힐 수 있다.
- local async payment는 MySQL, Redis, Elasticsearch, Kafka, Debezium/outbox consumer까지 살아 있어야 실제 terminal로 수렴한다.

판정: deterministic browser와 real local-backend profile을 분리하되 둘 다 Playwright를 canonical engine으로 만든다. 기존 smoke는 parity가 생기기 전까지 유지한다.

## Priority findings

### P0 — Must fix before design work

- Detail contract와 separate availability endpoint 분리
- Quote 화면과 checkout 사용자 승인 경계
- Checkout 전 stable idempotency key와 exact request를 기록하는 v2 booking journal
- Checkout response loss의 exact replay
- 0원 reservation direct-confirmed branch
- Payment-attempt issuance, tuple validation, durable write, Toss launch 순서
- Success/fail callback credential scrub와 subject claim
- Confirm 202 receipt parsing, exact replay, operation polling과 terminal cleanup
- `FAILED`/`REQUIRES_REVIEW`/network failure를 서로 다른 상태로 유지
- Backend reservation status/read DTO parity

### P1 — Structural closure required before broad restyling

- Parent `accommodations` feature를 strict registry에 포함하고 discovery-registry equality를 자동 검증
- Editor React setter contract를 semantic command로 교체
- Shell/container/gutter ownership 결정
- image fallback과 loading/error/empty state owner 통일
- custom media를 실제 CSS에서 소비하고 stale CRA 문구 제거
- TSX/CSSOM runtime design literal adapter와 policy 추가
- accommodation-owned amenity catalog 통합
- large screen/CSS를 guest/host 또는 stable visual section 단위로 분리

### P2 — Documentation and workflow hygiene

- 2026-08-29 plan의 retired payment compatibility/live-canary 문구를 historical로 표시
- current architecture와 style warning 0 상태를 문서에 반영
- 오래된 `routes/pages` verification example을 current target으로 사용하지 않게 명시
- future work를 small vertical commit으로 제한하고 formatting/tooling sweep와 behavior change를 섞지 않기

## Refactoring risk zones

| Area                   | Why risky                                                                        | Control                                                                   |
| ---------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Booking journal        | mutation response loss, TTL, subject change가 중복 reservation과 연결됨          | mutation 전 durable write, exact allowlist, epoch fence, v1 purge         |
| Payment callback       | paymentKey가 URL/history/storage/log에 남을 수 있음                              | provider boundary에서 즉시 scrub, short-lived credential record           |
| Async payment          | 202를 성공으로 오인하거나 polling을 중복 실행할 수 있음                          | backend operation ID authority, one active poller, exact terminal cleanup |
| Checkout retry         | 새 key나 새 quote로 자동 재시도하면 duplicate hold 가능                          | same body/key replay only, R016 fail closed                               |
| Payment attempt        | attempt 응답 유실 또는 SDK 실패                                                  | same endpoint replay, journal write 뒤 explicit click으로 SDK launch      |
| Multi-tab/session      | sessionStorage는 tab-local이고 late async result가 새 user에게 publish될 수 있음 | server authority, subject/epoch fence, no sensitive cross-tab broadcast   |
| Reservation read model | status drift가 잘못된 CTA와 cleanup을 만들 수 있음                               | exhaustive status mapping and unknown-response rejection                  |
| Local integration      | async path가 전체 messaging stack에 의존                                         | preflight, bounded waits, deterministic synthetic coverage                |
| Large visual surfaces  | component와 CSS가 커서 design regression 원인 분리가 어려움                      | section-level decomposition before restyling                              |

## Functional flows to preserve

- Public home/search/detail direct load, refresh, back/forward와 lazy loading
- Search URL restoration, map/card interaction and wishlist projection
- Login/signup, original return target, session retry and logout cleanup
- Auth-required reservation intent resume under the same subject
- Wishlist membership across search, detail, modal and profile
- Accommodation detail coupon and guest-selection behavior
- Reservation confirmation page path and booking intent query semantics
- Toss sandbox success, fail and user-cancel routes
- Payment callback credential claim before authenticated child rendering
- Guest/host reservation list and detail authorization boundaries
- Review partial-success and listing editor operation ordering
- Storage isolation across logout and account switch

Preservation means route and user intent remain recognizable. It does not mean retaining the obsolete direct reservation POST or treating 202 as success.

## Recommended architecture direction

1. Preserve the current dependency DAG and route/screen/workflow layering.
2. Model availability, quote, checkout, hold, payment-attempt and payment-operation as narrow feature capabilities.
3. Keep cross-feature sequencing in `workflows/booking-payment` with exhaustive states and route/session leases.
4. Write a subject-owned booking journal before checkout mutation; use a new namespace and purge v1 rather than inventing unsafe migration.
5. Keep sensitive callback credential storage separate and shorter-lived than non-sensitive operation receipts.
6. Replay only exact server-idempotent commands after ambiguous responses.
7. Let the server own price, availability, reservation and payment terminal truth.
8. Keep the local backend gate separate from Vercel/OCI deployment evidence.
9. Close semantic UI and layout/token boundaries before applying Airbnb visuals.

## Required sequence

1. Freeze the contract snapshot and close the feature-registry/document authority gaps.
2. Split detail from availability and protect half-open date/window semantics.
3. Add quote/checkout adapters, narrow idempotency transport support and v2 booking journal.
4. Cut the user flow to explicit quote review and idempotent checkout, including the 0-won branch.
5. Align reservation read statuses and recovery fields.
6. Add payment-attempt and pre-confirm hold-abandonment behavior.
7. Harden success/fail callback claim and scrub.
8. Replace immediate confirm success with Accepted receipt, exact replay and operation polling.
9. Update deterministic tests, then prove representative flows against the full local backend stack and Toss sandbox.
10. Replace editor setters, state/image fragments, shell/container, responsive/runtime tokens and amenity duplication.
11. Split high-risk visual surfaces and establish the real design-entry gate.
12. Only then start Airbnb-style vertical visual slices.

## Work required before Airbnb design-system application

- Define whether shell or an explicit page-container recipe owns max width and gutter.
- Make responsive aliases executable in CSS and share the same semantic breakpoints with runtime code.
- Add typed runtime token adapters for Maps SVG/CSSOM and TSX-only styling.
- Replace editor setters with named domain commands.
- Consolidate accommodation amenity taxonomy and visual catalog under the accommodation domain.
- Establish common image fallback and state recipes.
- Add only the semantic primitives justified by the real control inventory.
- Decompose Reservation, Wishlist, Search, Detail and Editor visual sections without changing behavior.
- Preserve payment orchestration during visual work; payment visuals come after the functional cutover.
- Add visual baselines per vertical slice rather than one large screenshot rewrite.

## Local versus deployment evidence

Local verification can prove:

- current frontend/backend V1 contract compatibility
- Vite same-origin proxy cookie session
- real API envelopes and domain error codes
- local Kafka/outbox payment-operation convergence
- Toss sandbox flow when configured local credentials are present

It cannot prove:

- Vercel→OCI cross-site `SameSite`/`Secure` cookie behavior
- production CORS allowlist and credential delivery
- Vercel rewrite, deep-link, cache and old-chunk behavior
- OCI deployment health
- Maps production referrer/quota
- AWS performance characteristics
- cross-device payment-operation recovery

These remain explicit deployment gates, not blockers for local contract alignment or backend-independent structural cleanup.

## Final decision

**바로 디자인 리팩터링으로 들어가면 안 된다. 먼저 구조와 최신 로컬 백엔드 계약을 정리해야 한다.**

다만 “구조 정리”는 현재 frontend architecture를 다시 갈아엎는 작업이 아니다. 이미 수렴한 레이어와 gate는 유지하고, P0 contract/state-machine drift와 P1 design-boundary 누락을 순서대로 닫는 작업이다. 이 closure가 끝나면 OCI 연결 없이도 Airbnb 디자인 작업을 시작할 수 있고, OCI/Vercel은 마지막 배포 검증 단계로 남길 수 있다.
