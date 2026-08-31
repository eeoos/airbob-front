<h1 align="center">$\bf{\large{\color{#6580DD} Codesquad \ - \ Airbob \ Frontend}}$</h1>

## Frontend Setup

Use Node.js 22.13+ on the Node 22 line, or Node.js 24. CI uses Node.js 22;
other major versions are outside the supported Vite toolchain range.

The browser build targets Vite 8's pinned `baseline-widely-available` set
(Chrome/Edge 111, Firefox 114, Safari/iOS 16.4). The retired CRA Browserslist
query is not used to imply a legacy bundle that Vite does not produce.

TypeScript 5.9 owns four explicit environments: browser application source,
Vitest source, Vite/Vitest configuration, and Playwright. The browser project
does not receive Node globals. Exact optional properties, unchecked indexed
access, type-only module syntax, side-effect import checking, and erasable-only
syntax are blocking compiler contracts.

ESLint 9 uses one native flat config with separate browser, Vitest, Playwright,
and Node-tool environments. React, Hooks, accessibility, Testing Library,
jest-dom, and Playwright feedback is blocking without CRA/Jest presets. ESLint
owns local code and capability-import feedback only; dependency-cruiser, Knip,
and Stylelint remain the sole graph, reachability, and CSS-policy owners.

Prettier 3.9 and EditorConfig own mechanical layout for active source, tests,
configuration, and compact current documentation. Three paragraph-heavy
architecture registries remain hand-maintained so a cell edit does not rewrite
an entire wide table row. Generated artifacts, npm's lockfile, local tool state,
binary assets, and archived plans retain their existing owners.

```bash
npm install
npm run typecheck
npm run test:ci:no-cache
npm run build
```

Start the Vite development server with `npm run dev`. Use `npm run preview`
to inspect an existing production build.

Install the deterministic browser once before the local Playwright suite:

```bash
npx playwright install chromium
```

Browser-public application runtime inputs:

- `REACT_APP_API_URL` — required for production builds
- `REACT_APP_GOOGLE_MAPS_API_KEY` — optional; map/Places UI uses its fallback state when absent
- `REACT_APP_TOSS_CLIENT_KEY` — optional until checkout is used
- `REACT_APP_CLOUDFRONT_DOMAIN` — optional; the current public asset host is the default

Vite consumes `PUBLIC_URL` only as the validated build asset base. It is not a
fifth application runtime config value. Leave it missing/empty for the default
root, or use either a
single-slash root-relative path such as `/airbob/assets` or an absolute HTTPS
URL with an optional path. Dot-relative/protocol-relative paths, HTTP/data/blob
URLs, credentials, query strings, fragments, surrounding whitespace,
percent-encoded path characters, and HTML-unsafe characters fail before
compilation.

Local development expects the backend API to be reachable through the Vite
`/api` proxy at `http://localhost:8080`.
Production builds fail closed unless `REACT_APP_API_URL` is an explicit HTTPS
origin with no credentials, path, query, or fragment. The deterministic CI
build uses a synthetic `.invalid` origin; deployment must provide the real
public API origin.
`REACT_APP_TOSS_CLIENT_KEY`, when configured, must use the browser-public
`test_ck_` or `live_ck_` category. `REACT_APP_CLOUDFRONT_DOMAIN` must likewise
be an HTTPS host with no credentials, non-default port, path, query, or fragment.
A server-secret `test_sk_` or `live_sk_` value in any of the four application
runtime slots or in `PUBLIC_URL` fails before the production compiler runs.
Percent encoding is rejected in every browser-public input so a reversible
encoding cannot hide a server-key category. The optional Google Maps key also
accepts only browser-key-safe letters, digits, `_`, and `-`.

## Verification Gates

Use these commands before broad visual redesign work:

```bash
npm run verify:pre-redesign
npm run verify:structure
npm run verify:architecture
npm run format:check
npm run report:architecture
npm run test:public-config-build
npm run test:e2e:artifact-policy
npm run typecheck:e2e
npm run test:e2e:characterization
npm run lint:e2e
npm run smoke:frontend:preflight
npm run verify:design-ready
```

- `verify:pre-redesign`: typecheck, deterministic single-worker Vitest, and production build.
- `verify:structure`: typecheck, deterministic single-worker Vitest, strict ESLint, the
  architecture/reachability/style ratchets, and a hostile-environment
  production build that proves only the four approved app-runtime public
  config categories plus a validated `PUBLIC_URL` asset base can enter built
  source.
- `verify:architecture`: runs forbidden-rule fixtures, the production
  dependency graph, monotonic migration-registry checks, target-only dead-code
  enforcement, full development and strict production dependency
  classification, strict style policy, and formatting drift detection.
- `report:architecture`: prints the measured legacy dead-code and CSS debt
  without turning it into permanent suppressions.
- `test:public-config-build`: injects synthetic password, secret, cookie, token,
  private-key, and unknown-env canaries into a temporary production build and
  fails if any forbidden value reaches generated text assets. It also runs the
  real production build entry point against rejected `PUBLIC_URL` forms and
  proves accepted root-relative and HTTPS-path asset bases.
- `test:e2e:characterization`: builds and serves a loopback-only production
  variant, then runs the synthetic Playwright flow matrix without a live backend.
- `test:e2e:artifact-policy`, `typecheck:e2e`, and `lint:e2e`: enforce the
  browser harness privacy, type, and lint contracts.
- `typecheck` checks browser and Vitest ownership; `typecheck:tooling` checks
  the TypeScript Vite/Vitest configuration without leaking Node types into the
  application project.
- `smoke:frontend:preflight`: validates smoke env names, dynamic route fixture IDs, browser binary path, frontend URL, and backend reachability without screenshots.
- `verify:design-ready`: runs `verify:pre-redesign` and strict browser smoke.

## Vite and Vercel deployment

Vite is the only build/dev owner (`dev`, `build`, and `preview`) and
keeps the production output at `build/` with production JavaScript source maps,
development CSS source maps, and hashed files under `build/static/`.
Vitest 4 is the sole unit/integration runner. It shares Vite's module graph,
runs the jsdom suite in deterministic file order, and keeps CSS Module test
names stable without a CRA compatibility shim. `react-scripts` and Jest types
are absent from both the manifest and lockfile. `npm run test:coverage` enforces
the measured U17 global floor: 87% statements, 79% branches, 89% functions, and
89% lines. The canonical `test:ci:no-cache` command and CI gate enforce the
same floors with Vitest caching disabled.

The checked-in `vercel.json` points Vercel at `build/` and applies the official
Vite SPA fallback. Vercel checks the deployment filesystem before the fallback,
so real public files and hashed `/static/*` chunks are served directly while
unknown deep links receive `index.html`. Hashed assets are cached as immutable
for one year; `index.html` must revalidate so a new document does not keep stale
chunk references.

Keep the last known-good commit-specific Vercel deployment instead of deleting
it. Before promoting a candidate, verify a direct route refresh and every lazy
chunk on both the candidate URL and that previous URL. Roll back by restoring
the previous immutable deployment/alias in Vercel, then verify its HTML and
hashed chunks again. Vercel Preview/OCI/Toss sandbox parity and the already-open
tab check remain explicitly unverified while the backend is unavailable; local
build success is not evidence for those live checks.

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
npm run test:ci:no-cache -- src/verification-gate.test.ts
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
