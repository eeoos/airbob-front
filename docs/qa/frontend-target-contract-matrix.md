# Frontend Target Contract Matrix

이 문서는 실제 Airbnb 시각 리팩터 전에 지켜야 하는 프론트엔드 계약과 현재 증거
상태를 한곳에서 판정한다. 실행 로그가 아니므로 suite 수, graph edge 수, bundle 크기
같이 곧 낡는 수치는 복제하지 않는다.

출발 revision은 frontend `cfdb1e4`, read-only backend contract target은
`b2ec09a`다. v2 owner switch는 `bf78544`, offline verification checkpoint는
`ac50110`이다. 아래의 `READY (offline)`은 이 checkpoint와 문서 정합성 변경을 포함한
`codex/frontend-contract-stabilization-v2` 작업 트리에서 canonical gate를 다시 실행한
결과다.
실행 순서는
[`2026-09-01 contract-alignment plan`](../plans/2026-09-01-001-refactor-local-backend-contract-alignment-plan.md)이
소유한다.

## 판정 기준

- `npm run verify:design-ready`가 최종 디자인 진입의 canonical gate다. U11 browser
  audit, U15 layout/token closure와 U16 최종 검증은 완료됐다. 과거 green이나
  focused test는 이 판정을 대신하지 않는다.
- `npm run verify:pre-redesign`은 같은 offline gate의 호환 alias이며 독립된 추가
  증거나 live-integration pass로 계산하지 않는다.
- `npm run verify:structure`는 구조, 타입, 의존성, 스타일, public build, 단위 테스트와
  strict lint를 소유한다. 개별 focused test 통과는 이 전체 gate를 대신하지 않는다.
- `npm run verify:browser`는 synthetic same-origin API와 기본 차단 network 정책을 쓰는
  결정론적 browser 증거를 소유한다. U11의 v2 예약·결제 matrix는 이 gate에 포함된다.
- `npm run verify:live-integration`은 별도 live smoke다. Vercel, OCI, 실제 Maps와
  Toss sandbox 증거는 디자인 진입의 offline gate가 아니다.
- `READY (offline)`은 실제 외부 시스템을 호출했다는 뜻이 아니다.
  `BLOCKED / UNVERIFIED`는 시도 근거가 있지만 반복 가능한 실행 전제조건이 없다는
  뜻이며 pass나 skip으로 승격하지 않는다.

## 구조 계약

