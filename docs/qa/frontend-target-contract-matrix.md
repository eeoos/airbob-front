# Frontend Target Contract Matrix

이 문서는 디자인 리팩터 전에 지켜야 하는 프론트엔드 계약과 그 증거를 한곳에서
판정한다. 최신 실행 결과를 기록하는 로그가 아니며, suite 수·module 수·graph edge 수·
측정 당시의 bundle 크기처럼 곧 낡는 수치는 복제하지 않는다.

## 판정 기준

- `npm run verify:design-ready`가 디자인 진입의 canonical gate다.
  `npm run verify:pre-redesign`도 같은 backend-independent gate를 가리킨다.
- `npm run verify:structure`는 구조·타입·의존성·스타일·빌드·단위 테스트를,
  `npm run verify:browser`는 synthetic same-origin API를 사용하는 deterministic browser
  characterization을 소유한다.
- `npm run verify:live-integration`은 Vercel, OCI, Toss sandbox, 실제 Google Maps/Places가
  준비된 뒤에만 실행하는 별도 live gate다. 이 명령은 디자인 진입 조건이 아니다.
- `READY (offline)`은 계약과 실행 가능한 로컬 증거가 canonical gate에 연결됐다는 뜻이다.
  각 branch가 통과했다는 주장은 해당 branch에서 gate를 다시 실행해야만 성립한다.
- `DEFERRED / UNVERIFIED (live)`는 외부 환경 증거가 아직 없다는 뜻이다. 로컬 build나
  mocked browser test 통과로 이 상태를 승격할 수 없다.

## 구조 계약

| 영역                        | 확정된 결정                                                                                                                                                                                                                                                                                                                                                        | 실행 가능한 증거                                                                          | 상태                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| Backend/API 불변성          | 프론트는 기존 `/api/v1` endpoint, payload, cookie session, authorization 의미를 보존한다. Backend, DB, server logic은 이 리팩터의 수정 범위가 아니다.                                                                                                                                                                                                              | feature API mapper/contract tests, `npm run verify:structure`                             | READY (offline); live compatibility는 별도 |
| HTTP 경계                   | `src/platform/http/clientCore.ts`가 injectable transport factory를, thin `client.ts` adapter가 유일한 production singleton을 소유한다. 일반 요청과 progress 없는 multipart는 credentialed `fetch`, upload progress가 필요한 multipart만 credentialed `XMLHttpRequest`를 사용한다. 한 `AppError` 경계가 transport/envelope 실패를 정규화한다.                       | `src/platform/http/*.test.ts`, `tests/architecture/verify-platform-boundary.mjs`          | READY (offline)                            |
| Page와 routing              | app router manifest와 lazy route adapter가 route composition을 소유한다. URL codec이 Search, Profile, Wishlist, detail/checkout view의 durable state authority이며 screen은 route parsing을 소유하지 않는다.                                                                                                                                                       | router/codec tests, deterministic Playwright direct-load/refresh/back-forward flows       | READY (offline)                            |
| Server state와 session      | TanStack Query는 session subject/epoch별 server-state cache를 소유하고 session 전환 시 generation이 교체된다. URL로 복원할 수 있는 state는 component local state나 browser storage에 복제하지 않는다.                                                                                                                                                              | session/query scope tests, auth/session characterization                                  | READY (offline)                            |
| Workflow mutation           | Wishlist, reservation/payment, review submission, listing editor, host listing management은 각각 등록된 workflow 한 곳만 write한다. 전송된 명령의 ambiguous 결과는 임의 재전송하지 않고 reconciliation 또는 terminal lock으로 수렴한다.                                                                                                                            | ownership matrix, dependency rules, workflow tests, browser characterization              | READY (offline)                            |
| Component와 overlay         | shared UI는 domain orchestration을 갖지 않는다. app overlay runtime 하나가 portal, topmost Escape, focus containment/restoration, modal scroll lock을 소유한다.                                                                                                                                                                                                    | overlay/Dialog/UserMenu tests, architecture import rules                                  | READY (offline)                            |
| Styling과 design foundation | shared token과 primitive가 layout·z-index·responsive·accessibility 계약을 제공한다. Airbnb 스타일의 시각 변경은 이 경계 위에서 수행하며 workflow나 API owner를 다시 page/component로 옮기지 않는다.                                                                                                                                                                | token/design-system contract tests, Stylelint, deterministic browser interactions         | READY (offline)                            |
| Dependency와 dead code      | dependency-cruiser, Knip, dependency classification, ESLint, TypeScript, Stylelint, Prettier가 서로 겹치지 않는 strict owner다. Production Knip은 target preprocessor 없이 전체 production graph를 검사하며 unused file, value/type export, duplicate export를 모두 차단한다. 우회 ignore, artificial entry, test-only production consumer로 debt를 숨기지 않는다. | `npm run lint:dead-code`, `npm run verify:architecture`, `npm run verify:structure`       | READY (offline)                            |
| Bundle과 public config      | initial graph와 lazy route의 incremental static-import graph는 root `frontend-bundle-budgets.json`의 executable budget을 따라야 한다. Built JavaScript와 source map은 허용된 browser-public config만 포함해야 한다.                                                                                                                                                | `npm run test:public-config-build`, `scripts/architecture/verify-public-config-build.mjs` | READY (offline)                            |
| Artifact와 privacy          | deterministic browser harness는 등록되지 않은 network를 차단하고 report/stdout/stderr를 redact하며 artifact canary를 검사한다. Credential, callback tuple, auth state, 사용자 PII는 증거에 남기지 않는다.                                                                                                                                                          | artifact-policy self-test, harness-security characterization, global teardown scan        | READY (offline)                            |

