<h1 align="center">$\bf{\large{\color{#6580DD} Codesquad \ - \ Airbob \ Frontend}}$</h1>

## Frontend Setup

```bash
npm install
npm run typecheck
npm run test:ci:no-cache
npm run build
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
npm run smoke:frontend:preflight
npm run verify:design-ready
```

- `verify:pre-redesign`: typecheck, no-cache Jest in band, and production build.
- `verify:structure`: typecheck, no-cache Jest in band, and `lint:strict`.
- `smoke:frontend:preflight`: validates smoke env names, dynamic route fixture IDs, browser binary path, frontend URL, and backend reachability without screenshots.
- `verify:design-ready`: runs `verify:pre-redesign` and strict browser smoke.

### Frontend Architecture Freeze

구조 리팩토링 종료 기준은 `docs/architecture/frontend-architecture-freeze.ko.md`에 기록되어 있습니다.

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
