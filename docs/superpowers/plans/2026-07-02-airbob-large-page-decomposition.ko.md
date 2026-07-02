# Airbob 대형 페이지 분해 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for independent implementation/review tasks. Use `superpowers:test-driven-development` for every code-changing task. Steps use checkbox (`- [ ]`) syntax for tracking. Backend/API/DB/server code is read-only unless the user explicitly approves backend edits.

**Goal:** Airbnb `design.md`를 적용하기 전에 `AccommodationEdit`, `AccommodationDetail`, `Search`, `Map`, `SearchBar`를 기능 단위로 쪼갤 수 있는 안전한 분해 순서와 검증 기준을 확정한다.

**Architecture:** 현재 CRA/React/TypeScript/CSS Modules 구조를 유지하면서 `pages`는 라우트 조립만, `features/*`는 도메인 상태/API 조합만, `shared/*`는 도메인을 모르는 공용 UI/유틸만 맡게 만든다. 큰 파일은 한 번에 갈아엎지 않고 URL/API/사용자 흐름을 고정하는 테스트를 먼저 만든 뒤 hook, pure helper, page-local component 순서로 이동한다.

**Tech Stack:** CRA 5, React 19, React Router 7, TypeScript 4.9, Axios, CSS Modules, Jest/React Testing Library, Google Maps JavaScript API, Daum Postcode.

---

## 현재 규모

| 영역 | TSX | CSS Module | 합계 | 현재 위험 |
| --- | ---: | ---: | ---: | --- |
| `src/pages/AccommodationEdit/AccommodationEdit.tsx` | 2,421 | 1,752 | 4,173 | 폼, 이미지, 저장/공개, 주소 검색, 스텝 UI가 한 파일에 있음 |
| `src/pages/AccommodationDetail/AccommodationDetail.tsx` | 1,576 | 1,697 | 3,273 | 상세 조회, 예약, 쿠폰, 리뷰, 갤러리, 모달, 반응형 UI가 한 파일에 있음 |
| `src/pages/Search/Search.tsx` | 984 | 575 | 1,559 | 검색 API, URL query, 지도 상태, 모바일 bottom sheet, wishlist modal이 섞임 |
| `src/components/Map/Map.tsx` | 1,414 | 118 | 1,532 | Google Maps imperative API, marker, InfoWindow HTML, bounds debounce가 한 컴포넌트에 있음 |
| `src/components/SearchBar/SearchBar.tsx` | 836 | 518 | 1,354 | 목적지/date/guest 입력, URL sync, Places autocomplete, dropdown 상태가 한 파일에 있음 |

이 다섯 영역만 합쳐도 약 11,891줄이다. 디자인을 바로 입히면 CSS/마크업 변경이 API 호출, URL query, 지도 상태, 예약 생성 같은 기능 회귀로 이어질 가능성이 높다.

---

## 공통 분해 원칙

- URL path와 query key는 변경하지 않는다.
- API endpoint, request body, response shape는 변경하지 않는다.
- backend/API/DB/server 코드는 수정하지 않는다.
- 먼저 pure helper와 hook contract 테스트를 만들고, 그 다음 UI를 이동한다.
- CSS split은 TSX 책임 분리가 안정된 뒤에 한다. CSS를 먼저 나누면 selector 추적 비용만 커진다.
- `Map`처럼 외부 imperative API가 큰 파일은 React UI처럼 바로 쪼개지 않는다. adapter/helper 경계를 먼저 만든다.
- Airbnb `design.md`, UI library 도입, visual redesign, 반응형 재설계는 이 문서의 작업이 끝난 뒤에 한다.

---

## 1. SearchBar 분해

### 현재 책임

- 검색어, 체크인/체크아웃, 성인/아동/유아/반려동물 수 상태 관리.
- URL query에서 초기값 읽기.
- 검색 실행 시 `/search?...` URL 생성.
- Google Places autocomplete hook 연결.
- date picker, guest picker, suggestions dropdown 열림/닫힘 제어.
- 외부 클릭 감지, IME composition 상태 처리.
- search page의 map drag mode와 상호작용.

### 분리 후보

- Create: `src/features/search/lib/searchParams.ts`
  - `parseSearchParams(search: string | URLSearchParams)`
  - `buildSearchParams(input)`
  - `formatGuestSummary(input)`
  - `formatDateRange(checkIn, checkOut)`
- Create: `src/features/search/lib/pagination.ts`
  - 최대 15페이지 제한, ellipsis, prev/next disabled 계산.
- Create: `src/features/search/hooks/useSearchBarState.ts`
  - SearchBar의 입력 상태, dropdown 상태, submit handler를 담당.
