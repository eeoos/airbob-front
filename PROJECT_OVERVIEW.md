# Airbob Frontend Overview

Airbob은 숙소 탐색, 위시리스트, 예약과 결제, 리뷰, 호스트 숙소 관리를 제공하는
React/TypeScript 단일 페이지 애플리케이션입니다. 브라우저에서 사용하는 백엔드 계약은
`/api/v1` REST API이며, 이번 프론트엔드 구조 전환은 API·DB·서버 동작을 변경하지 않습니다.

## 현재 제품 흐름

- 탐색: Home → Search → Accommodation detail
- 예약: Accommodation detail → Reservation confirm → Toss payment callback → Reservation detail
- 계정: Login/Signup → Wishlist/Profile → guest/host reservation detail
- 호스트: Profile listings → Accommodation edit/create → publish
- 후기: Reservation detail → Review create/edit/delete

현재 앱은 15개의 lazy route와 `main`, `search-header`, `bare` shell 조합을 사용합니다.
TanStack Query가 서버 상태를, `AuthProvider`가 세션 상태를, URL과 `history.state` 및 일부
`sessionStorage` 키가 화면·결제 전환 상태를 보유합니다. Axios 클라이언트는 cookie 기반
세션과 기존 응답 envelope를 유지합니다.

## 구조 문서

- 현재 구조의 단일 기준: [current frontend architecture](docs/architecture/current-frontend-architecture.md)
- 단계적 전환 규칙: [frontend migration rules](docs/architecture/frontend-migration-rules.md)
- route/workflow 소유권과 cutover 상태: [frontend ownership matrix](docs/architecture/frontend-ownership-matrix.md)
- 브라우저 저장 데이터와 개인정보/TTL: [frontend browser data inventory](docs/architecture/frontend-browser-data-inventory.md)
- 의존성·미사용 코드·스타일 strict 승격: [frontend architecture ratchets](tests/architecture/dependency-rules.md)
- 실행 계획: [frontend architecture overhaul plan](docs/plans/2026-08-29-001-refactor-frontend-architecture-overhaul-plan.md)
- 과거 계획 색인: [frontend refactor plan index](docs/archive/frontend-refactor-plan-index.md)

구조를 판단할 때는 첫 번째 문서를 우선합니다. 나머지 문서는 운영 규칙, 진행 상태 또는
역사 기록이며 현재 구조를 별도로 정의하지 않습니다.
