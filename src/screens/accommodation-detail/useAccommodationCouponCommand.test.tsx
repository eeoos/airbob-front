import { act, renderHook, waitFor } from "@testing-library/react";
import type {
  AccommodationCouponCampaign,
  AccommodationMemberCoupon,
} from "../../features/accommodations/detail/public";
import type { SessionSubject } from "../../platform/session/sessionScope";
import { testSessionRuntimeLeaseId } from "../../test/sessionFixtures";
import { useAccommodationCouponCommand } from "./useAccommodationCouponCommand";

const mockIssueCoupon = vi.fn();
const refreshMyCoupons = vi.fn();
const refreshCampaigns = vi.fn();
vi.mock("../../features/accommodations/detail/public", async () => ({
  ...(await vi.importActual<
    typeof import("../../features/accommodations/detail/public")
  >("../../features/accommodations/detail/public")),
  accommodationCouponApi: {
    issue: (...args: unknown[]) => mockIssueCoupon(...args),
  },
}));
const campaign: AccommodationCouponCampaign = {
  id: 31,
  name: "만원 할인",
  description: null,
  discountType: "FIXED_AMOUNT",
  discountValue: 10000,
  maxDiscountAmount: null,
  minPaymentPrice: 50000,
  kind: "campaign",
  issuanceStatus: "OPEN",
  issueStartAt: "2026-01-01T00:00:00",
  issueEndAt: "2026-12-31T00:00:00",
  usableFrom: "2026-01-01T00:00:00",
  usableUntil: "2026-12-31T00:00:00",
  issuedQuantity: 0,
  totalQuantity: 10,
};
const owned: AccommodationMemberCoupon = {
  ...campaign,
  kind: "owned",
  status: "AVAILABLE",
};
const authenticatedScope = {
  subject: "subject:member_1" as SessionSubject,
  epoch: 2,
  runtimeLeaseId: testSessionRuntimeLeaseId,
};
type Options = Parameters<typeof useAccommodationCouponCommand>[0];
const createOptions = (overrides: Partial<Options> = {}): Options => ({
  accommodationId: 7,
  isAuthenticated: true,
  onError: vi.fn(),
  requestAuthentication: vi.fn(),
  routeLease: { isCurrent: () => true },
  session: {
    captureAuthenticatedSession: () => authenticatedScope,
    isCurrentSession: () => true,
  },
  scope: authenticatedScope,
  totalPrice: 100000,
  refreshMyCoupons,
  refreshCampaigns,
  ...overrides,
});

