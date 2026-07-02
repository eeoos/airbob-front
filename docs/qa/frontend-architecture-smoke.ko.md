# Frontend Architecture Smoke QA

## 목적

Airbnb 디자인 리팩터 전에 프론트엔드 아키텍처 변경이 주요 사용자 흐름을 깨뜨리지 않았는지 확인한다.

## 환경

- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- QA 계정: 스레드에서 사용자가 제공한 QA 계정을 사용한다. 실제 이메일, 비밀번호, 닉네임, member_id 같은 자격 증명 값은 문서나 커밋에 남기지 않는다.

## Desktop 1280px 체크리스트

- [ ] Home search 입력 후 /search 로 이동한다.
- [ ] Search list 가 렌더링되고 page query 가 유지된다.
- [ ] Search map marker 또는 bounds update 후 결과가 새로고침된다.
- [ ] Accommodation detail 에서 date/guest, coupon, reservation button 이 정상 동작한다.
- [ ] 로그인 상태에서 Reservation confirm page 가 열린다.
- [ ] Wishlist page 에서 list/detail/modal open-close 흐름이 동작한다.
- [ ] Profile guest tab 과 host tab 을 전환할 수 있다.
- [ ] Host listing 에서 infinite scroll 또는 empty state 가 정상 표시된다.

## Mobile 375px 체크리스트

- [ ] Home search UI 가 viewport 안에 맞는다.
- [ ] Search mobile bottom sheet 의 closed/half/full behavior 가 동작한다.
- [ ] Detail booking panel/modal 이 viewport 안에 맞는다.
- [ ] Wishlist modal 과 auth modal 이 close button 또는 overlay 로 닫힌다.

## Recording

- failed step:
- console error:
- network failed request:
- screenshot path:
