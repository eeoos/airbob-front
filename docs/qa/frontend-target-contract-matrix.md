# Frontend Target Contract Matrix

이 문서는 deterministic browser characterization이 현재 보존하는 동작과 아직 구현되지 않은 target contract를 구분한다. `Target gap`은 skip test나 통과한 검증으로 집계하지 않는다. 각 행은 담당 implementation unit이 시작될 때 failing test 또는 executable architecture rule로 활성화한다.

## Current Browser Baseline

| Flow | Current contract | Deterministic evidence |
| --- | --- | --- |
| Auth/session | 중앙 codec으로 보호 URL의 pathname/query/hash를 로그인 뒤 복원하고, 익명 저장 intent는 modal close/Escape에서 mutation 없이 취소한다. 명시적 session reducer/subject/epoch가 동일 origin tab의 logout, B login, 실패한 logout 재검증을 동기화한다. | `auth-session-characterization.spec.ts` + session/codec unit contracts |
| Search | direct load/full refresh, pagination, back/forward, viewport URL과 API query projection을 보존한다. Destination/page는 push, map bounds는 replace 의미를 유지하고 detail URL은 booking-safe query만 전달한다. Query key/AbortSignal이 A→B 전환의 늦은 A 응답을 화면에서 차단하며 Maps/Places 실패는 typed terminal로 수렴하고 SDK 자원을 해제한다. | `search-wishlist-characterization.spec.ts`, `SearchController.stale-results.test.tsx`, Search codec/query/Maps/Places unit contracts |
| Wishlist | add/remove 결과를 search card에 투영하고 duplicate click을 mutation 한 번으로 수렴한다. 지연된 A 명령은 B generation에 투영되지 않고 B가 같은 target을 독립 실행한다. Wishlist index/recent/detail URL과 hash는 local mirror 없이 back/forward로 복원된다. | `search-wishlist-characterization.spec.ts`, `wishlist-characterization.spec.ts`, scoped workflow/cache tests |
| Reservation handoff | 예약 double click은 create와 checkout navigation을 한 번만 수행한다. | `reservation-payment-characterization.spec.ts` |
| Checkout | 현재 sessionStorage fallback document가 full reload 뒤 confirm 화면을 복구한다. | `reservation-payment-characterization.spec.ts` |
| Payment | mismatched callback을 거부하고, valid confirm을 재진입에도 한 번만 보내며 pending/DONE status reconciliation과 DONE cleanup을 보존한다. | `reservation-payment-characterization.spec.ts` |
| Review | missing reservation terminal과 review-create 성공 뒤 image-upload partial failure feedback/navigation을 보존한다. | `profile-review-characterization.spec.ts` |
| Accommodation editor | error terminal, successful hydration, update-before-publish ordering과 route 이탈 뒤 late update publish fence를 보존한다. | `accommodation-editor-characterization.spec.ts` |
| Harness isolation | unexpected Host, unregistered API/data/external HTTP, non-script Daum request와 WebSocket을 차단한다. | `harness-security-characterization.spec.ts` |
| Artifact/privacy | binary artifact, real-domain email, callback credential, secret key와 committed canary를 teardown에서 거부하고 reporter stdout/stderr를 같은 규칙으로 redact한다. | `scan-artifacts.mjs` self-test + redacted reporter + global teardown |

모든 spec은 test별 BrowserContext, synthetic `.invalid` identity, fixed clock, mocked `/api/v1` response를 사용한다. API/session 격리는 auto fixture라 `{ page }`만 요청한 spec에도 강제된다. 동일 origin의 document/allowlisted build asset과 정확히 지정한 Daum postcode script 이외의 HTTP/WebSocket network는 default-deny이며, 등록되지 않은 요청은 teardown에서 suite를 실패시킨다. Trace, video, screenshot, HTML report는 저장하지 않는다. Reporter는 stdout/stderr와 error stack을 출력 전에 redact하고, 남는 text artifact는 global teardown privacy scan을 통과해야 한다. Live backend/Toss sandbox 검증은 `scripts/smoke/frontend-smoke.mjs`가 계속 별도 소유한다.

CI의 첫 production build는 기본 배포 환경 compile gate다. Playwright 전용 서버는 그 뒤 synthetic same-origin API와 테스트용 browser-public key를 주입한 production build를 다시 생성한다. 두 build는 중복 실수가 아니라 배포 variant와 deterministic browser variant를 각각 검증하는 의도적인 분리다.

## Target Contracts Awaiting Activation