- Create: `src/features/search/components/SearchDestinationInput.tsx`
  - 목적지 input, suggestions, IME 이벤트만 담당.
- Create: `src/features/search/components/SearchDateField.tsx`
  - 날짜 field와 DatePicker 연결만 담당.
- Create: `src/features/search/components/SearchGuestField.tsx`
  - guest picker와 인원 증감만 담당.
- Modify: `src/components/SearchBar/SearchBar.tsx`
  - feature 컴포넌트를 조립하는 wrapper로 축소.

### 유지해야 할 플로우

- Home/Header/Search page 어디에서 실행해도 같은 query key를 만든다.
- `destination`, `latitude`, `longitude`, `checkIn`, `checkOut`, `adultOccupancy`, `childOccupancy`, `infantOccupancy`, `petOccupancy`가 기존과 같은 의미로 유지된다.
- Google Place 선택 검색은 viewport/lat/lng를 URL에 넣고 page를 초기화한다.
- 일반 텍스트 검색은 이전 viewport/lat/lng를 제거하고 destination 기반 검색으로 전환한다.
- 한글 입력 중 Enter가 composition 중간에 검색을 실행하지 않는다.
- 날짜 또는 guest picker를 열 때 바로 외부 클릭으로 닫히지 않는다.
- map drag mode에서 검색바 클릭/검색 동작이 기존처럼 mode를 빠져나온다.

### 테스트/QA 기준

- `src/features/search/lib/searchParams.test.ts`
  - 빈 query, 목적지 query, 좌표 query, 날짜 query, guest query를 기존 key로 round-trip 검증.
- `src/features/search/lib/pagination.test.ts`
  - 7페이지 이하/초과, ellipsis, 최대 15페이지 제한, prev/next disabled 검증.
- `src/features/search/hooks/useSearchBarState.test.tsx`
  - URL 초기값, guest 증감, date select, submit navigation 검증.
- Browser QA
  - Home에서 목적지 검색 후 Search로 이동.
  - Search에서 날짜/guest 변경 후 query 갱신.
  - 한글 목적지 입력 후 Enter.
  - 모바일 폭에서 date/guest picker 열고 닫기.

### 먼저 할 순서

1. `searchParams.ts`와 `pagination.ts` pure helper와 테스트를 만든다.
2. `SearchBar.tsx` 내부 URL/query 생성 코드를 helper로 바꾼다.
3. `useSearchBarState.ts`를 만들고 상태/handler만 이동한다.
4. 목적지/date/guest subcomponent를 하나씩 이동한다.
5. 마지막에 `SearchBar.module.css`를 component CSS로 나눈다.

---

## 2. Search 페이지 분해

### 현재 책임

- `useSearchParams`를 읽어 검색 API parameter를 만든다.
- `accommodationApi.search` 호출, loading/page/total state 관리.
- URL query 변경과 page 변경을 감지해 중복 호출을 피한다.
- 지도 bounds 변경 시 query를 업데이트한다.
- Accommodation card hover/select와 Map marker select를 동기화한다.
- Wishlist/Auth modal 상태를 관리한다.
- desktop list/map layout과 mobile bottom sheet layout을 동시에 렌더링한다.

### 분리 후보

- Create: `src/features/search/hooks/useSearchResults.ts`
  - query params를 받아 검색 결과, loading, pagination, reload를 반환.
- Create: `src/features/search/hooks/useSearchMapState.ts`
  - selected/hovered accommodation, map expanded, map drag mode, bounds update flag 관리.
- Create: `src/features/search/hooks/useSearchBottomSheet.ts`
  - 모바일 sheet 상태, drag/scroll/map interaction 처리.
- Create: `src/features/search/hooks/useSearchWishlistModal.ts`
  - wishlist modal open/close, auth modal open, wishlist success reconciliation 관리.
- Create: `src/features/search/components/SearchResultsList.tsx`
  - AccommodationCard list, empty/loading/error 상태, desktop pagination.
- Create: `src/features/search/components/SearchPagination.tsx`
  - desktop/mobile 공용 pagination UI.
- Create: `src/features/search/components/SearchMobileBottomSheet.tsx`
  - framer-motion bottom sheet, mobile pagination, scroll handling.
- Modify: `src/pages/Search/Search.tsx`
  - URL과 layout 조립만 담당.

### 유지해야 할 플로우

