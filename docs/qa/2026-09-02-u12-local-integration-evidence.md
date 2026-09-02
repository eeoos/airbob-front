# U12 Local Integration Status and Redacted Evidence

> Overall mutation profile: **BLOCKED / UNVERIFIED**
> Local-benchmark read-only subset: **PASS**
> Local core: **BLOCKED / UNVERIFIED**
> Local Toss sandbox: **BLOCKED / UNVERIFIED**
>
> 이 문서는 상태 기록과 다음 실행의 복사 가능한 redacted template이다. Environment
> variable은 이름과 present/missing 판정만 기록하고 값을 기록하지 않는다.

## Current prerequisite status

| Prerequisite                         | Status                | Evidence boundary                                                                                                     |
| ------------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Major local data                     | PARTIAL READY         | 803,008 members와 170,201 published accommodations의 aggregate를 읽기 전용으로 확인; U12 booking fixture는 아님       |
| Read-only runtime reachability       | PASS (read-only only) | frontend `localhost:3000`, local-benchmark backend readiness `UP`, MySQL/Redis/Kafka/Elasticsearch/Debezium reachable |
| Backend-owned disposable/reset owner | PARTIAL               | 사용자가 전용 local reset ownership을 확인했지만 business fixture reset/restore procedure는 backend에 없음            |
| Paid slots 1–3                       | BLOCKED / UNVERIFIED  | inventory row가 0이므로 availability, quote와 checkout용 독립 slot을 구성할 수 없음                                   |
| Complimentary slot                   | BLOCKED / UNVERIFIED  | inventory row와 active coupon이 모두 0이므로 0원 quote 조건을 구성할 수 없음                                          |
| Full messaging terminal              | BLOCKED / UNVERIFIED  | connector와 task는 `no_data`/`RUNNING`이지만 mutation terminal은 실행하지 않음                                        |
| Toss sandbox                         | BLOCKED / UNVERIFIED  | local-benchmark가 Toss를 비활성화하며 matching core PASS가 없음                                                       |
| Toss failure discriminator           | BLOCKED / UNVERIFIED  | backend가 `TossPayments-Test-Code` 또는 동등한 slot-scoped failure injection을 지원하지 않음                          |

이 상태는 skip이나 pass가 아니다. 자동 preflight와 backend-owner attestation이 각자의
전제조건을 검증하기 전에는 mutation을 보내지 않는다.

## 2026-09-02 actual local-benchmark audit

사용자가 reset ownership을 확인한 뒤에도 새 `dev`-only process는 실행하지 않았다. 기존 IntelliJ
process가 정확히 `local-benchmark`, `dev`, `performance-lab`,
`local-benchmark-runtime` group으로 실행 중임을 확인했고 일반 health와 readiness는 모두
`UP`이었다. 이 profile은 Flyway, 전체 scheduler, inventory startup/seed/retention, Toss,
Google server integration, Slack과 S3 write를 비활성화한다.

- Backend HEAD: `3d0ae2d65ae650d6eb9d9def7d6daeffa98a6e0a`
- Backend runtime-tree fingerprint: `e0ca06f59e962ca3ed6c94ed8ce61d18923ccb87a0a611435d47854e7589cb23`
- Backend worktree: dirty; 위 fingerprint는 local-benchmark runtime 관련 tracked diff와
  untracked runtime/test file을 포함하므로 HEAD만으로 재현됐다고 주장하지 않는다.
- Elasticsearch `accommodations` alias: present
- Debezium connector: `snapshot.mode=no_data`, connector와 task 모두 `RUNNING`
- Published accommodations: `170,201`
- Members: `803,008`
- `accommodation_inventory_day`: `0`
- Future available inventory: `0`
- Active coupons: `0`

Mutation 없이 실제 browser에서 다음 read-only subset을 확인했다.

- 원본 checkout의 browser-public `.env`를 file 복사나 값 출력 없이 Vite process에 주입했다.
  Worktree에는 ignored `.env`가 복사되지 않으므로 API URL만 있는 `.env.development`로는
  Google Maps가 활성화되지 않는다.
- Google Maps referrer와 일치하는 `http://localhost:3000`에서 Busan 검색 결과
  `1,000개 이상`, listing image/fallback, pagination, 지도와 price marker를 확인했다.
- 검색 결과의 public accommodation detail을 열어 hero, 핵심 정보, host, amenities, reviews와
  location map을 확인했다.
- Inventory가 없는 local-benchmark에서 availability는 fail-closed 상태와 retry action을
  표시하고, detail content와 disabled booking entry를 보존했다.
- 허용되지 않은 `127.0.0.1` referrer에서는 Google provider error가 발생해도 검색 결과를
  보존하고 지도 영역만 실패 상태로 유지한다. Partial SDK listener cleanup crash는 frontend
  commit `607a95f`에서 수정했다.

검증 결과:

- Map cleanup regression tests: `3 passed`
- Frontend unit/integration: `2,560 passed` across `292` files
- Affected deterministic browser suite: `32 passed`
- Live normal Maps path: PASS, console errors `0`
- Live provider-failure recovery: PASS; provider error는 관찰됐고 application cleanup error와
  global error boundary는 재발하지 않음

실제 U12 mutation runner는 실행하지 않았다. `local-benchmark` 문서와 데이터 상태가
availability/quote/checkout 실행을 금지하고, runner가 요구하는 QA credential 및 paid/
complimentary fixture attestation을 충족하지 못하기 때문이다. 이 판정은 read-only subset
PASS와 별개인 `BLOCKED / UNVERIFIED`다.

## Mutation authority

- Mutation profile은 `AIRBOB_LOCAL_MUTATION_PROFILE=disposable`일 때만 활성화한다.
- Data ownership profile은 정확히
  `AIRBOB_LOCAL_DATA_OWNERSHIP_PROFILE=backend-owned-disposable`이어야 한다.
- Backend Git revision, 15분 이내 reset 승인 시각, exact
  `backend-local-owner`와 PII-free procedure slug를 같은 실행에 묶는다. 오래됐거나 미래인
  승인 시각과 unsafe label은 preflight에서 차단한다.
- Backend owner가 QA identity, accommodation, inventory, coupon, reservation, operation을
  disposable로 승인하고 reset/cleanup 책임을 가진다.
- 이 ownership은 자동 preflight가 추론하지 않는다. Backend owner의 out-of-band attestation과
  redacted owner/procedure label이 없으면 실행 전에 `BLOCKED / UNVERIFIED`로 판정한다.
- Frontend runner는 DB 직접 seed/reset, backend test SQL 호출, 임의 fixture 생성 또는
  기존 demo/user data 변경을 하지 않는다.
- 실패 후에는 이미 받은 reservation/operation identifier로 진단한다. 새 idempotency key나
  새 checkout을 만들어 실패를 덮지 않는다.
- Messaging dependency가 port-open 상태여도 end-to-end terminal readiness가 확인되지
  않으면 `BLOCKED / UNVERIFIED`다.

## Canonical environment names

실행 기록에는 각 이름의 `present`/`missing`만 표시한다. 값, 길이, prefix, hash와 일부
masking 문자열도 남기지 않는다.

### Shared and local-core

- `AIRBOB_QA_EMAIL`
- `AIRBOB_QA_PASSWORD`
- `AIRBOB_LOCAL_MUTATION_PROFILE`
- `AIRBOB_LOCAL_DATA_OWNERSHIP_PROFILE`
- `AIRBOB_LOCAL_BACKEND_REVISION`
- `AIRBOB_LOCAL_RESET_AUTHORIZED_AT`
- `AIRBOB_LOCAL_RESET_OWNER_LABEL`
- `AIRBOB_LOCAL_RESET_PROCEDURE_LABEL`
- `AIRBOB_LOCAL_BACKEND_ORIGIN`
- `AIRBOB_LOCAL_BACKEND_READINESS_PATH`
- `AIRBOB_LOCAL_REQUIRED_HEALTH_COMPONENTS`
- `AIRBOB_LOCAL_MYSQL_PORT`
- `AIRBOB_LOCAL_REDIS_PORT`
- `AIRBOB_LOCAL_CACHE_REDIS_PORT`
- `AIRBOB_LOCAL_ELASTICSEARCH_PORT`
- `AIRBOB_LOCAL_KAFKA_PORT`
- `AIRBOB_LOCAL_DEBEZIUM_PORT`
- `AIRBOB_LOCAL_SEARCH_DESTINATION`
- `AIRBOB_LOCAL_WISHLIST_ACCOMMODATION_ID`
- `AIRBOB_LOCAL_PAID_FIXTURES`
- `AIRBOB_LOCAL_COMPLIMENTARY_FIXTURE`
- `AIRBOB_LOCAL_COMPLIMENTARY_COUPON_ID`

