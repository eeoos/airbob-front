# Local Backend Booking/Payment Profile Attempt

> 판정: **BLOCKED / UNVERIFIED**
> Frontend 기준: v2 owner switch `bf78544`, verification checkpoint `ac50110`
> Read-only backend 기준: `b2ec09a3cdc8cf86877edf5f222c6a5cd6c2afd1`

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

Backend가 다음을 공개 계약으로 제공한 뒤 별도 local profile을 실행한다.

1. 실행마다 격리되는 guest/host와 published accommodation 또는 명시적 reset owner
2. paid CARD/KRW 100원 이상과 complimentary 0원 quote를 만드는 안정적 조건
3. coupon, inventory와 async Kafka/Debezium/payment-operation 경로의 readiness 판정
4. reservation/operation identifier만으로 실패를 재진단하고 cleanup owner를 검증하는 절차
5. Toss sandbox client/server credential을 값 노출 없이 검사하는 guarded preflight

그때 core API/messaging과 Toss sandbox를 서로 다른 Playwright project와 결과로 기록하고,
외부 callback credential, cookie, payment key, 실제 사용자 PII를 artifact에 남기지 않는다.