## 보존해야 하는 사용자 흐름

| 흐름                  | 보존 계약                                                                                                                                                                         | Backend-independent evidence                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Auth/session          | 보호 URL의 pathname/query/hash 복원, anonymous intent cancel/resume, logout·identity change·401·focus revalidation의 같은 session generation 반영                                 | `auth-session-characterization.spec.ts`와 session/intent unit tests                                              |
| Search/Wishlist       | direct load·refresh·pagination·back/forward, destination/page push와 map bounds replace, stale A→B 결과 차단, wishlist duplicate mutation single-flight와 scoped cache projection | `search-wishlist-characterization.spec.ts`, `wishlist-characterization.spec.ts`, Search/Maps/Wishlist unit tests |
| Reservation/Payment   | reservation create와 checkout handoff single-flight, callback tuple 검증과 즉시 URL scrub, confirm single-flight, pending/ambiguous status reconciliation, exact terminal cleanup | `reservation-payment-characterization.spec.ts`와 booking-payment workflow/storage tests                          |
| Review/Editor/Profile | review create 뒤 image-upload partial failure, editor hydrate·image reconcile·save·publish ordering과 late completion fence, guest/host URL state와 list/detail navigation        | profile/review/editor characterization과 feature/workflow tests                                                  |

이 표의 payment evidence는 deterministic sandbox adapter와 synthetic callback 계약만 증명한다.
실제 Toss sandbox redirect와 OCI confirm/status 결과를 증명하지 않는다. Maps evidence도 adapter,
fallback, cleanup 계약만 증명하며 실제 SDK key, quota, referrer 설정을 증명하지 않는다.

## 외부 통합 상태

| 외부 경계                   | 아직 필요한 증거                                                                                                                                   | 현재 상태                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Vercel Preview              | commit-specific deployment의 direct deep-link refresh, hashed/lazy chunk load, 이전 immutable deployment rollback 확인                             | DEFERRED / UNVERIFIED (live)     |
| Vercel → OCI                | 실제 preview origin에서 cookie session, CORS, authenticated API, upload, error envelope 확인                                                       | DEFERRED / UNVERIFIED (live)     |
| Google Maps/Places          | 실제 browser-public key의 referrer 제한, SDK load, autocomplete, marker/bounds interaction, route departure cleanup 확인                           | DEFERRED / UNVERIFIED (live)     |
| Toss                        | sandbox CARD/KRW cancel·fail·success redirect, callback scrub, confirm exactly-once, status reconciliation 확인. 실제 결제 수단은 사용하지 않는다. | DEFERRED / UNVERIFIED (live)     |
| AWS performance environment | 필요할 때만 별도 성능 baseline과 regression을 측정한다. 구조·디자인 진입 gate와 결합하지 않는다.                                                   | DEFERRED; 별도 performance scope |

외부 통합 절차와 기록 규칙은
[`frontend-architecture-smoke.ko.md`](./frontend-architecture-smoke.ko.md)가 소유한다.

## 디자인 진입 판정

Global unused file/value/type export와 duplicate export 정리 및 strict production Knip
cutover가 완료되어 구조 계약의 디자인 진입 판정은 `READY (offline)`다. 시각 디자인
리팩터는 대상 revision에서 `npm run verify:design-ready`가 통과한 것을 확인한 뒤 시작할
수 있으며, backend가 아직 연결되지 않은 사실은 이 offline 판정을 막지 않는다. 다만
live 행은 계속 `DEFERRED / UNVERIFIED`로 남기며,
배포·통합까지 완료됐다고 보고하려면 backend 준비 후 `npm run verify:live-integration`과
live-only checklist를 별도로 통과해야 한다.