- URL query 변경 시 검색 결과가 갱신된다.
- page query 변경과 직접 page click이 중복 API 호출을 만들지 않는다.
- 지도 드래그/줌 후 3초 idle 시 viewport query가 반영되고 `destination`, `latitude`, `longitude`, `page`는 제거된다.
- card hover가 marker hover로, marker click이 selected card 상태로 연결된다.
- accommodation card click은 새 탭에서 상세 페이지를 연다.
- 로그인하지 않은 wishlist 클릭은 auth modal을 연다.
- wishlist modal close 후 카드의 heart 상태가 API 기준으로 재계산된다.
- 모바일 bottom sheet `closed | half | full` snap behavior가 유지된다.
- 페이지 변경 시 필터는 유지되고 최대 15페이지 제한이 유지된다.

### 테스트/QA 기준

- `src/features/search/hooks/useSearchResults.test.tsx`
  - query params -> API params 변환.
  - 첫 로드, page 변경, bounds query 변경.
  - API error 시 기존처럼 빈 결과/로딩 해제.
- `src/features/search/hooks/useSearchMapState.test.tsx`
  - hover/select/map drag mode transition.
- Browser QA
  - `/search?destination=...` 직접 진입.
  - page 2 클릭 후 URL과 결과 확인.
  - 지도 드래그 후 bounds query와 새 결과 확인.
  - desktop card hover/marker highlight.
  - mobile bottom sheet drag, scroll, pagination.
  - QA 계정으로 로그인 후 wishlist modal open/close.
  - Network tab에서 초기 진입, 검색, page 변경, 지도 drag마다 의도한 search API가 1회만 호출되는지 확인.

### 먼저 할 순서

1. `Search.tsx`의 API parameter builder를 pure helper로 이동한다.
2. `useSearchResults.ts`를 만들고 기존 effect의 중복 호출 방지 조건을 테스트로 고정한다.
3. `useSearchMapState.ts`로 selected/hovered/map drag 상태를 이동한다.
4. `useSearchBottomSheet.ts`로 모바일 sheet 상태를 이동한다.
5. `useSearchWishlistModal.ts`로 modal 상태만 이동한다.
6. `SearchPagination`, list, mobile bottom sheet를 component로 나눈다.
7. `Search.module.css`는 desktop/mobile section별로 마지막에 분리한다.

---

## 3. Map 분해

### 현재 책임

- Google Maps script 로드.
- map instance 생성과 custom control 생성.
- 숙소 marker 생성/삭제/아이콘 상태 변경.
- selected/hovered marker 동기화.
- InfoWindow HTML string 생성, inline `onclick`, `window.closeInfoWindow`, `window.toggleWishlist` 등록.
- bounds idle listener와 3초 debounce.
- viewport query와 accommodations 변경 사이의 fitBounds 조건 관리.
- expanded mode resize 처리.

### 분리 후보

- Create: `src/components/Map/lib/mapBounds.ts`
  - bounds serialize/compare, viewport 적용 여부 판단.
- Create: `src/components/Map/lib/markerIcon.ts`
  - price marker SVG/icon option 생성.
- Create: `src/components/Map/lib/infoWindowContent.ts`
  - InfoWindow HTML string 생성. 현재 동작을 보존하되 escape/format 경계를 명확히 한다.
- Create: `src/components/Map/hooks/useGoogleMapsScript.ts`
  - script loading과 already-loaded detection.
- Create: `src/components/Map/hooks/useMapBoundsListener.ts`
  - idle listener, debounce, cleanup.
- Create: `src/components/Map/hooks/useAccommodationMarkers.ts`
  - marker lifecycle과 hover/select icon update.
- Modify: `src/components/Map/Map.tsx`
  - refs를 들고 hook을 연결하는 adapter component로 축소.

### 유지해야 할 플로우

- Google Maps API key가 없으면 기존 fallback UI를 보인다.
- 검색 결과 marker가 가격 bubble로 보인다.
- card hover 시 marker 색상이 바뀐다.
- marker click 시 InfoWindow가 열리고 selected marker 상태가 유지된다.
- InfoWindow의 accommodation click은 새 탭 상세 페이지로 이동한다.
- InfoWindow의 heart click은 Search page wishlist flow와 연결된다.
- 지도 드래그/줌 idle 후 3초 뒤 bounds change가 호출된다.
- 동일 bounds에서는 중복 search를 호출하지 않는다.
- viewport query가 있을 때 초기 fitBounds와 이후 accommodations update가 기존처럼 동작한다.
- expanded mode에서 resize 후 InfoWindow 위치가 깨지지 않는다.
- map expand button처럼 imperative DOM으로 삽입되는 control은 hook 분리 전후 동일 위치와 동작을 유지한다.

### 테스트/QA 기준

- `src/components/Map/lib/mapBounds.test.ts`
  - 같은 bounds 비교, 다른 bounds 비교, viewport query serialize/deserialize.
- `src/components/Map/lib/markerIcon.test.ts`
  - 가격 길이에 따른 icon width와 anchor 계산.
