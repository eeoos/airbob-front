# Frontend Live Integration Smoke

> 현재 상태: **DEFERRED / UNVERIFIED**
> Vercel frontend와 OCI backend가 호환 가능한 상태로 연결되기 전에는 이 문서를 완료
> 증거로 사용하지 않는다. Toss는 sandbox만 사용한다.

## 목적과 경계

이 문서는 외부 서비스가 필요한 live 통합만 검증한다. 프론트 구조와 디자인 진입은
backend-independent `npm run verify:design-ready`가 판정하며, live smoke는 그 명령에
포함되지 않고 디자인 작업을 차단하지 않는다.

Live 범위는 다음뿐이다.

- commit-specific Vercel deployment의 SPA deep link와 lazy asset
- Vercel origin에서 OCI `/api/v1`로 가는 cookie session, CORS, API envelope와 upload
- 실제 Google Maps/Places SDK의 key/referrer/quota와 browser interaction
- Toss sandbox redirect, callback scrub, confirm/status reconciliation

AWS 성능 환경은 이 runbook과 디자인 진입 gate 밖의 별도 성능 작업이다.

## 실행 전 조건

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

## Smoke 환경 변수

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

## 실행

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

- 검증한 commit과 Vercel deployment label
- 실행 시각과 `verify:design-ready`, preflight, `verify:live-integration` exit status
- generated smoke report의 local path
- failed step, console error category, network failed request의 method/status/path
- Maps와 Toss sandbox checklist의 PASS/FAIL/DEFERRED

다음 값은 report, screenshot 이름, issue, commit, 채팅에 남기지 않는다.

- QA email/password, cookie, auth state, Maps/Toss key
- reservation/accommodation 식별자
- payment key, order identifier, callback query 또는 callback 전체 URL
- 실제 사용자 PII, request/response body, HAR, trace, payment callback screenshot

Console error, API failure, skipped dynamic route, credential redaction 실패가 하나라도 있으면
live gate는 실패다. 외부 환경이 준비되지 않은 경우에는 통과로 기록하지 말고
`DEFERRED / UNVERIFIED`를 유지한다.
