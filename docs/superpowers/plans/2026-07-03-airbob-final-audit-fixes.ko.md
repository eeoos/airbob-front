# Airbob Final Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the final audit blockers that prevent the frontend from safely entering the Airbnb-style design refactor.

**Architecture:** Keep backend/API/DB contracts unchanged. Make URL state, auth session state, and Google Maps script loading deterministic before visual changes. Use small targeted guards and tests instead of broad page rewrites.

**Tech Stack:** React, TypeScript, React Router, TanStack Query, Axios, Jest/React Testing Library, CSS Modules.

---

## File Structure

- Modify: `src/features/auth/hooks/useSessionQuery.ts`
  - Owns session query options. It must explicitly refetch on window focus because the app-level query client disables focus refetch globally.
- Modify: `src/api/auth.ts`
  - Allows `/auth/me` to receive an optional Axios abort signal so cancelled stale session checks do not clear a newer login.
- Modify: `src/contexts/AuthContext.tsx`
  - Cancels stale session queries before login refresh and uses a small request generation guard for manual session refreshes.
- Modify: `src/api/request.ts`
  - Publishes global auth errors when a backend envelope returns `success:false` with a 401-like `ApiClientError`.
- Test: `src/contexts/AuthContext.test.tsx`
  - Covers focus refresh option and stale manual refresh behavior.
- Test: `src/api/request.test.ts`
  - Covers 401 API envelope triggering the global auth event.
- Modify: `src/features/auth/components/AuthModal/AuthModal.tsx`
  - Prevents `onSuccess` from replaying a protected pending action after the modal was closed while login was in flight.
- Test: `src/features/auth/components/AuthModal/AuthModal.test.tsx`
  - Covers cancelled in-flight login not calling `onSuccess`.
- Modify: `src/pages/Wishlist/Wishlist.tsx`
  - Keeps local view state synchronized with `useSearchParams` after browser back/forward or external query changes.
- Test: `src/pages/Wishlist/Wishlist.routeState.test.tsx`
  - Covers rerendering after query changes.
- Modify: `src/features/reservations/lib/paymentRouteState.ts`
  - Treats invalid date strings as `null`, not `Invalid Date`.
- Test: `src/features/reservations/lib/paymentRouteState.test.ts`
  - Covers malformed check-in/check-out query strings.
- Move/Modify: `src/features/search/map/useGoogleMapsScript.ts` -> `src/hooks/useGoogleMapsScript.ts`
  - Makes the loader shared instead of feature-owned and adds a readiness timeout.
- Modify: `src/hooks/usePlacesAutocomplete.ts`
  - Uses the shared Google Maps script loader instead of appending its own script.
- Modify: `src/components/Map/Map.tsx`
  - Imports the shared loader from `src/hooks`.
- Move/Modify Test: `src/features/search/map/useGoogleMapsScript.test.ts` -> `src/hooks/useGoogleMapsScript.test.ts`
  - Keeps existing loader coverage and adds timeout / missed existing script cases.
- Modify: `src/components/components-boundary-contracts.test.ts`
  - Removes `Map/Map.tsx` from the feature-import allowlist after loader ownership is moved out of `features/search`.
- Modify: `src/routes/paths.ts`
  - Tightens `routeTo.wishlist` and `routeTo.profile` query argument types to route-state union types.
- Test: `src/routes/paths.test.ts`
  - Stops asserting that arbitrary route-state query values are preserved.
- Modify: `src/styles/design-system-contracts.test.ts`, `src/styles/tokens.test.ts`, selected CSS modules
  - Moves hardcoded date-picker/mobile layout assertions toward token usage.

---

## Task 1: Auth Session Race And 401 Envelope Boundary