- `src/components/Map/lib/infoWindowContent.test.ts`
  - title, price, rating, wishlist 상태별 HTML 생성.
- Browser QA
  - desktop Search에서 지도 marker 표시.
  - marker hover/select/InfoWindow close.
  - InfoWindow accommodation click 새 탭.
  - heart click 시 wishlist/auth modal.
  - 지도 drag/zoom 후 bounds query 변경.
  - expanded map toggle 후 marker/InfoWindow 유지.
  - Google Maps 로드, InfoWindow 열기/닫기, modal close 후 console error가 없는지 확인.

### 먼저 할 순서

1. `mapBounds.ts`, `markerIcon.ts`, `infoWindowContent.ts` pure helper를 테스트와 함께 만든다.
2. `Map.tsx` 내부 계산 코드만 helper로 대체한다.
3. `useGoogleMapsScript.ts`로 script loading을 이동한다.
4. `useMapBoundsListener.ts`로 idle/debounce/cleanup을 이동한다.
5. `useAccommodationMarkers.ts`로 marker lifecycle을 이동한다.
6. InfoWindow를 React portal로 바꾸는 작업은 별도 디자인/지도 개선 단계로 미룬다.

---

## 4. AccommodationDetail 분해

### 현재 책임

- accommodation detail API 조회와 loading state.
- recently viewed 추가.
- image gallery, mobile swipe, image modal.
- date picker와 guest picker 상태.
- 예약 생성 후 confirm route로 이동.
- coupon 조회/발급/선택/할인 계산.
- review 조회, cursor pagination, observer, review modal.
- wishlist/auth/description modal 상태.
- Google map iframe URL 생성.
- desktop/mobile 상세 UI와 sticky booking card 렌더링.

### 분리 후보

- Create: `src/features/accommodations/hooks/useAccommodationDetail.ts`
  - detail load, refresh, recently viewed add.
- Create: `src/features/accommodations/hooks/useAccommodationBooking.ts`
  - date/guest state, nights/price/discount 계산, reservation create, confirm URL 생성.
- Create: `src/features/accommodations/hooks/useAccommodationCoupons.ts`
  - valid coupons load, issue, selected coupon.
- Create: `src/features/accommodations/hooks/useAccommodationReviews.ts`
  - review cursor pagination, load more, observer target state.
- Create: `src/features/accommodations/hooks/useAccommodationGallery.ts`
  - current image, mobile slide, touch start/end, gallery modal.
- Create: `src/pages/AccommodationDetail/hooks/usePendingAuthAction.ts`
  - 비로그인 action 보류와 AuthModal 이후 재실행.
- Create: `src/features/accommodations/utils/date.ts`
  - URL date parse/format, unavailable date 정규화, 기본 숙박일 계산.
- Create: `src/features/accommodations/utils/booking.ts`
  - guest 제한, guest summary, confirm query 생성.
- Create: `src/features/accommodations/utils/review.ts`
  - review date/말줄임 formatting.
- Create: `src/features/accommodations/utils/map.ts`
  - Google Maps embed URL 생성.
- Create: `src/pages/AccommodationDetail/components/DetailImageGallery.tsx`
- Create: `src/pages/AccommodationDetail/components/BookingCard.tsx`
- Create: `src/pages/AccommodationDetail/components/ReviewSection.tsx`
- Create: `src/pages/AccommodationDetail/components/CouponSection.tsx`
- Create: `src/pages/AccommodationDetail/components/HostInfoSection.tsx`
- Modify: `src/pages/AccommodationDetail/AccommodationDetail.tsx`
  - route param과 section 조립만 담당.

### 유지해야 할 플로우

- `/accommodations/:id` 직접 진입 시 상세 정보가 로드된다.
- URL query의 check-in/check-out/guest 값이 booking card 초기값으로 반영된다.
- 날짜가 없으면 unavailable date를 건너뛰어 첫 예약 가능일과 1박 기본값을 표시한다.
- 날짜 변경 시 URL은 기존처럼 `replace` 방식으로 갱신된다.
- 날짜 선택 시 nights/total price가 기존 계산과 같아야 한다.
- 쿠폰 선택/발급 후 할인과 최종 결제 금액이 기존과 같아야 한다.
- 로그인 사용자에게만 쿠폰 영역이 보이고, 조건 미달 쿠폰 disabled와 `CP003` 기발급 처리 규칙을 유지한다.
- 예약 생성 성공 시 `/accommodations/:id/confirm?...`로 이동한다.
- 로그인 필요 action은 auth modal을 거친 뒤 pending action이 실행된다.
- 리뷰는 첫 페이지와 cursor 기반 추가 로딩이 유지된다.
- image gallery open/close, 모바일 swipe index가 유지된다.
- wishlist modal close 후 accommodation detail이 refresh된다.

