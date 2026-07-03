# Airbob Pre-Design Structural Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use `superpowers:test-driven-development` for every code-changing task. Steps use checkbox (`- [ ]`) syntax for tracking. Backend/API/DB/server code is read-only unless the user explicitly approves backend edits.

**Goal:** Airbnb 스타일 디자인 리팩토링 전에 Airbob 프론트엔드의 query contract, API/auth/server-state, 컴포넌트 ownership, 대형 화면 구조, 디자인 토큰 적용 기반을 안정화한다.

**Architecture:** 기존 CRA/React/TypeScript/CSS Modules 구조와 백엔드 API 계약은 유지한다. `routes`는 URL/auth/layout 정책, `pages`는 route/query 조립, `features/*`는 도메인 상태/API orchestration, `components`는 앱 전역 재사용 컴포넌트, `shared/ui`는 도메인을 모르는 primitive만 담당하게 만든다. 서버 상태는 TanStack Query를 도입해 query key와 mutation invalidation으로 관리하고, 화면 local state는 입력/패널/선택 상태에 한정한다.

**Tech Stack:** CRA 5, React 19, React Router 7, TypeScript 4.9, Axios, TanStack Query, CSS Modules, Jest/React Testing Library.

---

## Scope

포함:

- `Search`, `Profile`, `Wishlist`, payment redirect의 query parameter contract를 helper와 테스트로 고정한다.
- API response unwrap 흐름을 `requestApi` helper로 통일하고 `authApi`의 별도 `AxiosError` dialect를 제거한다.
- TanStack Query provider, query key, auth session query를 도입한다.
- `src/components`에 workflow container가 섞이지 않도록 ownership boundary test를 추가하고, 고위험 컴포넌트 이동을 시작한다.
- `Search` 결과 렌더링 중복을 먼저 제거하고, Map integration을 loader/layer/view 단위로 나눌 발판을 만든다.
- `AccommodationDetail`을 route shell과 presentation section으로 분해하는 첫 vertical slice를 수행한다.
- Airbnb 디자인 시스템 적용 전에 필요한 layout/token/primitive contract를 추가한다.
- verification gate와 QA 문서를 새 구조 기준으로 갱신한다.

제외:

- Airbnb 시각 디자인 적용.
- 백엔드/API/DB/server 코드 수정.
- API endpoint, request body, response shape 변경.
- CRA에서 Vite/Next 등으로 빌드 도구를 교체하는 작업.
- 전체 CSS Modules 일괄 토큰화. 이번 계획에서는 디자인 진입점과 새로 만지는 파일부터 통제한다.

## Protected Flows

아래 플로우는 모든 Task 후 유지되어야 한다.

- Header/Home search 입력에서 `/search` query 생성.
- Search URL query, list result, pagination, map bounds, map-drag mode, wishlist heart 동기화.
- Search/Wishlist/Map 카드에서 숙소 상세가 새 탭으로 열리는 동작.
- AccommodationDetail 날짜/게스트 query, coupon, reservation button, login pending action.
- ReservationConfirm -> Toss payment -> PaymentSuccess confirm -> ReservationDetail 또는 PaymentFail 이동.
- Profile `mode=guest|host`, `tab=listings|reservations` deep link.
- Wishlist `view=recently-viewed`, `id=<wishlistId>` deep link.
- Header user menu의 host draft 생성 -> `/accommodations/:id/edit?mode=create`.
- Auth modal, Wishlist modal, Reservation modal의 close button/Escape/backdrop 동작.

## File Structure

새로 만들 파일:

- `src/features/profile/lib/profileRouteState.ts`: `Profile` query param parse/build/normalize helper.
- `src/features/profile/lib/profileRouteState.test.ts`: profile route-state contract tests.
- `src/features/wishlist/lib/wishlistRouteState.ts`: `Wishlist` query param parse/build/normalize helper.
- `src/features/wishlist/lib/wishlistRouteState.test.ts`: wishlist route-state contract tests.
- `src/features/reservations/lib/paymentRouteState.ts`: payment query parse/validation helper.
- `src/features/reservations/lib/paymentRouteState.test.ts`: payment route-state contract tests.
- `src/api/request.ts`: Axios `ApiResponse<T>` unwrap helper.
- `src/api/request.test.ts`: `requestApi` success/null/error contract tests.
- `src/query/queryClient.ts`: shared `QueryClient` factory and default query behavior.
- `src/query/QueryProvider.tsx`: `QueryClientProvider` app wrapper.
- `src/features/auth/queryKeys.ts`: auth query key factory.
- `src/features/auth/hooks/useSessionQuery.ts`: `auth/me` server-state query hook.
- `src/components/components-boundary-contracts.test.ts`: `src/components` ownership boundary test.
- `src/features/search/components/SearchResultsList.tsx`: search result cards + empty/loading state presentation.
- `src/features/search/components/SearchResultsList.test.tsx`: search result presentation contract.
- `src/features/search/components/SearchPagination.tsx`: search pagination presentation.
- `src/features/search/components/SearchPagination.test.tsx`: pagination behavior tests.
- `src/features/search/map/useGoogleMapsScript.ts`: Google Maps script loader hook.
- `src/features/search/map/useGoogleMapsScript.test.ts`: script loader behavior tests.
- `src/features/accommodations/components/AmenityIcon.tsx`: typed amenity icon presentation.
- `src/features/accommodations/components/AmenityIcon.test.tsx`: amenity icon fallback/known icon tests.
- `src/features/accommodations/components/AccommodationHero.tsx`: detail title/action/image hero section.
- `src/features/accommodations/components/AccommodationHero.test.tsx`: hero section rendering tests.
- `src/styles/design-system-contracts.test.ts`: token/layout primitive adoption contract.

수정할 파일:

- `package.json`
- `package-lock.json`
- `src/index.tsx`
- `src/api/auth.ts`
- `src/api/accommodations.ts`
- `src/api/reservations.ts`
- `src/api/wishlist.ts`
- `src/api/reviews.ts`
- `src/api/payments.ts`
- `src/api/coupons.ts`
- `src/api/recentlyViewed.ts`
- `src/contexts/AuthContext.tsx`
- `src/pages/Profile/Profile.tsx`
- `src/pages/Wishlist/Wishlist.tsx`
- `src/pages/Search/Search.tsx`
- `src/pages/Reservations/ReservationConfirm.tsx`
- `src/pages/Reservations/PaymentSuccess.tsx`
- `src/pages/AccommodationDetail/AccommodationDetail.tsx`
- `src/components/Map/Map.tsx`
- `src/components/SearchBar/SearchBar.tsx`
- `src/components/Header/UserMenu.tsx`
- `src/styles/tokens.css`
- `src/verification-gate.test.ts`
- `docs/qa/frontend-architecture-smoke.ko.md`

## Task A: Query Parameter Contracts

**Files:**
- Create: `src/features/profile/lib/profileRouteState.ts`
- Create: `src/features/profile/lib/profileRouteState.test.ts`
- Create: `src/features/wishlist/lib/wishlistRouteState.ts`
- Create: `src/features/wishlist/lib/wishlistRouteState.test.ts`
- Create: `src/features/reservations/lib/paymentRouteState.ts`
- Create: `src/features/reservations/lib/paymentRouteState.test.ts`
- Modify: `src/pages/Profile/Profile.tsx`
- Modify: `src/pages/Wishlist/Wishlist.tsx`
- Modify: `src/pages/Reservations/ReservationConfirm.tsx`
- Modify: `src/pages/Reservations/PaymentSuccess.tsx`

- [ ] **Step 1: Write profile query contract test**

Create `src/features/profile/lib/profileRouteState.test.ts`.

