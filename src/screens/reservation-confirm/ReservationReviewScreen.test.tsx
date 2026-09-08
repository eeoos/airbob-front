import type { ComponentProps } from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "../../test/renderApp";
import { ReservationReviewScreen } from "./ReservationReviewScreen";

type Props = ComponentProps<typeof ReservationReviewScreen>;
const createProps = (): Props => ({
  snapshot: {
    phase: "quoted",
    flowId: "synthetic-review-flow",
    accommodationId: 42,
    reservationUid: null,
    orderName: "테스트 숙소 예약",
    checkIn: "2026-09-10",
    checkOut: "2026-09-12",
    adultCount: 2,
    childCount: 0,
    infantCount: 0,
    petCount: 0,
    nightlyPrice: 60000,
    nights: 2,
    subtotal: 120000,
    discountAmount: 0,
    amount: 120000,
    currency: "KRW",
    couponId: null,
    couponDisplayName: null,
    quoteExpiresAt: "2026-09-01T10:05:00Z",
    serverTime: "2026-09-01T10:00:00Z",
    paymentRequired: true,
    reservationStatus: null,
    paymentAllowed: false,
    holdExpiresAt: null,
    canCheckout: true,
    canPay: false,
    canRetryPayment: false,
    canReleaseHold: false,
  },
  detail: {
    id: 42,
    name: "테스트 숙소",
    description: "편안한 숙소",
    type: "APARTMENT",
    basePrice: 60000,
    currency: "KRW",
    checkInTime: "15:00:00",
    checkOutTime: "11:00:00",
    timeZoneId: "Asia/Seoul",
    isInWishlist: false,
    addressSummary: {
      country: "한국",
      city: "서울",
      state: null,
      district: null,
    },
    coordinate: { latitude: null, longitude: null },
    host: { id: 1, nickname: "합성 호스트", thumbnailImageUrl: null },
    policy: { maxOccupancy: 3, infantOccupancy: 1, petOccupancy: 0 },
    amenities: [],
    images: [],
    reviewSummary: { totalCount: 0, averageRating: 0 },
  },
  imageUrl: "https://cdn.example.com/synthetic-stay.jpg",
  availability: null,
  availabilityLoading: false,
  onRetryAvailability: vi.fn(),
  coupons: [],
  couponsLoading: false,
  couponsError: false,
  onRetryCoupons: vi.fn(),
  busy: false,
  error: null,
  canEdit: true,
  needsNewQuote: false,
  blocked: false,
  onSave: vi.fn().mockResolvedValue(true),
  onCheckout: vi.fn(),
  onExit: vi.fn(),
  onRefresh: vi.fn(),
});

const primaryAction = (name: string) => {
  const [button] = screen.getAllByRole("button", { name });
  if (!button) throw new Error(`Missing action: ${name}`);
  return button;
};

