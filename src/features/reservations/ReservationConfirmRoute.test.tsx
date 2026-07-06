import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { NavigateFunction } from "react-router-dom";
import type { AccommodationDetail } from "../../types/accommodation";
import { ReservationConfirmRoute } from "./ReservationConfirmRoute";
import type { ReservationCheckoutState } from "./lib/reservationCheckoutState";
import type { useReservationConfirmAccommodation } from "./hooks/useReservationConfirmAccommodation";

const mockNavigate = jest.fn() as jest.MockedFunction<NavigateFunction>;
const mockHandleError = jest.fn();
const mockClearError = jest.fn();
const mockReadReservationCheckoutState = jest.fn();
const mockUseReservationConfirmAccommodation = jest.fn<
  ReturnType<typeof useReservationConfirmAccommodation>,
  Parameters<typeof useReservationConfirmAccommodation>
>();
const mockEnsureTossPaymentsScript = jest.fn();
const mockGetTossPaymentsClient = jest.fn();
const mockRequestPayment = jest.fn();

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
};

jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({
    clearError: mockClearError,
    error: null,
    handleError: mockHandleError,
  }),
}));

jest.mock("./hooks/useReservationConfirmAccommodation", () => ({
  useReservationConfirmAccommodation: (
    options: Parameters<typeof useReservationConfirmAccommodation>[0],
  ) => mockUseReservationConfirmAccommodation(options),
}));

jest.mock("./lib/reservationCheckoutState", () => ({
  readReservationCheckoutState: (accommodationId: string, locationState: unknown) =>
    mockReadReservationCheckoutState(accommodationId, locationState),
}));

jest.mock("./lib/tossPayments", () => ({
  ensureTossPaymentsScript: () => mockEnsureTossPaymentsScript(),
  getTossClientKey: () => "test_ck_123",
  getTossPaymentsClient: (clientKey: string) => mockGetTossPaymentsClient(clientKey),
  shouldSilentlyResetPayment: (error: unknown) =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "USER_CANCEL",
  toReservationPaymentError: (error: unknown) =>
    error instanceof Error ? error : new Error("결제 진행 중 오류가 발생했습니다."),
}));

jest.mock("../../utils/image", () => ({
  getImageUrl: (imageUrl: string) => imageUrl,
}));

const checkoutState: ReservationCheckoutState = {
  adultOccupancy: 2,
  amount: 180000,
  checkIn: "2026-07-10",
  checkOut: "2026-07-12",
  childOccupancy: 1,
  couponDiscount: 15000,
  couponName: "여름 할인",
  customerEmail: "guest@example.com",
  customerName: "홍길동",
  infantOccupancy: 1,
  orderName: "테스트 숙소 2박",
  petOccupancy: 1,
  reservationUid: "reservation-123",
};

const accommodation: AccommodationDetail = {
  address_summary: {
    city: "Seoul",
    country: "KR",
    district: null,
    state: null,
  },
  amenities: [],
  base_price: 100000,
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  coordinate: {
    latitude: 37.5,
    longitude: 127,
  },
  currency: "KRW",
  description: "설명",
  host: {
    id: 1,
    nickname: "호스트",
    thumbnail_image_url: null,
  },
  id: 7,
  images: [{ id: 1, image_url: "/stay.jpg" }],
  is_in_wishlist: false,
  name: "테스트 숙소",
  policy: {
    infant_occupancy: 1,
    max_occupancy: 4,
    pet_occupancy: 1,
  },
  review_summary: {
    average_rating: 4.5,
    total_count: 3,
  },
  type: "ENTIRE_PLACE",
  unavailable_dates: [],
};

const renderRoute = (state: unknown = checkoutState) => {
  mockReadReservationCheckoutState.mockReturnValue(checkoutState);
  mockUseReservationConfirmAccommodation.mockReturnValue({
    accommodation,
    isLoading: false,
  });

  return render(
    <ReservationConfirmRoute
      accommodationId="7"
      locationState={state}
      navigate={mockNavigate}
    />,
  );
};

