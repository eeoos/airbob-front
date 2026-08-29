import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { couponApi } from "../../../api";
import { ApiClientError } from "../../../api/response";
import { CouponInfo } from "../../../types/coupon";
import { useAccommodationCoupons } from "./useAccommodationCoupons";

jest.mock("axios", () => ({
  AxiosError: class AxiosError extends Error {},
}));

jest.mock("../../../api", () => ({
  couponApi: {
    getValidCoupons: jest.fn(),
    issue: jest.fn(),
  },
}));

const mockHandleError = jest.fn();
const mockClearError = jest.fn();
const mockRequireAuth = jest.fn();
const mockIsCurrentAuthIntent = jest.fn();

const createCouponAuthIntentExecution = (
  couponId: number,
  accommodationId = 7,
) => ({
  generation: 17,
  intent: {
    type: "coupon.issue" as const,
    accommodationId,
    couponId,
  },
  isCurrent: mockIsCurrentAuthIntent,
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function QueryClientTestWrapper({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
};

const createCoupon = (
  id: number,
  overrides: Partial<CouponInfo> = {}
): CouponInfo => ({
  id,
  name: `쿠폰 ${id}`,
  description: null,
  discount_type: "FIXED_AMOUNT",
  discount_value: 10000,
  min_payment_price: null,
  max_discount_amount: null,
  start_date: "2026-07-01",
  end_date: "2026-12-31",
  total_quantity: null,
  issued_quantity: 0,
  ...overrides,
});

describe("useAccommodationCoupons", () => {
  beforeEach(() => {
    mockHandleError.mockReset();
    mockClearError.mockReset();
    mockRequireAuth.mockReset();
    mockIsCurrentAuthIntent.mockReset();
    mockIsCurrentAuthIntent.mockReturnValue(true);
    jest.mocked(couponApi.getValidCoupons).mockReset();
    jest.mocked(couponApi.issue).mockReset();
  });

  it("loads valid coupons and computes selected discount and payable price", async () => {
    const coupon = createCoupon(1);
    jest.mocked(couponApi.getValidCoupons).mockResolvedValue({
      infos: [coupon],
    });

    const { result } = renderHook(
      () =>
        useAccommodationCoupons({
          accommodationId: "7",
          isAuthenticated: true,
          totalPrice: 50000,
          handleError: mockHandleError,
          clearError: mockClearError,
          onRequireAuth: mockRequireAuth,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoadingCoupons).toBe(false));

    expect(couponApi.getValidCoupons).toHaveBeenCalledTimes(1);
    expect(result.current.coupons).toEqual([coupon]);

    act(() => {
      result.current.setSelectedCouponId(1);
    });

    expect(result.current.selectedCoupon).toEqual(coupon);
    expect(result.current.couponDiscount).toBe(10000);
    expect(result.current.payablePrice).toBe(40000);
  });

  it("resets coupon state and skips fetching when unauthenticated", () => {
    const { result } = renderHook(
      () =>
        useAccommodationCoupons({
          accommodationId: "7",
          isAuthenticated: false,
          totalPrice: 50000,
          handleError: mockHandleError,
          clearError: mockClearError,
          onRequireAuth: mockRequireAuth,
        }),
      { wrapper: createWrapper() },
    );

    expect(couponApi.getValidCoupons).not.toHaveBeenCalled();
    expect(result.current.coupons).toEqual([]);
    expect(result.current.selectedCouponId).toBeNull();
  });

  it("issues and selects a coupon for authenticated users", async () => {
    const coupon = createCoupon(2);
    jest.mocked(couponApi.getValidCoupons).mockResolvedValue({
      infos: [coupon],
    });
    jest.mocked(couponApi.issue).mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useAccommodationCoupons({
          accommodationId: "7",
          isAuthenticated: true,
          totalPrice: 50000,
          handleError: mockHandleError,
          clearError: mockClearError,
          onRequireAuth: mockRequireAuth,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoadingCoupons).toBe(false));

    await act(async () => {
      await result.current.handleIssueCoupon(coupon);
    });

    expect(couponApi.issue).toHaveBeenCalledWith(2);
    expect(result.current.selectedCouponId).toBe(2);
    expect(result.current.issuingCouponId).toBeNull();
  });

  it("treats CP003 as already issued and selects the coupon", async () => {
    const coupon = createCoupon(3);
    const error = new ApiClientError({
      message: "이미 발급받은 쿠폰입니다.",
      status: 400,
      code: "CP003",
    });
    jest.mocked(couponApi.getValidCoupons).mockResolvedValue({
      infos: [coupon],
    });
    jest.mocked(couponApi.issue).mockRejectedValue(error);

    const { result } = renderHook(
      () =>
        useAccommodationCoupons({
          accommodationId: "7",
          isAuthenticated: true,
          totalPrice: 50000,
          handleError: mockHandleError,
          clearError: mockClearError,
          onRequireAuth: mockRequireAuth,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoadingCoupons).toBe(false));

    await act(async () => {
      await result.current.handleIssueCoupon(coupon);
    });

    await waitFor(() => expect(result.current.selectedCouponId).toBe(3));
    expect(mockHandleError).not.toHaveBeenCalled();
  });

  it("defers coupon issue behind auth when logged out", async () => {
    const coupon = createCoupon(4);
    const { result } = renderHook(
      () =>
        useAccommodationCoupons({
          accommodationId: "7",
          isAuthenticated: false,
          totalPrice: 50000,
          handleError: mockHandleError,
          clearError: mockClearError,
          onRequireAuth: mockRequireAuth,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.handleIssueCoupon(coupon);
    });

    expect(mockRequireAuth).toHaveBeenCalledWith({
      type: "coupon.issue",
      accommodationId: 7,
      couponId: 4,
    });
    expect(couponApi.issue).not.toHaveBeenCalled();
  });

  it("executes one claimed coupon generation exactly once", async () => {
    const coupon = createCoupon(5);
    jest.mocked(couponApi.getValidCoupons).mockResolvedValue({ infos: [coupon] });
    jest.mocked(couponApi.issue).mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useAccommodationCoupons({
          accommodationId: "7",
          isAuthenticated: true,
          totalPrice: 50000,
          handleError: mockHandleError,
          clearError: mockClearError,
          onRequireAuth: mockRequireAuth,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.coupons).toEqual([coupon]));
    const execution = createCouponAuthIntentExecution(coupon.id);

    await act(async () => {
      await Promise.all([
        result.current.handleIssueCoupon(coupon, execution),
        result.current.handleIssueCoupon(coupon, execution),
      ]);
    });

    expect(mockRequireAuth).not.toHaveBeenCalled();
    expect(couponApi.issue).toHaveBeenCalledTimes(1);
    expect(couponApi.issue).toHaveBeenCalledWith(5);
    expect(result.current.selectedCouponId).toBe(5);
  });

  it("does not issue a coupon for a stale or mismatched claimed generation", async () => {
    const coupon = createCoupon(6);
    jest.mocked(couponApi.getValidCoupons).mockResolvedValue({ infos: [coupon] });
    const { result } = renderHook(
      () =>
        useAccommodationCoupons({
          accommodationId: "7",
          isAuthenticated: true,
          totalPrice: 50000,
          handleError: mockHandleError,
          clearError: mockClearError,
          onRequireAuth: mockRequireAuth,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.coupons).toEqual([coupon]));
    mockIsCurrentAuthIntent.mockReturnValue(false);

    await act(async () => {
      await result.current.handleIssueCoupon(
        coupon,
        createCouponAuthIntentExecution(coupon.id),
      );
      await result.current.handleIssueCoupon(
        coupon,
        createCouponAuthIntentExecution(coupon.id, 8),
      );
    });

    expect(couponApi.issue).not.toHaveBeenCalled();
    expect(result.current.selectedCouponId).toBeNull();
    expect(mockHandleError).not.toHaveBeenCalled();
  });

  it("does not update coupon UI when the claimed session becomes stale in flight", async () => {
    const coupon = createCoupon(7);
    let resolveIssue!: () => void;
    let isCurrent = true;
    mockIsCurrentAuthIntent.mockImplementation(() => isCurrent);
    jest.mocked(couponApi.getValidCoupons).mockResolvedValue({ infos: [coupon] });
    jest.mocked(couponApi.issue).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveIssue = resolve;
      }),
    );
    const { result } = renderHook(
      () =>
        useAccommodationCoupons({
          accommodationId: "7",
          isAuthenticated: true,
          totalPrice: 50000,
          handleError: mockHandleError,
          clearError: mockClearError,
          onRequireAuth: mockRequireAuth,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.coupons).toEqual([coupon]));
    let issuePromise: Promise<void> | undefined;
    act(() => {
      issuePromise = result.current.handleIssueCoupon(
        coupon,
        createCouponAuthIntentExecution(coupon.id),
      );
    });
    expect(couponApi.issue).toHaveBeenCalledWith(coupon.id);

    isCurrent = false;
    await act(async () => {
      resolveIssue();
      await issuePromise;
    });

    expect(result.current.selectedCouponId).toBeNull();
    expect(mockHandleError).not.toHaveBeenCalled();
  });

  it("does not update coupon UI or errors after unmounting in flight", async () => {
    const coupon = createCoupon(8);
    let resolveIssue!: () => void;
    jest.mocked(couponApi.getValidCoupons).mockResolvedValue({ infos: [coupon] });
    jest.mocked(couponApi.issue).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveIssue = resolve;
      }),
    );
    const { result, unmount } = renderHook(
      () =>
        useAccommodationCoupons({
          accommodationId: "7",
          isAuthenticated: true,
          totalPrice: 50000,
          handleError: mockHandleError,
          clearError: mockClearError,
          onRequireAuth: mockRequireAuth,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.coupons).toEqual([coupon]));
    let issuePromise: Promise<void> | undefined;
    act(() => {
      issuePromise = result.current.handleIssueCoupon(
        coupon,
        createCouponAuthIntentExecution(coupon.id),
      );
    });
    expect(couponApi.issue).toHaveBeenCalledWith(coupon.id);

    unmount();
    await act(async () => {
      resolveIssue();
      await issuePromise;
    });

    expect(mockHandleError).not.toHaveBeenCalled();
  });
});
