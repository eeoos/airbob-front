import { act, renderHook, waitFor } from "@testing-library/react";
import { reservationApi } from "../../../api";
import { useReservationPayment } from "./useReservationPayment";

const mockNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
  }),
  { virtual: true },
);

jest.mock("../../../api", () => ({
  reservationApi: {
    create: jest.fn(),
  },
}));

describe("useReservationPayment", () => {
  const reservationResponse = {
    reservation_uid: "res-123",
    order_name: "테스트 숙소",
    amount: 200000,
    customer_email: "user@example.com",
    customer_name: "홍길동",
  };

  const paymentOptions = {
    accommodationId: 7,
    checkIn: new Date(2026, 6, 10),
    checkOut: new Date(2026, 6, 12),
    adultCount: 2,
    childCount: 1,
    infantCount: 1,
    petCount: 1,
  };

  const createDeferred = <T,>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
      resolve = promiseResolve;
      reject = promiseReject;
    });

    return { promise, reject, resolve };
  };

  beforeEach(() => {
    sessionStorage.clear();
    mockNavigate.mockReset();
    jest.mocked(reservationApi.create).mockReset();
  });

  it("creates a reservation and routes payment through the confirm page", async () => {
    const handleError = jest.fn();
    const clearError = jest.fn();
    jest.mocked(reservationApi.create).mockResolvedValue(reservationResponse);

    const { result } = renderHook(() =>
      useReservationPayment({
        clearError,
        handleError,
      }),
    );

    await act(async () => {
      await result.current.startReservationPayment(paymentOptions);
    });

    expect(reservationApi.create).toHaveBeenCalledWith({
      accommodation_id: 7,
      check_in_date: "2026-07-10",
      check_out_date: "2026-07-12",
      guest_count: 3,
    });
    expect(mockNavigate).toHaveBeenCalledWith("/accommodations/7/confirm", {
      state: expect.objectContaining({
        reservationUid: "res-123",
        orderName: "테스트 숙소",
        amount: 200000,
        customerEmail: "user@example.com",
        customerName: "홍길동",
        checkIn: "2026-07-10",
        checkOut: "2026-07-12",
        adultOccupancy: 2,
        childOccupancy: 1,
        infantOccupancy: 1,
        petOccupancy: 1,
        couponName: null,
        couponDiscount: null,
      }),
    });

    expect(
      JSON.parse(
        sessionStorage.getItem("airbob:reservation-checkout:7") ?? "{}",
      ),
    ).toEqual(
      expect.objectContaining({
        reservationUid: "res-123",
        customerEmail: "user@example.com",
      }),
    );
    expect(handleError).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isProcessingPayment).toBe(false);
  });

  it("surfaces reservation creation failures and does not navigate", async () => {
    const handleError = jest.fn();
    const clearError = jest.fn();
    const error = new Error("예약 생성 실패");
    jest.mocked(reservationApi.create).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useReservationPayment({
        clearError,
        handleError,
      }),
    );

    await act(async () => {
      await result.current.startReservationPayment(paymentOptions);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(clearError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith(error);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("ignores duplicate starts while reservation creation is in flight", async () => {
    const handleError = jest.fn();
    const clearError = jest.fn();
    const pendingReservation = createDeferred<typeof reservationResponse>();
    jest
      .mocked(reservationApi.create)
      .mockReturnValue(pendingReservation.promise);

    const { result } = renderHook(() =>
      useReservationPayment({
        clearError,
        handleError,
      }),
    );

    await act(async () => {
      void result.current.startReservationPayment(paymentOptions);
      void result.current.startReservationPayment(paymentOptions);
    });

    expect(reservationApi.create).toHaveBeenCalledTimes(1);
    expect(clearError).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingReservation.resolve(reservationResponse);
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(handleError).not.toHaveBeenCalled();
  });
});