describe("useAccommodationCouponCommand", () => {
  beforeEach(() => {
    mockIssueCoupon.mockReset().mockResolvedValue(undefined);
    refreshMyCoupons.mockReset().mockResolvedValue({ coupons: [owned] });
    refreshCampaigns.mockReset();
  });
  it("issues once, reloads owned status, and only then applies the coupon", async () => {
    const options = createOptions();
    const { result } = renderHook(() => useAccommodationCouponCommand(options));
    await act(async () => {
      await result.current.issueCoupon(campaign);
    });
    expect(mockIssueCoupon).toHaveBeenCalledTimes(1);
    expect(refreshMyCoupons).toHaveBeenCalledTimes(1);
    expect(refreshCampaigns).toHaveBeenCalledTimes(1);
    expect(result.current.selectedCouponId).toBe(31);
    expect(result.current.issuingCouponId).toBeNull();
    expect(options.requestAuthentication).not.toHaveBeenCalled();
  });
  it("applies an owned coupon without issuing again", async () => {
    const options = createOptions();
    const { result } = renderHook(() => useAccommodationCouponCommand(options));
    await act(async () => {
      await result.current.issueCoupon(owned);
    });
    expect(mockIssueCoupon).not.toHaveBeenCalled();
    expect(refreshMyCoupons).toHaveBeenCalledTimes(1);
    expect(result.current.selectedCouponId).toBe(31);
  });
  it.each(["UPCOMING", "SOLD_OUT"] as const)(
    "does not issue a %s campaign",
    async (issuanceStatus) => {
      const options = createOptions();
      const { result } = renderHook(() =>
        useAccommodationCouponCommand(options),
      );
      await act(async () => {
        await result.current.issueCoupon({ ...campaign, issuanceStatus });
      });
      expect(mockIssueCoupon).not.toHaveBeenCalled();
      expect(refreshMyCoupons).not.toHaveBeenCalled();
      expect(result.current.selectedCouponId).toBeNull();
    },
  );
  it.each(["USED", "UPCOMING", "EXPIRED", "UNAVAILABLE"] as const)(
    "does not auto-apply CP003 when the owned coupon is %s",
    async (status) => {
      mockIssueCoupon.mockRejectedValue(
        Object.assign(new Error("already issued"), { code: "CP003" }),
      );
      refreshMyCoupons.mockResolvedValue({ coupons: [{ ...owned, status }] });
      const options = createOptions();
      const { result } = renderHook(() =>
        useAccommodationCouponCommand(options),
      );
      await act(async () => {
        await result.current.issueCoupon(campaign);
      });
      expect(refreshMyCoupons).toHaveBeenCalledTimes(1);
      expect(result.current.selectedCouponId).toBeNull();
      expect(options.onError).toHaveBeenLastCalledWith(
        expect.stringContaining("적용할 수 있는 상태와 금액"),
      );
    },
  );
  it("allows CP003 only after confirming an available owned coupon", async () => {
    mockIssueCoupon.mockRejectedValue(
      Object.assign(new Error("already issued"), { code: "CP003" }),
    );
    const options = createOptions();
    const { result } = renderHook(() => useAccommodationCouponCommand(options));
    await act(async () => {
      await result.current.issueCoupon(campaign);
    });
    expect(result.current.selectedCouponId).toBe(31);
    expect(options.onError).toHaveBeenCalledTimes(1);
  });
  it("rejects an owned coupon that expires between display and selection", async () => {
    refreshMyCoupons.mockResolvedValue({
      coupons: [{ ...owned, status: "EXPIRED" }],
    });
    const options = createOptions();
    const { result } = renderHook(() => useAccommodationCouponCommand(options));
    await act(async () => {
      await result.current.issueCoupon(owned);
    });
    expect(result.current.selectedCouponId).toBeNull();
    expect(mockIssueCoupon).not.toHaveBeenCalled();
  });
  it("does not apply when the owned read fails or no longer contains the coupon", async () => {
    refreshMyCoupons
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ coupons: [] });
    const options = createOptions();
    const { result } = renderHook(() => useAccommodationCouponCommand(options));
    await act(async () => {
      await result.current.issueCoupon(owned);
    });
    expect(result.current.selectedCouponId).toBeNull();
    await act(async () => {
      await result.current.issueCoupon(owned);
    });
    expect(result.current.selectedCouponId).toBeNull();
    expect(options.onError).toHaveBeenCalledTimes(4);
  });
  it("may issue below the minimum but cannot apply the coupon", async () => {
    const options = createOptions({ totalPrice: 40000 });
    const { result } = renderHook(() => useAccommodationCouponCommand(options));
    await act(async () => {
      await result.current.issueCoupon(campaign);
    });
    expect(mockIssueCoupon).toHaveBeenCalledTimes(1);
    expect(result.current.selectedCouponId).toBeNull();
    await act(async () => {
      await result.current.issueCoupon(owned);
    });
    expect(refreshMyCoupons).toHaveBeenCalledTimes(1);
  });
  it("suppresses duplicate writes and clears stale busy state on route change", async () => {
    let resolveIssue!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveIssue = resolve;
    });
    mockIssueCoupon.mockReturnValue(pending);
    let current = true;
    const options = createOptions({ routeLease: { isCurrent: () => current } });
    const { result, rerender } = renderHook(
      (props: Options) => useAccommodationCouponCommand(props),
      { initialProps: options },
    );
    act(() => {
      void result.current.issueCoupon(campaign);
      void result.current.issueCoupon(campaign);
    });
    expect(mockIssueCoupon).toHaveBeenCalledTimes(1);
    current = false;
    rerender({ ...options, routeLease: { isCurrent: () => true } });
    await waitFor(() => expect(result.current.issuingCouponId).toBeNull());
    await act(async () => {
      resolveIssue();
      await pending;
    });
    expect(result.current.selectedCouponId).toBeNull();
    expect(refreshMyCoupons).not.toHaveBeenCalled();
  });
  it("ignores an owned read completing after a session change", async () => {
    let resolveRead!: (value: { coupons: AccommodationMemberCoupon[] }) => void;
    const pending = new Promise<{ coupons: AccommodationMemberCoupon[] }>(
      (resolve) => {
        resolveRead = resolve;
      },
    );
    refreshMyCoupons.mockReturnValue(pending);
    let current = true;
    const options = createOptions({
      session: {
        captureAuthenticatedSession: () => authenticatedScope,
        isCurrentSession: () => current,
      },
    });
    const { result } = renderHook(() => useAccommodationCouponCommand(options));
    let action: Promise<void> | undefined;
    act(() => {
      action = result.current.issueCoupon(owned);
    });
    current = false;
    await act(async () => {
      resolveRead({ coupons: [owned] });
      await action;
    });
    expect(result.current.selectedCouponId).toBeNull();
    expect(options.onError).toHaveBeenCalledTimes(1);
  });
  it("does not carry an applied coupon into a different authenticated scope", async () => {
    const options = createOptions();
    const { result, rerender } = renderHook(
      (props: Options) => useAccommodationCouponCommand(props),
      { initialProps: options },
    );
    await act(async () => {
      await result.current.issueCoupon(owned);
    });
    expect(result.current.selectedCouponId).toBe(31);
    rerender({
      ...options,
      scope: { subject: "subject:member_2" as SessionSubject, epoch: 3 },
    });
    expect(result.current.selectedCouponId).toBeNull();
  });
});
