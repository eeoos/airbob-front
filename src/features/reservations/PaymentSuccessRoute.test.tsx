import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import type { NavigateFunction } from "react-router-dom";
import { reservationQueryKeys } from "./queryKeys";
import { PaymentSuccessRoute } from "./PaymentSuccessRoute";
import type { usePaymentConfirmation } from "./hooks/usePaymentConfirmation";

const mockNavigate = jest.fn() as jest.MockedFunction<NavigateFunction>;
const mockUsePaymentConfirmation = jest.fn<
  ReturnType<typeof usePaymentConfirmation>,
  Parameters<typeof usePaymentConfirmation>
>();
const mockClearReservationCheckoutStateByReservationUid = jest.fn();
let searchParams = new URLSearchParams({
  amount: "120000",
  orderId: "reservation-123",
  paymentKey: "payment-key-1",
});

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
};

jest.mock("./hooks/usePaymentConfirmation", () => ({
  usePaymentConfirmation: (
    options: Parameters<typeof usePaymentConfirmation>[0],
  ) =>
    mockUsePaymentConfirmation(options),
}));

jest.mock("./lib/reservationCheckoutState", () => ({
  clearReservationCheckoutStateByReservationUid: (reservationUid: string) =>
    mockClearReservationCheckoutStateByReservationUid(reservationUid),
}));

