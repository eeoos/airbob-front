# Frontend Target Contract Matrix

이 문서는 deterministic browser characterization이 현재 보존하는 동작과 아직 구현되지 않은 target contract를 구분한다. `Target gap`은 skip test나 통과한 검증으로 집계하지 않는다. 각 행은 담당 implementation unit이 시작될 때 failing test 또는 executable architecture rule로 활성화한다.

## Current Browser Baseline

| Flow | Current contract | Deterministic evidence |
| --- | --- | --- |
| Auth/session | 보호 URL의 pathname/query/hash를 로그인 뒤 복원하고, 익명 저장 intent는 modal close/Escape에서 mutation 없이 취소한다. | `auth-session-characterization.spec.ts` |
| Search | direct load/full refresh, pagination, back/forward, viewport URL과 API query projection을 보존한다. | `search-wishlist-characterization.spec.ts` |
| Wishlist | add/remove 결과를 search card에 투영하고 동기 duplicate click을 mutation 한 번으로 수렴한다. | `search-wishlist-characterization.spec.ts` |
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
| Runtime DAG와 type-only cycle 0 | accommodation editor type cycle과 compatibility feature edge가 남아 있다. | U3, U7-U13, U22 | dependency rules가 도입되고 각 slice가 target owner로 이동할 때 | dependency fixture + production graph report |
| Browser storage 단일 owner | 여러 feature가 `localStorage`/`sessionStorage`를 직접 사용한다. | U4, U10 | platform adapter가 생성되고 첫 writer가 cutover될 때 | adapter contract + reload browser test |
| Session substate와 cross-tab epoch | 현재는 React Query의 nullable user가 사실상 session state다. | U5 | safe return codec U6 완료 후 session owner cutover 시 | transient `/me`, A→logout→B, `BroadcastChannel` browser scenarios |
| 안전한 내부 return target | current route state parser만 개별 검증하며 중앙 codec이 없다. | U6 | typed route manifest 도입 시 | open-redirect rejection + deep-link/back/forward tests |
| Checkout marker subject/TTL/consume-once | current checkout storage와 callback query가 분산돼 있다. | U10 | payment workflow cutover 직전 | forged marker, A→B, two-tab, deduped confirm, payment-key removal tests |
| Modal portal/focus/body-lock owner | non-portal overlay와 중복 interaction logic가 남아 있다. | U14 | shared overlay primitives adoption 시작 시 | focus trap, Escape, backdrop, nested body-lock browser tests |
| 1024px responsive contract | 경계값과 tablet/desktop 전환 기준이 CSS와 hooks에 분산돼 있다. | U19 | shell/responsive owner 통합 시 | 1023/1024/1025 visual-behavior matrix |
| Reduced motion contract | animation owner와 opt-out 정책이 완전하지 않다. | U14, U19 | interaction primitive와 shell adoption 시 | `prefers-reduced-motion` browser assertions |
| Search SDK drag/stale-result behavior | URL/bounds request projection은 browser baseline이지만 Google adapter event와 stale response 교차는 unit test가 소유한다. | U8 | deterministic Maps port가 도입될 때 | fake Maps drag/idle plus out-of-order response browser tests |
| Wishlist cross-surface projection | search card/modal projection은 baseline이지만 detail/recent/list와 A→B isolation은 current cache tests가 소유한다. | U7 | wishlist workflow cutover 전에 | search/detail/recent/list projection and cross-session browser tests |
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