### 테스트/QA 기준

- `src/features/accommodations/hooks/useAccommodationBooking.test.tsx`
  - query 초기값, unavailable date 기본값, guest 제한, nights/total price, coupon discount, confirm URL.
- `src/features/accommodations/hooks/useAccommodationReviews.test.tsx`
  - 첫 로드, cursor load more, hasMore false 처리.
- `src/features/accommodations/hooks/useAccommodationCoupons.test.tsx`
  - coupon load, issue, selected coupon.
- Browser QA
  - 상세 직접 진입.
  - 날짜/인원 변경.
  - 쿠폰 발급/선택.
  - 예약 버튼 클릭 후 confirm URL.
  - 리뷰 더보기 또는 infinite load.
  - 이미지 gallery desktop/mobile.
  - wishlist modal open/close.
  - 1440/1024/768/375px에서 sticky booking card, date picker, modal z-index가 깨지지 않는지 확인.

### 먼저 할 순서

1. date, booking, review, map pure helper를 만들고 테스트한다.
2. modal, amenity list, host summary, location map 같은 leaf component를 state 이동 없이 분리한다.
3. `useAccommodationDetail.ts`로 detail load/refresh만 이동한다.
4. gallery state를 `useAccommodationGallery.ts`로 이동한다.
5. `useAccommodationReviews.ts`와 `useAccommodationCoupons.ts`를 분리한다.
6. `BookingCard`를 presentational component로 먼저 분리한다.
7. `useAccommodationBooking.ts`와 `usePendingAuthAction.ts`로 예약/auth 흐름을 이동한다.
8. CSS는 `BookingCard`, `ReviewSection`, `Gallery` 단위로 마지막에 나눈다.

---

## 5. AccommodationEdit 분해

### 현재 책임

- host auth gate와 edit/create route mode 판단.
- 기존 숙소 detail load와 form 초기화.
- form state 전체 관리.
- initial form/image와 현재 form/image 비교.
- update/publish/save-and-exit API 호출.
- 5단계 wizard navigation과 validation.
- accommodation type/amenity modal.
- time picker.
- Daum postcode 주소 검색과 상세 주소 confirm.
- image file validation, preview URL 생성/해제, drag/drop upload, server image delete, reorder.
- 2,421줄 TSX와 1,752줄 CSS에서 모든 step UI 렌더링.

### 분리 후보

- Create: `src/features/accommodations/edit/lib/accommodationEditMapper.ts`
  - API detail response -> form state.
  - form state -> update request body.
- Create: `src/features/accommodations/edit/lib/accommodationEditDirty.ts`
  - initial/current 비교, changed field 추출.
- Create: `src/features/accommodations/edit/lib/accommodationEditValidation.ts`
  - step별 validation.
- Create: `src/features/accommodations/edit/lib/imageItems.ts`
  - file validation, preview item 생성, reorder, server/new image 구분.
- Create: `src/features/accommodations/edit/types.ts`
  - `Step`, `ImageItem`, edit form data, amenity type.
- Create: `src/features/accommodations/edit/lib/daumAddressMapper.ts`
  - Daum postcode response -> addressInfo 변환.
- Create: `src/features/accommodations/edit/lib/time.ts`
  - `parseTime`, `formatTime`, AM/PM 변환.
- Create: `src/features/accommodations/edit/hooks/useAccommodationEditForm.ts`
  - form state, input/nested/time/amenity/type handlers.
- Create: `src/features/accommodations/edit/hooks/useAccommodationEditImages.ts`
  - image item state, object URL cleanup, drag/drop, upload/delete orchestration.
- Create: `src/features/accommodations/edit/hooks/useAccommodationEditSave.ts`
  - save-and-exit, next-step save, publish.
- Create: `src/features/accommodations/edit/hooks/useAccommodationEditSteps.ts`
  - step 완료 여부, 클릭 가능 여부, next/back 흐름.
- Create: `src/features/accommodations/edit/hooks/useDaumPostcode.ts`
  - `window.daum.Postcode` boundary.