### Local Toss sandbox

- `AIRBOB_LOCAL_TOSS_SANDBOX_PROFILE`
- `AIRBOB_LOCAL_TOSS_PROVIDER_PROFILE`
- `AIRBOB_LOCAL_TOSS_SERVER_PROFILE`
- `AIRBOB_LOCAL_TOSS_FAILURE_PROFILE`
- `AIRBOB_LOCAL_TOSS_EXPECTED_FAILURE_CODE`
- `REACT_APP_TOSS_CLIENT_KEY`
- `AIRBOB_LOCAL_TOSS_CARD_NUMBER`
- `AIRBOB_LOCAL_TOSS_CARD_EXPIRY`
- `AIRBOB_LOCAL_TOSS_CARD_CVC`
- `AIRBOB_LOCAL_TOSS_CARD_PASSWORD`

Runner는 card 입력을 spec scope에서만 읽고 browser나 Vite child에 전달하지 않는다. Raw
`AIRBOB_LOCAL_TOSS_SECRET_KEY`와 `TOSS_SECRET_KEY`는 Playwright 환경에서 금지한다. Backend
process가 server credential과 slot-scoped confirm-failure 주입을 별도로 관리한다. 어느
값도 이 기록이나 artifact에 복사하지 않는다.

## Execution order and distinct results

### 1. Preflight

```bash
npm run test:local:preflight
```

자동 preflight는 allowlisted 환경 이름/형식, frontend/backend health, dependency port,
Elasticsearch accommodation alias와 Debezium connector/task 상태를 확인한다.
`AIRBOB_LOCAL_PAID_FIXTURES`의 세 paid slot과
`AIRBOB_LOCAL_COMPLIMENTARY_FIXTURE`가 같은 숙소에서 겹치지 않는지도 값 출력 없이
검사한다. Exact ownership attestation 또는 backend reset 절차가 없으면 이후 command를
실행하지 않는다.

### 2. Local core result

```bash
npm run test:local:core
npm run verify:local:core
```

Result label: `local-core`

Redacted result root: `test-results/local-integration/local-core`

### 3. Local Toss sandbox result

이 명령이 새 run identity를 만들고 local core를 먼저 실행한다. Matching core assertion이
PASS인 경우에만 provider project를 시작한다. Runner는 Toss 직전에 clean frontend
revision/worktree 상태를 다시 확인하며 core 이후 drift가 있으면 provider를 시작하지 않는다.

```bash
npm run test:local:toss
npm run verify:local:toss
```

Result label: `local-toss-sandbox`

Redacted result root: `test-results/local-integration/local-toss-sandbox`

Package command가 아닌 local Playwright config 직접 실행은 지원하지 않는다. Browser
global setup은 runner UUID/project identity와 현재 frontend/backend revision에 맞는 same-run
core PASS manifest가 없으면 mutation 전에 차단한다.

### 4. Aggregate runner

```bash
npm run verify:local-integration
```

Aggregate는 두 profile을 순서대로 실행하지만 `local-core`와
`local-toss-sandbox`의 report/status를 합치지 않는다.

각 root의 mode-`0600` `result.json`은 assertion과 evidence를 분리한다.
`assertionStatus=PASS`는 해당 browser 시나리오가 통과했다는 뜻일 뿐이다. Backend owner가
외부 reset을 완료하기 전에는 `evidenceStatus=BLOCKED_UNVERIFIED`,
`cleanupStatus=EXTERNAL_RESET_REQUIRED`를 유지한다.

## Per-run redacted template

### Run identity

