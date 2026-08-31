# Frontend Target Contract Matrix

이 문서는 디자인 리팩터 전에 지켜야 하는 프론트엔드 계약과 그 증거를 한곳에서
판정한다. 최신 실행 결과를 기록하는 로그가 아니며, suite 수·module 수·graph edge 수·
측정 당시의 bundle 크기처럼 곧 낡는 수치는 복제하지 않는다.

판정 기준 revision은 frontend `cfdb1e4`, read-only backend contract target은 `b2ec09a`다.
현재 목표와 실행 순서는
[`2026-09-01 contract-alignment plan`](../plans/2026-09-01-001-refactor-local-backend-contract-alignment-plan.md)이
소유한다. 2026-08-29 계획의 완료 표시는 이 revision의 backend 계약 또는 디자인 진입
판정을 대신하지 않는다.

## 판정 기준

- `npm run verify:design-ready`가 최종 디자인 진입의 canonical gate다. 다만 current
  revision에서는 계약과 pre-design owner가 열려 있으므로, 2026-09-01 plan U16이 이
  명령과 증거를 다시 닫기 전까지 과거 green만으로 디자인 진입을 선언하지 않는다.
  `npm run verify:pre-redesign` alias도 현재의 `NOT READY` 판정을 덮어쓰지 않는다.
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

| 영역                        | 확정된 결정                                                                                                                                                                                                                                                                                                                                                        | 실행 가능한 증거                                                                          | 상태                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------- |
| Backend/API 불변성          | Backend, DB, server logic은 수정하지 않는다. 프론트 adapter가 read-only target `b2ec09a`의 `/api/v1` availability, quote/checkout, payment-attempt와 payment-operation 계약을 따라야 한다.                                                                                                                                                                         | feature API mapper/contract tests, `npm run verify:structure`                             | ALIGNMENT REQUIRED (U2–U3)  |
| HTTP 경계                   | `src/platform/http/clientCore.ts`가 injectable transport factory를, thin `client.ts` adapter가 유일한 production singleton을 소유한다. 일반 요청과 progress 없는 multipart는 credentialed `fetch`, upload progress가 필요한 multipart만 credentialed `XMLHttpRequest`를 사용한다. 한 `AppError` 경계가 transport/envelope 실패를 정규화한다.                       | `src/platform/http/*.test.ts`, `tests/architecture/verify-platform-boundary.mjs`          | READY (offline)             |
| Page와 routing              | app router manifest와 lazy route adapter가 route composition을 소유한다. URL codec이 Search, Profile, Wishlist, detail/checkout view의 durable state authority이며 screen은 route parsing을 소유하지 않는다.                                                                                                                                                       | router/codec tests, deterministic Playwright direct-load/refresh/back-forward flows       | READY (offline)             |
| Server state와 session      | TanStack Query는 session subject/epoch별 server-state cache를 소유하고 session 전환 시 generation이 교체된다. URL로 복원할 수 있는 state는 component local state나 browser storage에 복제하지 않는다.                                                                                                                                                              | session/query scope tests, auth/session characterization                                  | READY (offline)             |
| Workflow mutation           | 각 mutation은 writer 한 곳만 가진다. 예약·결제는 quote → idempotent checkout → payment-attempt → Toss v2 → 202 operation receipt → polling으로 수렴하며 `SUCCEEDED`만 성공 authority다.                                                                                                                                                                            | ownership matrix, dependency rules, workflow tests, browser characterization              | ALIGNMENT REQUIRED (U3/U11) |
| Component와 overlay         | shared UI는 domain orchestration을 갖지 않는다. app overlay runtime 하나가 portal, topmost Escape, focus containment/restoration, modal scroll lock을 소유한다.                                                                                                                                                                                                    | overlay/Dialog/UserMenu tests, architecture import rules                                  | READY (offline)             |
| Styling과 design foundation | shared token과 primitive의 기존 경계는 유지한다. 그러나 semantic amenity taxonomy는 detail/editor에 중복되고, custom-media transform에는 production alias consumer가 없으며, page width/gutter owner도 분산돼 있다. Airbnb 시각 변경 전에 U14/U15가 이를 닫아야 한다.                                                                                              | token/design-system contract tests, Stylelint, deterministic browser interactions         | OPEN (U14–U15)              |
| Dependency와 dead code      | dependency-cruiser, Knip, dependency classification, ESLint, TypeScript, Stylelint, Prettier가 서로 겹치지 않는 strict owner다. Production Knip은 target preprocessor 없이 전체 production graph를 검사하며 unused file, value/type export, duplicate export를 모두 차단한다. 우회 ignore, artificial entry, test-only production consumer로 debt를 숨기지 않는다. | `npm run lint:dead-code`, `npm run verify:architecture`, `npm run verify:structure`       | READY (offline)             |
| Bundle과 public config      | initial graph와 lazy route의 incremental static-import graph는 root `frontend-bundle-budgets.json`의 executable budget을 따라야 한다. Built JavaScript와 source map은 허용된 browser-public config만 포함해야 한다.                                                                                                                                                | `npm run test:public-config-build`, `scripts/architecture/verify-public-config-build.mjs` | READY (offline)             |
| Artifact와 privacy          | deterministic browser harness는 등록되지 않은 network를 차단하고 report/stdout/stderr를 redact하며 artifact canary를 검사한다. Credential, callback tuple, auth state, 사용자 PII는 증거에 남기지 않는다.                                                                                                                                                          | artifact-policy self-test, harness-security characterization, global teardown scan        | READY (offline)             |