| 영역                             | 확정된 결정                                                                                                                                                                                                                                                                                                                         | 실행 가능한 증거                                                                         | 현재 상태            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------- |
| Backend/API 불변성               | Backend, DB, 설정과 server logic은 read-only다. Frontend adapter가 target `b2ec09a`의 `/api/v1` snake_case 계약을 camelCase domain으로 엄격히 매핑한다.                                                                                                                                                                             | booking/payment/detail/availability mapper와 API contract tests, `verify:structure`      | READY (offline)      |
| HTTP 경계                        | `platform/http`가 credentialed native transport, exact idempotency header와 하나의 `AppError` 경계를 소유한다. Feature/workflow는 raw fetch/XHR나 임의 header를 소유하지 않는다.                                                                                                                                                    | `src/platform/http/*.test.ts`, platform/dependency architecture rules                    | READY (offline)      |
| Detail와 availability            | Detail은 정적 숙소 정보와 `timeZoneId`를, 별도 `/accommodations/{id}/availability`는 booking window와 unavailable range를 소유한다. Availability loading/error/malformed 상태에서도 detail은 보이되 날짜·quote action은 fail closed하고 retry를 제공한다. Quote가 최종 inventory/price authority다.                                 | detail/availability API·query tests, `AccommodationDetailController` failure/retry tests | READY (offline)      |
| Page와 routing                   | App route manifest와 lazy adapter가 composition을 소유한다. Search/Profile/Wishlist/booking/payment codec만 durable URL/history state를 해석하며 screen은 route parsing을 소유하지 않는다.                                                                                                                                          | route/codec tests, U11 direct-load/refresh/back-forward audit                            | READY (offline, U11) |
| Server state와 session           | QueryClient는 subject/epoch generation별 server state를 소유한다. U13 이후 Profile 및 guest/host reservation read/mutation도 explicit audience/resource/filter scope와 route/session lease를 사용한다.                                                                                                                              | session/query scope, Profile/reservation/editor workflow tests                           | READY (offline, U13) |
| Booking/payment writer           | 단일 v2 owner가 quote → explicit checkout → payment-attempt → Toss v2 → callback scrub/claim → confirm 202 → operation receipt → polling을 수행한다. Receipt presence가 pre-Accepted replay를 막고 `SUCCEEDED`/`FAILED`만 terminal이다. `REQUIRES_REVIEW`는 allowlisted identifiers를 보여주는 unresolved state로 계속 polling한다. | booking transaction, journal/recovery repository, callback route, Payment Result tests   | READY (offline, U11) |
| Browser recovery/privacy         | Fixed v2 journal, callback credential, operation receipt만 활성 storage slot이다. History에는 exact credential-free flow/operation reference만 쓴다. Callback URL/Router state는 auth/session child보다 먼저 scrub한다.                                                                                                             | storage/codec/boundary/AppProviders/recovery tests, browser artifact policy              | READY (offline)      |
| Editor commands                  | Editor는 setter bundle 대신 의미 단위 command와 단일 reducer를 사용하고, hydrate/image/save/publish completion을 route/session/resource lease로 막는다.                                                                                                                                                                             | editor controller/draft/workflow tests                                                   | READY (offline, U13) |
| UI recipe/catalog                | Shared state/image fallback recipe와 parent accommodation amenity catalog가 중복 semantics를 정리한다. Domain orchestration은 shared UI로 이동하지 않고 detail/editor glyph 표현은 각 context가 소유한다.                                                                                                                           | StateView/ImageWithFallback/catalog/component/source-policy tests                        | READY (offline, U14) |
| Layout/responsive/runtime tokens | PageContainer, 예외 route, custom-media와 non-CSS runtime token의 단일 owner를 세우되 visual restyle은 하지 않는다.                                                                                                                                                                                                                 | page-layout/source/style/responsive/runtime-token tests                                  | READY (offline, U15) |
| Dependency와 dead code           | dependency-cruiser, Knip, dependency classification, ESLint, TypeScript, Stylelint와 Prettier가 strict production graph를 검사한다. Test-only production reachability나 ignore로 debt를 숨기지 않는다.                                                                                                                              | `verify:architecture`, `verify:structure`                                                | READY (offline)      |
| Bundle과 public config           | Root budget과 public-config build gate가 lazy graph 및 browser-public 환경값만 허용한다. Toss secret/server key, QA 값과 예측 불가능한 env는 build artifact에 들어갈 수 없다.                                                                                                                                                       | bundle/public-config/Toss build gates                                                    | READY (offline)      |
| Artifact와 privacy               | Deterministic harness는 미등록 network를 차단하고 text output을 redact하며 artifact canary를 검사한다. Cookie, callback credential, auth state와 실제 PII를 evidence에 남기지 않는다.                                                                                                                                               | artifact-policy self-test, harness-security spec, teardown scan                          | READY (offline)      |

## 보존해야 하는 사용자 흐름