```ts
import {
  buildProfileRouteSearchParams,
  parseProfileRouteState,
} from "./profileRouteState";

describe("profile route state", () => {
  it("defaults to guest mode and trips tab", () => {
    const state = parseProfileRouteState(new URLSearchParams(""));

    expect(state).toEqual({ mode: "guest", tab: "trips" });
  });

  it("normalizes host mode to listings tab when tab is missing", () => {
    const state = parseProfileRouteState(new URLSearchParams("mode=host"));

    expect(state).toEqual({ mode: "host", tab: "listings" });
  });

  it("keeps the host reservations tab", () => {
    const state = parseProfileRouteState(
      new URLSearchParams("mode=host&tab=reservations")
    );

    expect(state).toEqual({ mode: "host", tab: "reservations" });
  });

  it("falls back from invalid query values without throwing", () => {
    const state = parseProfileRouteState(
      new URLSearchParams("mode=admin&tab=payments")
    );

    expect(state).toEqual({ mode: "guest", tab: "trips" });
  });

  it("builds stable profile query strings", () => {
    expect(
      buildProfileRouteSearchParams({ mode: "host", tab: "reservations" }).toString()
    ).toBe("mode=host&tab=reservations");
  });
});
```

- [ ] **Step 2: Write wishlist query contract test**

Create `src/features/wishlist/lib/wishlistRouteState.test.ts`.

```ts
import {
  buildWishlistRouteSearchParams,
  parseWishlistRouteState,
} from "./wishlistRouteState";

describe("wishlist route state", () => {
  it("defaults to wishlist index", () => {
    expect(parseWishlistRouteState(new URLSearchParams(""))).toEqual({
      view: "index",
      wishlistId: null,
    });
  });

  it("parses recently viewed view", () => {
    expect(
      parseWishlistRouteState(new URLSearchParams("view=recently-viewed"))
    ).toEqual({
      view: "recently-viewed",
      wishlistId: null,
    });
  });

  it("parses positive wishlist ids", () => {
    expect(parseWishlistRouteState(new URLSearchParams("id=42"))).toEqual({
      view: "wishlist-detail",
      wishlistId: 42,
    });
  });

  it("ignores invalid wishlist ids", () => {
    expect(parseWishlistRouteState(new URLSearchParams("id=abc"))).toEqual({
      view: "index",
      wishlistId: null,
    });
  });

  it("builds stable wishlist query strings", () => {
    expect(
      buildWishlistRouteSearchParams({
        view: "wishlist-detail",
        wishlistId: 42,
      }).toString()
    ).toBe("id=42");
  });
});
```

- [ ] **Step 3: Write payment query contract test**

Create `src/features/reservations/lib/paymentRouteState.test.ts`.

```ts
import { parsePaymentRouteState } from "./paymentRouteState";

describe("payment route state", () => {
  it("parses complete reservation confirm query params", () => {
    const state = parsePaymentRouteState(
      new URLSearchParams(
        "reservationUid=r-1&orderName=Airbob&amount=120000&customerEmail=a%40b.com&customerName=Jae&checkIn=2026-08-01&checkOut=2026-08-03&adultOccupancy=2&childOccupancy=1&infantOccupancy=0&petOccupancy=1&couponName=Summer&couponDiscount=10000"
      )
    );

    expect(state).toEqual({
      status: "valid",
      reservationUid: "r-1",
      orderName: "Airbob",
      amount: 120000,
      customerEmail: "a@b.com",
      customerName: "Jae",
      checkIn: new Date("2026-08-01"),
      checkOut: new Date("2026-08-03"),
      adultOccupancy: 2,
      childOccupancy: 1,
      infantOccupancy: 0,
      petOccupancy: 1,
      couponName: "Summer",
      couponDiscount: 10000,
    });
  });

  it("marks payment query invalid when required Toss values are missing", () => {
    const state = parsePaymentRouteState(new URLSearchParams("reservationUid=r-1"));

    expect(state).toEqual({
      status: "invalid",
      reason: "MISSING_PAYMENT_QUERY",
    });
  });

  it("marks payment query invalid when amount is not numeric", () => {
    const state = parsePaymentRouteState(
      new URLSearchParams(
        "reservationUid=r-1&orderName=Airbob&amount=abc&customerEmail=a%40b.com&customerName=Jae"
      )
    );

    expect(state).toEqual({
      status: "invalid",
      reason: "INVALID_PAYMENT_AMOUNT",
    });
  });
});
```

- [ ] **Step 4: Run tests to verify failure**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/profile/lib/profileRouteState.test.ts src/features/wishlist/lib/wishlistRouteState.test.ts src/features/reservations/lib/paymentRouteState.test.ts
```

Expected:

```text
Cannot find module './profileRouteState'
Cannot find module './wishlistRouteState'
Cannot find module './paymentRouteState'
```

- [ ] **Step 5: Implement profile route-state helper**

Create `src/features/profile/lib/profileRouteState.ts`.

```ts
export type ProfileMode = "guest" | "host";
export type ProfileTab = "trips" | "listings" | "reservations";

export interface ProfileRouteState {
  mode: ProfileMode;
  tab: ProfileTab;
}

const isProfileMode = (value: string | null): value is ProfileMode =>
  value === "guest" || value === "host";

const isHostTab = (value: string | null): value is "listings" | "reservations" =>
  value === "listings" || value === "reservations";

export const parseProfileRouteState = (
  searchParams: URLSearchParams
): ProfileRouteState => {
  const mode = isProfileMode(searchParams.get("mode"))
    ? searchParams.get("mode")!
    : "guest";

  if (mode === "guest") {
    return { mode, tab: "trips" };
  }

  const tab = isHostTab(searchParams.get("tab"))
    ? searchParams.get("tab")!
    : "listings";

  return { mode, tab };
};

export const buildProfileRouteSearchParams = ({
  mode,
  tab,
}: ProfileRouteState): URLSearchParams => {
  const params = new URLSearchParams();

  if (mode === "host") {
    params.set("mode", "host");
    params.set("tab", tab === "reservations" ? "reservations" : "listings");
  }

  return params;
};
```

- [ ] **Step 6: Implement wishlist route-state helper**

Create `src/features/wishlist/lib/wishlistRouteState.ts`.

```ts
export type WishlistRouteView = "index" | "recently-viewed" | "wishlist-detail";

export interface WishlistRouteState {
  view: WishlistRouteView;
  wishlistId: number | null;
}