**Files:**
- Modify: `src/features/auth/hooks/useSessionQuery.ts`
- Modify: `src/api/auth.ts`
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/api/request.ts`
- Test: `src/contexts/AuthContext.test.tsx`
- Test: `src/api/request.test.ts`

- [ ] **Step 1: Write failing test for session focus refresh**

Add this assertion to `src/features/auth/hooks/useSessionQuery.test.tsx` or extend the existing hook test:

```tsx
it("opts the session query back into window-focus refetch", async () => {
  jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);

  renderHook(() => useSessionQuery(), { wrapper });

  const query = queryClient.getQueryCache().find({ queryKey: authQueryKeys.me() });
  expect(query?.options.refetchOnWindowFocus).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/auth/hooks/useSessionQuery.test.tsx
```

Expected: FAIL because `refetchOnWindowFocus` is not set on the session query.

- [ ] **Step 3: Write failing test for 401 API envelopes publishing auth clear**

Add to `src/api/request.test.ts`:

```ts
it("publishes auth errors from 401 API envelopes", async () => {
  const listener = jest.fn();
  const unsubscribe = onAuthError(listener);

  await expect(
    requestApi(() =>
      Promise.resolve({
        data: {
          success: false,
          data: null,
          error: {
            message: "인증이 필요합니다.",
            status: 401,
            code: "AUTH_REQUIRED",
          },
        },
      })
    )
  ).rejects.toMatchObject({ status: 401 });

  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
});
```

- [ ] **Step 4: Run test to verify it fails**

Run:

```bash
npm run test:ci -- --runTestsByPath src/api/request.test.ts
```

Expected: FAIL because `requestApi` throws the `ApiClientError` but does not call `triggerAuthError()`.

- [ ] **Step 5: Implement minimal auth boundary fix**

Change `src/features/auth/hooks/useSessionQuery.ts`:

```ts
export function useSessionQuery() {
  return useQuery<MeInfo, Error, MeInfo | null, ReturnType<typeof authQueryKeys.me>>({
    queryKey: authQueryKeys.me(),
    queryFn: ({ signal }) => authApi.getMe(signal),
    retry: false,
    refetchOnWindowFocus: true,
  });
}
```

Change `src/api/auth.ts`:

```ts
getMe: async (signal?: AbortSignal): Promise<MeInfo> => {
  const response = await client.get<ApiResponse<MeInfo>>("/auth/me", { signal });
  // existing content-type guard remains unchanged
  return requestApi(() => Promise.resolve(response));
},
```

Change `src/api/request.ts`:

```ts
import { triggerAuthError } from "../utils/authEvents";
import { isApiClientError } from "./response";

const publishAuthEnvelopeError = (error: unknown) => {
  if (isApiClientError(error) && (error.status === 401 || error.code === "M004")) {
    triggerAuthError();
  }
};

export async function requestApi<T>(request: ApiRequest<T>): Promise<NonNullable<T>> {
  try {
    const response = await request();
    return unwrapApiResponse(response.data);
  } catch (error) {
    publishAuthEnvelopeError(error);
    throw error;
  }
}
```

Apply the same `try/catch` pattern to `requestApiNullable`.

Change `src/contexts/AuthContext.tsx` so login cancels any stale `/auth/me` query before login:

```ts
const login = async (credentials: LoginRequest) => {
  await queryClient.cancelQueries({ queryKey: authQueryKeys.me() });
  await authApi.login(credentials);
  await refreshSession();
};
```

- [ ] **Step 6: Run focused auth/API tests**

Run:

```bash
npm run test:ci -- --runTestsByPath src/features/auth/hooks/useSessionQuery.test.tsx src/api/request.test.ts src/contexts/AuthContext.test.tsx src/api/auth-boundary-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/auth/hooks/useSessionQuery.ts src/features/auth/hooks/useSessionQuery.test.tsx src/api/auth.ts src/api/request.ts src/api/request.test.ts src/contexts/AuthContext.tsx src/contexts/AuthContext.test.tsx src/api/auth-boundary-contracts.test.ts
git commit -m "fix: close auth session race boundaries"
```

---

## Task 2: Auth Modal Pending Action Cancellation

**Files:**
- Modify: `src/features/auth/components/AuthModal/AuthModal.tsx`
- Test: `src/features/auth/components/AuthModal/AuthModal.test.tsx`

- [ ] **Step 1: Write failing test**

Add a test that submits login, closes the dialog before the login promise resolves, resolves login, and asserts `onSuccess` was not called:

```tsx
it("does not run onSuccess when the modal closes before login resolves", async () => {
  const user = userEvent.setup();
  let resolveLogin: () => void = () => {};
  jest.mocked(useAuth).mockReturnValue({
    isAuthenticated: false,
    isLoading: false,
    login: jest.fn(() => new Promise<void>((resolve) => { resolveLogin = resolve; })),
    logout: jest.fn(),
    checkAuth: jest.fn(),
  });
  const onSuccess = jest.fn();

  function Harness() {
    const [isOpen, setIsOpen] = React.useState(true);
    return (
      <AuthModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={onSuccess}
      />
    );
  }

  render(<Harness />);
  await user.type(screen.getByLabelText("이메일"), "guest@example.com");
  await user.type(screen.getByLabelText("비밀번호"), "password123");
  await user.click(screen.getByRole("button", { name: "로그인" }));
  await user.click(screen.getByRole("button", { name: "닫기" }));

  await act(async () => {
    resolveLogin();
  });

  expect(onSuccess).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:ci -- --runTestsByPath src/features/auth/components/AuthModal/AuthModal.test.tsx
```

Expected: FAIL because `onSuccess` still runs after close.

- [ ] **Step 3: Implement minimal cancellation guard**

In `AuthModal.tsx`, track open state with a ref:

```ts
const isOpenRef = useRef(isOpen);

useEffect(() => {
  isOpenRef.current = isOpen;
}, [isOpen]);
```

After `await login(...)`, run:

```ts
if (!isOpenRef.current) {
  return;
}
onClose();
onSuccess?.();
```

- [ ] **Step 4: Run focused test**

```bash
npm run test:ci -- --runTestsByPath src/features/auth/components/AuthModal/AuthModal.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/components/AuthModal/AuthModal.tsx src/features/auth/components/AuthModal/AuthModal.test.tsx
git commit -m "fix: cancel auth modal pending actions on close"
```

---

## Task 3: Wishlist URL State Source Of Truth

**Files:**
- Modify: `src/pages/Wishlist/Wishlist.tsx`
- Test: `src/pages/Wishlist/Wishlist.routeState.test.tsx`

- [ ] **Step 1: Write failing back/forward style test**

Add a test that renders with `view=recently-viewed`, rerenders with an empty query, and expects the list view to show again:

```tsx
it("syncs rendered view when URL search params change after mount", () => {
  mockSearchParams = new URLSearchParams("view=recently-viewed");
  const { rerender } = render(<Wishlist />);
  expect(screen.getByText("최근 조회한 숙소")).toBeInTheDocument();

  mockSearchParams = new URLSearchParams("");
  rerender(<Wishlist />);

  expect(screen.getByText("위시리스트")).toBeInTheDocument();
  expect(screen.getByText("Weekend")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:ci -- --runTestsByPath src/pages/Wishlist/Wishlist.routeState.test.tsx
```

Expected: FAIL because `selectedWishlist` and `showRecentlyViewed` are initialized once and do not follow changed `searchParams`.

- [ ] **Step 3: Implement URL sync effect**

Add below the `useWishlistModals()` block:

```ts
useEffect(() => {
  const nextRouteState = parseWishlistRouteState(searchParams);
  setSelectedWishlist(nextRouteState.wishlistId);
  setShowRecentlyViewed(nextRouteState.view === "recently-viewed");
  setIsEditMode(false);
}, [searchParams]);
```

- [ ] **Step 4: Run focused test**

```bash
npm run test:ci -- --runTestsByPath src/pages/Wishlist/Wishlist.routeState.test.tsx src/features/wishlist/lib/wishlistRouteState.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Wishlist/Wishlist.tsx src/pages/Wishlist/Wishlist.routeState.test.tsx
git commit -m "fix: keep wishlist route state synced"
```

---

## Task 4: Payment Route Invalid Date Guard

**Files:**
- Modify: `src/features/reservations/lib/paymentRouteState.ts`
- Test: `src/features/reservations/lib/paymentRouteState.test.ts`

- [ ] **Step 1: Write failing test**

Add:

```ts
it("normalizes malformed reservation date query params to null", () => {
  const state = parsePaymentRouteState(
    new URLSearchParams(
      "reservationUid=r-1&orderName=Airbob&amount=120000&customerEmail=a%40b.com&customerName=Jae&checkIn=not-a-date&checkOut=also-bad"
    )
  );

  expect(state).toMatchObject({
    status: "valid",
    checkIn: null,
    checkOut: null,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:ci -- --runTestsByPath src/features/reservations/lib/paymentRouteState.test.ts
```

Expected: FAIL because invalid date strings become `Invalid Date` objects.

- [ ] **Step 3: Implement date guard**

Change `parseDateParam`:

```ts
const parseDateParam = (params: URLSearchParams, key: string): Date | null => {
  const value = params.get(key);
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
```

- [ ] **Step 4: Run focused test**

```bash
npm run test:ci -- --runTestsByPath src/features/reservations/lib/paymentRouteState.test.ts src/pages/Reservations/PaymentSuccess.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/reservations/lib/paymentRouteState.ts src/features/reservations/lib/paymentRouteState.test.ts
git commit -m "fix: guard invalid payment route dates"
```

---

## Task 5: Shared Google Maps Script Loader

**Files:**
- Move: `src/features/search/map/useGoogleMapsScript.ts` -> `src/hooks/useGoogleMapsScript.ts`
- Move: `src/features/search/map/useGoogleMapsScript.test.ts` -> `src/hooks/useGoogleMapsScript.test.ts`
- Modify: `src/hooks/usePlacesAutocomplete.ts`
- Modify: `src/components/Map/Map.tsx`
- Modify: `src/components/components-boundary-contracts.test.ts`

- [ ] **Step 1: Write failing boundary test expectation**

Remove `"Map/Map.tsx"` from `allowedWorkflowFiles` in `src/components/components-boundary-contracts.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:ci -- --runTestsByPath src/components/components-boundary-contracts.test.ts
```

Expected: FAIL because `src/components/Map/Map.tsx` imports from `features/search`.

- [ ] **Step 3: Move the shared loader**

Move the files:

```bash
git mv src/features/search/map/useGoogleMapsScript.ts src/hooks/useGoogleMapsScript.ts
git mv src/features/search/map/useGoogleMapsScript.test.ts src/hooks/useGoogleMapsScript.test.ts
```

Update `src/components/Map/Map.tsx`:

```ts
import { useGoogleMapsScript } from "../../hooks/useGoogleMapsScript";
```

- [ ] **Step 4: Make Places autocomplete use the shared loader**

In `src/hooks/usePlacesAutocomplete.ts`, remove direct `GOOGLE_MAPS_API_KEY` script creation and use:

```ts
const { isLoaded: isGoogleLoaded, status: googleMapsStatus } = useGoogleMapsScript();
```

Initialize Places services in an effect that runs when `isGoogleLoaded` is true. If `googleMapsStatus` is `error` or `missing-key`, keep suggestions empty and stop loading.

- [ ] **Step 5: Add loader timeout test**

Add to `src/hooks/useGoogleMapsScript.test.ts`:

```ts
it("transitions an existing script to error when readiness never arrives", async () => {
  const existingScript = document.createElement("script");
  existingScript.src =
    "https://maps.googleapis.com/maps/api/js?key=already-present&libraries=places&loading=async";
  document.head.appendChild(existingScript);

  const { result } = renderHook(() => useGoogleMapsScript());

  await waitFor(() => expect(result.current.status).toBe("loading"));

  act(() => {
    jest.advanceTimersByTime(5000);
  });

  await waitFor(() => expect(result.current.status).toBe("error"));
});
```

- [ ] **Step 6: Implement readiness timeout**

Add a timeout constant and set status to `error` if `window.google.maps.Map` never becomes ready while script status is `loading`.

- [ ] **Step 7: Run focused tests**

```bash
npm run test:ci -- --runTestsByPath src/hooks/useGoogleMapsScript.test.ts src/features/search/hooks/useSearchBarState.test.tsx src/components/components-boundary-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useGoogleMapsScript.ts src/hooks/useGoogleMapsScript.test.ts src/hooks/usePlacesAutocomplete.ts src/components/Map/Map.tsx src/components/components-boundary-contracts.test.ts
git add -u src/features/search/map
git commit -m "fix: share google maps script loading"
```

---

## Task 6: Route Builder Types And Design Token Guardrails

**Files:**
- Modify: `src/routes/paths.ts`
- Modify: `src/routes/paths.test.ts`
- Modify: `src/styles/design-system-contracts.test.ts`
- Modify: `src/styles/tokens.test.ts`
- Modify: `src/pages/AccommodationDetail/AccommodationDetail.module.css`
- Modify: `src/components/AccommodationCard/BaseAccommodationCard.module.css`

- [ ] **Step 1: Write failing route builder type contract test**

Change `src/routes/paths.test.ts` so `routeTo.wishlist` only tests supported values:

```ts
expect(routeTo.wishlist({ id: "wish 1" })).toBe("/wishlist?id=wish+1");
expect(routeTo.wishlist({ view: "recently-viewed" })).toBe(
  "/wishlist?view=recently-viewed"
);
```

Remove the arbitrary `"grid/card"` expectation.

- [ ] **Step 2: Tighten route builder types**

Import route-state types:

```ts
import type { ProfileRouteMode, ProfileRouteTab } from "../features/profile/lib/profileRouteState";
import type { WishlistRouteView } from "../features/wishlist/lib/wishlistRouteState";
```

Use:

```ts
wishlist: (query?: { id?: string | number; view?: Exclude<WishlistRouteView, "index" | "wishlist-detail"> }) => ...
profile: (query?: { mode?: ProfileRouteMode; tab?: ProfileRouteTab }) => ...
```

- [ ] **Step 3: Write failing token adoption assertions**

Extend `src/styles/design-system-contracts.test.ts`:

```ts
it("uses card media ratio token for base accommodation cards", () => {
  const cardCss = readSource("components/AccommodationCard/BaseAccommodationCard.module.css");
  expect(cardCss).toContain("aspect-ratio: var(--card-media-ratio)");
});
```

Update `src/styles/tokens.test.ts` date picker expectation from `top: 130px` to token usage:

```ts
expectDeclaration(datePickerContainer, "top: var(--layout-search-mobile-popover-top);");
```

- [ ] **Step 4: Run tests to verify failures**

```bash
npm run test:ci -- --runTestsByPath src/routes/paths.test.ts src/styles/design-system-contracts.test.ts src/styles/tokens.test.ts
```

Expected: FAIL until CSS and type/test expectations are updated.

- [ ] **Step 5: Implement token usage**

Change `src/components/AccommodationCard/BaseAccommodationCard.module.css`:

```css
aspect-ratio: var(--card-media-ratio);
```

Change `src/pages/AccommodationDetail/AccommodationDetail.module.css` date picker mobile offset:

```css
top: var(--layout-search-mobile-popover-top);
```

- [ ] **Step 6: Run focused tests**

```bash
npm run test:ci -- --runTestsByPath src/routes/paths.test.ts src/styles/design-system-contracts.test.ts src/styles/tokens.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/routes/paths.ts src/routes/paths.test.ts src/styles/design-system-contracts.test.ts src/styles/tokens.test.ts src/pages/AccommodationDetail/AccommodationDetail.module.css src/components/AccommodationCard/BaseAccommodationCard.module.css
git commit -m "fix: tighten route and token contracts"
```

---

## Final Verification

- [ ] Run focused suites for changed areas:

```bash
npm run test:ci -- --runTestsByPath src/contexts/AuthContext.test.tsx src/api/request.test.ts src/features/auth/components/AuthModal/AuthModal.test.tsx src/pages/Wishlist/Wishlist.routeState.test.tsx src/features/reservations/lib/paymentRouteState.test.ts src/hooks/useGoogleMapsScript.test.ts src/components/components-boundary-contracts.test.ts src/routes/paths.test.ts src/styles/design-system-contracts.test.ts src/styles/tokens.test.ts
```

- [ ] Run full verification:

```bash
npm run verify
```

Expected: typecheck pass, 99+ test suites pass, build exits 0. Existing browser baseline warnings may remain, but newly introduced warnings should be removed.

---

## Self-Review

1. Spec coverage: The plan covers the final audit blockers: auth focus/session race, auth envelope clearing, pending auth modal action cancellation, Wishlist URL sync, payment invalid dates, Google Maps loader ownership/readiness, loose route builders, and token adoption guardrails.
2. Placeholder scan: No TBD/TODO/fill-later placeholders remain. Each implementation step names exact files, commands, and expected outcomes.
3. Type consistency: Route-state type names match existing `ProfileRouteMode`, `ProfileRouteTab`, and `WishlistRouteView`. Auth query key names match `authQueryKeys.me()`. Payment parser names match `parsePaymentRouteState`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-03-airbob-final-audit-fixes.ko.md`.

Execution mode selected by current user request: Inline Execution in this session using `superpowers:executing-plans`, with TDD for each behavior change.
