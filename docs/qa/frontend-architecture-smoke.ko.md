# Frontend Local and Live Integration Smoke

> U12 local core: **BLOCKED / UNVERIFIED**
> U12 local Toss sandbox: **BLOCKED / UNVERIFIED**
> Local-benchmark read-only subset: **PASS**
> Deployment live: **DEFERRED / UNVERIFIED**
>
> 2026-09-02 audit에서 infrastructure, local-benchmark backend readiness, 실제 search/Maps와
> accommodation detail을 읽기 전용으로 검증했다. 사용자는 전용 local reset ownership도
> 확인했다. 그러나 booking inventory와 active coupon이 0이고 backend-owned fixture reset
> procedure와 Toss failure injection이 없으므로 local core와 Toss는 pass로 기록하지 않는다.

## 목적과 경계

이 문서는 U12 real local-backend profile과 외부 서비스가 필요한 deployment live 통합을
서로 다른 증거로 검증한다. 프론트 구조와 디자인 진입은 backend-independent
`npm run verify:design-ready`가 판정하며, 어느 통합 smoke도 그 명령에 포함되지 않는다.

Local 범위는 다음뿐이다.

- Vite `/api` proxy를 통한 cookie session, search, wishlist, detail과 availability
- backend-owned disposable data에서 paid/complimentary quote와 checkout
- paid hold의 attempt replay/release와 availability projection
- local messaging stack을 통과한 operation terminal
- 별도 Toss sandbox project의 cancel/fail/success, callback scrub, confirm/poll recovery

Deployment live 범위는 다음뿐이다.

- commit-specific Vercel deployment의 SPA deep link와 lazy asset
- Vercel origin에서 OCI `/api/v1`로 가는 cookie session, CORS, API envelope와 upload
- 실제 Google Maps/Places SDK의 key/referrer/quota와 browser interaction
- Toss sandbox redirect, callback scrub, confirm/status reconciliation

AWS 성능 환경은 이 runbook과 디자인 진입 gate 밖의 별도 성능 작업이다.

## U12 local profile

### Local 실행 전 조건

- Vite frontend, local backend와 backend 문서가 요구하는 DB/cache/messaging service가
  모두 reachable이어야 한다. 단순 port open만으로 messaging ready를 주장하지 않는다.
- Backend owner가 해당 identity, accommodation, inventory, coupon과 생성된
  reservation/operation을 disposable로 선언하고 reset/cleanup 책임자와 절차를 제공해야
  한다. 이 ownership은 자동 preflight가 추론할 수 없으므로 실행 전 out-of-band attestation과
  실행 기록이 필요하다. Frontend runner는 DB를 seed/reset하거나 backend test SQL을
  재사용하지 않는다.
- 서로 겹치지 않는 paid slot 1–3과 별도 complimentary slot을 준비한다. Paid quote는
  current CARD/KRW 최소 금액을 충족하고 complimentary quote는 Toss를 호출하지 않는
  조건이어야 한다.
- Search와 wishlist fixture가 동일한 disposable dataset을 가리키고 guest identity가 이를
  읽고 변경할 권한을 가져야 한다.
- Operation terminal을 만드는 Kafka/Debezium 등 backend-owned messaging path의 readiness와
  bounded completion 기준을 backend owner가 확인해야 한다.
- Toss project는 local core가 먼저 검증된 뒤에만 실행한다. Browser에는
  `REACT_APP_TOSS_CLIENT_KEY`만 주입하고 server credential은 backend process가 소유한다.
  Key 값이나 존재 확인 출력도 evidence에 남기지 않는다.

### Local 환경 변수 이름

아래는 canonical 이름이다. Shell과 secret manager에는 값을 out-of-band로 주입하되,
명령, screenshot, report, issue, commit과 채팅에는 값을 쓰지 않는다.