const parsePositiveInteger = (value: string | null): number | null => {
  if (!value) return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const parseWishlistRouteState = (
  searchParams: URLSearchParams
): WishlistRouteState => {
  if (searchParams.get("view") === "recently-viewed") {
    return { view: "recently-viewed", wishlistId: null };
  }

  const wishlistId = parsePositiveInteger(searchParams.get("id"));

  if (wishlistId !== null) {
    return { view: "wishlist-detail", wishlistId };
  }

  return { view: "index", wishlistId: null };
};

export const buildWishlistRouteSearchParams = ({
  view,
  wishlistId,
}: WishlistRouteState): URLSearchParams => {
  const params = new URLSearchParams();

  if (view === "recently-viewed") {
    params.set("view", "recently-viewed");
  }

  if (view === "wishlist-detail" && wishlistId !== null) {
    params.set("id", String(wishlistId));
  }

  return params;
};
```

- [ ] **Step 7: Implement payment route-state helper**

Create `src/features/reservations/lib/paymentRouteState.ts`.

```ts
export type InvalidPaymentRouteReason =
  | "MISSING_PAYMENT_QUERY"
  | "INVALID_PAYMENT_AMOUNT";

export type PaymentRouteState =
  | {
      status: "valid";
      reservationUid: string;
      orderName: string;
      amount: number;
      customerEmail: string;
      customerName: string;
      checkIn: Date | null;
      checkOut: Date | null;
      adultOccupancy: number;
      childOccupancy: number;
      infantOccupancy: number;
      petOccupancy: number;
      couponName: string | null;
      couponDiscount: number;
    }
  | {
      status: "invalid";
      reason: InvalidPaymentRouteReason;
    };

const parseOptionalDate = (value: string | null): Date | null => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseOccupancy = (value: string | null, fallback: number): number => {
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const parseMoney = (value: string | null): number | null => {
  if (!value) return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

export const parsePaymentRouteState = (
  searchParams: URLSearchParams
): PaymentRouteState => {
  const reservationUid = searchParams.get("reservationUid");
  const orderName = searchParams.get("orderName");
  const amount = parseMoney(searchParams.get("amount"));
  const customerEmail = searchParams.get("customerEmail");
  const customerName = searchParams.get("customerName");

  if (!reservationUid || !orderName || !customerEmail || !customerName) {
    return { status: "invalid", reason: "MISSING_PAYMENT_QUERY" };
  }

  if (amount === null) {
    return { status: "invalid", reason: "INVALID_PAYMENT_AMOUNT" };
  }

  return {
    status: "valid",
    reservationUid,
    orderName,
    amount,
    customerEmail,
    customerName,
    checkIn: parseOptionalDate(searchParams.get("checkIn")),
    checkOut: parseOptionalDate(searchParams.get("checkOut")),
    adultOccupancy: parseOccupancy(searchParams.get("adultOccupancy"), 1),
    childOccupancy: parseOccupancy(searchParams.get("childOccupancy"), 0),
    infantOccupancy: parseOccupancy(searchParams.get("infantOccupancy"), 0),
    petOccupancy: parseOccupancy(searchParams.get("petOccupancy"), 0),
    couponName: searchParams.get("couponName"),
    couponDiscount: parseMoney(searchParams.get("couponDiscount")) ?? 0,
  };
};
```

- [ ] **Step 8: Run contract tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/profile/lib/profileRouteState.test.ts src/features/wishlist/lib/wishlistRouteState.test.ts src/features/reservations/lib/paymentRouteState.test.ts
```

Expected: PASS.

- [ ] **Step 9: Wire helpers into pages**

Modify:

- `src/pages/Profile/Profile.tsx`: replace inline `mode`/`tab` parsing with `parseProfileRouteState(searchParams)`.
- `src/pages/Wishlist/Wishlist.tsx`: replace initial `viewParam`/`wishlistIdParam` parsing with `parseWishlistRouteState(searchParams)`.
- `src/pages/Reservations/ReservationConfirm.tsx`: replace direct `searchParams.get(...)` payment parsing with `parsePaymentRouteState(searchParams)`.
- `src/pages/Reservations/PaymentSuccess.tsx`: keep existing Toss result handling, but use parsed invalid state when a payment query is incomplete.

Use this pattern in `ReservationConfirm.tsx`:

```tsx
const paymentRouteState = parsePaymentRouteState(searchParams);

const reservationUid =
  paymentRouteState.status === "valid" ? paymentRouteState.reservationUid : null;
const orderName =
  paymentRouteState.status === "valid" ? paymentRouteState.orderName : null;
const amount =
  paymentRouteState.status === "valid" ? paymentRouteState.amount : null;
```

- [ ] **Step 10: Run affected tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/pages/Profile/profile-responsive-contracts.test.ts src/pages/Wishlist/Wishlist.tsx src/pages/Reservations/PaymentSuccess.test.tsx src/pages/Reservations/ReservationDetail.test.tsx src/features/profile/lib/profileRouteState.test.ts src/features/wishlist/lib/wishlistRouteState.test.ts src/features/reservations/lib/paymentRouteState.test.ts
```

Expected: PASS, except `src/pages/Wishlist/Wishlist.tsx` is not a test path. If Jest reports "No tests found" for that path, rerun without it:

```bash
npm run test:ci -- --runTestsByPath src/pages/Profile/profile-responsive-contracts.test.ts src/pages/Reservations/PaymentSuccess.test.tsx src/pages/Reservations/ReservationDetail.test.tsx src/features/profile/lib/profileRouteState.test.ts src/features/wishlist/lib/wishlistRouteState.test.ts src/features/reservations/lib/paymentRouteState.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/features/profile/lib src/features/wishlist/lib src/features/reservations/lib src/pages/Profile/Profile.tsx src/pages/Wishlist/Wishlist.tsx src/pages/Reservations/ReservationConfirm.tsx src/pages/Reservations/PaymentSuccess.tsx
git commit -m "refactor: codify frontend query route contracts"
```

## Task B: API Request Helper And Auth Error Unification

**Files:**
- Create: `src/api/request.ts`
- Create: `src/api/request.test.ts`
- Modify: `src/api/auth.ts`
- Modify: `src/api/accommodations.ts`
- Modify: `src/api/reservations.ts`
- Modify: `src/api/wishlist.ts`
- Modify: `src/api/reviews.ts`
- Modify: `src/api/payments.ts`
- Modify: `src/api/coupons.ts`
- Modify: `src/api/recentlyViewed.ts`
- Modify: `src/api/index.ts`

- [ ] **Step 1: Write request helper tests**

Create `src/api/request.test.ts`.

```ts
import { ApiResponse } from "../types/api";
import { ApiClientError } from "./response";
import { requestApi, requestApiNullable } from "./request";

describe("requestApi", () => {
  it("unwraps successful API envelopes", async () => {
    const result = await requestApi(async () => ({
      data: {
        success: true,
        data: { id: 1, name: "Airbob" },
      } satisfies ApiResponse<{ id: number; name: string }>,
    }));

    expect(result).toEqual({ id: 1, name: "Airbob" });
  });

  it("allows null only through requestApiNullable", async () => {
    const result = await requestApiNullable(async () => ({
      data: {
        success: true,
        data: null,
      } satisfies ApiResponse<null>,
    }));

    expect(result).toBeNull();
  });

  it("throws ApiClientError for unsuccessful envelopes", async () => {
    await expect(
      requestApi(async () => ({
        data: {
          success: false,
          error: {
            message: "로그인이 필요합니다.",
            status: 401,
            code: "UNAUTHORIZED",
          },
        } satisfies ApiResponse<never>,
      }))
    ).rejects.toMatchObject<ApiClientError>({
      name: "ApiClientError",
      message: "로그인이 필요합니다.",
      status: 401,
      code: "UNAUTHORIZED",
    });
  });
});
```

- [ ] **Step 2: Run helper test to verify failure**

Run:

```bash
npm run test:ci -- --runTestsByPath src/api/request.test.ts
```

Expected:

```text
Cannot find module './request'
```

- [ ] **Step 3: Implement request helper**

Create `src/api/request.ts`.

```ts
import { ApiResponse } from "../types/api";
import { unwrapApiResponse } from "./response";

type ApiRequest<T> = () => Promise<{ data: ApiResponse<T> }>;

export async function requestApi<T>(
  request: ApiRequest<T>
): Promise<NonNullable<T>> {
  const response = await request();
  return unwrapApiResponse(response.data);
}

export async function requestApiNullable<T>(
  request: ApiRequest<T>
): Promise<T | null> {
  const response = await request();
  return unwrapApiResponse(response.data, { allowNull: true });
}
```

- [ ] **Step 4: Verify helper test passes**

Run:

```bash
npm run test:ci -- --runTestsByPath src/api/request.test.ts src/api/response.test.ts
```

Expected: PASS.

- [ ] **Step 5: Migrate authApi onto request helper**

Replace `src/api/auth.ts` with this structure.

```ts
import { client } from "./client";
import { requestApi, requestApiNullable } from "./request";
import { LoginRequest, MeInfo, SignupRequest } from "../types/auth";

export const authApi = {
  login: async (request: LoginRequest): Promise<void> => {
    await requestApiNullable(() => client.post("/auth/login", request));
  },

  signup: async (request: SignupRequest): Promise<void> => {
    await requestApiNullable(() => client.post("/members", request));
  },

  logout: async (): Promise<void> => {
    await requestApiNullable(() => client.post("/auth/logout"));
  },

  getMe: async (): Promise<MeInfo> => {
    return requestApi(() => client.get("/auth/me"));
  },
};
```

- [ ] **Step 6: Migrate domain API wrappers incrementally**

For each API file, replace this pattern:

```ts
const response = await client.get<ApiResponse<AccommodationSearchResponse>>(
  "/search/accommodations",
  { params }
);
return unwrapApiResponse(response.data);
```

with:

```ts
return requestApi(() =>
  client.get("/search/accommodations", { params })
);
```

For `void` endpoints, replace:

```ts
const response = await client.patch<ApiResponse<null>>(`/accommodations/${accommodationId}/publish`);
unwrapApiResponse(response.data, { allowNull: true });
```

with:

```ts
await requestApiNullable(() =>
  client.patch(`/accommodations/${accommodationId}/publish`)
);
```

Apply this to:

- `src/api/accommodations.ts`
- `src/api/reservations.ts`
- `src/api/wishlist.ts`
- `src/api/reviews.ts`
- `src/api/payments.ts`
- `src/api/coupons.ts`
- `src/api/recentlyViewed.ts`

- [ ] **Step 7: Export request helper**

Ensure `src/api/index.ts` exports the helper.

```ts
export * from "./request";
```

- [ ] **Step 8: Run API tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/api/request.test.ts src/api/response.test.ts src/api/api-response-contracts.test.ts src/api/auth-boundary-contracts.test.ts src/api/ui-api-boundary-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/api
git commit -m "refactor: unify API response handling"
```

## Task C: TanStack Query Provider And Auth Session Boundary

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/query/queryClient.ts`
- Create: `src/query/QueryProvider.tsx`
- Create: `src/features/auth/queryKeys.ts`
- Create: `src/features/auth/hooks/useSessionQuery.ts`
- Create: `src/features/auth/hooks/useSessionQuery.test.tsx`
- Modify: `src/index.tsx`
- Modify: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: Install TanStack Query**

Run:

```bash
npm install @tanstack/react-query
```

Expected:

```text
added ... @tanstack/react-query
```

- [ ] **Step 2: Write session query test**

Create `src/features/auth/hooks/useSessionQuery.test.tsx`.

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { authApi } from "../../../api";
import { useSessionQuery } from "./useSessionQuery";

jest.mock("../../../api", () => ({
  authApi: {
    getMe: jest.fn(),
  },
}));

const mockGetMe = authApi.getMe as jest.MockedFunction<typeof authApi.getMe>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

describe("useSessionQuery", () => {
  beforeEach(() => {
    mockGetMe.mockReset();
  });

  it("returns authenticated session when authApi.getMe succeeds", async () => {
    mockGetMe.mockResolvedValue({
      id: 1,
      email: "jae@example.com",
      nickname: "jae",
    });

    const { result } = renderHook(() => useSessionQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      id: 1,
      email: "jae@example.com",
      nickname: "jae",
    });
  });

  it("keeps unauthenticated state in query error instead of throwing during render", async () => {
    mockGetMe.mockRejectedValue(new Error("unauthorized"));

    const { result } = renderHook(() => useSessionQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run session query test to verify failure**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/auth/hooks/useSessionQuery.test.tsx
```

Expected:

```text
Cannot find module './useSessionQuery'
```

- [ ] **Step 4: Implement query client**

Create `src/query/queryClient.ts`.

```ts
import { QueryClient } from "@tanstack/react-query";

export const createAppQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
```

- [ ] **Step 5: Implement QueryProvider**

Create `src/query/QueryProvider.tsx`.

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createAppQueryClient } from "./queryClient";

const queryClient = createAppQueryClient();

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 6: Implement auth query key and hook**

Create `src/features/auth/queryKeys.ts`.

```ts
export const authQueryKeys = {
  all: ["auth"] as const,
  me: () => [...authQueryKeys.all, "me"] as const,
};
```

Create `src/features/auth/hooks/useSessionQuery.ts`.

```ts
import { useQuery } from "@tanstack/react-query";
import { authApi } from "../../../api";
import { authQueryKeys } from "../queryKeys";

export const useSessionQuery = () =>
  useQuery({
    queryKey: authQueryKeys.me(),
    queryFn: authApi.getMe,
    retry: false,
  });
```

- [ ] **Step 7: Wrap app with QueryProvider**

Modify `src/index.tsx` so `QueryProvider` wraps `AuthProvider`.

```tsx
import { QueryProvider } from "./query/QueryProvider";

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
```

- [ ] **Step 8: Refactor AuthContext to use session query as source of truth**

Modify `src/contexts/AuthContext.tsx` so `isAuthenticated` derives from query state and login/logout invalidate auth query. Keep the public context shape unchanged.

```tsx
import React, { createContext, useContext, ReactNode, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api";
import { onAuthError } from "../utils/authEvents";
import { LoginRequest } from "../types/auth";
import { authQueryKeys } from "../features/auth/queryKeys";
import { useSessionQuery } from "../features/auth/hooks/useSessionQuery";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  const sessionQuery = useSessionQuery();

  React.useEffect(() => {
    const unsubscribe = onAuthError(() => {
      queryClient.removeQueries({ queryKey: authQueryKeys.me() });
    });

    return unsubscribe;
  }, [queryClient]);

  const checkAuth = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: authQueryKeys.me() });
  }, [queryClient]);

  const login = async (credentials: LoginRequest) => {
    await authApi.login(credentials);
    await queryClient.invalidateQueries({ queryKey: authQueryKeys.me() });
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.removeQueries({ queryKey: authQueryKeys.me() });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: sessionQuery.isSuccess,
        isLoading: sessionQuery.isLoading,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
```

- [ ] **Step 9: Run auth/session tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/auth/hooks/useSessionQuery.test.tsx src/routes/RequireAuth.test.tsx src/components/Header/Header.test.tsx src/api/auth-boundary-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 10: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/query src/features/auth src/index.tsx src/contexts/AuthContext.tsx
git commit -m "refactor: introduce server-state auth boundary"
```

## Task D: Component Ownership Boundary

**Files:**
- Create: `src/components/components-boundary-contracts.test.ts`
- Modify: `src/components/Header/UserMenu.tsx`
- Move: `src/components/SearchBar/*` to `src/features/search/components/SearchBar/*`
- Move: `src/components/ReservationModal/*` to `src/features/reservations/components/ReservationModal/*`
- Move: `src/components/AuthModal/*` to `src/features/auth/components/AuthModal/*`
- Modify imports in affected files.

- [ ] **Step 1: Write boundary test with current allowed exceptions**

Create `src/components/components-boundary-contracts.test.ts`.

```ts
import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

const componentsRoot = join(process.cwd(), "src/components");
const productionSourceExtensions = [".ts", ".tsx"];
const forbiddenImportPattern =
  /from\s+["'](?:\.\.\/)+(?:api|features|pages)(?:\/[^"']*)?["']/;

const allowedWorkflowFiles = new Set([
  "Header/UserMenu.tsx",
  "Map/Map.tsx",
]);

const collectProductionSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectProductionSourceFiles(entryPath);
    }

    const isProductionSource =
      productionSourceExtensions.some((extension) => entry.name.endsWith(extension)) &&
      !entry.name.includes(".test.") &&
      !entry.name.endsWith(".d.ts");

    return isProductionSource ? [entryPath] : [];
  });

describe("components ownership boundary", () => {
  it("keeps generic components from importing app API or feature orchestration", () => {
    const violations = collectProductionSourceFiles(componentsRoot)
      .map((filePath) => ({
        filePath,
        relativePath: relative(componentsRoot, filePath),
        source: readFileSync(filePath, "utf8"),
      }))
      .filter(({ relativePath }) => !allowedWorkflowFiles.has(relativePath))
      .filter(({ source }) => forbiddenImportPattern.test(source))
      .map(({ relativePath }) => relativePath);

    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run boundary test to see current violations**

Run:

```bash
npm run test:ci -- --runTestsByPath src/components/components-boundary-contracts.test.ts
```

Expected: FAIL with workflow components still under `src/components`, especially `AuthModal`, `ReservationModal`, and `SearchBar`.

- [ ] **Step 3: Move SearchBar into search feature**

Move files:

```text
src/components/SearchBar/SearchBar.tsx -> src/features/search/components/SearchBar/SearchBar.tsx
src/components/SearchBar/SearchBar.module.css -> src/features/search/components/SearchBar/SearchBar.module.css
src/components/SearchBar/index.ts -> src/features/search/components/SearchBar/index.ts
```

Update relative imports inside moved `SearchBar.tsx`:

```tsx
import { DatePicker } from "../../../../components/DatePicker";
import {
  type SearchParams,
  useSearchBarState,
} from "../../hooks/useSearchBarState";
```

Update import users:

```tsx
import { SearchBar } from "../../features/search/components/SearchBar";
```

for `src/components/Header/Header.tsx`, adjusting relative path from Header to features:

```tsx
import { SearchBar } from "../../features/search/components/SearchBar";
```

- [ ] **Step 4: Move ReservationModal into reservations feature**

Move files:

```text
src/components/ReservationModal/ReservationModal.tsx -> src/features/reservations/components/ReservationModal/ReservationModal.tsx
src/components/ReservationModal/ReservationModal.module.css -> src/features/reservations/components/ReservationModal/ReservationModal.module.css
src/components/ReservationModal/index.ts -> src/features/reservations/components/ReservationModal/index.ts
src/components/ReservationModal/ReservationModal.test.tsx -> src/features/reservations/components/ReservationModal/ReservationModal.test.tsx
```

Update imports inside moved `ReservationModal.tsx`:

```tsx
import { AccommodationDetail } from "../../../../types/accommodation";
import { useApiError } from "../../../../hooks/useApiError";
import { useAuth } from "../../../../hooks/useAuth";
import { useReservationPayment } from "../../hooks/useReservationPayment";
import { Dialog } from "../../../../shared/ui";
import { ErrorToast } from "../../../../components/ErrorToast";
import { getImageUrl } from "../../../../utils/image";
```

Update import users:

```tsx
import ReservationModal from "../../features/reservations/components/ReservationModal";
```

- [ ] **Step 5: Move AuthModal into auth feature**

Move files:

```text
src/components/AuthModal/AuthModal.tsx -> src/features/auth/components/AuthModal/AuthModal.tsx
src/components/AuthModal/AuthModal.module.css -> src/features/auth/components/AuthModal/AuthModal.module.css
src/components/AuthModal/index.ts -> src/features/auth/components/AuthModal/index.ts
src/components/AuthModal/AuthModal.test.tsx -> src/features/auth/components/AuthModal/AuthModal.test.tsx
```

Update imports inside moved `AuthModal.tsx` with this base pattern:

```tsx
import { useAuth } from "../../../../hooks/useAuth";
import { useSignup } from "../../hooks/useSignup";
import { Dialog } from "../../../../shared/ui";
```

Update import users:

```tsx
import { AuthModal } from "../../features/auth/components/AuthModal";
```

Use the correct relative path from each importing file.

- [ ] **Step 6: Run moved component tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/auth/components/AuthModal/AuthModal.test.tsx src/features/reservations/components/ReservationModal/ReservationModal.test.tsx src/components/Header/Header.test.tsx src/components/components-boundary-contracts.test.ts
```

Expected: PASS for moved tests and boundary test. `Header/UserMenu.tsx` and `Map/Map.tsx` remain explicit exceptions for later tasks.

- [ ] **Step 7: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components src/features/auth src/features/reservations src/features/search
git commit -m "refactor: separate workflow containers from generic components"
```

## Task E: Search Results Decomposition

**Files:**
- Create: `src/features/search/components/SearchPagination.tsx`
- Create: `src/features/search/components/SearchPagination.test.tsx`
- Create: `src/features/search/components/SearchResultsList.tsx`
- Create: `src/features/search/components/SearchResultsList.test.tsx`
- Modify: `src/pages/Search/Search.tsx`

- [ ] **Step 1: Write SearchPagination test**

Create `src/features/search/components/SearchPagination.test.tsx`.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchPagination } from "./SearchPagination";

describe("SearchPagination", () => {
  it("renders page controls and dispatches selected page index", async () => {
    const onPageChange = jest.fn();

    render(
      <SearchPagination
        currentPage={1}
        isLoading={false}
        totalPages={4}
        onPageChange={onPageChange}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "3" }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables previous button on the first page", () => {
    render(
      <SearchPagination
        currentPage={0}
        isLoading={false}
        totalPages={4}
        onPageChange={jest.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Write SearchResultsList test**

Create `src/features/search/components/SearchResultsList.test.tsx`.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccommodationSearchInfo } from "../../../types/accommodation";
import { SearchResultsList } from "./SearchResultsList";

jest.mock("../../../../components/AccommodationCard", () => ({
  AccommodationCardSearch: ({
    accommodation,
    onClick,
  }: {
    accommodation: AccommodationSearchInfo;
    onClick: () => void;
  }) => <button onClick={onClick}>{accommodation.name}</button>,
}));

const accommodation = {
  id: 7,
  name: "Seoul stay",
  base_price: 120000,
  thumbnail_url: null,
  is_in_wishlist: false,
  address_summary: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: "Mapo",
  },
  review_summary: {
    average_rating: 4.8,
    total_count: 12,
  },
} as AccommodationSearchInfo;

describe("SearchResultsList", () => {
  it("renders loading state before first results", () => {
    render(
      <SearchResultsList
        accommodations={[]}
        checkIn={null}
        checkOut={null}
        currentPage={0}
        hoveredAccommodationId={null}
        isLoading
        selectedAccommodationId={null}
        totalPages={0}
        layout="desktop"
        onAccommodationClick={jest.fn()}
        onHoverAccommodation={jest.fn()}
        onPageChange={jest.fn()}
        onWishlistToggle={jest.fn()}
      />
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("renders cards and delegates click intent", async () => {
    const onAccommodationClick = jest.fn();

    render(
      <SearchResultsList
        accommodations={[accommodation]}
        checkIn="2026-08-01"
        checkOut="2026-08-02"
        currentPage={0}
        hoveredAccommodationId={null}
        isLoading={false}
        selectedAccommodationId={null}
        totalPages={1}
        layout="desktop"
        onAccommodationClick={onAccommodationClick}
        onHoverAccommodation={jest.fn()}
        onPageChange={jest.fn()}
        onWishlistToggle={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Seoul stay" }));

    expect(onAccommodationClick).toHaveBeenCalledWith(7);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/components/SearchPagination.test.tsx src/features/search/components/SearchResultsList.test.tsx
```

Expected:

```text
Cannot find module './SearchPagination'
Cannot find module './SearchResultsList'
```

- [ ] **Step 4: Implement SearchPagination**

Create `src/features/search/components/SearchPagination.tsx`.

```tsx
import React from "react";
import {
  getLimitedTotalPages,
  getPaginationItems,
} from "../lib/pagination";
import styles from "../../../pages/Search/Search.module.css";

interface SearchPaginationProps {
  currentPage: number;
  isLoading: boolean;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function SearchPagination({
  currentPage,
  isLoading,
  totalPages,
  onPageChange,
}: SearchPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={styles.paginationContainer}>
      <div className={styles.pagination}>
        <button
          className={styles.paginationButton}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0 || isLoading}
        >
          이전
        </button>
        {getPaginationItems({ currentPage, totalPages }).map((page, index) => {
          if (page === "ellipsis") {
            return (
              <span key={`ellipsis-${index}`} className={styles.paginationEllipsis}>
                ...
              </span>
            );
          }

          return (
            <button
              key={page}
              className={`${styles.paginationButton} ${
                page === currentPage ? styles.paginationButtonActive : ""
              }`}
              onClick={() => onPageChange(page)}
              disabled={isLoading}
            >
              {page + 1}
            </button>
          );
        })}
        <button
          className={styles.paginationButton}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= getLimitedTotalPages(totalPages) - 1 || isLoading}
        >
          다음
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement SearchResultsList**

Create `src/features/search/components/SearchResultsList.tsx`.

```tsx
import React from "react";
import { AccommodationCardSearch } from "../../../components/AccommodationCard";
import { ListContainer } from "../../../components/ListContainer";
import { AccommodationSearchInfo } from "../../../types/accommodation";
import { SearchPagination } from "./SearchPagination";
import styles from "../../../pages/Search/Search.module.css";

interface SearchResultsListProps {
  accommodations: AccommodationSearchInfo[];
  checkIn: string | null;
  checkOut: string | null;
  currentPage: number;
  hoveredAccommodationId: number | null;
  isLoading: boolean;
  layout: "desktop" | "bottom-sheet";
  selectedAccommodationId: number | null;
  totalPages: number;
  onAccommodationClick: (accommodationId: number) => void;
  onHoverAccommodation: (accommodationId: number | null) => void;
  onPageChange: (page: number) => void;
  onWishlistToggle: (accommodationId: number) => void;
}

export function SearchResultsList({
  accommodations,
  checkIn,
  checkOut,
  currentPage,
  isLoading,
  layout,
  selectedAccommodationId,
  totalPages,
  onAccommodationClick,
  onHoverAccommodation,
  onPageChange,
  onWishlistToggle,
}: SearchResultsListProps) {
  if (isLoading && accommodations.length === 0) {
    return <div className={styles.loading}>로딩 중...</div>;
  }

  if (accommodations.length === 0) {
    return <div className={styles.empty}>검색 결과가 없습니다.</div>;
  }

  const cards = accommodations.map((accommodation) => (
    <div
      key={accommodation.id}
      id={`accommodation-${accommodation.id}`}
      onMouseEnter={() => onHoverAccommodation(accommodation.id)}
      onMouseLeave={() => onHoverAccommodation(null)}
      className={`${styles.cardWrapper} ${
        selectedAccommodationId === accommodation.id ? styles.selected : ""
      }`}
    >
      <AccommodationCardSearch
        accommodation={accommodation}
        onClick={() => onAccommodationClick(accommodation.id)}
        onWishlistToggle={() => onWishlistToggle(accommodation.id)}
        checkIn={checkIn}
        checkOut={checkOut}
      />
    </div>
  ));

  return (
    <>
      {layout === "desktop" ? (
        <ListContainer columns={3} gap={10}>{cards}</ListContainer>
      ) : (
        <div className={styles.cardGrid}>{cards}</div>
      )}
      <SearchPagination
        currentPage={currentPage}
        isLoading={isLoading}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </>
  );
}
```

- [ ] **Step 6: Replace duplicated Search rendering**

Modify `src/pages/Search/Search.tsx`:

- Import `SearchResultsList`.
- Replace the mobile bottom-sheet card grid/pagination block with `SearchResultsList`.
- Replace the desktop `ListContainer`/pagination block with `SearchResultsList`.

Use this call for mobile:

```tsx
<SearchResultsList
  accommodations={accommodations}
  checkIn={searchParams.get("checkIn")}
  checkOut={searchParams.get("checkOut")}
  currentPage={currentPage}
  hoveredAccommodationId={hoveredAccommodationId}
  isLoading={isLoading}
  layout="bottom-sheet"
  selectedAccommodationId={selectedAccommodationId}
  totalPages={totalPages}
  onAccommodationClick={handleAccommodationCardClick}
  onHoverAccommodation={setHoveredAccommodationId}
  onPageChange={handlePageChange}
  onWishlistToggle={openWishlistModal}
/>
```

Use this call for desktop with `layout="desktop"`.

- [ ] **Step 7: Run Search tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/components/SearchPagination.test.tsx src/features/search/components/SearchResultsList.test.tsx src/features/search/hooks/useSearchResults.test.tsx src/features/search/hooks/useSearchBottomSheet.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/search/components src/pages/Search/Search.tsx
git commit -m "refactor: share search result rendering"
```

## Task F: Google Maps Script Loader Boundary

**Files:**
- Create: `src/features/search/map/useGoogleMapsScript.ts`
- Create: `src/features/search/map/useGoogleMapsScript.test.ts`
- Modify: `src/components/Map/Map.tsx`

- [ ] **Step 1: Write script loader tests**

Create `src/features/search/map/useGoogleMapsScript.test.ts`.

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { useGoogleMapsScript } from "./useGoogleMapsScript";

const originalEnv = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

describe("useGoogleMapsScript", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    delete (window as Partial<Window>).google;
    process.env.REACT_APP_GOOGLE_MAPS_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.REACT_APP_GOOGLE_MAPS_API_KEY = originalEnv;
  });

  it("adds one Google Maps script tag", () => {
    renderHook(() => useGoogleMapsScript());
    renderHook(() => useGoogleMapsScript());

    expect(
      document.querySelectorAll('script[src*="maps.googleapis.com"]').length
    ).toBe(1);
  });

  it("reports missing key without appending script", async () => {
    process.env.REACT_APP_GOOGLE_MAPS_API_KEY = "";

    const { result } = renderHook(() => useGoogleMapsScript());

    await waitFor(() => {
      expect(result.current.status).toBe("missing-key");
    });

    expect(document.querySelector('script[src*="maps.googleapis.com"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run loader tests to verify failure**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/map/useGoogleMapsScript.test.ts
```

Expected:

```text
Cannot find module './useGoogleMapsScript'
```

- [ ] **Step 3: Implement script loader hook**

Create `src/features/search/map/useGoogleMapsScript.ts`.

```ts
import { useEffect, useState } from "react";

type GoogleMapsScriptStatus = "idle" | "loading" | "loaded" | "error" | "missing-key";

const hasGoogleMaps = () =>
  !!(
    window.google &&
    window.google.maps &&
    window.google.maps.Map &&
    typeof window.google.maps.Map === "function"
  );

export function useGoogleMapsScript() {
  const [status, setStatus] = useState<GoogleMapsScriptStatus>(() =>
    hasGoogleMaps() ? "loaded" : "idle"
  );

  useEffect(() => {
    if (hasGoogleMaps()) {
      setStatus("loaded");
      return;
    }

    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setStatus("missing-key");
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com"]'
    );

    if (existingScript) {
      setStatus("loading");
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => setStatus("loaded");
    script.onerror = () => setStatus("error");
    document.head.appendChild(script);
    setStatus("loading");
  }, []);

  return {
    isLoaded: status === "loaded" || hasGoogleMaps(),
    status,
  };
}
```

- [ ] **Step 4: Replace Map inline script loading**

Modify `src/components/Map/Map.tsx`:

- Import `useGoogleMapsScript` from `../../features/search/map/useGoogleMapsScript`.
- Remove the existing script injection effect from lines around the current Google Maps loading block.
- Replace local `isMapLoaded` state usage with:

```tsx
const { isLoaded: isMapLoaded, status: mapScriptStatus } = useGoogleMapsScript();
```

- In render fallback, show `"지도를 불러올 수 없습니다."` when `mapScriptStatus === "missing-key" || mapScriptStatus === "error"`.

- [ ] **Step 5: Run map tests and typecheck**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/search/map/useGoogleMapsScript.test.ts src/components/Map/lib/mapBounds.test.ts src/components/Map/lib/infoWindowContent.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/search/map src/components/Map/Map.tsx
git commit -m "refactor: isolate google maps script loading"
```

## Task G: Accommodation Detail First Decomposition Slice

**Files:**
- Create: `src/features/accommodations/components/AmenityIcon.tsx`
- Create: `src/features/accommodations/components/AmenityIcon.test.tsx`
- Create: `src/features/accommodations/components/AccommodationHero.tsx`
- Create: `src/features/accommodations/components/AccommodationHero.test.tsx`
- Modify: `src/pages/AccommodationDetail/AccommodationDetail.tsx`

- [ ] **Step 1: Write AmenityIcon test**

Create `src/features/accommodations/components/AmenityIcon.test.tsx`.

```tsx
import { render, screen } from "@testing-library/react";
import { AmenityIcon } from "./AmenityIcon";

describe("AmenityIcon", () => {
  it("renders a labelled known amenity icon", () => {
    render(<AmenityIcon type="WIFI" />);

    expect(screen.getByRole("img", { name: "WIFI" })).toBeInTheDocument();
  });

  it("renders fallback icon for unknown amenity types", () => {
    render(<AmenityIcon type="UNKNOWN_AMENITY" />);

    expect(screen.getByRole("img", { name: "UNKNOWN_AMENITY" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write AccommodationHero test**

Create `src/features/accommodations/components/AccommodationHero.test.tsx`.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccommodationHero } from "./AccommodationHero";

const accommodation = {
  id: 1,
  name: "Airbob home",
  is_in_wishlist: true,
  images: [
    { id: 10, image_url: "/a.jpg" },
    { id: 11, image_url: "/b.jpg" },
  ],
  review_summary: {
    average_rating: 4.9,
    total_count: 12,
  },
} as any;

describe("AccommodationHero", () => {
  it("renders title, rating, images, and save action", async () => {
    const onOpenGallery = jest.fn();
    const onSave = jest.fn();

    render(
      <AccommodationHero
        accommodation={accommodation}
        currentImageIndex={0}
        mobileSlideIndex={0}
        onMobileSlideIndexChange={jest.fn()}
        onOpenGallery={onOpenGallery}
        onSave={onSave}
        onShare={jest.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Airbob home" })).toBeInTheDocument();
    expect(screen.getByText("4.9")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /저장/ }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/accommodations/components/AmenityIcon.test.tsx src/features/accommodations/components/AccommodationHero.test.tsx
```

Expected:

```text
Cannot find module './AmenityIcon'
Cannot find module './AccommodationHero'
```

- [ ] **Step 4: Implement AmenityIcon**

Create `src/features/accommodations/components/AmenityIcon.tsx`.

```tsx
import React from "react";

interface AmenityIconProps {
  type: string;
}

const iconStyle = {
  width: "24px",
  height: "24px",
  flexShrink: 0,
};

export function AmenityIcon({ type }: AmenityIconProps) {
  const commonProps = {
    role: "img",
    "aria-label": type,
    style: iconStyle,
  } as const;

  switch (type) {
    case "WIFI":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...commonProps}>
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      );
    case "TV":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...commonProps}>
          <rect x="2" y="7" width="20" height="15" rx="2" />
          <path d="M17 2l-5 5-5-5" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...commonProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6M12 16h.01" />
        </svg>
      );
  }
}
```

After this passes, move remaining icon cases from `AccommodationDetail.tsx` into this component without changing rendered SVG paths.

- [ ] **Step 5: Implement AccommodationHero**

Create `src/features/accommodations/components/AccommodationHero.tsx`.

```tsx
import React from "react";
import { AccommodationDetail } from "../../../types/accommodation";
import { getImageUrl } from "../../../utils/image";
import styles from "../../../pages/AccommodationDetail/AccommodationDetail.module.css";

interface AccommodationHeroProps {
  accommodation: AccommodationDetail;
  currentImageIndex: number;
  mobileSlideIndex: number;
  onMobileSlideIndexChange: (index: number) => void;
  onOpenGallery: (index: number) => void;
  onSave: () => void;
  onShare: () => void;
}

export function AccommodationHero({
  accommodation,
  mobileSlideIndex,
  onMobileSlideIndexChange,
  onOpenGallery,
  onSave,
  onShare,
}: AccommodationHeroProps) {
  return (
    <>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <div className={styles.titleWrapper}>
            <h1 className={styles.title}>{accommodation.name}</h1>
            <div className={styles.meta}>
              {accommodation.review_summary.total_count > 0 && (
                <div className={styles.review}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className={styles.star}>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <span>{accommodation.review_summary.average_rating.toFixed(1)}</span>
                  <span className={styles.reviewCount}>
                    ({accommodation.review_summary.total_count})
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className={styles.actionButtons}>
            <button className={styles.shareButton} onClick={onShare}>
              <span>공유하기</span>
            </button>
            <button className={styles.saveButton} onClick={onSave}>
              <span>{accommodation.is_in_wishlist ? "저장 목록" : "저장"}</span>
            </button>
          </div>
        </div>
      </div>

      {accommodation.images.length > 0 && (
        <div className={styles.imageSection}>
          <div className={styles.imageGrid}>
            <button className={styles.mainImage} onClick={() => onOpenGallery(0)}>
              <img
                src={getImageUrl(accommodation.images[0].image_url)}
                alt={accommodation.name}
                className={styles.image}
              />
            </button>
            <div className={styles.thumbnailGrid}>
              {Array.from({ length: 4 }).map((_, index) => {
                const imageIndex = index + 1;
                const image = accommodation.images[imageIndex];

                if (!image) {
                  return (
                    <div key={`placeholder-${index}`} className={styles.thumbnailPlaceholder}>
                      이미지 없음
                    </div>
                  );
                }

                return (
                  <button
                    key={image.id}
                    className={styles.thumbnail}
                    onClick={() => onOpenGallery(imageIndex)}
                  >
                    <img
                      src={getImageUrl(image.image_url)}
                      alt={`${accommodation.name} ${imageIndex + 1}`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.mobileImageSlider} onClick={() => onOpenGallery(mobileSlideIndex)}>
            <div
              className={styles.sliderContainer}
              style={{ transform: `translateX(-${mobileSlideIndex * 100}%)` }}
            >
              {accommodation.images.map((image, index) => (
                <img
                  key={image.id}
                  src={getImageUrl(image.image_url)}
                  alt={`${accommodation.name} ${index + 1}`}
                  className={styles.slideImage}
                />
              ))}
            </div>
            <div className={styles.sliderIndicator}>
              {mobileSlideIndex + 1} / {accommodation.images.length}
            </div>
            {accommodation.images.length <= 5 && (
              <div className={styles.sliderDots}>
                {accommodation.images.map((_, index) => (
                  <button
                    key={index}
                    className={`${styles.sliderDot} ${index === mobileSlideIndex ? styles.active : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onMobileSlideIndexChange(index);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 6: Replace detail inline sections**

Modify `src/pages/AccommodationDetail/AccommodationDetail.tsx`:

- Remove `getAmenityIcon`.
- Import `AmenityIcon`.
- Import `AccommodationHero`.
- Replace header/image section with `AccommodationHero`.
- Replace amenity icon call:

```tsx
<AmenityIcon type={amenity.type} />
```

Use this `AccommodationHero` call:

```tsx
<AccommodationHero
  accommodation={accommodation}
  currentImageIndex={currentImageIndex}
  mobileSlideIndex={mobileSlideIndex}
  onMobileSlideIndexChange={setMobileSlideIndex}
  onOpenGallery={(index) => {
    setCurrentImageIndex(index);
    setIsImageGalleryOpen(true);
  }}
  onSave={() => {
    if (!isAuthenticated) {
      setPendingAction(() => () => setIsWishlistModalOpen(true));
      setIsAuthModalOpen(true);
    } else {
      setIsWishlistModalOpen(true);
    }
  }}
  onShare={() => {}}
/>
```

- [ ] **Step 7: Run detail tests and typecheck**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/accommodations/components/AmenityIcon.test.tsx src/features/accommodations/components/AccommodationHero.test.tsx src/features/accommodations/hooks/useAccommodationDetail.test.ts src/features/accommodations/hooks/useAccommodationBooking.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/accommodations/components src/pages/AccommodationDetail/AccommodationDetail.tsx
git commit -m "refactor: extract accommodation detail presentation sections"
```

## Task H: Design Token Entry Contracts

**Files:**
- Modify: `src/styles/tokens.css`
- Create: `src/styles/design-system-contracts.test.ts`
- Modify: `src/components/Header/Header.module.css`
- Modify: `src/features/search/components/SearchBar/SearchBar.module.css`
- Modify: `src/pages/Search/Search.module.css`

- [ ] **Step 1: Add layout tokens**

Modify `src/styles/tokens.css` and add these variables inside `:root`.

```css
  --layout-page-max-width: 1120px;
  --layout-page-padding-x: 24px;
  --layout-header-desktop-height: 80px;
  --layout-header-mobile-height: 130px;
  --layout-search-mobile-popover-top: var(--layout-header-mobile-height);
  --card-media-ratio: 1 / 1;
```

- [ ] **Step 2: Write design-system contract test**

Create `src/styles/design-system-contracts.test.ts`.

```ts
import { readFileSync } from "fs";
import { join } from "path";

const readSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("design system entry contracts", () => {
  it("defines shared layout tokens used by header, search, and cards", () => {
    const tokens = readSource("src/styles/tokens.css");

    [
      "--layout-page-max-width",
      "--layout-page-padding-x",
      "--layout-header-desktop-height",
      "--layout-header-mobile-height",
      "--layout-search-mobile-popover-top",
      "--card-media-ratio",
    ].forEach((token) => {
      expect(tokens).toContain(token);
    });
  });

  it("does not hardcode mobile search popover top offsets", () => {
    const source = readSource(
      "src/features/search/components/SearchBar/SearchBar.module.css"
    );

    expect(source).not.toMatch(/top:\s*130px/);
    expect(source).toContain("var(--layout-search-mobile-popover-top)");
  });

  it("keeps search page height tied to header tokens", () => {
    const source = readSource("src/pages/Search/Search.module.css");

    expect(source).toContain("var(--layout-header-desktop-height)");
    expect(source).toContain("var(--layout-header-mobile-height)");
  });
});
```

- [ ] **Step 3: Run contract test to verify failure**

Run:

```bash
npm run test:ci -- --runTestsByPath src/styles/design-system-contracts.test.ts
```

Expected: FAIL until CSS files consume the new tokens.

- [ ] **Step 4: Replace search popover top offsets**

Modify `src/features/search/components/SearchBar/SearchBar.module.css`.

Replace:

```css
top: 130px;
```

with:

```css
top: var(--layout-search-mobile-popover-top);
```

in `.datePickerContainer`, `.guestPicker`, and `.suggestions` mobile rules.

- [ ] **Step 5: Replace Search page header height math**

Modify `src/pages/Search/Search.module.css`.

Replace desktop height expressions such as:

```css
height: calc(100vh - 80px);
```

with:

```css
height: calc(100vh - var(--layout-header-desktop-height));
```

Replace mobile height expressions tied to `144px` or header/search combined constants with:

```css
height: calc(100vh - var(--layout-header-mobile-height));
```

- [ ] **Step 6: Run design contract test**

Run:

```bash
npm run test:ci -- --runTestsByPath src/styles/design-system-contracts.test.ts src/styles/tokens.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/styles src/features/search/components/SearchBar/SearchBar.module.css src/pages/Search/Search.module.css src/components/Header/Header.module.css
git commit -m "refactor: add layout tokens for design refactor"
```

## Task I: Verification Gate And QA Update

**Files:**
- Modify: `src/verification-gate.test.ts`
- Modify: `docs/qa/frontend-architecture-smoke.ko.md`
- Modify: `README.md`

- [ ] **Step 1: Extend verification gate**

Modify `src/verification-gate.test.ts` and add required terms for the new architecture checkpoints.

```ts
const architectureTerms = [
  "query route contract",
  "server-state auth boundary",
  "components ownership boundary",
  "design system entry contracts",
];

architectureTerms.forEach((term) => {
  expect(qaDoc).toContain(term);
});
```

- [ ] **Step 2: Run verification gate to verify failure**

Run:

```bash
npm run test:ci -- --runTestsByPath src/verification-gate.test.ts
```

Expected: FAIL until QA doc contains the new terms.

- [ ] **Step 3: Update QA document**

Modify `docs/qa/frontend-architecture-smoke.ko.md` and add this section.

```md
## Architecture Checkpoints

- query route contract: Search/Profile/Wishlist/payment query deep links must preserve existing URL behavior.
- server-state auth boundary: login, logout, focus refresh, and 401 handling must leave Header/UserMenu and protected routes consistent.
- components ownership boundary: shared UI primitives must remain domain-free, and workflow containers must live under features or pages.
- design system entry contracts: header height, mobile search popover position, page width, card media ratio, modal z-index, and bottom-sheet z-index must use tokens.
```

- [ ] **Step 4: Add README setup commands**

Modify `README.md` with this minimal setup section below the title.

````md
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
````

- [ ] **Step 5: Run verification gate**

Run:

```bash
npm run test:ci -- --runTestsByPath src/verification-gate.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run full local verification**

Run:

```bash
npm run verify
```

Expected: PASS for typecheck, no-cache Jest, and production build.

- [ ] **Step 7: Commit**

```bash
git add src/verification-gate.test.ts docs/qa/frontend-architecture-smoke.ko.md README.md
git commit -m "docs: document pre-design architecture verification"
```

## Task J: Final Browser Smoke Before Design Refactor

**Files:**
- Modify only if QA finds a frontend bug in files already touched by Tasks A-I.

- [ ] **Step 1: Start frontend**

Run:

```bash
npm start
```

Expected:

```text
Local: http://localhost:3000
```

- [ ] **Step 2: Confirm backend is reachable**

Open:

```text
http://localhost:8080
```

Expected: backend responds or the team confirms a running backend URL. Do not modify backend code.

- [ ] **Step 3: Desktop smoke**

Use desktop width `1280px`. Validate:

- Header logo link and search.
- `/search` list, pagination, map marker, map bounds update.
- Accommodation detail gallery, date/guest, coupon, reservation button.
- Auth modal close button, Escape, backdrop.
- Wishlist modal open/close and card heart reconciliation.
- Profile guest/host tab switching.
- Host listing and host reservation detail.

- [ ] **Step 4: Mobile smoke**

Use mobile width `375px`. Validate:

- Header search fits viewport.
- Search mobile bottom sheet closed/half/full states.
- Search modal overlays do not hide behind header.
- Detail booking panel fits viewport.
- Wishlist/auth/reservation modals close correctly.
- Profile tabs fit viewport.

- [ ] **Step 5: Record QA result**

Update `docs/qa/frontend-architecture-smoke.ko.md` under `Recording` with:

```md
- failed step: none
- console error: none
- network failed request: none
- screenshot path: none
```

If there is a failure, replace `none` with the exact failed checkpoint, console message, network request, and screenshot path. Fix only frontend files touched by this plan or create a follow-up plan for unrelated failures.

- [ ] **Step 6: Final verification**

Run:

```bash
npm run verify
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add docs/qa/frontend-architecture-smoke.ko.md
git commit -m "test: record pre-design architecture smoke"
```

## Self-Review

Spec coverage:

- 현재 프론트 구조가 왜 유지보수하기 어려운지: Tasks A-D identify and enforce boundaries around query state, API/auth state, and component ownership.
- 페이지/컴포넌트/상태/API/스타일링/라우팅 구조 분석 결과 반영: Tasks A-I cover each axis.
- 리팩토링 전 반드시 고쳐야 할 구조적 문제: query contracts, API/auth dialect, server-state cache, workflow component placement, large Search/Detail sections, layout tokens.
- 백엔드/API/DB/서버 로직 수정 금지: all tasks are frontend-only and preserve endpoint/request/response shapes.
- Airbnb 스타일 디자인 시스템 전 정리: Tasks H-I define token/layout/QA entry contracts.

Placeholder scan:

- No placeholder markers or unspecified test steps are present.
- Every code-changing task includes concrete file paths, code snippets, commands, and expected results.

Type consistency:

- `ProfileRouteState`, `WishlistRouteState`, `PaymentRouteState`, `requestApi`, `requestApiNullable`, `authQueryKeys`, and `useSessionQuery` are defined before later tasks use them.
- Component props in `SearchResultsList`, `SearchPagination`, `AmenityIcon`, and `AccommodationHero` match the call sites described in the same task.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-03-airbob-pre-design-structural-refactor.ko.md`. Two execution options:

**1. Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach?
