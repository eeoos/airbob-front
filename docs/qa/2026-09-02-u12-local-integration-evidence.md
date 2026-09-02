# U12 Local Integration Status and Redacted Evidence

> Overall: **BLOCKED / UNVERIFIED**
> Local core: **BLOCKED / UNVERIFIED**
> Local Toss sandbox: **BLOCKED / UNVERIFIED**
>
> 이 문서는 상태 기록과 다음 실행의 복사 가능한 redacted template이다. Environment
> variable은 이름과 present/missing 판정만 기록하고 값을 기록하지 않는다.

## Current prerequisite status

| Prerequisite                         | Status               | Evidence boundary                                                     |
| ------------------------------------ | -------------------- | --------------------------------------------------------------------- |
| Major local data                     | readiness signaled   | 사용자가 주요 data 준비를 알림; fixture 값은 수집하거나 기록하지 않음 |
| Frontend/backend/messaging services  | BLOCKED / UNVERIFIED | 현재 service가 꺼져 있어 reachability/readiness 미검증                |
| Backend-owned disposable/reset owner | BLOCKED / UNVERIFIED | owner와 reset/cleanup 절차를 아직 확인하지 않음                       |
| Paid slots 1–3                       | BLOCKED / UNVERIFIED | 세 slot의 독립성, availability와 paid quote 조건 미검증               |
| Complimentary slot                   | BLOCKED / UNVERIFIED | accommodation/date/coupon의 0원 quote 조건 미검증                     |
| Full messaging terminal              | BLOCKED / UNVERIFIED | backend-owned messaging path의 bounded terminal 미검증                |
| Toss sandbox                         | BLOCKED / UNVERIFIED | local core와 credential ownership 미검증; provider flow 미실행        |
| Toss failure discriminator           | BLOCKED / UNVERIFIED | paid[1] 공식 test-code 주입을 구분하는 backend 증거 미검증            |

이 상태는 skip이나 pass가 아니다. 자동 preflight와 backend-owner attestation이 각자의
전제조건을 검증하기 전에는 mutation을 보내지 않는다.

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
