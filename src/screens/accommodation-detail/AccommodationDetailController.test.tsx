import { act, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import type { SessionSubject } from "../../platform/session/sessionScope";
import { AccommodationDetailController } from "./AccommodationDetailController";
import type { AccommodationDetailScreenProps } from "./AccommodationDetailScreen";

const mockDetailQuery = vi.fn();
const mockCouponsQuery = vi.fn();
const mockReviewsQuery = vi.fn();
const mockIssueCoupon = vi.fn();
const mockCreateReservationWorkflow = vi.fn();
const mockStartReservation = vi.fn();
const mockDisposeReservation = vi.fn();
let capturedScreenProps: AccommodationDetailScreenProps | null = null;

vi.mock("../../features/accommodations/detail/public", async () => ({
  ...(await vi.importActual<
    typeof import("../../features/accommodations/detail/public")
  >("../../features/accommodations/detail/public")),
  accommodationCouponApi: {
    issue: (...args: unknown[]) => mockIssueCoupon(...args),
  },
  useAccommodationDetailReadQuery: (...args: unknown[]) =>
    mockDetailQuery(...args),
  useValidCouponsReadQuery: (...args: unknown[]) => mockCouponsQuery(...args),
}));

vi.mock("../../features/reviews/public", async () => ({
  ...(await vi.importActual<typeof import("../../features/reviews/public")>(
    "../../features/reviews/public",
  )),
  useAccommodationReviewsReadQuery: (...args: unknown[]) =>
    mockReviewsQuery(...args),
}));

vi.mock("../../workflows/booking-payment/reservation-create", async () => ({
  ...(await vi.importActual<
    typeof import("../../workflows/booking-payment/reservation-create")
  >("../../workflows/booking-payment/reservation-create")),
  createReservationCreateWorkflow: (...args: unknown[]) =>
    mockCreateReservationWorkflow(...args),
  reservationCreateTransport: {},
}));

vi.mock("./AccommodationDetailScreen", () => ({
  AccommodationDetailScreen: (props: AccommodationDetailScreenProps) => {
    capturedScreenProps = props;
    return <div data-testid="accommodation-detail-screen" />;
  },
}));

const accommodation = {
  id: 7,
  name: "테스트 숙소",
  description: "설명",
  type: "HOUSE",
  basePrice: 100000,
  currency: "KRW",
  checkInTime: "15:00:00",
  checkOutTime: "11:00:00",
  unavailableDates: [],
  isInWishlist: false,
  addressSummary: {
    country: "대한민국",
    state: null,
    city: "서울",
    district: "마포구",
  },
  coordinate: { latitude: 37.5, longitude: 127 },
  host: { id: 1, nickname: "호스트", thumbnailImageUrl: null },
  policy: { maxOccupancy: 4, infantOccupancy: 1, petOccupancy: 1 },
  amenities: [],
  images: [],
  reviewSummary: { totalCount: 0, averageRating: 0 },
};

const authenticatedScope = {
  subject: "subject:member_1" as SessionSubject,
  epoch: 3,
};

const session = {
  captureAuthenticatedSession: vi.fn(() => authenticatedScope),
  isCurrentSession: vi.fn(() => true),
};

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

const createProps = (
  overrides: Partial<
    React.ComponentProps<typeof AccommodationDetailController>
  > = {},
) => ({
  accommodationId: 7,
  authIntent: {
    claimed: null,
    cancelPending: vi.fn(),
    completeClaim: vi.fn(),
    request: vi.fn(() => true),
  },
  bookingRouteState: {
    checkIn: "2026-07-20",
    checkOut: "2026-07-22",
    adultOccupancy: 2,
    childOccupancy: 1,
    infantOccupancy: 0,
    petOccupancy: 0,
  },
  checkoutHandoff: {
    preflight: vi.fn(() => ({ status: "ready" as const })),
    commit: vi.fn(),
  },
  isAuthenticated: true,
  onReplaceBookingDates: vi.fn(),
  recordRecentlyViewed: vi.fn().mockResolvedValue(undefined),
  resolveImageUrl: (path: string | null) => path ?? "",
  routeLease: { isCurrent: () => true },
  scope: authenticatedScope,
  session,
  ...overrides,
});

const getReadyView = () => {
  expect(capturedScreenProps?.state.status).toBe("ready");
  if (!capturedScreenProps || capturedScreenProps.state.status !== "ready") {
    throw new Error("Expected accommodation detail screen to be ready");
  }
  return capturedScreenProps.state.view;
};

const getFirstCoupon = () => {
  const couponView = getReadyView().bookingCard.couponState.coupons[0];
  if (!couponView) {
    throw new Error("Expected the first coupon view to be defined");
  }
  return couponView;
};

const getMockCall = (
  mock: ReturnType<typeof vi.fn>,
  callIndex: number,
  label: string,
) => {
  const call = mock.mock.calls[callIndex];
  if (!call) {
    throw new Error(`Expected ${label} call ${callIndex + 1} to be defined`);
  }
  return call;
};

describe("AccommodationDetailController", () => {
  beforeEach(() => {
    capturedScreenProps = null;
    mockDetailQuery.mockReset();
    mockDetailQuery.mockReturnValue({
      data: accommodation,
      error: null,
      isError: false,
      isLoading: false,
    });
    mockCouponsQuery.mockReset();
    mockCouponsQuery.mockReturnValue({
      data: { coupons: [] },
      error: null,
      errorUpdatedAt: 0,
      isError: false,
      isFetching: false,
    });
    mockReviewsQuery.mockReset();
    mockReviewsQuery.mockReturnValue({
      data: undefined,
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isError: false,
      isFetchingNextPage: false,
    });
    mockIssueCoupon.mockReset();
    mockStartReservation.mockReset();
    mockStartReservation.mockResolvedValue({ status: "handed-off" });
    mockDisposeReservation.mockReset();
    mockCreateReservationWorkflow.mockReset();
    mockCreateReservationWorkflow.mockReturnValue({
      dispose: mockDisposeReservation,
      start: mockStartReservation,
    });
  });

  it("submits a validated current booking snapshot to one workflow owner", async () => {
    render(<AccommodationDetailController {...createProps()} />);

    act(() => getReadyView().bookingCard.bookingActions.onReserve());
    await waitFor(() => expect(mockStartReservation).toHaveBeenCalledTimes(1));

    expect(mockStartReservation).toHaveBeenCalledWith({
      accommodation: {
        id: 7,
        maxOccupancy: 4,
        maxInfants: 1,
        maxPets: 1,
        unavailableDates: [],
      },
      appliedCoupon: null,
      intent: {
        type: "reservation.start",
        accommodationId: 7,
        checkIn: "2026-07-20",
        checkOut: "2026-07-22",
        adultCount: 2,
        childCount: 1,
        infantCount: 0,
        petCount: 0,
        couponId: null,
      },
      routeLease: expect.any(Object),
    });
  });

  it("keeps the committed reservation workflow live through StrictMode replay", async () => {
    render(
      <StrictMode>
        <AccommodationDetailController {...createProps()} />
      </StrictMode>,
    );

    await act(async () => Promise.resolve());
    expect(mockDisposeReservation).not.toHaveBeenCalled();

    act(() => getReadyView().bookingCard.bookingActions.onReserve());
    await waitFor(() => expect(mockStartReservation).toHaveBeenCalledTimes(1));
  });

  it("resumes the claimed immutable booking instead of remounted UI counts", async () => {
    const completeClaim = vi.fn();
    const claimedIntent = {
      type: "reservation.start" as const,
      accommodationId: 7,
      checkIn: "2026-08-10",
      checkOut: "2026-08-13",
      adultCount: 3,
      childCount: 0,
      infantCount: 1,
      petCount: 1,
      couponId: null,
    };
    render(
      <AccommodationDetailController
        {...createProps({
          authIntent: {
            claimed: {
              attemptId: 19,
              intent: claimedIntent,
              isCurrent: () => true,
            },
            cancelPending: vi.fn(),
            completeClaim,
            request: vi.fn(() => true),
          },
          bookingRouteState: {
            adultOccupancy: 1,
            childOccupancy: 0,
            infantOccupancy: 0,
            petOccupancy: 0,
          },
        })}
      />,
    );

    await waitFor(() => expect(mockStartReservation).toHaveBeenCalledTimes(1));
    const [startRequest] = getMockCall(
      mockStartReservation,
      0,
      "startReservation",
    );
    expect(startRequest?.intent).toEqual(claimedIntent);
    expect(completeClaim).toHaveBeenCalledWith(19);
  });

  it("opens authentication with the exact validated intent returned by the workflow", async () => {
    const requestedIntent = {
      type: "reservation.start" as const,
      accommodationId: 7,
      checkIn: "2026-07-20",
      checkOut: "2026-07-22",
      adultCount: 2,
      childCount: 1,
      infantCount: 0,
      petCount: 0,
      couponId: null,
    };
    mockStartReservation.mockResolvedValue({
      status: "auth-required",
      intent: requestedIntent,
    });
    const request = vi.fn(() => true);
    render(
      <AccommodationDetailController
        {...createProps({
          authIntent: {
            claimed: null,
            cancelPending: vi.fn(),
            completeClaim: vi.fn(),
            request,
          },
          isAuthenticated: false,
          scope: { subject: null, epoch: 3 },
          session: {
            captureAuthenticatedSession: () => null,
            isCurrentSession: () => false,
          },
        })}
      />,
    );

    act(() => getReadyView().bookingCard.bookingActions.onReserve());
    await waitFor(() => expect(request).toHaveBeenCalledWith(requestedIntent));
    expect(getReadyView().authModal.isOpen).toBe(true);
  });

  it("synchronously suppresses duplicate controller continuations", async () => {
    let resolve!: (result: unknown) => void;
    const pending = new Promise((promiseResolve) => {
      resolve = promiseResolve;
    });
    mockStartReservation.mockReturnValue(pending);
    render(<AccommodationDetailController {...createProps()} />);

    act(() => {
      getReadyView().bookingCard.bookingActions.onReserve();
      getReadyView().bookingCard.bookingActions.onReserve();
    });
    expect(mockStartReservation).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve({ status: "handed-off" });
      await pending;
    });
  });

  it("requests authentication with the exact coupon intent before issuing", () => {
    const request = vi.fn(() => true);
    mockCouponsQuery.mockReturnValue({
      data: { coupons: [coupon] },
      isFetching: false,
    });
    render(
      <AccommodationDetailController
        {...createProps({
          authIntent: {
            claimed: null,
            cancelPending: vi.fn(),
            completeClaim: vi.fn(),
            request,
          },
          isAuthenticated: false,
          scope: { subject: null, epoch: 3 },
          session: {
            captureAuthenticatedSession: () => null,
            isCurrentSession: () => false,
          },
        })}
      />,
    );

    act(() => {
      getReadyView().bookingCard.couponActions.handleIssueCoupon(
        getFirstCoupon(),
      );
    });

    expect(request).toHaveBeenCalledWith({
      type: "coupon.issue",
      accommodationId: 7,
      couponId: 31,
    });
    expect(mockIssueCoupon).not.toHaveBeenCalled();
    expect(getReadyView().authModal.isOpen).toBe(true);
  });

  it("suppresses duplicate coupon writes and ignores a stale completion", async () => {
    let resolveIssue!: () => void;
    const pendingIssue = new Promise<void>((resolve) => {
      resolveIssue = resolve;
    });
    let isRouteCurrent = true;
    mockIssueCoupon.mockReturnValue(pendingIssue);
    mockCouponsQuery.mockReturnValue({
      data: { coupons: [coupon] },
      isFetching: false,
    });
    const initialProps = createProps({
      routeLease: { isCurrent: () => isRouteCurrent },
      session: {
        captureAuthenticatedSession: () => authenticatedScope,
        isCurrentSession: () => true,
      },
    });
    const view = render(<AccommodationDetailController {...initialProps} />);
    const couponView = getFirstCoupon();

    act(() => {
      getReadyView().bookingCard.couponActions.handleIssueCoupon(couponView);
      getReadyView().bookingCard.couponActions.handleIssueCoupon(couponView);
    });
    expect(mockIssueCoupon).toHaveBeenCalledTimes(1);
    expect(getFirstCoupon().isIssuing).toBe(true);

    isRouteCurrent = false;
    view.rerender(
      <AccommodationDetailController
        {...initialProps}
        routeLease={{ isCurrent: () => true }}
      />,
    );
    await waitFor(() => expect(getFirstCoupon().isIssuing).toBe(false));

    await act(async () => {
      resolveIssue();
      await pendingIssue;
    });
    expect(getReadyView().bookingCard.couponState.selectedCoupon).toBeNull();
  });

  it("clears reservation busy state when the exact route lease changes", async () => {
    let resolveReservation!: (result: unknown) => void;
    const reservationPending = new Promise((resolve) => {
      resolveReservation = resolve;
    });
    let firstRouteCurrent = true;
    const initialProps = createProps({
      routeLease: { isCurrent: () => firstRouteCurrent },
    });
    mockStartReservation.mockReturnValue(reservationPending);
    const view = render(<AccommodationDetailController {...initialProps} />);

    act(() => getReadyView().bookingCard.bookingActions.onReserve());
    expect(getReadyView().bookingCard.bookingState.isReserving).toBe(true);

    firstRouteCurrent = false;
    view.rerender(
      <AccommodationDetailController
        {...initialProps}
        routeLease={{ isCurrent: () => true }}
      />,
    );

    await waitFor(() => {
      expect(getReadyView().bookingCard.bookingState.isReserving).toBe(false);
    });

    await act(async () => {
      resolveReservation({ status: "stale" });
      await reservationPending;
    });
    expect(getReadyView().bookingCard.bookingState.isReserving).toBe(false);
  });

  it("renders a coupon query failure and deliberately settles a claimed coupon intent", async () => {
    const completeClaim = vi.fn();
    mockCouponsQuery.mockReturnValue({
      data: undefined,
      error: { kind: "network" },
      errorUpdatedAt: 1,
      isError: true,
      isFetching: false,
    });

    render(
      <AccommodationDetailController
        {...createProps({
          authIntent: {
            claimed: {
              attemptId: 23,
              intent: {
                type: "coupon.issue",
                accommodationId: 7,
                couponId: 31,
              },
              isCurrent: () => true,
            },
            cancelPending: vi.fn(),
            completeClaim,
            request: vi.fn(() => true),
          },
        })}
      />,
    );

    await waitFor(() => expect(completeClaim).toHaveBeenCalledWith(23));
    expect(getReadyView().bookingCard.couponState.errorMessage).toBe(
      "네트워크 연결을 확인한 뒤 다시 시도해주세요.",
    );
    expect(mockIssueCoupon).not.toHaveBeenCalled();
  });

  it("does not abort or duplicate recently viewed recording for a date-only route replacement", async () => {
    let resolveRecord!: () => void;
    const recordPending = new Promise<void>((resolve) => {
      resolveRecord = resolve;
    });
    const recordRecentlyViewed = vi.fn().mockReturnValue(recordPending);
    const initialProps = createProps({ recordRecentlyViewed });
    const view = render(<AccommodationDetailController {...initialProps} />);

    await waitFor(() => expect(recordRecentlyViewed).toHaveBeenCalledTimes(1));
    const [, recordOptions] = getMockCall(
      recordRecentlyViewed,
      0,
      "recordRecentlyViewed",
    );
    if (!(recordOptions?.signal instanceof AbortSignal)) {
      throw new Error(
        "Expected recordRecentlyViewed to receive an AbortSignal",
      );
    }
    const signal = recordOptions.signal;

    view.rerender(
      <AccommodationDetailController
        {...initialProps}
        routeLease={{ isCurrent: () => true }}
      />,
    );

    expect(signal.aborted).toBe(false);
    expect(recordRecentlyViewed).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRecord();
      await recordPending;
    });
    expect(recordRecentlyViewed).toHaveBeenCalledTimes(1);
  });

  it("loads one review cursor at a time without retrying a failed cursor loop", async () => {
    const fetchNextPage = vi.fn().mockRejectedValue(new Error("page failed"));
    mockReviewsQuery.mockReturnValue({
      data: {
        pages: [
          {
            reviews: [],
            pageInfo: {
              currentSize: 6,
              hasNext: true,
              nextCursor: "cursor-2",
            },
          },
        ],
      },
      error: null,
      errorUpdatedAt: 0,
      fetchNextPage,
      hasNextPage: true,
      isError: false,
      isFetchingNextPage: false,
    });
    render(<AccommodationDetailController {...createProps()} />);

    act(() => getReadyView().reviews.onOpenReviews());
    expect(fetchNextPage).not.toHaveBeenCalled();
    await act(async () => getReadyView().reviewModal.onLoadMore());
    await waitFor(() =>
      expect(capturedScreenProps?.errorMessage).toBe(
        "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
      ),
    );
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    act(() => getReadyView().reviewModal.onClose());
    act(() => getReadyView().reviews.onOpenReviews());
    await act(async () => getReadyView().reviewModal.onLoadMore());
    expect(fetchNextPage).toHaveBeenCalledTimes(2);
  });

  it("shows a direct detail query error without mutation or redirect", () => {
    mockDetailQuery.mockReturnValue({
      data: undefined,
      error: { code: "A001" },
      isError: true,
      isLoading: false,
    });
    render(<AccommodationDetailController {...createProps()} />);

    expect(capturedScreenProps?.state).toEqual({
      status: "error",
      message: "존재하지 않거나 삭제된 숙소입니다.",
    });
    expect(mockStartReservation).not.toHaveBeenCalled();
  });

  it("records a current authenticated detail at most once per controller scope", async () => {
    const props = createProps();
    const { rerender } = render(<AccommodationDetailController {...props} />);

    await waitFor(() =>
      expect(props.recordRecentlyViewed).toHaveBeenCalledTimes(1),
    );
    rerender(<AccommodationDetailController {...props} />);
    expect(props.recordRecentlyViewed).toHaveBeenCalledTimes(1);
  });
});