- Create: `src/pages/AccommodationEdit/components/StepBasics.tsx`
- Create: `src/pages/AccommodationEdit/components/StepLocation.tsx`
- Create: `src/pages/AccommodationEdit/components/StepAmenities.tsx`
- Create: `src/pages/AccommodationEdit/components/StepPhotos.tsx`
- Create: `src/pages/AccommodationEdit/components/StepPublish.tsx`
- Create: `src/pages/AccommodationEdit/components/TimePicker.tsx`
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.tsx`
  - route/auth, hooks, step switch 조립만 담당.

### 유지해야 할 플로우

- 비로그인 또는 host 권한이 없으면 기존 경로로 이동한다.
- `mode=create`는 기존 데이터 fetch 없이 기본값을 유지한다.
- edit mode에서 기존 숙소 data와 이미지가 정확히 초기화된다.
- save-and-exit은 변경된 필드만 update하고 host profile로 이동한다.
- 변경사항이 없으면 API 호출 없이 host profile로 이동한다.
- step 4에서 이미지 업로드가 완료되어야 step 5로 이동한다.
- step 2에서 이미지는 최소 1장 이상 필요하고 첫 이미지 cover 규칙을 유지한다.
- step 4 다음 클릭은 update 저장 후 step 5로 이동한다.
- publish는 기존 조건과 API 호출 순서를 유지한다.
- server image 삭제는 기존처럼 삭제 API를 호출한다.
- new image preview object URL은 unmount/remove 시 해제된다.
- drag/drop과 file input image 추가가 같은 validation을 사용한다.
- Daum postcode가 없을 때 기존 안내/오류 동작을 유지한다.
- 상세 주소 미입력 confirm flow가 유지된다.
- time picker keyboard/scroll behavior가 유지된다.
- type/amenity modal과 amenity 수량, `selectedAmenities`와 `formData.amenityInfos` 동기화를 유지한다.

### 테스트/QA 기준

- `src/features/accommodations/edit/lib/accommodationEditMapper.test.ts`
  - backend detail -> form state mapping.
  - form state -> update body mapping.
- `src/features/accommodations/edit/lib/accommodationEditDirty.test.ts`
  - 변경 없음, nested field 변경, amenity set 변경, image 변경.
- `src/features/accommodations/edit/lib/accommodationEditValidation.test.ts`
  - step별 required field.
- `src/features/accommodations/edit/lib/imageItems.test.ts`
  - file type/size validation, reorder, server/new image 분류.
- `src/features/accommodations/edit/lib/daumAddressMapper.test.ts`
  - road/jibun address, sido/sigungu/bname, zonecode mapping.
- `src/features/accommodations/edit/lib/time.test.ts`
  - AM/PM parse/format, 12시/0시 edge case.
- Browser QA
  - create mode에서 1~5단계 진행.
  - host profile에서 숙소 수정 진입.
  - step 1~5 이동.
  - 주소 검색과 상세 주소 confirm.
  - 이미지 추가/삭제/reorder.
  - save-and-exit.
  - 변경 없음 save-and-exit에서 update API가 호출되지 않는지 확인.
  - publish.
  - 768px 이하에서 주소 검색, 이미지 grid, modal, button group이 겹치지 않는지 확인.

### 먼저 할 순서

1. `types.ts`, `time.ts`, `daumAddressMapper.ts`, `accommodationEditMapper.ts`, `accommodationEditDirty.ts`, `imageItems.ts`를 테스트와 함께 만든다.
2. 기존 `AccommodationEdit.tsx`의 mapping/dirty/image 계산만 helper로 대체한다.
3. `TimePicker`를 page-local component로 이동한다.
4. `useAccommodationEditForm.ts`로 form handler를 이동한다.
5. API 없는 확인 모달, type modal, amenity modal을 leaf component로 이동한다.
6. `useAccommodationEditImages.ts`로 image state와 upload/delete orchestration을 이동한다.
7. `useDaumPostcode.ts`로 global script boundary를 이동한다.
8. step component를 하나씩 분리하되 orchestrator는 페이지에 유지한다.
9. 마지막에 `useAccommodationEditSteps.ts`, `useAccommodationEditSave.ts`로 orchestration을 이동한다.
10. CSS는 step component 분리가 끝난 뒤 step별 module로 나눈다.

---

## 추천 구현 순서

### Task A: 검색 query helper 고정

**Files:**

- Create: `src/features/search/lib/searchParams.ts`
- Create: `src/features/search/lib/searchParams.test.ts`
- Create: `src/features/search/lib/pagination.ts`
- Create: `src/features/search/lib/pagination.test.ts`
- Modify: `src/components/SearchBar/SearchBar.tsx`
- Modify: `src/pages/Search/Search.tsx`

- [x] `SearchBar`와 `Search`가 공유할 query key, viewport 제거 규칙, page reset 규칙을 테스트로 고정한다.
- [x] helper를 기존 코드에 연결하되 렌더링 구조는 바꾸지 않는다.
- [x] `npm run verify -- --no-cache`를 통과시킨다.
- [x] Commit: `refactor: centralize search params helpers`

### Task B: SearchBar state 분리

**Files:**

- Create: `src/features/search/hooks/useSearchBarState.ts`
- Create: `src/features/search/hooks/useSearchBarState.test.tsx`
- Modify: `src/components/SearchBar/SearchBar.tsx`

- [x] URL 초기값, submit navigation, picker open/close 상태를 hook 테스트로 고정한다.
- [x] `SearchBar.tsx`에서 state/handler를 hook으로 이동한다.
- [x] JSX 구조와 CSS class는 최대한 유지한다.
- [x] `npm run verify -- --no-cache`를 통과시킨다.
- [x] Commit: `refactor: extract search bar state`

### Task C: Search results state 분리

**Files:**

- Create: `src/features/search/hooks/useSearchResults.ts`
- Create: `src/features/search/hooks/useSearchResults.test.tsx`
- Create: `src/features/search/hooks/useSearchMapState.ts`
- Create: `src/features/search/hooks/useSearchMapState.test.tsx`
- Create: `src/features/search/hooks/useSearchBottomSheet.ts`
- Create: `src/features/search/hooks/useSearchBottomSheet.test.tsx`
- Modify: `src/pages/Search/Search.tsx`

- [x] 검색 API 호출과 pagination 상태를 `useSearchResults`로 이동한다.
- [x] selected/hovered/map drag 상태를 `useSearchMapState`로 이동한다.
- [x] 모바일 sheet 상태를 `useSearchBottomSheet`로 이동한다.
- [x] page query 중복 호출 방지 조건을 테스트로 고정한다.
- [x] `npm run verify -- --no-cache`를 통과시킨다.
- [x] Browser QA로 desktop/mobile search flow를 확인한다.
- [x] Commit: `refactor: extract search results state`

### Task D: Map pure helper 분리

**Files:**

- Create: `src/components/Map/lib/mapBounds.ts`
- Create: `src/components/Map/lib/mapBounds.test.ts`
- Create: `src/components/Map/lib/markerIcon.ts`
- Create: `src/components/Map/lib/markerIcon.test.ts`
- Create: `src/components/Map/lib/infoWindowContent.ts`
- Create: `src/components/Map/lib/infoWindowContent.test.ts`
- Modify: `src/components/Map/Map.tsx`

- [x] bounds compare/debounce 판단에서 순수 계산만 먼저 뺀다.
- [x] marker icon 계산을 helper로 뺀다.
- [x] InfoWindow HTML 생성을 helper로 뺀다.
- [x] `npm run verify -- --no-cache`를 통과시킨다.
- [x] Browser QA로 QA 계정 로그인, search API 200, 지도 렌더링, console error 없음, bounds query flow를 확인한다.
  - 제한: 로컬 Elasticsearch `accommodations` index가 0건이라 실제 marker/InfoWindow click flow는 현재 데이터 상태에서 확인하지 못했다. 이를 완료하려면 ES 재색인 또는 테스트 검색 데이터 투입이 필요하며, backend/data 상태 변경이므로 별도 승인 후 진행한다.
- [x] Commit: `refactor: extract map helper logic`

### Task E: AccommodationDetail data hooks 분리

**Files:**

- Create: `src/features/accommodations/hooks/useAccommodationDetail.ts`
- Create: `src/features/accommodations/hooks/useAccommodationBooking.ts`
- Create: `src/features/accommodations/hooks/useAccommodationReviews.ts`
- Create: `src/features/accommodations/hooks/useAccommodationCoupons.ts`
- Create matching tests under `src/features/accommodations/hooks/`
- Modify: `src/pages/AccommodationDetail/AccommodationDetail.tsx`

- [ ] booking price/date/query 계산을 먼저 테스트한다.
- [ ] detail load, reviews, coupons, booking hook을 순서대로 이동한다.
- [ ] section component 분리는 hook 분리 후 별도 commit으로 미룬다.
- [ ] `npm run verify -- --no-cache`를 통과시킨다.
- [ ] Browser QA로 상세/예약/리뷰/쿠폰/wishlist flow를 확인한다.
- [ ] Commit: `refactor: extract accommodation detail hooks`

### Task F: AccommodationEdit pure model 분리

**Files:**

- Create: `src/features/accommodations/edit/lib/accommodationEditMapper.ts`
- Create: `src/features/accommodations/edit/lib/accommodationEditMapper.test.ts`
- Create: `src/features/accommodations/edit/lib/accommodationEditDirty.ts`
- Create: `src/features/accommodations/edit/lib/accommodationEditDirty.test.ts`
- Create: `src/features/accommodations/edit/lib/imageItems.ts`
- Create: `src/features/accommodations/edit/lib/imageItems.test.ts`
- Create: `src/features/accommodations/edit/lib/daumAddressMapper.ts`
- Create: `src/features/accommodations/edit/lib/daumAddressMapper.test.ts`
- Create: `src/features/accommodations/edit/lib/time.ts`
- Create: `src/features/accommodations/edit/lib/time.test.ts`
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.tsx`