describe("ReservationReviewScreen", () => {
  it("waits for the final confirmation click and preserves editing on that step", async () => {
    const props = createProps();
    renderApp(<ReservationReviewScreen {...props} />);
    expect(props.onCheckout).not.toHaveBeenCalled();
    await userEvent.click(primaryAction("다음"));
    expect(props.onCheckout).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "이제, 여행을 시작해볼까요?" }),
    ).toHaveFocus();
    expect(
      screen.getByText("확인 및 결제를 누르면 토스페이먼츠 결제창이 열립니다."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "날짜 변경" })).toBeEnabled();
    await userEvent.click(primaryAction("확인 및 결제"));
    expect(props.onCheckout).toHaveBeenCalledTimes(1);
    await userEvent.click(
      screen.getByRole("button", { name: "예약 검토로 돌아가기" }),
    );
    expect(primaryAction("다음")).toBeEnabled();
    await userEvent.click(
      screen.getByRole("button", { name: "숙소로 돌아가기" }),
    );
    expect(props.onExit).toHaveBeenCalledTimes(1);
  });

  it("requires explicit confirmation for a fully discounted stay", async () => {
    const props = createProps();
    renderApp(
      <ReservationReviewScreen
        {...props}
        snapshot={{
          ...props.snapshot,
          amount: 0,
          discountAmount: 120000,
          paymentRequired: false,
          couponId: 4,
          couponDisplayName: "전액 할인",
        }}
      />,
    );
    await userEvent.click(primaryAction("다음"));
    expect(
      screen.getByText(
        "전액 할인이 적용되어 추가 결제 없이 예약을 확정할 수 있어요.",
      ),
    ).toBeVisible();
    expect(screen.queryByText(/토스페이먼츠 결제창/)).not.toBeInTheDocument();
    expect(props.onCheckout).not.toHaveBeenCalled();
    await userEvent.click(primaryAction("예약 확정하기"));
    expect(props.onCheckout).toHaveBeenCalledTimes(1);
  });

  it("retains a failed guest edit for retry and closes only after acceptance", async () => {
    const props = createProps();
    const onSave = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    renderApp(<ReservationReviewScreen {...props} onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: "게스트 변경" }));
    const dialog = screen.getByRole("dialog", { name: "게스트 변경" });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "성인 늘리기" }),
    );
    expect(
      within(dialog).getByRole("button", { name: "성인 늘리기" }),
    ).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "반려동물 늘리기" }),
    ).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(dialog).toBeVisible();
    expect(onSave).toHaveBeenLastCalledWith({
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      adultCount: 3,
      childCount: 0,
      infantCount: 0,
      petCount: 0,
      couponId: null,
    });
    await userEvent.click(within(dialog).getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent(
      "변경한 예약 조건과 요금을 반영했어요.",
    );
    expect(props.onCheckout).not.toHaveBeenCalled();
  });

  it("discards a cancelled draft and reopens the accepted guest count", async () => {
    const props = createProps();
    renderApp(<ReservationReviewScreen {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "게스트 변경" }));
    await userEvent.click(screen.getByRole("button", { name: "성인 늘리기" }));
    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    await userEvent.click(screen.getByRole("button", { name: "게스트 변경" }));
    expect(screen.getByRole("button", { name: "성인 늘리기" })).toBeEnabled();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("keeps unavailable date edits unsavable and delegates availability retry", async () => {
    const props = createProps();
    const { rerender } = renderApp(
      <ReservationReviewScreen {...props} availabilityLoading />,
    );
    await userEvent.click(screen.getByRole("button", { name: "날짜 변경" }));
    expect(
      screen.getByText("예약 가능한 날짜를 확인하고 있어요."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    rerender(<ReservationReviewScreen {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(props.onRetryAvailability).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("refreshes an expired quote and blocks commands during checkout or terminal failure", async () => {
    const props = createProps();
    const { rerender } = renderApp(
      <ReservationReviewScreen {...props} needsNewQuote />,
    );
    await userEvent.click(primaryAction("최신 요금 다시 확인"));
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
    expect(props.onCheckout).not.toHaveBeenCalled();
    rerender(<ReservationReviewScreen {...props} busy canEdit={false} />);
    expect(primaryAction("예약 확인 중…")).toBeDisabled();
    expect(screen.getByRole("button", { name: "게스트 변경" })).toBeDisabled();
    rerender(
      <ReservationReviewScreen
        {...props}
        blocked
        error="예약 상태를 다시 확인해주세요."
      />,
    );
    expect(primaryAction("다음")).toBeDisabled();
    const alert = screen.getByRole("alert");
    await userEvent.click(
      within(alert).getByRole("button", { name: "숙소로 돌아가기" }),
    );
    expect(props.onExit).toHaveBeenCalledTimes(1);
  });

  it("distinguishes coupon loading, retry, and an empty owned list", async () => {
    const props = createProps();
    const { rerender } = renderApp(
      <ReservationReviewScreen {...props} couponsLoading />,
    );
    await userEvent.click(screen.getByRole("button", { name: "쿠폰 변경" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "쿠폰을 불러오고 있어요.",
    );
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    rerender(<ReservationReviewScreen {...props} couponsError />);
    await userEvent.click(
      screen.getByRole("button", { name: "쿠폰 다시 불러오기" }),
    );
    expect(props.onRetryCoupons).toHaveBeenCalledTimes(1);
    rerender(<ReservationReviewScreen {...props} />);
    expect(
      screen.getByText("현재 사용할 수 있는 쿠폰이 없어요."),
    ).toBeVisible();
    expect(
      screen.getByRole("radio", { name: "쿠폰 사용 안 함" }),
    ).toBeChecked();
    expect(props.onCheckout).not.toHaveBeenCalled();
  });
});
