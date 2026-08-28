<h1 align="center">$\bf{\large{\color{#6580DD} Codesquad \ - \ Airbob \ Frontend}}$</h1>

## Frontend Setup

Use Node.js 20.12+, Node.js 22, or Node.js 24. Odd-numbered Node releases
are outside the supported toolchain range.

```bash
npm install
npm run typecheck
npm run test:ci:no-cache
npm run build
```

Install the deterministic browser once before the local Playwright suite:

```bash
npx playwright install chromium
```

Required environment variables:

- `REACT_APP_API_URL`
- `REACT_APP_GOOGLE_MAPS_API_KEY`
- `REACT_APP_TOSS_CLIENT_KEY`
- `REACT_APP_CLOUDFRONT_DOMAIN`

Local development expects the backend API to be reachable through the CRA proxy at `http://localhost:8080`.

## Verification Gates

Use these commands before broad visual redesign work:

```bash
npm run verify:pre-redesign
npm run verify:structure
npm run verify:architecture
npm run report:architecture
npm run test:e2e:artifact-policy
npm run typecheck:e2e
npm run test:e2e:characterization
npm run lint:e2e
npm run smoke:frontend:preflight
npm run verify:design-ready
```

- `verify:pre-redesign`: typecheck, no-cache Jest in band, and production build.
- `verify:structure`: typecheck, no-cache Jest in band, strict ESLint, and the
  architecture/reachability/style ratchets.
- `verify:architecture`: runs forbidden-rule fixtures, the production
  dependency graph, monotonic migration-registry checks, target-only dead-code
  enforcement, new-unused-dependency prevention, and strict style policy.
- `report:architecture`: prints the measured legacy dead-code and CSS debt
  without turning it into permanent suppressions.
- `test:e2e:characterization`: builds and serves a loopback-only production
  variant, then runs the synthetic Playwright flow matrix without a live backend.
- `test:e2e:artifact-policy`, `typecheck:e2e`, and `lint:e2e`: enforce the
  browser harness privacy, type, and lint contracts.
- `smoke:frontend:preflight`: validates smoke env names, dynamic route fixture IDs, browser binary path, frontend URL, and backend reachability without screenshots.
- `verify:design-ready`: runs `verify:pre-redesign` and strict browser smoke.

### Frontend Architecture

현재 운영 구조의 기준 문서는
[`docs/architecture/current-frontend-architecture.md`](docs/architecture/current-frontend-architecture.md)입니다.
단계적 구조 전환은 아래 문서를 함께 사용합니다.

- [migration rules](docs/architecture/frontend-migration-rules.md)
- [ownership matrix](docs/architecture/frontend-ownership-matrix.md)
- [browser data inventory](docs/architecture/frontend-browser-data-inventory.md)
- [executable architecture ratchets](tests/architecture/dependency-rules.md)
- [active overhaul plan](docs/plans/2026-08-29-001-refactor-frontend-architecture-overhaul-plan.md)

기존 [architecture freeze](docs/architecture/frontend-architecture-freeze.ko.md)와
[structure refactor report](docs/architecture/frontend-structure-refactor.md)는 2026년 7월 작업의
역사 기록이며 현재 구조 판단이나 새 리팩토링의 완료 기준으로 사용하지 않습니다.

```bash
npm run verify:structure
npm run test:ci:no-cache -- --runInBand src/verification-gate.test.ts
```

브라우저 기반 smoke까지 확인하려면 QA 계정, 안정적인 reservation UID, 프론트/백엔드 서버, `GSTACK_BROWSE_BIN`을 준비한 뒤 실행합니다.

```bash
npm run verify:design-ready
```

Required smoke environment variables:

- `AIRBOB_QA_EMAIL`
- `AIRBOB_QA_PASSWORD`
- `GSTACK_BROWSE_BIN`
- `AIRBOB_SMOKE_ACCOMMODATION_ID`
- `AIRBOB_SMOKE_EDIT_ACCOMMODATION_ID`
- `AIRBOB_SMOKE_RESERVATION_UID`
- `AIRBOB_SMOKE_HOST_RESERVATION_UID`

Optional smoke configuration:

- `AIRBOB_FRONTEND_URL` defaults to `http://localhost:3000`
- `AIRBOB_API_BASE_URL` defaults to `http://localhost:8080`
- `AIRBOB_SMOKE_REPORT_ROOT` defaults to `.gstack/qa-reports`
- `AIRBOB_SMOKE_EXPECT_SEARCH_RESULTS=true` requires a visible search result card

날짜가 적힌 기존 smoke 결과는 당시 실행 증거일 뿐 현재 통과 상태를 보장하지 않습니다.
동적 fixture나 외부 실행 환경이 없어 skip된 경로도 검증 완료로 간주하지 않습니다.