| 이름                                      | 용도                                                 |
| ----------------------------------------- | ---------------------------------------------------- |
| `AIRBOB_QA_EMAIL`, `AIRBOB_QA_PASSWORD`   | disposable guest identity                            |
| `AIRBOB_LOCAL_MUTATION_PROFILE`           | mutation opt-in; 정확히 `disposable`                 |
| `AIRBOB_LOCAL_DATA_OWNERSHIP_PROFILE`     | 정확히 `backend-owned-disposable`인 소유권 확인      |
| `AIRBOB_LOCAL_BACKEND_REVISION`           | 실행 대상 backend의 non-secret Git revision          |
| `AIRBOB_LOCAL_RESET_AUTHORIZED_AT`        | 15분 이내 UTC reset 승인 시각                        |
| `AIRBOB_LOCAL_RESET_OWNER_LABEL`          | 정확히 `backend-local-owner`인 PII-free 역할 label   |
| `AIRBOB_LOCAL_RESET_PROCEDURE_LABEL`      | PII가 아닌 reset/restore 절차 label                  |
| `AIRBOB_LOCAL_BACKEND_ORIGIN`             | optional loopback backend-origin override            |
| `AIRBOB_LOCAL_BACKEND_READINESS_PATH`     | optional backend readiness-path override             |
| `AIRBOB_LOCAL_REQUIRED_HEALTH_COMPONENTS` | optional required-health-component override          |
| `AIRBOB_LOCAL_MYSQL_PORT`                 | optional local MySQL readiness-port override         |
| `AIRBOB_LOCAL_REDIS_PORT`                 | optional local Redis readiness-port override         |
| `AIRBOB_LOCAL_CACHE_REDIS_PORT`           | optional local cache-Redis readiness-port override   |
| `AIRBOB_LOCAL_ELASTICSEARCH_PORT`         | optional local Elasticsearch readiness-port override |
| `AIRBOB_LOCAL_KAFKA_PORT`                 | optional local Kafka readiness-port override         |
| `AIRBOB_LOCAL_DEBEZIUM_PORT`              | optional local Debezium readiness-port override      |
| `AIRBOB_LOCAL_SEARCH_DESTINATION`         | disposable search fixture                            |
| `AIRBOB_LOCAL_WISHLIST_ACCOMMODATION_ID`  | wishlist mutation fixture                            |
| `AIRBOB_LOCAL_PAID_FIXTURES`              | 정확히 세 개의 독립적인 paid slot fixture            |
| `AIRBOB_LOCAL_COMPLIMENTARY_FIXTURE`      | accommodation/date를 포함한 complimentary slot       |
| `AIRBOB_LOCAL_COMPLIMENTARY_COUPON_ID`    | backend-owned complimentary coupon                   |
| `AIRBOB_LOCAL_TOSS_SANDBOX_PROFILE`       | explicit Toss sandbox opt-in                         |
| `AIRBOB_LOCAL_TOSS_PROVIDER_PROFILE`      | test-only provider-input attestation                 |
| `AIRBOB_LOCAL_TOSS_SERVER_PROFILE`        | 정확히 `sandbox-configured`인 backend-owned 확인     |
| `AIRBOB_LOCAL_TOSS_FAILURE_PROFILE`       | 정확히 `confirm-test-code-configured`인 실패 확인    |
| `AIRBOB_LOCAL_TOSS_EXPECTED_FAILURE_CODE` | paid[1]에서 기대하는 non-secret backend failure code |
| `REACT_APP_TOSS_CLIENT_KEY`               | Toss sandbox browser-public client key               |
| `AIRBOB_LOCAL_TOSS_CARD_NUMBER`           | runner-only sandbox card input                       |
| `AIRBOB_LOCAL_TOSS_CARD_EXPIRY`           | runner-only sandbox card input                       |
| `AIRBOB_LOCAL_TOSS_CARD_CVC`              | runner-only sandbox card input                       |
| `AIRBOB_LOCAL_TOSS_CARD_PASSWORD`         | runner-only sandbox card input                       |