| Target gap | Current state | Owner | Activation condition | Required evidence |
| --- | --- | --- | --- | --- |
| Runtime DAG와 type-only cycle 0 | U3 rule owner와 fixture가 활성화됐고 Auth/Wishlist/Search는 strict registry에 등록됐다. Production graph는 476 modules/1,271 dependencies이며 editor cycle 2개와 compatibility cross-feature edge 11개, 총 warning 13개와 target error 0개다. | U9-U13, U22 | 남은 slice를 `architecture-ratchet.json`에 등록하는 production cutover 때 | dependency fixture + production graph report |
| Final main/route bundle budget | U8 fixed-env production build의 main은 140.89 kB gzip이다. Search controller/screen, Wishlist provider, AccommodationActionModal은 각각 lazy chunk에 남고 Header main에는 들어오지 않는다. 계획의 131.4 kB final target은 아직 충족/승인되지 않았다. | U15, U18 | token/asset 정리 뒤 executable bundle budget을 canonical gate에 연결할 때 | fixed-env build stats + budget assertion |
| Subject-owned checkout storage repository | U4 platform storage adapter가 유일한 production `sessionStorage` 직접 접근 owner다. 기존 checkout/index/payment helper는 그 raw compatibility seam을 쓰며 새 subject/version/TTL repository writer는 아직 활성화되지 않았다. | U10 | server-verified checkout repository가 단일 writer로 cutover될 때 | adapter contract + invalid/foreign/expired purge + reload browser test |
| Checkout marker subject/TTL/consume-once | current checkout storage와 callback query가 분산돼 있다. | U10 | payment workflow cutover 직전 | forged marker, A→B, two-tab, deduped confirm, payment-key removal tests |
| Remaining custom-overlay adoption/browser promotion | U19 app portal/stack/focus/body-lock owner는 활성화됐지만 일부 legacy custom overlay 소비자와 deterministic browser promotion이 남아 있다. | U14, U18 | 마지막 custom overlay가 shared runtime으로 이동하고 browser gate를 승격할 때 | focus trap, Escape, backdrop, nested body-lock browser tests |
| Responsive browser evidence | U19 canonical 1024px CSS/JS owner와 static/unit contract는 활성화됐고 U8 SearchBar가 동일 owner를 사용한다. 남은 화면의 adoption 및 실제 viewport 경계 browser evidence는 없다. | U14, U18 | remaining consumers가 canonical policy로 이동하고 design-entry gate를 조립할 때 | 1023/1024/1025 visual-behavior matrix |
| Reduced motion contract | animation owner와 opt-out 정책이 완전하지 않다. | U14, U19 | interaction primitive와 shell adoption 시 | `prefers-reduced-motion` browser assertions |
| Reservation route-transition/ambiguity fence | duplicate는 baseline이지만 lazy route 전환 commit 전에 late create response가 오면 confirm으로 다시 handoff되는 current gap과 ambiguous server result owner 부재가 남아 있다. | U9 | reservation workflow cutover 전에 | URL/session epoch 기반 late-response fence + ambiguous create/status reconciliation browser tests |
| Editor full command journal | hydration, update→publish와 unmount fence는 baseline이지만 image delete/upload ordering은 분산돼 있다. | U12 | editor workflow cutover 전에 | delete/upload/save/publish journal browser tests |
| Built artifact/source-map canary | Playwright artifact scan은 적용됐지만 production bundle/source map secret allowlist 검사는 아직 없다. | U18 | canonical CI gate 조립 시 | build/source-map scanner with browser-public allowlist |

## Observed Current Gaps

- **Reservation late handoff (U9):** 2026-08-29 production-build characterization에서 reservation POST가 pending인 동안 Header Home link를 누르면 URL은 `/`로 먼저 바뀌지만 lazy Home route commit 전 응답이 완료될 수 있었다. 이 경우 detail owner의 `isMountedRef`가 아직 active여서 `/accommodations/:id/confirm`으로 다시 이동했다. 목표 기대값을 skip test로 남기지 않았으며 U9에서 URL/session epoch 기반 fence를 도입하기 전까지 미검증/미해결 결함으로 집계한다.

## Promotion Rule

Target contract는 담당 U-ID가 다음 조건을 모두 만족한 commit에서만 `Current Browser Baseline`으로 이동한다.

1. skip 없이 deterministic하게 통과한다.
2. 실제 backend, Maps, Toss 또는 live credential에 접근하지 않는다.
3. 등록되지 않은 network request가 0이다.
4. 실패 artifact에 callback credential, auth state 또는 사용자 PII가 없다.
5. 해당 slice의 old writer와 compatibility surface 제거 조건이 ownership matrix와 일치한다.
