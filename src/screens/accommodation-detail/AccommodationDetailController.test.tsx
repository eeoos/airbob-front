import { act, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import type { SessionSubject } from "../../platform/session/sessionScope";
import { AccommodationDetailController } from "./AccommodationDetailController";
import type { AccommodationDetailScreenProps } from "./AccommodationDetailScreen";

const mockDetailQuery = jest.fn();
const mockCouponsQuery = jest.fn();
const mockReviewsQuery = jest.fn();
const mockIssueCoupon = jest.fn();
const mockCreateReservationWorkflow = jest.fn();
const mockStartReservation = jest.fn();
const mockDisposeReservation = jest.fn();
let capturedScreenProps: AccommodationDetailScreenProps | null = null;

jest.mock("../../features/accommodations/detail/public", () => ({
  ...jest.requireActual("../../features/accommodations/detail/public"),
  accommodationCouponApi: {
    issue: (...args: unknown[]) => mockIssueCoupon(...args),
  },
  useAccommodationDetailReadQuery: (...args: unknown[]) =>
    mockDetailQuery(...args),
  useValidCouponsReadQuery: (...args: unknown[]) => mockCouponsQuery(...args),
}));

jest.mock("../../features/reviews/public", () => ({
  ...jest.requireActual("../../features/reviews/public"),
  useAccommodationReviewsReadQuery: (...args: unknown[]) =>
    mockReviewsQuery(...args),
}));

jest.mock("../../workflows/booking-payment/reservation-create", () => ({
  ...jest.requireActual(
    "../../workflows/booking-payment/reservation-create",
  ),
  createReservationCreateWorkflow: (...args: unknown[]) =>
    mockCreateReservationWorkflow(...args),
  reservationCreateTransport: {},
}));

jest.mock("./AccommodationDetailScreen", () => ({
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
  captureAuthenticatedSession: jest.fn(() => authenticatedScope),
  isCurrentSession: jest.fn(() => true),
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
    cancelPending: jest.fn(),
    completeClaim: jest.fn(),
    request: jest.fn(() => true),
  },
  bookingRouteState: {
    checkIn: "2026-07-20",
    checkOut: "2026-07-22",
    adultOccupancy: 2,
    childOccupancy: 1,
    infantOccupancy: 0,
    petOccupancy: 0,
  },
  checkoutHandoff: { commit: jest.fn() },
  isAuthenticated: true,
  onReplaceBookingDates: jest.fn(),
  recordRecentlyViewed: jest.fn().mockResolvedValue(undefined),
  resolveImageUrl: (path: string | null) => path ?? "",
  routeLease: { isCurrent: () => true },
  scope: authenticatedScope,
  session,
  ...overrides,
});

const getReadyView = () => {
  expect(capturedScreenProps?.state.status).toBe("ready");
  return capturedScreenProps!.state.status === "ready"
    ? capturedScreenProps!.state.view
    : null!;
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
      fetchNextPage: jest.fn(),
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
    const completeClaim = jest.fn();
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
            cancelPending: jest.fn(),
            completeClaim,
            request: jest.fn(() => true),
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
    expect(mockStartReservation.mock.calls[0][0].intent).toEqual(
      claimedIntent,
    );
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
    const request = jest.fn(() => true);
    render(
      <AccommodationDetailController
        {...createProps({
          authIntent: {
            claimed: null,
            cancelPending: jest.fn(),
            completeClaim: jest.fn(),
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
    const request = jest.fn(() => true);
    mockCouponsQuery.mockReturnValue({
      data: { coupons: [coupon] },
      isFetching: false,
    });
    render(
      <AccommodationDetailController
        {...createProps({
          authIntent: {
            claimed: null,
            cancelPending: jest.fn(),
            completeClaim: jest.fn(),
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
        getReadyView().bookingCard.couponState.coupons[0],
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
    const view = render(
      <AccommodationDetailController {...initialProps} />,
    );
    const couponView = getReadyView().bookingCard.couponState.coupons[0];

    act(() => {
      getReadyView().bookingCard.couponActions.handleIssueCoupon(couponView);
      getReadyView().bookingCard.couponActions.handleIssueCoupon(couponView);
    });
    expect(mockIssueCoupon).toHaveBeenCalledTimes(1);
    expect(
      getReadyView().bookingCard.couponState.coupons[0].isIssuing,
    ).toBe(true);

    isRouteCurrent = false;
    view.rerender(
      <AccommodationDetailController
        {...initialProps}
        routeLease={{ isCurrent: () => true }}
      />,
    );
    await waitFor(() =>
      expect(
        getReadyView().bookingCard.couponState.coupons[0].isIssuing,
      ).toBe(false),
    );

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
    const view = render(
      <AccommodationDetailController {...initialProps} />,
    );

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
    const completeClaim = jest.fn();
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
            cancelPending: jest.fn(),
            completeClaim,
            request: jest.fn(() => true),
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
    const recordRecentlyViewed = jest.fn().mockReturnValue(recordPending);
    const initialProps = createProps({ recordRecentlyViewed });
    const view = render(
      <AccommodationDetailController {...initialProps} />,
    );

    await waitFor(() => expect(recordRecentlyViewed).toHaveBeenCalledTimes(1));
    const signal = recordRecentlyViewed.mock.calls[0][1].signal as AbortSignal;

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
    const fetchNextPage = jest
      .fn()
      .mockRejectedValue(new Error("page failed"));
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
    const { rerender } = render(
      <AccommodationDetailController {...props} />,
    );

    await waitFor(() =>
      expect(props.recordRecentlyViewed).toHaveBeenCalledTimes(1),
    );
    rerender(<AccommodationDetailController {...props} />);
    expect(props.recordRecentlyViewed).toHaveBeenCalledTimes(1);
  });
});