Local frontend origin은 harness가 고정 소유하며 별도 환경 변수로 받지 않는다. Runner는
card 입력을 browser나 Vite child로 전달하지 않고 spec scope에서만 사용한다. Raw
`AIRBOB_LOCAL_TOSS_SECRET_KEY`와 `TOSS_SECRET_KEY`가 Playwright 환경에 있으면 preflight는
즉시 차단한다. Server credential과 공식 confirm test-code 주입은 backend process만
소유한다. Test-code 동작은
[Toss Payments 테스트 환경 문서](https://docs.tosspayments.com/guides/v2/get-started/environment)를
기준으로 한다. Failure profile은 paid slot 2(`paid[1]`)에만 적용되는 one-shot 또는
slot-scoped 계약이어야 하며 paid slot 3(`paid[2]`)의 success를 오염시키면 안 된다.

### Local 실행과 독립 결과

```bash
npm run test:local:preflight
npm run test:local:core
npm run verify:local:core
npm run test:local:toss
npm run verify:local:toss
npm run verify:local-integration
```

| 결과 이름            | 명령                                                           | Redacted result root                                | 판정 규칙                                            |
| -------------------- | -------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| `local-core`         | `test:local:preflight`, `test:local:core`, `verify:local:core` | `test-results/local-integration/local-core`         | Auth/core API/hold assertion과 redaction을 독립 기록 |
| `local-toss-sandbox` | `test:local:toss`, `verify:local:toss`                         | `test-results/local-integration/local-toss-sandbox` | 같은 run identity의 core assertion PASS 뒤에만 시작  |
| aggregate            | `verify:local-integration`                                     | 위 두 result root를 그대로 분리 유지                | guarded runner가 core→Toss 순서를 한 번만 소유       |

위 package command만 지원한다. Local Playwright config를 직접 호출하는 경로는 runner
identity가 없어 차단된다. Mutation run은 clean committed frontend workspace에서만 시작하며,
Toss 직전에 revision/worktree 상태를 다시 읽어 core 시점과 정확히 같은지 확인한다. Toss
global setup도 동일 run identity, frontend/backend revision의 `local-core` PASS manifest를
독립 확인한다.

각 result root의 mode-`0600` `result.json`은 run identity, frontend/backend revision,
preflight/assertion status, reset label과 cleanup 상태만 보존한다. Fixture, credential,
transaction identifier와 request/response 값은 보존하지 않는다. Assertion이 모두 통과해도
`cleanupStatus=EXTERNAL_RESET_REQUIRED`이면 evidence는 `BLOCKED_UNVERIFIED`다.

자동 preflight는 allowlisted 환경 이름/형식, fresh reset authorization, 서로 겹치지 않는 fixture, frontend/backend
health, dependency port, Elasticsearch accommodation alias와 Debezium connector/task
`RUNNING`을 검사한다. Exact data-ownership attestation이 없으면 command를 실행하지 않고
`BLOCKED / UNVERIFIED`로 기록한다. 실제 reset 책임자와 절차 실행은 여전히 backend owner가
기록한다. Service, fixture slot 또는 messaging readiness가 하나라도 확인되지 않아도 같은
판정이다. `test:local:toss` 자체가 같은 실행에서 core를 먼저 수행한다. Toss
credential/profile이 없거나 matching core assertion이 PASS가 아니면 provider project를
시작하지 않으며 Toss 결과도 PASS나 skip이 아니라 `BLOCKED / UNVERIFIED`다. 각 실행은
[`U12 redacted evidence record`](./2026-09-02-u12-local-integration-evidence.md)에 독립적으로
기록한다.

Local proxy 성공은 same-origin development behavior만 증명한다. Vercel→OCI의 credential,
CORS allowlist, Origin/CSRF rejection, production Maps key/referrer/quota, cross-device recovery,
AWS 성능을 증명하지 않는다.

## Deployment live 실행 전 조건

- 검증할 Git commit과 그 commit-specific Vercel deployment를 고정한다.
- 해당 frontend contract와 호환되는 OCI backend가 reachable 상태여야 한다.
- Vercel에는 OCI API origin, Google Maps browser key, Toss sandbox client key가 올바른
  deployment environment로 설정돼 있어야 한다. 값은 문서·명령 출력·report에 기록하지
  않는다.
- QA 계정과 disposable test data를 out-of-band로 준비한다. 실제 사용자 데이터와 실제
  결제 수단을 사용하지 않는다.
- guest/host reservation detail과 accommodation detail/edit에 사용할 안정적인 fixture를
  준비한다. 식별자는 shell environment에만 두고 echo하거나 commit하지 않는다.
- `GSTACK_BROWSE_BIN`이 실행 가능해야 한다. Search result card를 검증하려면 OCI search
  index에도 전용 fixture가 있어야 한다.

## Deployment live 환경 변수

| 이름                                    | 용도                                 | 규칙                                                            |
| --------------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `AIRBOB_FRONTEND_URL`                   | 검증할 commit-specific Vercel origin | live 실행에서는 반드시 명시하고 query/credential을 넣지 않는다. |
| `AIRBOB_API_BASE_URL`                   | OCI API base                         | `/api/v1` contract를 가리키며 credential을 URL에 넣지 않는다.   |
| `AIRBOB_QA_EMAIL`, `AIRBOB_QA_PASSWORD` | 전용 QA 로그인                       | out-of-band로 주입하고 저장·출력하지 않는다.                    |
| `GSTACK_BROWSE_BIN`                     | browser smoke executable             | absolute executable path                                        |
| `AIRBOB_SMOKE_ACCOMMODATION_ID`         | accommodation detail fixture         | 전용 fixture만 사용                                             |
| `AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID`    | accommodation edit fixture           | 변경·삭제 가능한 전용 fixture만 사용                            |
| `AIRBOB_SMOKE_RESERVATION_UID`          | guest reservation detail fixture     | strict smoke 필수; 기록 금지                                    |
| `AIRBOB_SMOKE_HOST_RESERVATION_UID`     | host reservation detail fixture      | strict smoke 필수; 기록 금지                                    |
| `AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS`    | visible result card 강제             | search fixture가 준비된 실행에서만 `true`                       |
| `AIRBOB_SMOKE_REPORT_ROOT`              | local redacted report 위치 변경      | 필요할 때만 사용                                                |

## Deployment live 실행

먼저 동일 commit의 backend-independent gate를 통과시킨다.

```bash
npm run verify:design-ready
```

필수 값을 현재 shell에 out-of-band로 주입한 뒤 live reachability와 fixture 준비 상태를
확인한다. Preflight는 screenshot/report를 만들지 않지만 frontend와 backend에 실제로
접근한다.

```bash
npm run smoke:frontend:preflight
npm run verify:live-integration
```

Search fixture까지 준비된 실행은 result card를 강제한다.

```bash
AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS=true npm run verify:live-integration
```

`verify:live-integration`은 strict dynamic-route smoke다. 필수 reservation fixture가 없으면
browser를 열기 전에 실패해야 한다. Non-strict `npm run smoke:frontend`가 route를 skip한
결과는 통과 증거가 아니다.

## 자동 route evidence

Strict smoke report에서 desktop과 mobile 각각 다음 route가 skip 없이 확인돼야 한다.

- Home, Search, Wishlist, Recently Viewed, Profile Host Listings
- Accommodation Detail과 Accommodation Edit
- Guest Reservation Detail과 Host Reservation Detail

Search index가 비어 있으면 empty state까지만 검증된다. Result card evidence가 필요하면
`AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS=true`로 다시 실행한다. Report의 `Google Maps API key:
present` 표시는 key 값이나 실제 SDK 동작 증거가 아니므로 아래 수동 확인을 생략할 수 없다.

## 수동 live checklist

### Vercel과 OCI

- [ ] commit-specific Preview URL의 `/`, Search, Wishlist, Profile, detail route를 직접
      refresh해 HTML과 lazy chunk가 정상 load된다.
- [ ] QA login 뒤 refresh와 protected route 이동에서도 cookie session이 유지된다.
- [ ] logout, expired/rejected session, 401 뒤 Header·modal·protected navigation이 같은
      anonymous state로 수렴한다.
- [ ] Search/detail/profile/reservation API가 기존 envelope로 동작하고 CORS 또는 cookie
      warning이 없다.
- [ ] 전용 editor fixture에서 image upload, save, publish ordering을 확인하고 테스트
      변경을 정리한다.
- [ ] 이전 immutable Vercel deployment도 자기 HTML과 hashed chunk를 제공해 rollback
      대상으로 사용할 수 있다.

### Google Maps와 Places

- [ ] Search에서 SDK가 key/referrer 오류 없이 load되고 Places suggestion을 선택할 수 있다.
- [ ] marker 선택, map bounds 변경, list/map state와 browser history가 합의한 결과를 보인다.
- [ ] Search route를 떠난 뒤 obsolete listener, marker, pending result가 다른 route에
      영향을 주지 않는다.
- [ ] desktop과 mobile fallback/error terminal이 빈 화면이나 무한 loading으로 남지 않는다.

### Toss sandbox

- [ ] 전용 reservation으로 sandbox 결제 요청이 한 번만 시작된다.
- [ ] 사용자 cancel과 provider failure가 checkout을 보존하고 안전한 retry를 제공한다.
- [ ] success callback 진입 즉시 URL의 callback credential이 제거되고 confirm POST가
      정확히 한 번만 전송된다.
- [ ] refresh/re-entry와 pending 또는 ambiguous 결과가 추가 결제 요청 없이 status
      reconciliation으로 수렴한다.
- [ ] success/fail terminal이 올바른 reservation detail로 이동하고 exact terminal record만
      정리한다.
- [ ] live SDK에 retired protocol 요청이 없으며 실제 결제 수단이나 production key를
      사용하지 않는다.

## 실패와 증거 기록

각 실행은 다음 항목만 redacted 작업 기록에 남긴다.

- 검증한 frontend/backend commit과 실행 시각
- local이면 `local-core`와 `local-toss-sandbox` 각각의 명령, exit status와
  `PASS`/`FAIL`/`BLOCKED / UNVERIFIED` 판정
- local이면 backend reset/disposable 책임자와 messaging readiness 확인 여부. 사람 이름,
  내부 URL이나 credential이 아니라 승인된 owner label과 redacted 절차 참조만 기록
- deployment live이면 Vercel deployment label과 `verify:design-ready`, preflight,
  `verify:live-integration` exit status
- generated smoke report의 local redacted path
- failed step, console error category, network failed request의 method/status/path
- Maps와 Toss sandbox checklist의 PASS/FAIL/DEFERRED

다음 값은 report, screenshot 이름, issue, commit, 채팅에 남기지 않는다.

- QA email/password, cookie, auth state, Maps/Toss key
- reservation/accommodation 식별자
- payment key, order identifier, callback query 또는 callback 전체 URL
- 실제 사용자 PII, request/response body, HAR, trace, video, download, raw browser storage
- payment callback, credential-bearing URL 또는 provider 화면 screenshot

Console error, API failure, skipped dynamic route, credential redaction 실패가 하나라도 있으면
해당 gate는 실패다. Local 전제조건이 없으면 `BLOCKED / UNVERIFIED`, deployment 외부
환경이 준비되지 않았으면 `DEFERRED / UNVERIFIED`를 유지한다. 둘 다 skip이나 pass로
기록하지 않는다.