| 흐름                  | 보존 계약                                                                                                                                                                                                    | Backend-independent evidence                                       | 상태                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------- |
| Auth/session          | 보호 URL의 pathname/query/hash 복원, anonymous intent cancel/resume, logout·identity change·401·focus revalidation의 동일 generation 반영                                                                    | auth/session characterization과 session/intent unit tests          | READY (offline)      |
| Search/Wishlist       | direct load·refresh·pagination·back/forward, destination/page push와 map-bounds replace, stale A→B 차단, wishlist duplicate mutation single-flight와 scoped projection                                       | Search/Wishlist browser characterization과 workflow/query tests    | READY (offline)      |
| Accommodation Detail  | Detail과 Availability 독립 loading/error, availability 실패 시 detail 보존 + booking fail-closed/retry, quote 전에 현재 route/session/date/occupancy/coupon 재검증                                           | detail/availability query/controller/booking validation tests      | READY (offline)      |
| Reservation/Payment   | quote 검토 뒤 명시적 checkout, 동일 idempotency replay, 같은 reservation payment-attempt retry/release, Toss callback 즉시 scrub, crash/reload recovery, 202 receipt polling, review/terminal acknowledgment | v2 workflow/storage/route tests와 U11 deterministic browser matrix | READY (offline, U11) |
| Review/Editor/Profile | Review image-upload partial failure, editor hydrate·image reconcile·save·publish ordering과 late completion fence, guest/host URL state와 list/detail navigation                                             | Profile/Review/Editor characterization과 feature/workflow tests    | READY (offline, U13) |

결정론적 payment evidence는 synthetic gateway와 callback 계약만 증명한다. 실제 Toss
sandbox redirect나 local backend operation을 증명하지 않는다. Maps 증거도 adapter,
fallback과 cleanup 계약만 증명하며 실제 key/quota/referrer 설정을 증명하지 않는다.

## 외부 통합 상태

| 외부 경계                   | 필요한 증거                                                                                                                                                                                                     | 현재 상태                                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Local backend core profile  | Backend-owned disposable fixture/reset 또는 per-run unique resource로 auth, availability, paid/complimentary quote, checkout, attempt/release와 operation messaging을 반복 실행                                 | [`U12 attempt`](./2026-09-01-local-backend-payment-profile-attempt.md): **BLOCKED / UNVERIFIED** — fixture/reset과 실행 service 없음 |
| Toss sandbox                | Local backend core 전제가 갖춰진 뒤 test client/server credential을 값 노출 없이 preflight하고 CARD/KRW cancel/fail/success redirect, exactly joined confirm와 polling을 검증한다. 실제 결제는 수행하지 않는다. | DEFERRED / UNVERIFIED (sandbox)                                                                                                      |
| Vercel Preview              | commit-specific deep-link refresh, lazy chunk와 immutable deployment rollback 확인                                                                                                                              | DEFERRED / UNVERIFIED (live); offline gate 비차단                                                                                    |
| Vercel → OCI                | 실제 preview origin의 cookie/CORS/authenticated API/upload/error envelope 확인                                                                                                                                  | DEFERRED / UNVERIFIED (live); offline gate 비차단                                                                                    |
| Google Maps/Places          | browser-public key referrer 제한, SDK load, autocomplete, marker/bounds와 route cleanup 확인                                                                                                                    | DEFERRED / UNVERIFIED (live); offline gate 비차단                                                                                    |
| AWS performance environment | 필요할 때 별도 baseline/regression 측정                                                                                                                                                                         | DEFERRED; 별도 performance scope                                                                                                     |

U12에서는 backend README, profile, Flyway, startup runner와 현재 Compose/listener를
읽기 전용으로 확인했다. Product fixture/reset 공개 계약이 없어 실제 mutation을 보내지
않았으며 backend 파일·DB·설정도 수정하지 않았다. 이 판정은 local integration pass가
아니다. 외부 절차와 기록 규칙은
[`frontend-architecture-smoke.ko.md`](./frontend-architecture-smoke.ko.md)가 소유한다.

## 디자인 진입 판정

현재 디자인 진입 판정은 **READY (offline)**다. Backend adapter, separate availability,
v2 예약·결제 owner, U11 deterministic browser matrix, U13–U16 design-foundation 경계와
canonical `verify:design-ready`가 green이다. U12의 근거 있는 `BLOCKED / UNVERIFIED`는
이 offline 판정을 막지 않지만, mocked green을 실제 local backend 또는 Toss sandbox
pass로 표현할 수는 없다. 실제 Airbnb 시각 작업은 이 구조를 기준으로 별도 vertical
slice에서 시작한다.