describe("ReservationConfirmRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockHandleError.mockReset();
    mockClearError.mockReset();
    mockReadReservationCheckoutState.mockReset();
    mockUseReservationConfirmAccommodation.mockReset();
    mockEnsureTossPaymentsScript.mockReset();
    mockEnsureTossPaymentsScript.mockImplementation(
      () => new Promise<void>(() => {}),
    );
    mockGetTossPaymentsClient.mockReset();
    mockRequestPayment.mockReset();
    mockRequestPayment.mockResolvedValue(undefined);
    mockGetTossPaymentsClient.mockReturnValue({
      requestPayment: mockRequestPayment,
    });
  });

  it("renders the preserved reservation checkout summary", () => {
    renderRoute();

    expect(mockReadReservationCheckoutState).toHaveBeenCalledWith("7", checkoutState);
    expect(mockUseReservationConfirmAccommodation).toHaveBeenCalledWith({
      accommodationId: "7",
      clearError: mockClearError,
      handleError: mockHandleError,
      navigate: mockNavigate,
      reservationUid: "reservation-123",
    });
    expect(screen.getByRole("heading", { name: "확인 및 결제" })).toBeInTheDocument();
    expect(screen.getByText("테스트 숙소")).toBeInTheDocument();
    expect(screen.getByText("2026년 7월 10일~2026년 7월 12일")).toBeInTheDocument();
    expect(screen.getByText("성인 3명, 유아 1명, 반려동물 1마리")).toBeInTheDocument();
    expect(screen.getByText("2박 x ₩100,000")).toBeInTheDocument();
    expect(screen.getByText("-₩20,000")).toBeInTheDocument();
    expect(screen.getByText("₩180,000")).toBeInTheDocument();
  });

  it("keeps invalid checkout dates at zero nights", () => {
    mockReadReservationCheckoutState.mockReturnValue({
      ...checkoutState,
      checkIn: "2026-02-30",
      checkOut: "2026-03-03",
    });
    mockUseReservationConfirmAccommodation.mockReturnValue({
      accommodation,
      isLoading: false,
    });

    render(
      <ReservationConfirmRoute
        accommodationId="7"
        locationState={checkoutState}
        navigate={mockNavigate}
      />,
    );

    expect(screen.getByText("0박 x ₩100,000")).toBeInTheDocument();
  });

  it("loads Toss on mount and requests payment with unchanged checkout fields", async () => {
    mockEnsureTossPaymentsScript.mockResolvedValue(undefined);
    renderRoute();

    expect(mockEnsureTossPaymentsScript).toHaveBeenCalledTimes(1);

    const paymentButton = await screen.findByRole("button", {
      name: "확인 및 결제",
    });
    expect(paymentButton).toBeEnabled();

    fireEvent.click(paymentButton);

    await waitFor(() =>
      expect(mockGetTossPaymentsClient).toHaveBeenCalledWith("test_ck_123")
    );
    expect(mockRequestPayment).toHaveBeenCalledWith({
      amount: 180000,
      customerEmail: "guest@example.com",
      customerName: "홍길동",
      failUrl: "http://localhost/reservations/reservation-123/fail",
      orderId: "reservation-123",
      orderName: "테스트 숙소 2박",
      successUrl: "http://localhost/reservations/reservation-123/success",
    });
  });

  it("silently resets payment processing for Toss user cancellation", async () => {
    mockEnsureTossPaymentsScript.mockResolvedValue(undefined);
    mockRequestPayment.mockRejectedValue({ code: "USER_CANCEL" });
    renderRoute();

    const paymentButton = await screen.findByRole("button", {
      name: "확인 및 결제",
    });
    expect(paymentButton).toBeEnabled();

    fireEvent.click(paymentButton);

    expect(await screen.findByRole("button", { name: "확인 및 결제" })).toBeEnabled();
    expect(mockHandleError).not.toHaveBeenCalled();
  });

  it("keeps payment disabled until the Toss SDK loader resolves", async () => {
    const tossReady = createDeferred<void>();
    mockEnsureTossPaymentsScript.mockReturnValueOnce(tossReady.promise);

    renderRoute();

    const paymentButton = screen.getByRole("button", {
      name: "결제 시스템 로딩 중...",
    });
    expect(paymentButton).toBeDisabled();

    fireEvent.click(paymentButton);
    expect(mockGetTossPaymentsClient).not.toHaveBeenCalled();

    await act(async () => {
      tossReady.resolve();
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "확인 및 결제" }),
      ).toBeEnabled(),
    );
  });
});
