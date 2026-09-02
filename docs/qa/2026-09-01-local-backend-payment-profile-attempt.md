# Local Backend Booking/Payment Profile Attempt

> 판정: **BLOCKED / UNVERIFIED**
> Frontend 기준: v2 owner switch `bf78544`, verification checkpoint `ac50110`
> Read-only backend 기준: `b2ec09a3cdc8cf86877edf5f222c6a5cd6c2afd1`

## 2026-09-02 재개 상태

사용자가 주요 local data가 준비됐다고 알렸다. 따라서 이 문서가 2026-09-01에 확인한
"공개 fixture/reset 계약을 찾지 못함"은 당시 attempt의 사실이며, 현재 data 부재를
주장하는 근거로 사용하지 않는다. 다만 현재 service는 꺼져 있고 backend-owned
disposable/reset 소유권, paid slot 1–3, complimentary slot과 full messaging readiness를
자동 preflight와 별도 owner attestation으로 확인하지 않았다. 실제 mutation이나 Toss
sandbox 실행도 아직 없다.

그러므로 판정은 **BLOCKED / UNVERIFIED**를 유지한다. 후속 실행과 redacted 증거는
[`2026-09-02 U12 local-integration evidence`](./2026-09-02-u12-local-integration-evidence.md)가
소유한다. Local core와 local Toss sandbox는 서로 다른 명령과 결과로 기록하며, 어느
한쪽도 다른 쪽의 pass를 대신하지 않는다.

## 시도한 범위

U12 사전조건에 따라 실제 mutation을 보내기 전에 backend가 소유하는 반복 가능한
fixture/reset 또는 per-run unique resource 계약이 있는지 읽기 전용으로 확인했다. 확인
대상은 backend README, application profile, Flyway migration, main-source startup runner,
예약·결제 API와 Docker Compose의 현재 실행 상태다. Backend 파일, DB, 설정과 기존
untracked `docs/ideation/`은 수정하거나 정리하지 않았다.

## 확인된 사실

- Backend README는 `docker compose up -d`와 `./gradlew bootRun` 실행 절차를 제공한다.
- README의 `test@test.com` 계정은 배포된 Demo 설명이다. 빈 local schema에 이 계정,
  host, published accommodation, paid/complimentary quote 조건과 coupon을 만드는 main-source
  fixture 계약은 찾지 못했다.
- Flyway는 schema를 소유하지만 product fixture를 seed하지 않는다. Inventory startup은
  이미 존재하는 published accommodation의 날짜 row를 준비할 뿐, 예약 가능한 숙소나
  guest/host identity를 만들지 않는다.
- Frontend가 안전하게 호출할 수 있는 fixture/reset endpoint나 per-run unique-resource
  bootstrap 계약은 없다. 테스트 소스의 직접 SQL fixture는 production/local profile의
  공개 계약이 아니므로 재사용하지 않는다.
- 읽기 전용 `docker compose ps` 결과 현재 Airbob Compose service는 실행 중이 아니었고,
  `8080` backend와 frontend dev port listener도 없었다.
- Toss server key와 sandbox browser key의 존재 여부는 출력하거나 추정하지 않았다.

## 왜 실행을 중단했는가

실제 quote/checkout/payment-attempt/hold-release는 inventory, coupon과 예약 상태를
변경한다. 소유자가 명시된 disposable fixture나 reset 없이 Demo/기존 데이터를 사용하면
반복 실행할 수 없고 다른 사용자의 상태를 훼손할 수 있다. Frontend 도구가 DB를 직접
seed/cleanup하거나 backend 전용 테스트 SQL을 호출하는 것도 이 작업의 read-only backend
경계를 위반한다. 따라서 infrastructure를 임의로 기동하거나 mutation을 보내지 않았다.

이 결과는 local integration pass가 아니다. Deterministic Playwright와 contract/unit gate가
계속 blocking evidence이며, 실제 local core와 Toss sandbox는 각각 미검증 상태다. OCI,
Vercel, production Maps와 실제 결제는 이 판정에 포함되지 않는다.

## 재개 조건

다음 항목을 backend-owner attestation과 자동 preflight가 각각 실제로 확인한 뒤 별도
local profile을 실행한다.

1. 실행마다 격리되는 guest/host와 published accommodation 또는 명시적 reset owner
2. paid CARD/KRW 100원 이상과 complimentary 0원 quote를 만드는 안정적 조건
3. coupon, inventory와 async Kafka/Debezium/payment-operation 경로의 readiness 판정
4. reservation/operation identifier만으로 실패를 재진단하고 cleanup owner를 검증하는 절차
5. Toss sandbox client/server credential을 값 노출 없이 검사하는 guarded preflight

Mutation은 `AIRBOB_LOCAL_MUTATION_PROFILE=disposable`과
`AIRBOB_LOCAL_DATA_OWNERSHIP_PROFILE=backend-owned-disposable`을 함께 명시한 경우에만
허용하고, fresh reset authorization과 non-secret backend revision/owner/procedure label을
같은 run identity에 묶는다. 이 기계적 label은 backend owner의 실제 reset 책임을 대신하지
않으며 post-run cleanup 전 result는 `BLOCKED_UNVERIFIED`를 유지한다. Toss server key는
backend process만 소유하며 Playwright runner는 raw key를 읽지 않고 non-secret
server-profile attestation만 검사한다.
Core API/messaging은 `npm run verify:local:core`, Toss sandbox는 core PASS 뒤
`npm run verify:local:toss`로 서로 다른 Playwright project와 결과에 기록한다. 외부
callback credential, cookie, payment key, 식별자, 실제 사용자 PII, request/response body,
HAR, trace, video 또는 credential-bearing screenshot은 artifact에 남기지 않는다.

Local Vite proxy 결과는 Vercel→OCI credential/CORS/Origin/CSRF, production Maps,
cross-device recovery 또는 AWS performance를 증명하지 않는다.