- [ ] API/form mapping과 dirty diff를 pure helper로 고정한다.
- [ ] image item 계산을 pure helper로 고정한다.
- [ ] hook/component 분리는 아직 하지 않는다.
- [ ] `npm run verify -- --no-cache`를 통과시킨다.
- [ ] Browser QA로 edit mode load, save-and-exit, image remove/add를 확인한다.
- [ ] Commit: `refactor: extract accommodation edit model helpers`

### Task G: AccommodationEdit hooks/components 분리

**Files:**

- Create: `src/features/accommodations/edit/hooks/useAccommodationEditForm.ts`
- Create: `src/features/accommodations/edit/hooks/useAccommodationEditImages.ts`
- Create: `src/features/accommodations/edit/hooks/useAccommodationEditSave.ts`
- Create: `src/features/accommodations/edit/hooks/useDaumPostcode.ts`
- Create page-local step components under `src/pages/AccommodationEdit/components/`
- Modify: `src/pages/AccommodationEdit/AccommodationEdit.tsx`
- Split CSS only after TSX split is stable.

- [ ] form state hook을 먼저 이동한다.
- [ ] image orchestration hook을 이동한다.
- [ ] save/publish hook을 이동한다.
- [ ] Daum Postcode global boundary를 이동한다.
- [ ] step component를 한 commit에 하나 또는 두 개씩만 이동한다.
- [ ] `npm run verify -- --no-cache`를 통과시킨다.
- [ ] Browser QA로 create/edit/publish 전체 wizard를 확인한다.
- [ ] Commit: `refactor: split accommodation edit workflow`