- Frontend commit: `[record commit only]`
- Backend commit/profile label: `[result.json의 non-secret revision/label]`
- Started/finished at: `[record timestamps]`
- Backend reset/disposable owner label: `[record approved role or procedure reference]`
- Mutation opt-in: `[present and exact disposable value verified / missing]`
- Run manifest: `[local-core/result.json and local-toss-sandbox/result.json]`
- Preflight result: `[PASS / FAIL / BLOCKED_UNVERIFIED]`
- Preflight exit status: `[record integer only]`

### Environment presence

- Required shared/local-core names: `[all present / list missing names only]`
- Optional readiness overrides: `[list configured names only / none]`
- Local Toss sandbox names: `[all present / list missing names only / not evaluated]`
- Backend-owned Toss server credential: `[presence verified by backend owner / missing / not evaluated]`
- Values printed or persisted: `[must be no]`

### `local-core`

- Command exit statuses: `[record integers only]`
- Result: `[PASS / FAIL / BLOCKED / UNVERIFIED]`
- Redacted report path: `[local path without identifiers]`
- [ ] Cookie session works through the Vite `/api` proxy.
- [ ] Search, wishlist mutation, detail and availability use disposable data.
- [ ] Paid slot 1 proves quote, checkout and exact idempotent checkout replay.
- [ ] Paid slot 2 proves payment-attempt replay and explicit hold release.
- [ ] Paid slot 3 remains independent for the later Toss success scenario.
- [ ] Complimentary slot proves a 0원 checkout with zero Toss/payment-attempt traffic.
- [ ] Logout revokes the cookie session and browser storage contains no auth credential.
- [ ] Reset/cleanup was completed by the backend owner.

### `local-toss-sandbox`

- Command exit statuses: `[record integers only]`
- Result: `[PASS / FAIL / BLOCKED / UNVERIFIED]`
- Redacted report path: `[local path without identifiers]`
- [ ] `local-core` PASS is referenced.
- [ ] Sandbox client key and backend-owned server-profile presence are verified without output.
- [ ] Two cancel/retry cycles reuse one frontend payment attempt, then release the hold.
- [ ] Slot-scoped official confirm failure reaches the scrubbed FAILED operation UI.
- [ ] Success callback is scrubbed before child UI and confirm is sent exactly once.
- [ ] Confirm receipt and polling reach the backend-authoritative terminal.
- [ ] Async operation reaches a bounded terminal through the full messaging path.
- [ ] Reload/re-entry reuses the existing attempt and does not start a new payment.
- [ ] Reset/cleanup was completed by the backend owner.

### Failure record

Record only:

- result label, failed step and exit status
- error category and sanitized method/status/path
- existing reservation/operation reference category, never its value
- whether messaging was nonterminal, unavailable or timed out
- whether retry reused the same logical operation
- cleanup/reset status and backend owner label

Missing prerequisites are `BLOCKED / UNVERIFIED`. An assertion, contract, redaction or cleanup
failure after execution starts is `FAIL`. Only every required assertion plus artifact scan and
backend-owned cleanup can produce `PASS`.

## Artifact prohibition

Do not create, retain, attach or commit:

- QA email/password, cookie, token or serialized auth/browser storage
- accommodation, coupon, reservation, payment-attempt, order or operation values
- Toss client/server key, payment key, callback query or callback URL
- actual user PII or request/response bodies
- HAR, Playwright trace/video, downloads or raw console/network dumps
- provider, payment callback or credential-bearing screenshots
- report/screenshot filenames containing any fixture or transaction identifier

Permitted evidence is limited to redacted report paths, exit statuses, scenario status, sanitized
method/status/path, timestamps and non-secret revision/profile/owner labels. Artifact policy failure
is a test failure, never a reason to retain the unsafe artifact.

## Claims this profile cannot make

A passing local profile proves only the local Vite proxy plus the local backend/messaging and,
separately, Toss sandbox paths it exercised. It does not prove:

- Vercel→OCI credentialed CORS or cookie behavior
- allowed Origin handling, arbitrary-Origin rejection or CSRF protection
- production Google Maps/Places key, referrer, quota or interaction
- cross-device or cross-browser transaction recovery
- AWS latency, throughput, scaling or deployment stability

Those remain separate deployment/security/performance evidence gates.
