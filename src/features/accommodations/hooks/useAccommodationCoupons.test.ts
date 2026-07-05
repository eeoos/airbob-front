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

    expect(mockRequireAuth).toHaveBeenCalledTimes(1);
    expect(couponApi.issue).not.toHaveBeenCalled();
  });

  it("replays a deferred coupon issue after auth success without reopening auth", async () => {
    const coupon = createCoupon(5);
    let pendingAction: (() => void | Promise<void>) | undefined;
    mockRequireAuth.mockImplementation((action) => {
      pendingAction = action;
    });
    jest.mocked(couponApi.issue).mockResolvedValue(undefined);

    const { result } = renderHook(
      () =>
        useAccommodationCoupons({
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

    mockRequireAuth.mockClear();

    await act(async () => {
      await pendingAction?.();
    });

    expect(mockRequireAuth).not.toHaveBeenCalled();
    expect(couponApi.issue).toHaveBeenCalledWith(5);
    expect(result.current.selectedCouponId).toBe(5);
  });
});
