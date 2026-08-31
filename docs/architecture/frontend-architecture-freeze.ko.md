# Airbob Frontend Architecture Freeze (Historical)

> 상태: **2026-08-29 superseded**. 이 문서는 2026년 7월 구조 정리의 종료 기준을 보존하는
> 역사 기록이며 현재 아키텍처의 기준이나 새 리팩토링의 완료 조건이 아닙니다.

현재 구조는 [current frontend architecture](current-frontend-architecture.md), 단계별 전환과
제거 조건은 [migration rules](frontend-migration-rules.md)와
[ownership matrix](frontend-ownership-matrix.md)를 따릅니다. 현재 실행 계획과 과거 계획의
관계는 [refactor plan index](../archive/frontend-refactor-plan-index.md)에 기록합니다.

## 당시 기준의 의미

2026년 7월 freeze는 feature-first 라우팅, `src/routes`의 route 계약, TanStack Query,
CSS Modules, `appShell.ts`/`publicCache.ts` 호환 경계와 정적 검증 명령을 도입했습니다.
이 요소들은 현재 production에 도달 가능하므로 migration 중에는 보존하지만, 특히
`appShell.ts`와 `publicCache.ts`는 목표 구조가 아니라 ownership matrix의 제거 조건을 가진
legacy seam입니다.

당시 명령의 의미는 역사 기록이며 현재 gate 계약을 정의하지 않습니다. 현재
`verify:design-ready`는 backend-independent gate이고, live smoke는 별도
`verify:live-integration`과 live-only runbook을 따릅니다. 과거 통과 기록이나 skip은 현재
검증을 대신하지 않습니다.