describe("PaymentSuccessRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUsePaymentConfirmation.mockReset();
    mockClearReservationCheckoutStateByReservationUid.mockReset();
    searchParams = new URLSearchParams({
      amount: "120000",
      orderId: "reservation-123",
      paymentKey: "payment-key-1",
    });
  });

  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

  const renderRoute = (
    reservationUid = "reservation-123",
    queryClient = createQueryClient(),
  ) =>
    render(
      <QueryClientProvider client={queryClient}>
        <PaymentSuccessRoute
          navigate={mockNavigate}
          reservationUid={reservationUid}
          searchParams={searchParams}
        />
      </QueryClientProvider>,
    );

  const renderRouteWithoutReservationUid = () =>
    render(
      <QueryClientProvider client={createQueryClient()}>
        <PaymentSuccessRoute
          navigate={mockNavigate}
          reservationUid={undefined}
          searchParams={searchParams}
        />
      </QueryClientProvider>,
    );

  it("invalidates guest reservation caches after confirmed payment", async () => {
    searchParams = new URLSearchParams({
      amount: "120000",
      orderId: "reservation-1",
      paymentKey: "payment-key-1",
    });
    mockUsePaymentConfirmation.mockReturnValue({
      isProcessing: false,
      result: {
        error: null,
        status: "confirmed",
      },
    });
    const queryClient = createQueryClient();
    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    renderRoute("reservation-1", queryClient);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-1", {
        replace: true,
      }),
    );

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: reservationQueryKeys.guestReservationDetail("reservation-1"),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: reservationQueryKeys.guestReservationsRoot,
    });
  });

  it("waits for reservation cache invalidation before routing confirmed payment", async () => {
    searchParams = new URLSearchParams({
      amount: "120000",
      orderId: "reservation-1",
      paymentKey: "payment-key-1",
    });
    mockUsePaymentConfirmation.mockReturnValue({
      isProcessing: false,
      result: {
        error: null,
        status: "confirmed",
      },
    });
    const queryClient = createQueryClient();
    const invalidation = createDeferred();
    const invalidateQueriesSpy = jest
      .spyOn(queryClient, "invalidateQueries")
      .mockImplementation(() => invalidation.promise);

    renderRoute("reservation-1", queryClient);

    await waitFor(() => expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2));

    expect(mockNavigate).not.toHaveBeenCalled();

    await act(async () => {
      invalidation.resolve();
      await invalidation.promise;
    });

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-1", {
        replace: true,
      }),
    );
  });

  it("routes confirmed payment even if reservation cache invalidation fails", async () => {
    searchParams = new URLSearchParams({
      amount: "120000",
      orderId: "reservation-1",
      paymentKey: "payment-key-1",
    });
    mockUsePaymentConfirmation.mockReturnValue({
      isProcessing: false,
      result: {
        error: null,
        status: "confirmed",
      },
    });
    const queryClient = createQueryClient();
    const invalidateQueriesSpy = jest
      .spyOn(queryClient, "invalidateQueries")
      .mockRejectedValue(new Error("invalidate failed"));

    renderRoute("reservation-1", queryClient);

    await waitFor(() => expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-1", {
        replace: true,
      }),
    );
  });

  it("routes confirmed payment confirmation to the reservation detail page", async () => {
    mockUsePaymentConfirmation.mockReturnValue({
      isProcessing: false,
      result: {
        error: null,
        status: "confirmed",
      },
    });

    renderRoute();

    expect(mockUsePaymentConfirmation).toHaveBeenCalledWith({
      amount: "120000",
      enabled: true,
      orderId: "reservation-123",
      paymentKey: "payment-key-1",
    });

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-123", {
        replace: true,
      }),
    );
    expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
      "reservation-123",
    );
  });

  it("routes confirmed payment confirmation even if checkout cleanup throws", async () => {
    mockClearReservationCheckoutStateByReservationUid.mockImplementation(() => {
      throw new Error("cleanup failed");
    });
    mockUsePaymentConfirmation.mockReturnValue({
      isProcessing: false,
      result: {
        error: null,
        status: "confirmed",
      },
    });

    renderRoute();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-123", {
        replace: true,
      }),
    );
    expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
      "reservation-123",
    );
  });

  it("routes malformed payment confirmation results to the invalid callback failure page", async () => {
    searchParams = new URLSearchParams({
      amount: "120000x",
      orderId: "reservation-123",
      paymentKey: "payment-key-1",
    });
    mockUsePaymentConfirmation.mockReturnValue({
      isProcessing: false,
      result: {
        error: null,
        status: "invalid",
      },
    });

    renderRoute();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail?reason=invalid-callback",
        { replace: true },
      ),
    );
    expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
      "reservation-123",
    );
  });

  it("preserves checkout state and routes retryable confirmation failures to the confirm failed page", async () => {
    mockUsePaymentConfirmation.mockReturnValue({
      isProcessing: false,
      result: {
        error: new Error("confirm failed"),
        retryable: true,
        status: "failed",
      },
    });

    renderRoute();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail?reason=confirm-failed",
        { replace: true },
      ),
    );
    expect(mockClearReservationCheckoutStateByReservationUid).not.toHaveBeenCalled();
  });

  it("clears checkout state and routes non-retryable confirmation failures to the confirm failed page", async () => {
    mockUsePaymentConfirmation.mockReturnValue({
      isProcessing: false,
      result: {
        error: new Error("confirm failed"),
        retryable: false,
        status: "failed",
      },
    });

    renderRoute();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail?reason=confirm-failed",
        { replace: true },
      ),
    );
    expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
      "reservation-123",
    );
  });

  it("routes skipped payment confirmation to the invalid callback failure page", async () => {
    mockUsePaymentConfirmation.mockReturnValue({
      isProcessing: false,
      result: {
        error: null,
        status: "skipped",
      },
    });

    renderRoute();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail?reason=invalid-callback",
        { replace: true },
      ),
    );
    expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
      "reservation-123",
    );
  });

  it("disables confirmation and routes to failure when Toss success query is incomplete", async () => {
    searchParams = new URLSearchParams({
      amount: "120000",
      orderId: "order-1",
    });
    mockUsePaymentConfirmation.mockReturnValue({
      isProcessing: false,
      result: null,
    });

    renderRoute();

    expect(mockUsePaymentConfirmation).toHaveBeenCalledWith({
      amount: null,
      enabled: false,
      orderId: null,
      paymentKey: null,
    });

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail?reason=invalid-callback",
        { replace: true },
      ),
    );
    expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
      "reservation-123",
    );
  });

  it("disables confirmation and routes to failure when Toss orderId mismatches the route reservationUid", async () => {
    searchParams = new URLSearchParams({
      amount: "120000",
      orderId: "other-reservation",
      paymentKey: "payment-key-1",
    });
    mockUsePaymentConfirmation.mockReturnValue({
      isProcessing: false,
      result: null,
    });

    renderRoute();

    expect(mockUsePaymentConfirmation).toHaveBeenCalledWith({
      amount: null,
      enabled: false,
      orderId: null,
      paymentKey: null,
    });

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123/fail?reason=invalid-callback",
        { replace: true },
      ),
    );
    expect(mockClearReservationCheckoutStateByReservationUid).toHaveBeenCalledWith(
      "reservation-123",
    );
  });

  it("routes missing reservationUid to profile with replacement history", async () => {
    mockUsePaymentConfirmation.mockReturnValue({
      isProcessing: false,
      result: null,
    });

    renderRouteWithoutReservationUid();

    expect(mockUsePaymentConfirmation).toHaveBeenCalledWith({
      amount: null,
      enabled: false,
      orderId: null,
      paymentKey: null,
    });

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/profile", {
        replace: true,
      }),
    );
    expect(mockClearReservationCheckoutStateByReservationUid).not.toHaveBeenCalled();
  });
});