---

## 리팩토링 위험 구간

- `Search.tsx`의 URL query와 API 호출 중복 방지 로직: 잘못 옮기면 검색이 두 번 호출되거나 page 이동이 무시된다.
- `Map.tsx`의 bounds debounce와 fitBounds 조건: 잘못 옮기면 지도 드래그마다 과도한 검색이 발생하거나 지도가 매번 초기 위치로 돌아간다.
- `Map.tsx`의 InfoWindow inline handler: 현재 `window.*`에 의존하므로 helper 분리까지만 먼저 하고 React화는 별도 작업으로 둔다.
- `AccommodationDetail.tsx`의 예약 confirm URL: query parameter 하나만 빠져도 결제/예약 흐름이 깨진다.
- `AccommodationDetail.tsx`의 pending auth action: auth modal 이후 원래 action이 실행되는 흐름을 보존해야 한다.
- `AccommodationEdit.tsx`의 dirty diff: 변경된 필드만 보내는 구조라 mapper/compare가 조금만 달라도 저장 데이터가 누락된다.
- `AccommodationEdit.tsx`의 image lifecycle: object URL cleanup, server image delete, new image upload 순서가 섞이면 메모리 누수나 데이터 손실이 생긴다.
- `AccommodationEdit.tsx`의 Daum Postcode global boundary: 테스트 환경과 브라우저 환경 차이가 크므로 hook으로 격리해야 한다.

---

## Airbnb 스타일 디자인 시스템 적용 전 필요한 정리

- `SearchBar`, `Search`, `AccommodationDetail`, `AccommodationEdit`의 핵심 상태/API 로직을 hook/helper로 분리한다.
- `Map`은 최소한 pure helper와 script/bounds/marker hook 경계를 만든다.
- 각 화면의 CSS Module은 section/component 단위로 나눈다.
- button/input/card/loading/empty/error 등 이미 만든 `shared/ui` primitive를 작은 화면에서 검증한 뒤 큰 화면에 적용한다.
- route builder와 query helper를 사용해 직접 문자열 navigation을 줄인다.
- Browser QA 체크리스트를 Search/Detail/Edit/Wishlist 단위로 문서화하고 매 큰 refactor commit마다 실행한다.

---

## 판단

바로 Airbnb `design.md`를 입히면 안 된다. 먼저 구조 정리가 필요하다.

현재 큰 화면은 디자인과 상태/API/라우팅이 같은 파일에 붙어 있다. 디자인 변경을 시작하기 전에 최소한 SearchBar, Search state, Map helper, AccommodationDetail hooks, AccommodationEdit model helper까지는 분리해야 한다. 그 이후에 Airbnb `design.md`를 token과 `shared/ui`에 먼저 적용하고, 작은 화면부터 큰 화면으로 확장하는 순서가 안전하다.
