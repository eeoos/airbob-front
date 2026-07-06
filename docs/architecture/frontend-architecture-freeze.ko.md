# Airbob Frontend Architecture Freeze

## 구조 freeze 기준

- Production feature 파일은 다른 feature의 private surface를 직접 import하지 않는다.
- Cross-feature 사용은 appShell.ts 또는 publicCache.ts를 통한다.
- Route path와 route query contract는 src/routes가 소유한다.
- Feature public index.ts는 route container export만 허용한다.
- SearchRoute는 화면 렌더링을 담당하고 useSearchRouteController가 route orchestration을 소유한다.
- Query 에러 toast 중복 방지는 useHandledQueryError가 소유한다.
- AuthProvider는 provider 역할을 맡고 sessionLifecycle이 세션 side effect를 소유한다.
- API response shape와 backend contract는 프론트 구조 정리에서 변경하지 않는다.
- Airbnb 스타일 시각 리팩토링은 이 문서의 freeze gate 통과 뒤 화면 단위로 진행한다.

## 의도적으로 남기는 리스크

- Search, accommodation detail, reservation/payment, wishlist는 여전히 큰 화면이다.
- CSS Modules에는 feature-local hard-coded value가 남아 있다.
- Strict browser smoke는 QA 계정, stable reservation UID, frontend server, backend server, GSTACK_BROWSE_BIN이 있어야 실행된다.
- CRA-to-Vite migration은 구조 freeze 이후 별도 브랜치에서만 진행한다.

## Freeze Gate

```bash
npm run verify:structure
npm run test:ci:no-cache -- --runInBand src/verification-gate.test.ts
```

브라우저 플로우까지 닫을 때는 아래 명령을 별도로 실행한다.

```bash
npm run verify:design-ready
```
