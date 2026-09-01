import { act, renderHook, waitFor } from "@testing-library/react";
import type { SessionSubject } from "../../platform/session/sessionScope";
import { testSessionRuntimeLeaseId } from "../../test/sessionFixtures";
import { useAccommodationCouponCommand } from "./useAccommodationCouponCommand";

const mockIssueCoupon = vi.fn();

vi.mock("../../features/accommodations/detail/public", async () => ({
  ...(await vi.importActual<
    typeof import("../../features/accommodations/detail/public")
  >("../../features/accommodations/detail/public")),
  accommodationCouponApi: {
    issue: (...args: unknown[]) => mockIssueCoupon(...args),
  },
}));

const coupon = {
  id: 31,
  name: "만원 할인",
  description: null,
  discountType: "FIXED_AMOUNT" as const,
  discountValue: 10000,
  maxDiscountAmount: null,
  minPaymentPrice: null,
  issuedQuantity: 0,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  totalQuantity: 10,
};
const authenticatedScope = {
  subject: "subject:member_1" as SessionSubject,
  epoch: 2,
  runtimeLeaseId: testSessionRuntimeLeaseId,
};

describe("useAccommodationCouponCommand", () => {
  beforeEach(() => mockIssueCoupon.mockReset());

  it("suppresses duplicate writes and clears stale busy state on route change", async () => {
    let resolveIssue!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveIssue = resolve;
    });
    mockIssueCoupon.mockReturnValue(pending);
    let firstRouteIsCurrent = true;
    const session = {
      captureAuthenticatedSession: () => authenticatedScope,
      isCurrentSession: () => true,
    };
    const onError = vi.fn();
    const requestAuthentication = vi.fn();
    const { result, rerender } = renderHook(
      ({ routeLease }) =>
        useAccommodationCouponCommand({
          accommodationId: 7,
          isAuthenticated: true,
          onError,
          requestAuthentication,
          routeLease,
          session,
        }),
      {
        initialProps: {
          routeLease: { isCurrent: () => firstRouteIsCurrent },
        },
      },
    );

    act(() => {
      void result.current.issueCoupon(coupon);
      void result.current.issueCoupon(coupon);
    });
    expect(mockIssueCoupon).toHaveBeenCalledTimes(1);
    expect(result.current.issuingCouponId).toBe(31);

    firstRouteIsCurrent = false;
    rerender({ routeLease: { isCurrent: () => true } });
    await waitFor(() => expect(result.current.issuingCouponId).toBeNull());

    await act(async () => {
      resolveIssue();
      await pending;
    });
    expect(result.current.selectedCouponId).toBeNull();
  });

  it("selects a coupon after a successful authenticated issue", async () => {
    mockIssueCoupon.mockResolvedValue(undefined);
    const onError = vi.fn();
    const requestAuthentication = vi.fn();
    const routeLease = { isCurrent: () => true };
    const session = {
      captureAuthenticatedSession: () => authenticatedScope,
      isCurrentSession: () => true,
    };
    const { result } = renderHook(() =>
      useAccommodationCouponCommand({
        accommodationId: 7,
        isAuthenticated: true,
        onError,
        requestAuthentication,
        routeLease,
        session,
      }),
    );

    await act(async () => {
      await result.current.issueCoupon(coupon);
    });

    expect(mockIssueCoupon).toHaveBeenCalledTimes(1);
    expect(result.current.selectedCouponId).toBe(31);
    expect(result.current.issuingCouponId).toBeNull();
    expect(onError).toHaveBeenCalledWith(null);
    expect(requestAuthentication).not.toHaveBeenCalled();
  });

  it("treats CP003 as an already-issued coupon without surfacing an error", async () => {
    mockIssueCoupon.mockRejectedValueOnce(
      Object.assign(new Error("already issued"), { code: "CP003" }),
    );
    const onError = vi.fn();
    const requestAuthentication = vi.fn();
    const routeLease = { isCurrent: () => true };
    const session = {
      captureAuthenticatedSession: () => authenticatedScope,
      isCurrentSession: () => true,
    };
    const { result } = renderHook(() =>
      useAccommodationCouponCommand({
        accommodationId: 7,
        isAuthenticated: true,
        onError,
        requestAuthentication,
        routeLease,
        session,
      }),
    );

    await act(async () => {
      await result.current.issueCoupon(coupon);
    });

    expect(mockIssueCoupon).toHaveBeenCalledTimes(1);
    expect(result.current.selectedCouponId).toBe(31);
    expect(result.current.issuingCouponId).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(null);
  });

  it("does not select or report a coupon when the captured session becomes stale", async () => {
    let resolveIssue!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveIssue = resolve;
    });
    mockIssueCoupon.mockReturnValue(pending);
    let isSessionCurrent = true;
    const onError = vi.fn();
    const requestAuthentication = vi.fn();
    const routeLease = { isCurrent: () => true };
    const session = {
      captureAuthenticatedSession: () => authenticatedScope,
      isCurrentSession: () => isSessionCurrent,
    };
    const { result } = renderHook(() =>
      useAccommodationCouponCommand({
        accommodationId: 7,
        isAuthenticated: true,
        onError,
        requestAuthentication,
        routeLease,
        session,
      }),
    );

    let issuePromise: Promise<void> | undefined;
    act(() => {
      issuePromise = result.current.issueCoupon(coupon);
    });
    expect(result.current.issuingCouponId).toBe(31);

    isSessionCurrent = false;
    await act(async () => {
      resolveIssue();
      await issuePromise;
    });

    expect(result.current.selectedCouponId).toBeNull();
    expect(result.current.issuingCouponId).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(null);
  });
});
