import { act, renderHook, waitFor } from "@testing-library/react";
import { reservationApi } from "../../../api";
import { useReservationPayment } from "./useReservationPayment";

jest.mock("../../../api", () => ({
  reservationApi: {
    create: jest.fn(),
  },
}));

describe("useReservationPayment", () => {
  const originalClientKey = process.env.REACT_APP_TOSS_CLIENT_KEY;
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
  };

  beforeEach(() => {
    jest.mocked(reservationApi.create).mockReset();
    process.env.REACT_APP_TOSS_CLIENT_KEY = "test_ck_123";
  });

  afterEach(() => {
    process.env.REACT_APP_TOSS_CLIENT_KEY = originalClientKey;
    delete (window as any).TossPayments;
    document
      .querySelectorAll('script[src="https://js.tosspayments.com/v1"]')
      .forEach((script) => script.remove());
  });

  it("creates a reservation and starts Toss payment with route-based URLs", async () => {
    const handleError = jest.fn();
    const clearError = jest.fn();
    const renderPaymentMethods = jest.fn().mockResolvedValue(undefined);
    const requestPayment = jest.fn();
    const widgets = jest.fn(() => ({ renderPaymentMethods }));
    (window as any).TossPayments = jest.fn(() => ({
      widgets,
      requestPayment,
    }));
    jest.mocked(reservationApi.create).mockResolvedValue(reservationResponse);

    const { result } = renderHook(() =>
      useReservationPayment({
        clearError,
        handleError,
      })
    );

    await act(async () => {
      await result.current.startReservationPayment(paymentOptions);
    });

    await waitFor(() => expect(requestPayment).toHaveBeenCalled());

    expect(reservationApi.create).toHaveBeenCalledWith({
      accommodation_id: 7,
      check_in_date: "2026-07-10",
      check_out_date: "2026-07-12",
      guest_count: 3,
    });
    expect(widgets).toHaveBeenCalledWith({ customerKey: "user@example.com" });
    expect(renderPaymentMethods).toHaveBeenCalledWith(
      "#payment-widget",
      { value: 200000 },
      { variantKey: "DEFAULT" }
    );
    expect(requestPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "res-123",
        successUrl: "http://localhost/reservations/res-123/success",
        failUrl: "http://localhost/reservations/res-123/fail",
        amount: 200000,
      })
    );
    expect(handleError).not.toHaveBeenCalled();
    expect(result.current.isProcessingPayment).toBe(true);
  });

  it("loads the Toss SDK through the shared adapter", async () => {
    const handleError = jest.fn();
    const clearError = jest.fn();
    const renderPaymentMethods = jest.fn().mockResolvedValue(undefined);
    const requestPayment = jest.fn();
    const widgets = jest.fn(() => ({ renderPaymentMethods }));
    (window as any).TossPayments = jest.fn(() => ({
      widgets,
      requestPayment,
    }));
    jest.mocked(reservationApi.create).mockResolvedValue(reservationResponse);

    const { result } = renderHook(() =>
      useReservationPayment({
        clearError,
        handleError,
      })
    );

    expect(
      document.querySelectorAll('script[src="https://js.tosspayments.com/v1"]')
    ).toHaveLength(1);

    await act(async () => {
      await result.current.startReservationPayment(paymentOptions);
    });

    await waitFor(() => expect(requestPayment).toHaveBeenCalled());
  });

  it("surfaces Toss setup failures and resets payment state", async () => {
    const handleError = jest.fn();
    const clearError = jest.fn();
    delete (window as any).TossPayments;
    jest.mocked(reservationApi.create).mockResolvedValue(reservationResponse);

    const { result } = renderHook(() =>
      useReservationPayment({
        clearError,
        handleError,
      })
    );

    await act(async () => {
      await result.current.startReservationPayment({
        accommodationId: 7,
        checkIn: new Date(2026, 6, 10),
        checkOut: new Date(2026, 6, 12),
        adultCount: 1,
        childCount: 0,
      });
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(handleError).toHaveBeenCalledWith(
      new Error("결제 시스템을 불러올 수 없습니다.")
    );
    expect(result.current.isProcessingPayment).toBe(false);
  });

  it("resets state and surfaces unexpected Toss payment request rejections", async () => {
    const handleError = jest.fn();
    const clearError = jest.fn();
    const renderPaymentMethods = jest.fn().mockResolvedValue(undefined);
    const requestPayment = jest.fn().mockRejectedValue(new Error("카드 승인 실패"));
    const widgets = jest.fn(() => ({ renderPaymentMethods }));
    (window as any).TossPayments = jest.fn(() => ({
      widgets,
      requestPayment,
    }));
    jest.mocked(reservationApi.create).mockResolvedValue(reservationResponse);

    const { result } = renderHook(() =>
      useReservationPayment({
        clearError,
        handleError,
      })
    );

    await act(async () => {
      await result.current.startReservationPayment(paymentOptions);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(handleError).toHaveBeenCalledWith(new Error("카드 승인 실패"));
    expect(result.current.isProcessingPayment).toBe(false);
  });

  it("resets state without showing an error when Toss payment is cancelled", async () => {
    const handleError = jest.fn();
    const clearError = jest.fn();
    const renderPaymentMethods = jest.fn().mockResolvedValue(undefined);
    const requestPayment = jest.fn().mockRejectedValue({
      code: "USER_CANCEL",
      message: "사용자가 결제를 취소했습니다.",
    });
    const widgets = jest.fn(() => ({ renderPaymentMethods }));
    (window as any).TossPayments = jest.fn(() => ({
      widgets,
      requestPayment,
    }));
    jest.mocked(reservationApi.create).mockResolvedValue(reservationResponse);

    const { result } = renderHook(() =>
      useReservationPayment({
        clearError,
        handleError,
      })
    );

    await act(async () => {
      await result.current.startReservationPayment(paymentOptions);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(handleError).not.toHaveBeenCalled();
    expect(result.current.isProcessingPayment).toBe(false);
  });
});