## 보존해야 하는 사용자 흐름

| 흐름                  | 보존 계약                                                                                                                                                                         | Backend-independent evidence                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Auth/session          | 보호 URL의 pathname/query/hash 복원, anonymous intent cancel/resume, logout·identity change·401·focus revalidation의 같은 session generation 반영                                 | `auth-session-characterization.spec.ts`와 session/intent unit tests                                              |
| Search/Wishlist       | direct load·refresh·pagination·back/forward, destination/page push와 map bounds replace, stale A→B 결과 차단, wishlist duplicate mutation single-flight와 scoped cache projection | `search-wishlist-characterization.spec.ts`, `wishlist-characterization.spec.ts`, Search/Maps/Wishlist unit tests |
| Reservation/Payment   | quote와 명시적 checkout 승인, exact idempotent replay, payment-attempt, callback tuple 검증·즉시 scrub, 202 receipt polling, review/support terminal과 exact cleanup              | U3 단계별 workflow/storage tests와 U11 deterministic browser matrix (현재 미완료)                                |
| Review/Editor/Profile | review create 뒤 image-upload partial failure, editor hydrate·image reconcile·save·publish ordering과 late completion fence, guest/host URL state와 list/detail navigation        | profile/review/editor characterization과 feature/workflow tests                                                  |

이 표의 payment evidence는 deterministic sandbox adapter와 synthetic callback 계약만 증명한다.
실제 Toss sandbox redirect와 OCI confirm/status 결과를 증명하지 않는다. Maps evidence도 adapter,
fallback, cleanup 계약만 증명하며 실제 SDK key, quota, referrer 설정을 증명하지 않는다.

## 외부 통합 상태

| 외부 경계                   | 아직 필요한 증거                                                                                                                                   | 현재 상태                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Vercel Preview              | commit-specific deployment의 direct deep-link refresh, hashed/lazy chunk load, 이전 immutable deployment rollback 확인                             | DEFERRED / UNVERIFIED (live)      |
| Vercel → OCI                | 실제 preview origin에서 cookie session, CORS, authenticated API, upload, error envelope 확인                                                       | DEFERRED / UNVERIFIED (live)      |
| Google Maps/Places          | 실제 browser-public key의 referrer 제한, SDK load, autocomplete, marker/bounds interaction, route departure cleanup 확인                           | DEFERRED / UNVERIFIED (live)      |
| Toss                        | sandbox CARD/KRW cancel·fail·success redirect, callback scrub, confirm exactly-once, status reconciliation 확인. 실제 결제 수단은 사용하지 않는다. | DEFERRED / UNVERIFIED (live)      |
| Local backend profile       | backend-owned disposable fixture/reset 또는 per-run unique resource 계약으로 core API/messaging을 반복 실행                                        | UNVERIFIED — U12 attempt required |
| AWS performance environment | 필요할 때만 별도 성능 baseline과 regression을 측정한다. 구조·디자인 진입 gate와 결합하지 않는다.                                                   | DEFERRED; 별도 performance scope  |

외부 통합 절차와 기록 규칙은
[`frontend-architecture-smoke.ko.md`](./frontend-architecture-smoke.ko.md)가 소유한다.

## 디자인 진입 판정

현재 디자인 진입 판정은 `NOT READY`다. Global Knip과 기존 DAG/toolchain 경계는
유지하지만, current backend 계약(U2/U3/U11)과 editor/catalog/layout/token owner
(U13–U15)를 닫고 U12의 real-local 결과를 `PASS` 또는 근거 있는
`BLOCKED/UNVERIFIED`로 기록한 뒤 U16에서 canonical gate를 다시 증명해야 한다. OCI,
Vercel, production Maps와 AWS가 준비되지 않은 사실은 그 offline 판정을 막지 않지만,
local backend contract drift를 mocked green으로 대체할 수는 없다.
